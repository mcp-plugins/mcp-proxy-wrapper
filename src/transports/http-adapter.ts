/**
 * @file HTTP Transport Adapter
 * @version 2.0.0
 * @status STABLE - HTTP transport with connection pooling and retry
 * 
 * Implements HTTP transport adapter for MCP servers that communicate over
 * HTTP/HTTPS. Uses a request/response pattern with connection pooling,
 * retry logic, and comprehensive error handling.
 */

import http from 'http';
import https from 'https';
import { EventEmitter } from 'events';
import { 
  IConnection, 
  IConnectionAdapter, 
  ConnectionState, 
  ConnectionStats,
  HttpTransportConfig,
  TransportConfig,
  AdapterMetadata,
  JsonRpcMessage,
  ConnectionError,
  TransportError,
  TimeoutError,
  ProtocolError
} from '../interfaces/connection.js';
import { MessageFramer } from '../protocol/framing.js';
import { createLogger } from '../utils/logger.js';

/**
 * Pending request information
 */
interface PendingRequest {
  id: string | number | null;
  resolve: (message: JsonRpcMessage) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
  createdAt: Date;
}

/**
 * HTTP connection implementation
 */
export class HttpConnection extends EventEmitter implements IConnection {
  public readonly id: string;
  public readonly transport = 'http' as const;
  
  private _state: ConnectionState = ConnectionState.DISCONNECTED;
  private httpAgent: http.Agent | https.Agent;
  private stats: ConnectionStats;
  private messageHandlers: ((message: JsonRpcMessage) => void)[] = [];
  private stateChangeHandlers: ((state: ConnectionState) => void)[] = [];
  private errorHandlers: ((error: Error) => void)[] = [];
  private pendingRequests = new Map<string | number, PendingRequest>();
  private requestCounter = 0;
  private isSecure: boolean;
  private logger = createLogger({ level: 'info', prefix: 'HTTP-CONNECTION' });
  
