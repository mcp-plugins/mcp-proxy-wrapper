/**
 * @file Remote Proxy Interfaces
 * @version 1.0.0
 * 
 * Type definitions for remote MCP server proxy functionality
 */

import { ProxyWrapperOptions } from './proxy-hooks.js';
import { ProxyPlugin } from './plugin.js';

/**
 * Configuration for connecting to a remote MCP server
 */
export interface RemoteServerConfig {
  /** Type of transport to use */
  transport: 'stdio' | 'sse' | 'websocket';
  
  /** Server URL (for HTTP/SSE/WebSocket) */
  url?: string;
  
  /** Command to run for STDIO transport */
  command?: string;
  
  /** Arguments for STDIO command */
  args?: string[];
  
  /** Environment variables for STDIO command */
  env?: Record<string, string>;
  
  /** Working directory for STDIO command */
  cwd?: string;
  
  /** Connection timeout in milliseconds */
  timeout?: number;
  
  /** Additional headers for HTTP/SSE/WebSocket */
  headers?: Record<string, string>;
  
  /** Server name for identification */
  name?: string;
  
  /** Server version */
  version?: string;
}

/**
 * Definition of a remote tool discovered from the remote server
 */
export interface RemoteToolDefinition {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
  annotations?: Record<string, unknown>;
}

/**
 * Options for the remote proxy wrapper
 */
export interface RemoteProxyWrapperOptions extends ProxyWrapperOptions {
  /** Configuration for the remote server */
  remoteServer: RemoteServerConfig;
  
  /** Name for the proxy server */
  proxyServerName?: string;
  
  /** Version for the proxy server */
  proxyServerVersion?: string;
  
  /** Plugins to apply to the remote server */
  plugins?: ProxyPlugin[];
}

/**
 * Transport-specific configurations
 */
export interface STDIOTransportConfig extends RemoteServerConfig {
  transport: 'stdio';
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
}

export interface SSETransportConfig extends RemoteServerConfig {
  transport: 'sse';
  url: string;
  headers?: Record<string, string>;
  timeout?: number;
}

export interface WebSocketTransportConfig extends RemoteServerConfig {
  transport: 'websocket';
  url: string;
  headers?: Record<string, string>;
  timeout?: number;
}

/**
 * Union type for all transport configurations
 */
export type TransportConfig = STDIOTransportConfig | SSETransportConfig | WebSocketTransportConfig;

/**
 * Connection state tracking
 */
export enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting',
  ERROR = 'error',
  CLOSING = 'closing',
  CLOSED = 'closed'
}

/**
 * Connection statistics and health information
 */
export interface ConnectionStats {
  state: ConnectionState;
  connectedAt?: Date;
  lastError?: Error;
  reconnectAttempts: number;
  messagesSent: number;
  messagesReceived: number;
  toolCallsProxied: number;
}

/**
 * Health check result
 */
export interface HealthCheckResult {
  healthy: boolean;
  connectionState: ConnectionState;
  stats: ConnectionStats;
  lastChecked: Date;
  errors?: string[];
}