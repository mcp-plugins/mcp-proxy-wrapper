/**
 * @file WebSocket Transport Adapter
 * @version 2.0.0
 * @status STABLE - WebSocket transport with reconnection and heartbeat
 * 
 * Implements WebSocket transport adapter for MCP servers that communicate over
 * WebSocket connections. Includes comprehensive connection management, automatic
 * reconnection, heartbeat monitoring, and message framing.
 */

import WebSocket from 'ws';
import { EventEmitter } from 'events';
import { 
  IConnection, 
  IConnectionAdapter, 
  ConnectionState, 
  ConnectionStats,
  WebSocketTransportConfig,
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
 * WebSocket connection implementation
 */
export class WebSocketConnection extends EventEmitter implements IConnection {
  public readonly id: string;
  public readonly transport = 'websocket' as const;
  
  private _state: ConnectionState = ConnectionState.DISCONNECTED;
  private webSocket: WebSocket | null = null;
  private messageParser = new StreamingMessageParser();
  private stats: ConnectionStats;
  private messageHandlers: ((message: JsonRpcMessage) => void)[] = [];
  private stateChangeHandlers: ((state: ConnectionState) => void)[] = [];
  private errorHandlers: ((error: Error) => void)[] = [];
  private heartbeatInterval?: NodeJS.Timeout;
  private reconnectTimeout?: NodeJS.Timeout;
  private reconnectAttempts = 0;
  private lastPong = Date.now();
  private logger = createLogger({ level: 'info', prefix: 'WEBSOCKET-CONNECTION' });
  
  constructor(
    private config: WebSocketTransportConfig,
    connectionId?: string
  ) {
    super();
    
    this.id = connectionId || `ws_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    this.logger = createLogger({
      level: this.config.debug ? 'debug' : 'info',
      prefix: `WEBSOCKET-CONNECTION:${this.id.substring(0, 8)}`
    });
    
    this.stats = {
      messagesSent: 0,
      messagesReceived: 0,
      bytesSent: 0,
      bytesReceived: 0,
      reconnectAttempts: 0,
      metadata: {
        url: this.config.url,
        protocols: this.config.protocols,
        readyState: null
      }
    };
    
    this.logger.debug('WebSocket connection created', {
      id: this.id,
      url: this.config.url,
      protocols: this.config.protocols
    });
  }
  
  /**
   * Current connection state
   */
  get state(): ConnectionState {
    return this._state;
  }
  
  /**
   * Connect to the WebSocket server
   */
  async connect(): Promise<void> {
    if (this._state !== ConnectionState.DISCONNECTED) {
      throw new ConnectionError(
        `Cannot connect from state: ${this._state}`,
        'INVALID_STATE',
        'websocket'
      );
    }
    
    this.setState(ConnectionState.CONNECTING);
    
    return new Promise((resolve, reject) => {
      try {
        // Create WebSocket connection
        const wsOptions: WebSocket.ClientOptions = {
          headers: this.config.headers,
          origin: this.config.options?.origin,
          perMessageDeflate: this.config.options?.perMessageDeflate !== false,
          maxPayload: this.config.options?.maxPayload || this.config.maxPayloadSize || 16 * 1024 * 1024,
          handshakeTimeout: this.config.timeout || 30000
        };
        
        this.webSocket = new WebSocket(this.config.url, this.config.protocols, wsOptions);
        
        // Set up connection event handlers
        const onOpen = () => {
          this.webSocket!.removeListener('error', onError);
          this.setState(ConnectionState.CONNECTED);
          this.stats.connectedAt = new Date();
          this.lastPong = Date.now();
          
          // Start heartbeat if configured
          if (this.config.options?.heartbeatInterval) {
            this.startHeartbeat();
          }
          
          this.logger.info('WebSocket connected', {
            url: this.config.url,
            protocols: this.webSocket!.protocol
          });
          
          resolve();
        };
        
        const onError = (error: Error) => {
          this.webSocket!.removeListener('open', onOpen);
          this.setState(ConnectionState.ERROR);
          reject(new TransportError(
            `Failed to connect to WebSocket: ${error.message}`,
            'websocket',
            error
          ));
        };
        
        this.webSocket.once('open', onOpen);
        this.webSocket.once('error', onError);
        
        // Set up ongoing event handlers
        this.setupWebSocketHandlers();
        
      } catch (error) {
        this.setState(ConnectionState.ERROR);
        reject(new TransportError(
          `Failed to create WebSocket connection: ${error instanceof Error ? error.message : String(error)}`,
          'websocket',
          error instanceof Error ? error : undefined
        ));
      }
    });
  }
  
  /**
   * Send a JSON-RPC message to the server
   */
  async send(message: JsonRpcMessage): Promise<void> {
    if (!this.isConnected()) {
      throw new ConnectionError(
        `Cannot send message in state: ${this._state}`,
        'NOT_CONNECTED',
        'websocket'
      );
    }
    
    if (!this.webSocket) {
      throw new TransportError('WebSocket not available', 'websocket');
    }
    
    try {
      // Serialize message to JSON (WebSocket handles framing)
      const jsonString = JSON.stringify(message);
      const messageBuffer = Buffer.from(jsonString, 'utf8');
      
      // Check payload size
      const maxPayload = this.config.options?.maxPayload || this.config.maxPayloadSize || 16 * 1024 * 1024;
      if (messageBuffer.length > maxPayload) {
        throw new Error(`Message size ${messageBuffer.length} exceeds maximum payload size ${maxPayload}`);
      }
      
      // Send message
      await new Promise<void>((resolve, reject) => {
        this.webSocket!.send(jsonString, (error: any) => {
          if (error) {
            reject(new TransportError(
              `Failed to send WebSocket message: ${error.message}`,
              'websocket',
              error
            ));
          } else {
            resolve();
          }
        });
      });
      
      // Update statistics
      this.stats.messagesSent++;
      this.stats.bytesSent += messageBuffer.length;
      
      this.logger.debug('Message sent', {
        method: message.method,
        id: message.id,
        size: messageBuffer.length
      });
      
    } catch (error) {
      this.logger.error('Failed to send message:', error);
      throw error instanceof TransportError ? error : new TransportError(
        `Failed to send message: ${error instanceof Error ? error.message : String(error)}`,
        'websocket',
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
      // Stop heartbeat
      if (this.heartbeatInterval) {
        clearInterval(this.heartbeatInterval);
        this.heartbeatInterval = undefined;
      }
      
      // Cancel reconnect timeout
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = undefined;
      }
      
      // Close WebSocket connection
      if (this.webSocket) {
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(() => {
            // Force close if graceful close doesn't work
            if (this.webSocket && this.webSocket.readyState !== WebSocket.CLOSED) {
              this.webSocket.terminate();
            }
            resolve();
          }, 5000);
          
          this.webSocket!.once('close', () => {
            clearTimeout(timeout);
            resolve();
          });
          
          // Initiate graceful close
          if (this.webSocket!.readyState === WebSocket.OPEN) {
            this.webSocket!.close(1000, 'Normal closure');
          } else {
            resolve();
          }
        });
      }
      
      // Clear message parser
      this.messageParser.clear();
      
      this.setState(ConnectionState.CLOSED);
      this.logger.info('WebSocket connection closed');
      
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
           this.webSocket !== null && 
           this.webSocket.readyState === WebSocket.OPEN;
  }
  
  /**
   * Get connection statistics
   */
  getStats(): ConnectionStats {
    return {
      ...this.stats,
      metadata: {
        ...this.stats.metadata,
        readyState: this.webSocket?.readyState ?? null,
        protocol: this.webSocket?.protocol ?? null,
        extensions: this.webSocket?.extensions ?? null,
        lastPong: this.lastPong,
        reconnectAttempts: this.reconnectAttempts
      }
    };
  }
  
  /**
   * Set up WebSocket event handlers
   */
  private setupWebSocketHandlers(): void {
    if (!this.webSocket) return;
    
    // Handle incoming messages
    this.webSocket.on('message', (data: WebSocket.RawData) => {
      try {
        let jsonString: string;
        
        // Handle different data types
        if (Buffer.isBuffer(data)) {
          jsonString = data.toString('utf8');
        } else if (data instanceof ArrayBuffer) {
          jsonString = Buffer.from(data).toString('utf8');
        } else if (Array.isArray(data)) {
          jsonString = Buffer.concat(data).toString('utf8');
        } else {
          jsonString = String(data);
        }
        
        this.stats.bytesReceived += Buffer.byteLength(jsonString, 'utf8');
        
        // Parse JSON message
        const message = MessageFramer.parseMessage(jsonString);
        this.stats.messagesReceived++;
        
        this.logger.debug('Message received', {
          method: message.method,
          id: message.id,
          size: jsonString.length
        });
        
        // Notify handlers
        for (const handler of this.messageHandlers) {
          try {
            handler(message);
          } catch (error) {
            this.logger.error('Error in message handler:', error);
          }
        }
        
      } catch (error) {
        this.logger.error('Error processing WebSocket message:', error);
        this.emitError(new ProtocolError(
          `Failed to process message: ${error instanceof Error ? error.message : String(error)}`,
          'websocket'
        ));
      }
    });
    
    // Handle connection close
    this.webSocket.on('close', (code: number, reason: Buffer) => {
      const reasonString = reason.toString();
      this.logger.info('WebSocket closed', { code, reason: reasonString });
      
      if (this._state === ConnectionState.CLOSING) {
        // Expected close
        return;
      }
      
      // Unexpected close - attempt reconnection if configured
      if (this.config.retry?.maxAttempts && this.reconnectAttempts < this.config.retry.maxAttempts) {
        this.attemptReconnection();
      } else {
        this.setState(ConnectionState.ERROR);
        this.emitError(new TransportError(
          `WebSocket connection closed unexpectedly (code: ${code}, reason: ${reasonString})`,
          'websocket'
        ));
      }
    });
    
    // Handle WebSocket errors
    this.webSocket.on('error', (error: Error) => {
      this.logger.error('WebSocket error:', error);
      
      if (this._state === ConnectionState.CONNECTING) {
        // Error during connection - will be handled by connect promise
        return;
      }
      
      this.setState(ConnectionState.ERROR);
      this.emitError(new TransportError(
        `WebSocket error: ${error.message}`,
        'websocket',
        error
      ));
    });
    
    // Handle pong responses (for heartbeat)
    this.webSocket.on('pong', () => {
      this.lastPong = Date.now();
      this.logger.debug('Received pong');
    });
  }
  
  /**
   * Start heartbeat monitoring
   */
  private startHeartbeat(): void {
    if (this.heartbeatInterval) return;
    
    const interval = this.config.options?.heartbeatInterval || 30000;
    
    this.heartbeatInterval = setInterval(() => {
      if (!this.isConnected()) {
        return;
      }
      
      // Check if we've received a pong recently
      const timeSinceLastPong = Date.now() - this.lastPong;
      if (timeSinceLastPong > interval * 2) {
        this.logger.warn('Heartbeat timeout - connection may be stale');
        this.emitError(new TransportError('Heartbeat timeout', 'websocket'));
        return;
      }
      
      // Send ping
      try {
        this.webSocket!.ping();
        this.logger.debug('Sent ping');
      } catch (error) {
        this.logger.error('Failed to send ping:', error);
      }
    }, interval);
  }
  
  /**
   * Attempt to reconnect after unexpected disconnection
   */
  private async attemptReconnection(): Promise<void> {
    if (this._state === ConnectionState.CLOSING || this._state === ConnectionState.CLOSED) {
      return;
    }
    
    this.reconnectAttempts++;
    this.stats.reconnectAttempts++;
    
    const maxAttempts = this.config.retry?.maxAttempts || 5;
    this.logger.info(`Attempting reconnection (${this.reconnectAttempts}/${maxAttempts})`);
    
    this.setState(ConnectionState.RECONNECTING);
    
    // Calculate backoff delay
    const backoff = this.config.retry?.backoff || 'exponential';
    const baseDelay = this.config.retry?.baseDelay || 1000;
    const maxDelay = this.config.retry?.maxDelay || 30000;
    
    let delay = baseDelay;
    if (backoff === 'exponential') {
      delay = Math.min(baseDelay * Math.pow(2, this.reconnectAttempts - 1), maxDelay);
    } else if (backoff === 'linear') {
      delay = Math.min(baseDelay * this.reconnectAttempts, maxDelay);
    }
    
    // Add jitter if configured
    if (this.config.retry?.jitter) {
      delay += Math.random() * 1000;
    }
    
    this.reconnectTimeout = setTimeout(async () => {
      try {
        // Clean up old connection
        if (this.webSocket) {
          this.webSocket.removeAllListeners();
          if (this.webSocket.readyState === WebSocket.OPEN) {
            this.webSocket.close();
          }
          this.webSocket = null;
        }
        
        this.messageParser.clear();
        
        // Attempt new connection
        this.setState(ConnectionState.CONNECTING);
        await this.connect();
        
        this.logger.info('Reconnection successful', {
          attempts: this.reconnectAttempts
        });
        
        // Reset reconnect counter on successful reconnection
        this.reconnectAttempts = 0;
        
      } catch (error) {
        this.logger.error(`Reconnection attempt ${this.reconnectAttempts} failed:`, error);
        
        if (this.reconnectAttempts < maxAttempts) {
          // Try again
          this.attemptReconnection();
        } else {
          // Max attempts reached
          this.setState(ConnectionState.ERROR);
          this.emitError(new TransportError(
            `Failed to reconnect after ${maxAttempts} attempts`,
            'websocket',
            error instanceof Error ? error : undefined
          ));
        }
      }
    }, delay);
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
 * WebSocket transport adapter
 */
export class WebSocketAdapter implements IConnectionAdapter {
  private logger = createLogger({ level: 'info', prefix: 'WEBSOCKET-ADAPTER' });
  
  /**
   * Create a new WebSocket connection
   */
  async connect(config: TransportConfig): Promise<IConnection> {
    if (config.transport !== 'websocket') {
      throw new Error(`Invalid transport type: ${config.transport}. Expected 'websocket'`);
    }
    
    const wsConfig = config as WebSocketTransportConfig;
    this.logger.debug('Creating WebSocket connection', {
      url: wsConfig.url,
      protocols: wsConfig.protocols
    });
    
    const connection = new WebSocketConnection(wsConfig);
    await connection.connect();
    
    return connection;
  }
  
  /**
   * Probe if this adapter can handle the configuration
   */
  async probe(config: TransportConfig): Promise<boolean> {
    if (config.transport !== 'websocket') {
      return false;
    }
    
    const wsConfig = config as WebSocketTransportConfig;
    
    // Basic validation
    if (!wsConfig.url) {
      return false;
    }
    
    // Check if URL is a valid WebSocket URL
    try {
      const url = new URL(wsConfig.url);
      return url.protocol === 'ws:' || url.protocol === 'wss:';
    } catch {
      return false;
    }
  }
  
  /**
   * Get adapter metadata
   */
  getMetadata(): AdapterMetadata {
    return {
      name: 'websocket-adapter',
      transport: 'websocket',
      version: '2.0.0',
      capabilities: {
        autoReconnect: true,
        healthCheck: true,
        binaryData: true,
        streaming: true
      }
    };
  }
}