/**
 * @file Server-Sent Events (SSE) Transport Adapter
 * @version 2.0.0
 * @status STABLE - SSE transport with event streaming and HTTP fallback
 * 
 * Implements Server-Sent Events transport adapter for MCP servers that communicate
 * via SSE for receiving messages and HTTP POST for sending messages. Includes
 * automatic reconnection, event parsing, and bidirectional communication.
 */

import http from 'http';
import https from 'https';
import { EventEmitter } from 'events';
import { 
  IConnection, 
  IConnectionAdapter, 
  ConnectionState, 
  ConnectionStats,
  SSETransportConfig,
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
 * SSE event data
 */
interface SSEEvent {
  id?: string;
  event?: string;
  data: string;
  retry?: number;
}

/**
 * SSE connection implementation
 */
export class SSEConnection extends EventEmitter implements IConnection {
  public readonly id: string;
  public readonly transport = 'sse' as const;
  
  private _state: ConnectionState = ConnectionState.DISCONNECTED;
  private sseRequest: http.ClientRequest | null = null;
  private sseResponse: http.IncomingMessage | null = null;
  private httpAgent: http.Agent | https.Agent;
  private stats: ConnectionStats;
  private messageHandlers: ((message: JsonRpcMessage) => void)[] = [];
  private stateChangeHandlers: ((state: ConnectionState) => void)[] = [];
  private errorHandlers: ((error: Error) => void)[] = [];
  private reconnectTimeout?: NodeJS.Timeout;
  private reconnectAttempts = 0;
  private lastEventId?: string;
  private isSecure: boolean;
  private sendUrl: string;
  private eventBuffer = '';
  private logger = createLogger({ level: 'info', prefix: 'SSE-CONNECTION' });
  
  constructor(
    private config: SSETransportConfig,
    connectionId?: string
  ) {
    super();
    
    this.id = connectionId || `sse_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    this.logger = createLogger({
      level: this.config.debug ? 'debug' : 'info',
      prefix: `SSE-CONNECTION:${this.id.substring(0, 8)}`
    });
    
    // Determine if this is HTTPS
    const url = new URL(this.config.url);
    this.isSecure = url.protocol === 'https:';
    
    // Set up send URL (for bidirectional communication)
    this.sendUrl = this.config.sendUrl || this.config.url.replace('/events', '/send');
    
    // Create HTTP agent
    const agentOptions = {
      keepAlive: true,
      maxSockets: 5,
      timeout: 30000,
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
        sendUrl: this.sendUrl,
        isSecure: this.isSecure,
        lastEventId: undefined,
        reconnectTime: this.config.options?.reconnectTime
      }
    };
    
    this.logger.debug('SSE connection created', {
      id: this.id,
      url: this.config.url,
      sendUrl: this.sendUrl,
      isSecure: this.isSecure
    });
  }
  
  /**
   * Current connection state
   */
  get state(): ConnectionState {
    return this._state;
  }
  
  /**
   * Connect to the SSE server
   */
  async connect(): Promise<void> {
    if (this._state !== ConnectionState.DISCONNECTED) {
      throw new ConnectionError(
        `Cannot connect from state: ${this._state}`,
        'INVALID_STATE',
        'sse'
      );
    }
    
    this.setState(ConnectionState.CONNECTING);
    
    return new Promise((resolve, reject) => {
      try {
        this.establishSSEConnection()
          .then(() => {
            this.setState(ConnectionState.CONNECTED);
            this.stats.connectedAt = new Date();
            
            this.logger.info('SSE connection established', {
              url: this.config.url,
              lastEventId: this.lastEventId
            });
            
            resolve();
          })
          .catch((error) => {
            this.setState(ConnectionState.ERROR);
            reject(new TransportError(
              `Failed to establish SSE connection: ${error instanceof Error ? error.message : String(error)}`,
              'sse',
              error instanceof Error ? error : undefined
            ));
          });
        
      } catch (error) {
        this.setState(ConnectionState.ERROR);
        reject(new TransportError(
          `Failed to create SSE connection: ${error instanceof Error ? error.message : String(error)}`,
          'sse',
          error instanceof Error ? error : undefined
        ));
      }
    });
  }
  
  /**
   * Send a JSON-RPC message to the server via HTTP POST
   */
  async send(message: JsonRpcMessage): Promise<void> {
    if (!this.isConnected()) {
      throw new ConnectionError(
        `Cannot send message in state: ${this._state}`,
        'NOT_CONNECTED',
        'sse'
      );
    }
    
    try {
      await this.sendHttpMessage(message);
      
      this.logger.debug('Message sent via HTTP', {
        method: message.method,
        id: message.id
      });
      
    } catch (error) {
      this.logger.error('Failed to send SSE message:', error);
      throw error instanceof TransportError ? error : new TransportError(
        `Failed to send message: ${error instanceof Error ? error.message : String(error)}`,
        'sse',
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
      // Cancel reconnect timeout
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = undefined;
      }
      
      // Close SSE connection
      if (this.sseRequest) {
        this.sseRequest.destroy();
        this.sseRequest = null;
      }
      
      if (this.sseResponse) {
        this.sseResponse.destroy();
        this.sseResponse = null;
      }
      
      // Destroy HTTP agent
      this.httpAgent.destroy();
      
      // Clear event buffer
      this.eventBuffer = '';
      
      this.setState(ConnectionState.CLOSED);
      this.logger.info('SSE connection closed');
      
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
           this.sseRequest !== null && 
           this.sseResponse !== null &&
           !this.sseRequest.destroyed;
  }
  
  /**
   * Get connection statistics
   */
  getStats(): ConnectionStats {
    return {
      ...this.stats,
      metadata: {
        ...this.stats.metadata,
        lastEventId: this.lastEventId,
        reconnectAttempts: this.reconnectAttempts,
        requestDestroyed: this.sseRequest?.destroyed ?? true,
        responseReadableEnded: this.sseResponse?.readableEnded ?? true
      }
    };
  }
  
  /**
   * Establish the SSE connection
   */
  private async establishSSEConnection(): Promise<void> {
    const url = new URL(this.config.url);
    
    // Prepare headers
    const headers: Record<string, string> = {
      'Accept': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'User-Agent': 'MCP-Proxy-Wrapper/2.0.0',
      ...this.config.headers
    };
    
    // Add Last-Event-ID if we have one
    if (this.config.options?.lastEventId || this.lastEventId) {
      headers['Last-Event-ID'] = this.config.options?.lastEventId || this.lastEventId!;
    }
    
    // Include credentials if configured
    if (this.config.options?.withCredentials) {
      // This would be handled by the HTTP agent
    }
    
    // Create request options
    const requestOptions: http.RequestOptions = {
      hostname: url.hostname,
      port: url.port || (this.isSecure ? 443 : 80),
      path: url.pathname + url.search,
      method: 'GET',
      headers,
      agent: this.httpAgent,
      timeout: this.config.timeout || 0 // SSE connections are long-lived
    };
    
    this.logger.debug('Establishing SSE connection', {
      url: this.config.url,
      headers: Object.keys(headers)
    });
    
    return new Promise((resolve, reject) => {
      const httpModule = this.isSecure ? https : http;
      
      this.sseRequest = httpModule.request(requestOptions, (res) => {
        // Check response status
        if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
          reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
          return;
        }
        
        // Verify content type
        const contentType = res.headers['content-type'];
        if (!contentType || !contentType.includes('text/event-stream')) {
          reject(new Error(`Invalid content-type: ${contentType}. Expected text/event-stream`));
          return;
        }
        
        this.sseResponse = res;
        this.setupSSEHandlers();
        
        this.logger.debug('SSE connection established', {
          statusCode: res.statusCode,
          contentType
        });
        
        resolve();
      });
      
      this.sseRequest.on('error', (error) => {
        reject(new TransportError(
          `SSE request error: ${error.message}`,
          'sse',
          error
        ));
      });
      
      this.sseRequest.on('timeout', () => {
        this.sseRequest!.destroy();
        reject(new TimeoutError(
          'SSE connection timeout',
          'sse',
          requestOptions.timeout as number
        ));
      });
      
      this.sseRequest.end();
    });
  }
  
  /**
   * Set up SSE event stream handlers
   */
  private setupSSEHandlers(): void {
    if (!this.sseResponse) return;
    
    this.sseResponse.setEncoding('utf8');
    
    this.sseResponse.on('data', (chunk: string) => {
      this.eventBuffer += chunk;
      this.processEventBuffer();
    });
    
    this.sseResponse.on('end', () => {
      this.logger.info('SSE stream ended');
      
      if (this._state === ConnectionState.CLOSING) {
        // Expected end
        return;
      }
      
      // Unexpected end - attempt reconnection
      this.attemptReconnection();
    });
    
    this.sseResponse.on('error', (error: Error) => {
      this.logger.error('SSE response error:', error);
      
      if (this._state === ConnectionState.CLOSING) {
        return;
      }
      
      this.setState(ConnectionState.ERROR);
      this.emitError(new TransportError(
        `SSE response error: ${error.message}`,
        'sse',
        error
      ));
    });
  }
  
  /**
   * Process the event buffer and extract complete events
   */
  private processEventBuffer(): void {
    const lines = this.eventBuffer.split('\n');
    this.eventBuffer = lines.pop() || ''; // Keep incomplete line in buffer
    
    let currentEvent: Partial<SSEEvent> = {};
    
    for (const line of lines) {
      if (line === '') {
        // Empty line indicates end of event
        if (currentEvent.data !== undefined) {
          this.processSSEEvent(currentEvent as SSEEvent);
        }
        currentEvent = {};
        continue;
      }
      
      // Skip comments
      if (line.startsWith(':')) {
        continue;
      }
      
      // Parse field
      const colonIndex = line.indexOf(':');
      if (colonIndex === -1) {
        continue;
      }
      
      const field = line.substring(0, colonIndex);
      let value = line.substring(colonIndex + 1);
      
      // Remove leading space from value
      if (value.startsWith(' ')) {
        value = value.substring(1);
      }
      
      switch (field) {
        case 'id':
          currentEvent.id = value;
          break;
        case 'event':
          currentEvent.event = value;
          break;
        case 'data':
          currentEvent.data = (currentEvent.data || '') + value + '\n';
          break;
        case 'retry':
          currentEvent.retry = parseInt(value, 10);
          break;
      }
    }
  }
  
  /**
   * Process a complete SSE event
   */
  private processSSEEvent(event: SSEEvent): void {
    try {
      // Update last event ID
      if (event.id) {
        this.lastEventId = event.id;
      }
      
      // Remove trailing newline from data
      const data = event.data.endsWith('\n') 
        ? event.data.slice(0, -1) 
        : event.data;
      
      this.stats.bytesReceived += Buffer.byteLength(data, 'utf8');
      
      this.logger.debug('SSE event received', {
        id: event.id,
        event: event.event,
        dataLength: data.length
      });
      
      // Handle different event types
      if (event.event === 'message' || !event.event) {
        // Standard message event - parse as JSON-RPC
        const message = MessageFramer.parseMessage(data);
        this.stats.messagesReceived++;
        
        this.logger.debug('JSON-RPC message received', {
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
      } else if (event.event === 'ping') {
        // Heartbeat event
        this.logger.debug('Received SSE ping');
      } else {
        // Custom event type
        this.logger.debug('Received custom SSE event', {
          event: event.event,
          data
        });
      }
      
    } catch (error) {
      this.logger.error('Error processing SSE event:', error);
      this.emitError(new ProtocolError(
        `Failed to process SSE event: ${error instanceof Error ? error.message : String(error)}`,
        'sse'
      ));
    }
  }
  
  /**
   * Send a message via HTTP POST
   */
  private async sendHttpMessage(message: JsonRpcMessage): Promise<void> {
    const url = new URL(this.sendUrl);
    
    // Serialize message
    const jsonData = JSON.stringify(message);
    const bodyBuffer = Buffer.from(jsonData, 'utf8');
    
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
      path: url.pathname + url.search,
      method: 'POST',
      headers,
      agent: this.httpAgent,
      timeout: this.config.timeout || 30000
    };
    
    this.logger.debug('Sending HTTP message', {
      url: this.sendUrl,
      messageId: message.id,
      size: bodyBuffer.length
    });
    
    return new Promise((resolve, reject) => {
      const httpModule = this.isSecure ? https : http;
      
      const req = httpModule.request(requestOptions, (res) => {
        // Consume response data
        res.on('data', () => {});
        
        res.on('end', () => {
          if (res.statusCode && (res.statusCode < 200 || res.statusCode >= 300)) {
            reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
          } else {
            resolve();
          }
        });
        
        res.on('error', (error) => {
          reject(new TransportError(
            `HTTP response error: ${error.message}`,
            'sse',
            error
          ));
        });
      });
      
      req.on('error', (error) => {
        reject(new TransportError(
          `HTTP request error: ${error.message}`,
          'sse',
          error
        ));
      });
      
      req.on('timeout', () => {
        req.destroy();
        reject(new TimeoutError(
          `HTTP request timeout after ${requestOptions.timeout}ms`,
          'sse',
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
   * Attempt to reconnect after unexpected disconnection
   */
  private async attemptReconnection(): Promise<void> {
    if (this._state === ConnectionState.CLOSING || this._state === ConnectionState.CLOSED) {
      return;
    }
    
    this.reconnectAttempts++;
    this.stats.reconnectAttempts++;
    
    const maxAttempts = this.config.retry?.maxAttempts || 5;
    this.logger.info(`Attempting SSE reconnection (${this.reconnectAttempts}/${maxAttempts})`);
    
    this.setState(ConnectionState.RECONNECTING);
    
    // Use configured reconnect time or calculate backoff
    let delay = this.config.options?.reconnectTime || 3000;
    
    if (this.config.retry) {
      const backoff = this.config.retry.backoff || 'exponential';
      const baseDelay = this.config.retry.baseDelay || 1000;
      const maxDelay = this.config.retry.maxDelay || 30000;
      
      if (backoff === 'exponential') {
        delay = Math.min(baseDelay * Math.pow(2, this.reconnectAttempts - 1), maxDelay);
      } else if (backoff === 'linear') {
        delay = Math.min(baseDelay * this.reconnectAttempts, maxDelay);
      }
      
      // Add jitter if configured
      if (this.config.retry.jitter) {
        delay += Math.random() * 1000;
      }
    }
    
    this.reconnectTimeout = setTimeout(async () => {
      try {
        // Clean up old connection
        if (this.sseRequest) {
          this.sseRequest.destroy();
          this.sseRequest = null;
        }
        if (this.sseResponse) {
          this.sseResponse.destroy();
          this.sseResponse = null;
        }
        
        this.eventBuffer = '';
        
        // Attempt new connection
        this.setState(ConnectionState.CONNECTING);
        await this.establishSSEConnection();
        this.setState(ConnectionState.CONNECTED);
        
        this.logger.info('SSE reconnection successful', {
          attempts: this.reconnectAttempts
        });
        
        // Reset reconnect counter on successful reconnection
        this.reconnectAttempts = 0;
        
      } catch (error) {
        this.logger.error(`SSE reconnection attempt ${this.reconnectAttempts} failed:`, error);
        
        if (this.reconnectAttempts < maxAttempts) {
          // Try again
          this.attemptReconnection();
        } else {
          // Max attempts reached
          this.setState(ConnectionState.ERROR);
          this.emitError(new TransportError(
            `Failed to reconnect after ${maxAttempts} attempts`,
            'sse',
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
 * SSE transport adapter
 */
export class SSEAdapter implements IConnectionAdapter {
  private logger = createLogger({ level: 'info', prefix: 'SSE-ADAPTER' });
  
  /**
   * Create a new SSE connection
   */
  async connect(config: TransportConfig): Promise<IConnection> {
    if (config.transport !== 'sse') {
      throw new Error(`Invalid transport type: ${config.transport}. Expected 'sse'`);
    }
    
    const sseConfig = config as SSETransportConfig;
    this.logger.debug('Creating SSE connection', {
      url: sseConfig.url,
      sendUrl: sseConfig.sendUrl
    });
    
    const connection = new SSEConnection(sseConfig);
    await connection.connect();
    
    return connection;
  }
  
  /**
   * Probe if this adapter can handle the configuration
   */
  async probe(config: TransportConfig): Promise<boolean> {
    if (config.transport !== 'sse') {
      return false;
    }
    
    const sseConfig = config as SSETransportConfig;
    
    // Basic validation
    if (!sseConfig.url) {
      return false;
    }
    
    // Check if URL is a valid HTTP/HTTPS URL
    try {
      const url = new URL(sseConfig.url);
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
      name: 'sse-adapter',
      transport: 'sse',
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