/**
 * @file Connection Interface for Universal MCP Proxy
 * @version 2.0.0
 * @status STABLE - Core interface for all transport types
 * 
 * Defines the core connection abstraction that all transport adapters must implement.
 * This interface provides a unified way to communicate with MCP servers regardless
 * of the underlying transport mechanism (STDIO, WebSocket, HTTP, SSE).
 */

/**
 * JSON-RPC 2.0 message format for MCP communication
 */
export interface JsonRpcMessage {
  jsonrpc: '2.0';
  id?: string | number | null;
  method?: string;
  params?: any;
  result?: any;
  error?: JsonRpcError;
}

/**
 * JSON-RPC 2.0 error object
 */
export interface JsonRpcError {
  code: number;
  message: string;
  data?: any;
}

/**
 * Connection state enumeration
 */
export enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  CLOSING = 'closing',
  CLOSED = 'closed',
  ERROR = 'error'
}

/**
 * Core connection interface that all transport adapters must implement
 */
export interface IConnection {
  /** Current connection state */
  readonly state: ConnectionState;
  
  /** Unique identifier for this connection */
  readonly id: string;
  
  /** Transport type identifier */
  readonly transport: TransportType;
  
  /**
   * Send a JSON-RPC message to the server
   * @param message The JSON-RPC message to send
   * @returns Promise that resolves when the message is sent
   */
  send(message: JsonRpcMessage): Promise<void>;
  
  /**
   * Register a handler for incoming messages
   * @param handler Function to call when messages are received
   */
  onMessage(handler: (message: JsonRpcMessage) => void): void;
  
  /**
   * Register a handler for connection state changes
   * @param handler Function to call when connection state changes
   */
  onStateChange(handler: (state: ConnectionState) => void): void;
  
  /**
   * Register a handler for connection errors
   * @param handler Function to call when errors occur
   */
  onError(handler: (error: Error) => void): void;
  
  /**
   * Close the connection gracefully
   * @returns Promise that resolves when the connection is closed
   */
  close(): Promise<void>;
  
  /**
   * Check if the connection is currently usable
   */
  isConnected(): boolean;
  
  /**
   * Get connection statistics and metadata
   */
  getStats(): ConnectionStats;
}

/**
 * Connection statistics and metadata
 */
export interface ConnectionStats {
  /** When the connection was established */
  connectedAt?: Date;
  
  /** Total messages sent */
  messagesSent: number;
  
  /** Total messages received */
  messagesReceived: number;
  
  /** Total bytes sent */
  bytesSent: number;
  
  /** Total bytes received */
  bytesReceived: number;
  
  /** Number of reconnection attempts */
  reconnectAttempts: number;
  
  /** Last error that occurred */
  lastError?: Error;
  
  /** Transport-specific metadata */
  metadata: Record<string, any>;
}

/**
 * Transport types supported by the universal proxy
 */
export type TransportType = 'stdio' | 'websocket' | 'sse' | 'http' | 'inmemory';

/**
 * Base configuration for all transport types
 */
export interface BaseTransportConfig {
  /** Transport type */
  transport: TransportType;
  
  /** Connection timeout in milliseconds */
  timeout?: number;
  
  /** Maximum message payload size in bytes */
  maxPayloadSize?: number;
  
  /** Enable debug logging */
  debug?: boolean;
  
  /** Custom headers for HTTP-based transports */
  headers?: Record<string, string>;
  
  /** Retry configuration */
  retry?: RetryConfig;
  
  /** Circuit breaker configuration */
  circuitBreaker?: CircuitBreakerConfig;
}

/**
 * STDIO transport configuration
 */
export interface StdioTransportConfig extends BaseTransportConfig {
  transport: 'stdio';
  
  /** Command to execute (for spawning processes) */
  command?: string[];
  
  /** Additional command arguments */
  args?: string[];
  
  /** Working directory for the process */
  cwd?: string;
  
  /** Environment variables for the process */
  env?: Record<string, string>;
  
  /** Process health check configuration */
  healthCheck?: HealthCheckConfig;
  
  /** Process restart configuration */
  restart?: RestartConfig;
  
  /** Stream configuration */
  streams?: {
    /** High water mark for streams */
    highWaterMark?: number;
    
    /** Encoding for stdio streams */
    encoding?: BufferEncoding;
  };
}

/**
 * WebSocket transport configuration
 */
export interface WebSocketTransportConfig extends BaseTransportConfig {
  transport: 'websocket';
  
  /** WebSocket URL */
  url: string;
  
  /** WebSocket protocols */
  protocols?: string[];
  
  /** WebSocket options */
  options?: {
    /** Origin header */
    origin?: string;
    
    /** Per-message deflate configuration */
    perMessageDeflate?: boolean;
    
    /** Maximum payload size */
    maxPayload?: number;
    
    /** Heartbeat interval in milliseconds */
    heartbeatInterval?: number;
  };
}

/**
 * HTTP transport configuration
 */
export interface HttpTransportConfig extends BaseTransportConfig {
  transport: 'http';
  
  /** Base URL for the HTTP server */
  url: string;
  
  /** HTTP method for tool calls */
  method?: 'POST' | 'PUT';
  
  /** Request path for tool calls */
  path?: string;
  