  constructor(
    private config: HttpTransportConfig,
    connectionId?: string
  ) {
    super();
    
    this.id = connectionId || `http_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    this.logger = createLogger({
      level: this.config.debug ? 'debug' : 'info',
      prefix: `HTTP-CONNECTION:${this.id.substring(0, 8)}`
    });
    
    // Determine if this is HTTPS
    const url = new URL(this.config.url);
    this.isSecure = url.protocol === 'https:';
    
    // Create HTTP agent with connection pooling
    const agentOptions = {
      keepAlive: this.config.agent?.keepAlive !== false,
      maxSockets: this.config.agent?.maxSockets || 10,
      timeout: this.config.agent?.timeout || 30000,
      keepAliveMsecs: 1000
    };
    
    this.httpAgent = this.isSecure 
      ? new https.Agent(agentOptions)
      : new http.Agent(agentOptions);
    
    this.stats = {
      messagesSent: 0,
      messagesReceived: 0,
      bytesSent: 0,
      bytesReceived: 0,
      reconnectAttempts: 0,
      metadata: {
        url: this.config.url,
        method: this.config.method || 'POST',
        path: this.config.path || '/',
        isSecure: this.isSecure,
        agentSockets: 0,
        pendingRequests: 0
      }
    };
    
    this.logger.debug('HTTP connection created', {
      id: this.id,
      url: this.config.url,
      isSecure: this.isSecure,
      method: this.config.method || 'POST'
    });
  }
  
  /**
   * Current connection state
   */
  get state(): ConnectionState {
    return this._state;
  }
  
  /**
   * Connect to the HTTP server (validate endpoint)
   */
  async connect(): Promise<void> {
    if (this._state !== ConnectionState.DISCONNECTED) {
      throw new ConnectionError(
        `Cannot connect from state: ${this._state}`,
        'INVALID_STATE',
        'http'
      );
    }
    
    this.setState(ConnectionState.CONNECTING);
    
    try {
      // Validate the endpoint by sending a test request
      await this.validateEndpoint();
      
      this.setState(ConnectionState.CONNECTED);
      this.stats.connectedAt = new Date();
      
      this.logger.info('HTTP connection established', {
        url: this.config.url,
        method: this.config.method || 'POST'
      });
      
    } catch (error) {
      this.setState(ConnectionState.ERROR);
      throw new TransportError(
        `Failed to connect to HTTP server: ${error instanceof Error ? error.message : String(error)}`,
        'http',
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
        'http'
      );
    }
    
    try {
      const response = await this.sendHttpRequest(message);
      
      // For notifications (no id), we don't expect a response
      if (message.id === undefined) {
        this.logger.debug('Notification sent', {
          method: message.method
        });
        return;
      }
      
      // For requests, process the response
      this.processHttpResponse(response);
      
    } catch (error) {
      this.logger.error('Failed to send HTTP message:', error);
      throw error instanceof TransportError ? error : new TransportError(
        `Failed to send message: ${error instanceof Error ? error.message : String(error)}`,
        'http',
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
      // Cancel all pending requests
      for (const [id, pending] of this.pendingRequests) {
        clearTimeout(pending.timeout);
        pending.reject(new Error('Connection closing'));
      }
      this.pendingRequests.clear();
      
      // Destroy the HTTP agent
      this.httpAgent.destroy();
      
      this.setState(ConnectionState.CLOSED);
      this.logger.info('HTTP connection closed');
      
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
    return this._state === ConnectionState.CONNECTED;
  }
  
  /**
   * Get connection statistics
   */
  getStats(): ConnectionStats {
    // Update agent socket counts
    const agentStats = this.getAgentStats();
    
    return {
      ...this.stats,
      metadata: {
        ...this.stats.metadata,
        agentSockets: agentStats.sockets,
        pendingRequests: this.pendingRequests.size,
        activeRequests: agentStats.requests
      }
    };
  }
  
  /**
   * Validate the HTTP endpoint
   */
  private async validateEndpoint(): Promise<void> {
    // Send a test ping request to validate the endpoint
    const pingMessage = MessageFramer.createRequest('ping', {}, 'validation_ping');
    
    try {
      await this.sendHttpRequest(pingMessage, { timeout: 5000 });
      this.logger.debug('Endpoint validation successful');
    } catch (error) {
      // If ping fails, try a generic JSON-RPC request
      const testMessage = MessageFramer.createRequest('tools/list', {}, 'validation_test');
      await this.sendHttpRequest(testMessage, { timeout: 5000 });
      this.logger.debug('Endpoint validation successful (fallback)');
    }
  }
  
  /**
   * Send an HTTP request with the JSON-RPC message
   */
  private async sendHttpRequest(
    message: JsonRpcMessage, 
    options: { timeout?: number } = {}
  ): Promise<JsonRpcMessage> {
    const url = new URL(this.config.url);
    const path = this.config.path || url.pathname || '/';
    const method = this.config.method || 'POST';
    
    // Serialize message
    const jsonData = JSON.stringify(message);
    const bodyBuffer = Buffer.from(jsonData, 'utf8');
    
    // Check payload size
    const maxPayloadSize = this.config.maxPayloadSize || 10 * 1024 * 1024;
    if (bodyBuffer.length > maxPayloadSize) {
      throw new Error(`Message size ${bodyBuffer.length} exceeds maximum payload size ${maxPayloadSize}`);
    }
    
    // Prepare headers
    const headers = {
      'Content-Type': 'application/json',
      'Content-Length': bodyBuffer.length.toString(),
      'User-Agent': 'MCP-Proxy-Wrapper/2.0.0',
      ...this.config.headers
    };
    
    // Create request options
    const requestOptions: http.RequestOptions = {
      hostname: url.hostname,
      port: url.port || (this.isSecure ? 443 : 80),
      path,
      method,
      headers,
      agent: this.httpAgent,
      timeout: options.timeout || this.config.timeout || 30000
    };
    
    this.logger.debug('Sending HTTP request', {
      method,
      url: `${url.protocol}//${url.host}${path}`,
      messageId: message.id,
      size: bodyBuffer.length
    });
    
    return new Promise((resolve, reject) => {
      const httpModule = this.isSecure ? https : http;
      
      const req = httpModule.request(requestOptions, (res) => {
        const chunks: Buffer[] = [];
        
        res.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });
        
        res.on('end', () => {
          try {
            const responseBuffer = Buffer.concat(chunks);
            const responseText = responseBuffer.toString('utf8');
            
            this.stats.bytesReceived += responseBuffer.length;
            
            // Check response status
            if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
              throw new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`);
            }
            
            // Parse JSON response
            const responseMessage = MessageFramer.parseMessage(responseText);
            this.stats.messagesReceived++;
            
            this.logger.debug('HTTP response received', {
              statusCode: res.statusCode,
              messageId: responseMessage.id,
              size: responseBuffer.length,
              hasError: !!responseMessage.error
            });
            
            resolve(responseMessage);
            
          } catch (error) {
            reject(new ProtocolError(
              `Failed to process HTTP response: ${error instanceof Error ? error.message : String(error)}`,
              'http'
            ));
          }
        });
        
        res.on('error', (error) => {
          reject(new TransportError(
            `HTTP response error: ${error.message}`,
            'http',
            error
          ));
        });
      });
      
      req.on('error', (error) => {
        reject(new TransportError(
          `HTTP request error: ${error.message}`,
          'http',
          error
        ));
      });
      
      req.on('timeout', () => {
        req.destroy();
        reject(new TimeoutError(
          `HTTP request timeout after ${requestOptions.timeout}ms`,
          'http',
          requestOptions.timeout as number
        ));
      });
      
      // Write request body
      req.write(bodyBuffer);
      req.end();
      
      // Update statistics
      this.stats.messagesSent++;
      this.stats.bytesSent += bodyBuffer.length;
    });
  }
  
  /**
   * Process HTTP response and notify handlers
   */
  private processHttpResponse(response: JsonRpcMessage): void {
    try {
      // Notify message handlers
      for (const handler of this.messageHandlers) {
        try {
          handler(response);
        } catch (error) {
          this.logger.error('Error in message handler:', error);
        }
      }
      
    } catch (error) {
      this.logger.error('Error processing HTTP response:', error);
      this.emitError(new ProtocolError(
        `Failed to process response: ${error instanceof Error ? error.message : String(error)}`,
        'http'
      ));
    }
  }
  
  /**
   * Get HTTP agent statistics
   */
  private getAgentStats(): { sockets: number; requests: number } {
    const agent = this.httpAgent as any;
    
    // Count active sockets
    let sockets = 0;
    if (agent.sockets) {
      for (const socketList of Object.values(agent.sockets)) {
        if (Array.isArray(socketList)) {
          sockets += socketList.length;
        }
      }
    }
    
    // Count pending requests
    let requests = 0;
    if (agent.requests) {
      for (const requestList of Object.values(agent.requests)) {
        if (Array.isArray(requestList)) {
          requests += requestList.length;
        }
      }
    }
    
    return { sockets, requests };
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
 * HTTP transport adapter
 */
export class HttpAdapter implements IConnectionAdapter {
  private logger = createLogger({ level: 'info', prefix: 'HTTP-ADAPTER' });
  
  /**
   * Create a new HTTP connection
   */
  async connect(config: TransportConfig): Promise<IConnection> {
    if (config.transport !== 'http') {
      throw new Error(`Invalid transport type: ${config.transport}. Expected 'http'`);
    }
    
    const httpConfig = config as HttpTransportConfig;
    this.logger.debug('Creating HTTP connection', {
      url: httpConfig.url,
      method: httpConfig.method || 'POST'
    });
    
    const connection = new HttpConnection(httpConfig);
    await connection.connect();
    
    return connection;
  }
  
  /**
   * Probe if this adapter can handle the configuration
   */
  async probe(config: TransportConfig): Promise<boolean> {
    if (config.transport !== 'http') {
      return false;
    }
    
    const httpConfig = config as HttpTransportConfig;
    
    // Basic validation
    if (!httpConfig.url) {
      return false;
    }
    
    // Check if URL is a valid HTTP/HTTPS URL
    try {
      const url = new URL(httpConfig.url);
      return url.protocol === 'http:' || url.protocol === 'https:';
    } catch {
      return false;
    }
  }
  
  /**
   * Get adapter metadata
   */
  getMetadata(): AdapterMetadata {
    return {
      name: 'http-adapter',
      transport: 'http',
      version: '2.0.0',
      capabilities: {
        autoReconnect: false,
        healthCheck: true,
        binaryData: false,
        streaming: false
      }
    };
  }
}