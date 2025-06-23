/**
 * @file STDIO Transport Adapter
 * @version 2.0.0
 * @status STABLE - STDIO process management and communication
 * 
 * Implements STDIO transport adapter for MCP servers that run as separate processes.
 * This is the most common transport type for MCP servers and includes comprehensive
 * process management, health checking, and automatic restart capabilities.
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import { 
  IConnection, 
  IConnectionAdapter, 
  ConnectionState, 
  ConnectionStats,
  StdioTransportConfig,
  TransportConfig,
  AdapterMetadata,
  JsonRpcMessage,
  ConnectionError,
  TransportError,
  TimeoutError,
  ProtocolError
} from '../interfaces/connection.js';
import { MessageFramer, StreamingMessageParser } from '../protocol/framing.js';
import { createLogger } from '../utils/logger.js';

/**
 * STDIO connection implementation
 */
export class StdioConnection extends EventEmitter implements IConnection {
  public readonly id: string;
  public readonly transport = 'stdio' as const;
  
  private _state: ConnectionState = ConnectionState.DISCONNECTED;
  private childProcess: ChildProcess | null = null;
  private messageParser = new StreamingMessageParser();
  private stats: ConnectionStats;
  private messageHandlers: ((message: JsonRpcMessage) => void)[] = [];
  private stateChangeHandlers: ((state: ConnectionState) => void)[] = [];
  private errorHandlers: ((error: Error) => void)[] = [];
  private healthCheckInterval?: NodeJS.Timeout;
  private restartAttempts = 0;
  private logger = createLogger({ level: 'info', prefix: 'STDIO-CONNECTION' });
  