  /** HTTP agent configuration */
  agent?: {
    /** Keep connections alive */
    keepAlive?: boolean;
    
    /** Maximum sockets per host */
    maxSockets?: number;
    
    /** Socket timeout */
    timeout?: number;
  };
}

/**
 * Server-Sent Events transport configuration
 */
export interface SSETransportConfig extends BaseTransportConfig {
  transport: 'sse';
  
  /** SSE endpoint URL */
  url: string;
  
  /** URL for sending messages to server */
  sendUrl?: string;
  
  /** SSE options */
  options?: {
    /** Reconnection time in milliseconds */
    reconnectTime?: number;
    
    /** Last event ID */
    lastEventId?: string;
    
    /** Whether to include credentials */
    withCredentials?: boolean;
  };
}

/**
 * In-memory transport configuration (for testing)
 */
export interface InMemoryTransportConfig extends BaseTransportConfig {
  transport: 'inmemory';
  
  /** Reference to the server-side transport */
  serverTransport?: any;
}

/**
 * Union type for all transport configurations
 */
export type TransportConfig = 
  | StdioTransportConfig
  | WebSocketTransportConfig 
  | HttpTransportConfig
  | SSETransportConfig
  | InMemoryTransportConfig;

/**
 * Retry configuration
 */
export interface RetryConfig {
  /** Maximum number of retry attempts */
  maxAttempts: number;
  
  /** Backoff strategy */
  backoff: 'fixed' | 'exponential' | 'linear';
  
  /** Base delay in milliseconds */
  baseDelay: number;
  
  /** Maximum delay in milliseconds */
  maxDelay?: number;
  
  /** Jitter to add to delays */
  jitter?: boolean;
}

/**
 * Circuit breaker configuration
 */
export interface CircuitBreakerConfig {
  /** Number of failures before opening circuit */
  failureThreshold: number;
  
  /** Time to wait before attempting to close circuit */
  resetTimeout: number;
  
  /** Minimum number of requests before evaluating failure rate */
  minimumRequests?: number;
  
  /** Rolling window duration in milliseconds */
  windowDuration?: number;
}

/**
 * Health check configuration
 */
export interface HealthCheckConfig {
  /** Enable health checks */
  enabled: boolean;
  
  /** Health check interval in milliseconds */
  interval: number;
  
  /** Health check timeout in milliseconds */
  timeout: number;
  
  /** Number of consecutive failures before marking unhealthy */
  failureThreshold?: number;
  
  /** Custom health check command/method */
  command?: string[];
}

/**
 * Process restart configuration
 */
export interface RestartConfig {
  /** Enable automatic restart */
  enabled: boolean;
  
  /** Maximum number of restart attempts */
  maxRetries: number;
  
  /** Backoff strategy for restarts */
  backoff: 'fixed' | 'exponential';
  
  /** Base delay between restart attempts */
  baseDelay: number;
  
  /** Maximum delay between restart attempts */
  maxDelay?: number;
  
  /** Conditions that trigger a restart */
  triggers?: {
    /** Restart on process exit */
    onExit?: boolean;
    
    /** Restart on specific exit codes */
    onExitCodes?: number[];
    
    /** Restart on health check failures */
    onHealthCheckFailure?: boolean;
  };
}

/**
 * Connection adapter interface that transport implementations must implement
 */
export interface IConnectionAdapter {
  /**
   * Create a new connection using this adapter
   * @param config Transport-specific configuration
   * @returns Promise that resolves to a connection instance
   */
  connect(config: TransportConfig): Promise<IConnection>;
  
  /**
   * Probe if this adapter can handle the given configuration
   * @param config Transport configuration to probe
   * @returns Promise that resolves to true if this adapter can handle the config
   */
  probe?(config: TransportConfig): Promise<boolean>;
  
  /**
   * Get metadata about this adapter
   */
  getMetadata(): AdapterMetadata;
}

/**
 * Adapter metadata
 */
export interface AdapterMetadata {
  /** Adapter name */
  name: string;
  
  /** Supported transport type */
  transport: TransportType;
  
  /** Adapter version */
  version: string;
  
  /** Adapter capabilities */
  capabilities: {
    /** Supports auto-reconnection */
    autoReconnect: boolean;
    
    /** Supports health checks */
    healthCheck: boolean;
    
    /** Supports binary data */
    binaryData: boolean;
    
    /** Supports streaming */
    streaming: boolean;
  };
}

/**
 * Custom error types for connection operations
 */
export class ConnectionError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly transport: TransportType,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'ConnectionError';
  }
}

export class TransportError extends ConnectionError {
  constructor(message: string, transport: TransportType, cause?: Error) {
    super(message, 'TRANSPORT_ERROR', transport, cause);
    this.name = 'TransportError';
  }
}

export class TimeoutError extends ConnectionError {
  constructor(message: string, transport: TransportType, public readonly timeoutMs: number) {
    super(message, 'TIMEOUT_ERROR', transport);
    this.name = 'TimeoutError';
  }
}

export class ProtocolError extends ConnectionError {
  constructor(message: string, transport: TransportType, public readonly invalidMessage?: any) {
    super(message, 'PROTOCOL_ERROR', transport);
    this.name = 'ProtocolError';
  }
}