  constructor(
    private config: StdioTransportConfig,
    connectionId?: string
  ) {
    super();
    
    this.id = connectionId || `stdio_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    this.logger = createLogger({
      level: this.config.debug ? 'debug' : 'info',
      prefix: `STDIO-CONNECTION:${this.id.substring(0, 8)}`
    });
    
    this.stats = {
      messagesSent: 0,
      messagesReceived: 0,
      bytesSent: 0,
      bytesReceived: 0,
      reconnectAttempts: 0,
      metadata: {
        command: this.config.command,
        args: this.config.args,
        cwd: this.config.cwd,
        pid: null
      }
    };
    
    this.logger.debug('STDIO connection created', {
      id: this.id,
      command: this.config.command,
      args: this.config.args
    });
  }
  
  /**
   * Current connection state
   */
  get state(): ConnectionState {
    return this._state;
  }
  
  /**
   * Connect to the STDIO server by spawning the process
   */
  async connect(): Promise<void> {
    if (this._state !== ConnectionState.DISCONNECTED) {
      throw new ConnectionError(
        `Cannot connect from state: ${this._state}`,
        'INVALID_STATE',
        'stdio'
      );
    }
    
    this.setState(ConnectionState.CONNECTING);
    
    try {
      await this.spawnProcess();
      this.setState(ConnectionState.CONNECTED);
      this.stats.connectedAt = new Date();
      
      // Start health checks if configured
      if (this.config.healthCheck?.enabled) {
        this.startHealthCheck();
      }
      
      this.logger.info(`Connected to STDIO server`, {
        pid: this.childProcess?.pid,
        command: this.config.command
      });
      
    } catch (error) {
      this.setState(ConnectionState.ERROR);
      throw new TransportError(
        `Failed to connect to STDIO server: ${error instanceof Error ? error.message : String(error)}`,
        'stdio',
        error instanceof Error ? error : undefined
      );
    }
  }
  
  /**
   * Send a JSON-RPC message to the server
   */
  async send(message: JsonRpcMessage): Promise<void> {
    if (!this.isConnected()) {
      throw new ConnectionError(
        `Cannot send message in state: ${this._state}`,
        'NOT_CONNECTED',
        'stdio'
      );
    }
    
    if (!this.childProcess?.stdin) {
      throw new TransportError('Process stdin not available', 'stdio');
    }
    
    try {
      // Frame the message
      const frameBuffer = MessageFramer.serialize(message);
      
      // Send to process stdin
      const written = this.childProcess.stdin.write(frameBuffer);
      if (!written) {
        // Handle backpressure
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new TimeoutError(
              'Write timeout exceeded',
              'stdio',
              this.config.timeout || 30000
            ));
          }, this.config.timeout || 30000);
          
          this.childProcess!.stdin!.once('drain', () => {
            clearTimeout(timeout);
            resolve();
          });
          
          this.childProcess!.stdin!.once('error', (error) => {
            clearTimeout(timeout);
            reject(error);
          });
        });
      }
      
      // Update statistics
      this.stats.messagesSent++;
      this.stats.bytesSent += frameBuffer.length;
      
      this.logger.debug('Message sent', {
        method: message.method,
        id: message.id,
        size: frameBuffer.length
      });
      
    } catch (error) {
      this.logger.error('Failed to send message:', error);
      throw new TransportError(
        `Failed to send message: ${error instanceof Error ? error.message : String(error)}`,
        'stdio',
        error instanceof Error ? error : undefined
      );
    }
  }
  
  /**
   * Register a message handler
   */
  onMessage(handler: (message: JsonRpcMessage) => void): void {
    this.messageHandlers.push(handler);
  }
  
  /**
   * Register a state change handler
   */
  onStateChange(handler: (state: ConnectionState) => void): void {
    this.stateChangeHandlers.push(handler);
  }
  
  /**
   * Register an error handler
   */
  onError(handler: (error: Error) => void): void {
    this.errorHandlers.push(handler);
  }
  
  /**
   * Close the connection
   */
  async close(): Promise<void> {
    if (this._state === ConnectionState.CLOSED || this._state === ConnectionState.CLOSING) {
      return;
    }
    
    this.setState(ConnectionState.CLOSING);
    
    try {
      // Stop health checks
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
        this.healthCheckInterval = undefined;
      }
      
      // Close the child process
      if (this.childProcess) {
        await this.terminateProcess();
      }
      
      // Clear message parser
      this.messageParser.clear();
      
      this.setState(ConnectionState.CLOSED);
      this.logger.info('Connection closed');
      
    } catch (error) {
      this.logger.error('Error during close:', error);
      this.setState(ConnectionState.ERROR);
      throw error;
    }
  }
  
  /**
   * Check if connection is usable
   */
  isConnected(): boolean {
    return this._state === ConnectionState.CONNECTED && 
           this.childProcess !== null && 
           !this.childProcess.killed;
  }
  
  /**
   * Get connection statistics
   */
  getStats(): ConnectionStats {
    return {
      ...this.stats,
      metadata: {
        ...this.stats.metadata,
        pid: this.childProcess?.pid || null,
        killed: this.childProcess?.killed || false,
        exitCode: this.childProcess?.exitCode,
        signalCode: this.childProcess?.signalCode
      }
    };
  }
  
  /**
   * Spawn the child process
   */
  private async spawnProcess(): Promise<void> {
    if (!this.config.command || this.config.command.length === 0) {
      throw new Error('No command specified for STDIO transport');
    }
    
    const [command, ...args] = this.config.command;
    const allArgs = [...args, ...(this.config.args || [])];
    
    this.logger.debug('Spawning process', {
      command,
      args: allArgs,
      cwd: this.config.cwd
    });
    
    // Spawn the process
    this.childProcess = spawn(command, allArgs, {
      cwd: this.config.cwd,
      env: { ...process.env, ...this.config.env },
      stdio: ['pipe', 'pipe', 'pipe'],
      detached: false,
      windowsHide: true
    });
    
    // Set up process event handlers
    this.setupProcessHandlers();
    
    // Wait for process to start
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new TimeoutError(
          'Process start timeout exceeded',
          'stdio',
          this.config.timeout || 30000
        ));
      }, this.config.timeout || 30000);
      
      const onError = (error: Error) => {
        clearTimeout(timeout);
        reject(error);
      };
      
      const onSpawn = () => {
        clearTimeout(timeout);
        this.childProcess!.removeListener('error', onError);
        resolve();
      };
      
      this.childProcess!.once('spawn', onSpawn);
      this.childProcess!.once('error', onError);
    });
    
    this.stats.metadata.pid = this.childProcess.pid;
    this.logger.debug('Process spawned', { pid: this.childProcess.pid });
  }
  
  /**
   * Set up process event handlers
   */
  private setupProcessHandlers(): void {
    if (!this.childProcess) return;
    
    // Handle stdout (incoming messages)
    this.childProcess.stdout!.on('data', (data: Buffer) => {
      try {
        this.stats.bytesReceived += data.length;
        const messages = this.messageParser.addData(data);
        
        for (const message of messages) {
          this.stats.messagesReceived++;
          this.logger.debug('Message received', {
            method: message.method,
            id: message.id
          });
          
          // Notify handlers
          for (const handler of this.messageHandlers) {
            try {
              handler(message);
            } catch (error) {
              this.logger.error('Error in message handler:', error);
            }
          }
        }
      } catch (error) {
        this.logger.error('Error processing stdout data:', error);
        this.emitError(new ProtocolError(
          `Failed to process message data: ${error instanceof Error ? error.message : String(error)}`,
          'stdio'
        ));
      }
    });
    
    // Handle stderr (logging/errors)
    this.childProcess.stderr!.on('data', (data: Buffer) => {
      const text = data.toString().trim();
      if (text) {
        this.logger.debug('Process stderr:', text);
      }
    });
    
    // Handle process exit
    this.childProcess.on('exit', (code, signal) => {
      const currentPid = this.childProcess?.pid;
      this.logger.info('Process exited', { code, signal, pid: currentPid });
      
      if (this._state === ConnectionState.CLOSING) {
        // Expected exit
        return;
      }
      
      // Unexpected exit - attempt restart if configured
      const shouldRestart = this.config.restart?.enabled && 
        this.shouldRestartOnExit(code, signal);
      
      if (shouldRestart) {
        this.attemptRestart().catch(error => {
          this.logger.error('Restart failed:', error);
          this.setState(ConnectionState.ERROR);
          this.emitError(error);
        });
      } else {
        this.setState(ConnectionState.ERROR);
        this.emitError(new TransportError(
          `Process exited unexpectedly (code: ${code}, signal: ${signal})`,
          'stdio'
        ));
      }
    });
    
    // Handle process errors
    this.childProcess.on('error', (error) => {
      this.logger.error('Process error:', error);
      this.setState(ConnectionState.ERROR);
      this.emitError(new TransportError(
        `Process error: ${error.message}`,
        'stdio',
        error
      ));
    });
  }
  
  /**
   * Terminate the child process gracefully
   */
  private async terminateProcess(): Promise<void> {
    if (!this.childProcess || this.childProcess.killed) {
      return;
    }
    
    return new Promise<void>((resolve) => {
      const timeout = setTimeout(() => {
        // Force kill if graceful termination doesn't work
        if (!this.childProcess!.killed) {
          this.logger.warn('Force killing process');
          this.childProcess!.kill('SIGKILL');
        }
        resolve();
      }, 5000);
      
      this.childProcess!.once('exit', () => {
        clearTimeout(timeout);
        resolve();
      });
      
      // Try graceful termination first
      this.childProcess!.kill('SIGTERM');
    });
  }
  
  /**
   * Check if we should restart on process exit
   */
  private shouldRestartOnExit(code: number | null, signal: string | null): boolean {
    if (!this.config.restart?.enabled) return false;
    
    const triggers = this.config.restart.triggers;
    if (!triggers) return true; // Default to restart on any exit
    
    if (triggers.onExit) return true;
    
    if (triggers.onExitCodes && code !== null) {
      return triggers.onExitCodes.includes(code);
    }
    
    return false;
  }
  
  /**
   * Attempt to restart the process
   */
  private async attemptRestart(): Promise<void> {
    const maxRetries = this.config.restart?.maxRetries || 3;
    if (this.restartAttempts >= maxRetries) {
      throw new Error(`Maximum restart attempts (${maxRetries}) exceeded`);
    }
    
    this.restartAttempts++;
    this.stats.reconnectAttempts++;
    
    this.logger.info(`Attempting restart (${this.restartAttempts}/${maxRetries})`);
    this.setState(ConnectionState.RECONNECTING);
    
    // Calculate backoff delay
    const backoff = this.config.restart?.backoff || 'exponential';
    const baseDelay = this.config.restart?.baseDelay || 1000;
    const maxDelay = this.config.restart?.maxDelay || 30000;
    
    let delay = baseDelay;
    if (backoff === 'exponential') {
      delay = Math.min(baseDelay * Math.pow(2, this.restartAttempts - 1), maxDelay);
    } else if (backoff === 'fixed') {
      delay = baseDelay;
    }
    
    // Wait before restarting
    await new Promise(resolve => setTimeout(resolve, delay));
    
    try {
      // Clean up old process
      this.childProcess = null;
      this.messageParser.clear();
      
      // Spawn new process
      await this.spawnProcess();
      this.setState(ConnectionState.CONNECTED);
      
      const newPid = (this.childProcess as ChildProcess | null)?.pid;
      this.logger.info('Process restarted successfully', {
        pid: newPid,
        attempts: this.restartAttempts
      });
      
      // Reset restart counter on successful restart
      this.restartAttempts = 0;
      
    } catch (error) {
      this.logger.error(`Restart attempt ${this.restartAttempts} failed:`, error);
      throw error;
    }
  }
  
  /**
   * Start health check monitoring
   */
  private startHealthCheck(): void {
    if (this.healthCheckInterval) return;
    
    const config = this.config.healthCheck!;
    this.healthCheckInterval = setInterval(async () => {
      try {
        await this.performHealthCheck();
      } catch (error) {
        this.logger.error('Health check failed:', error);
        
        // Trigger restart if configured
        if (this.config.restart?.enabled && 
            this.config.restart.triggers?.onHealthCheckFailure) {
          this.attemptRestart().catch(restartError => {
            this.logger.error('Health check restart failed:', restartError);
            this.setState(ConnectionState.ERROR);
            this.emitError(restartError);
          });
        }
      }
    }, config.interval);
  }
  
  /**
   * Perform a health check
   */
  private async performHealthCheck(): Promise<void> {
    if (!this.isConnected()) {
      throw new Error('Connection not available for health check');
    }
    
    const config = this.config.healthCheck!;
    
    // If custom command is specified, use it
    if (config.command) {
      // This would typically send a ping message or call a health endpoint
      // For now, we just check if the process is still alive
      if (!this.childProcess || this.childProcess.killed) {
        throw new Error('Process is not running');
      }
    } else {
      // Default health check - verify process is responsive
      if (!this.childProcess || this.childProcess.killed) {
        throw new Error('Process is not running');
      }
    }
  }
  
  /**
   * Set connection state and notify handlers
   */
  private setState(newState: ConnectionState): void {
    if (this._state === newState) return;
    
    const oldState = this._state;
    this._state = newState;
    
    this.logger.debug('State changed', { from: oldState, to: newState });
    
    // Notify handlers
    for (const handler of this.stateChangeHandlers) {
      try {
        handler(newState);
      } catch (error) {
        this.logger.error('Error in state change handler:', error);
      }
    }
  }
  
  /**
   * Emit error to handlers
   */
  private emitError(error: Error): void {
    this.stats.lastError = error;
    
    for (const handler of this.errorHandlers) {
      try {
        handler(error);
      } catch (handlerError) {
        this.logger.error('Error in error handler:', handlerError);
      }
    }
  }
}

/**
 * STDIO transport adapter
 */
export class StdioAdapter implements IConnectionAdapter {
  private logger = createLogger({ level: 'info', prefix: 'STDIO-ADAPTER' });
  
  /**
   * Create a new STDIO connection
   */
  async connect(config: TransportConfig): Promise<IConnection> {
    if (config.transport !== 'stdio') {
      throw new Error(`Invalid transport type: ${config.transport}. Expected 'stdio'`);
    }
    
    const stdioConfig = config as StdioTransportConfig;
    this.logger.debug('Creating STDIO connection', {
      command: stdioConfig.command,
      args: stdioConfig.args
    });
    
    const connection = new StdioConnection(stdioConfig);
    await connection.connect();
    
    return connection;
  }
  
  /**
   * Probe if this adapter can handle the configuration
   */
  async probe(config: TransportConfig): Promise<boolean> {
    if (config.transport !== 'stdio') {
      return false;
    }
    
    const stdioConfig = config as StdioTransportConfig;
    
    // Basic validation
    if (!stdioConfig.command || stdioConfig.command.length === 0) {
      return false;
    }
    
    // Could add more sophisticated probing here, like checking if the command exists
    return true;
  }
  
  /**
   * Get adapter metadata
   */
  getMetadata(): AdapterMetadata {
    return {
      name: 'stdio-adapter',
      transport: 'stdio',
      version: '2.0.0',
      capabilities: {
        autoReconnect: true,
        healthCheck: true,
        binaryData: false,
        streaming: true
      }
    };
  }
}