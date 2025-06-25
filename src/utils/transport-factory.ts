/**
 * @file Transport Factory for Remote Proxy Wrapper
 * @version 1.0.0
 * 
 * Factory pattern for creating different types of MCP transport instances.
 * Provides better separation of concerns and easier testing.
 */

import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { WebSocketClientTransport } from '@modelcontextprotocol/sdk/client/websocket.js';
import { ProxyConfigurationError } from './errors.js';
import { RemoteServerConfig, STDIOTransportConfig, SSETransportConfig, WebSocketTransportConfig } from '../interfaces/remote-proxy.js';


/**
 * Configuration validator for transport configs
 */
export class TransportConfigValidator {
  /**
   * Validate STDIO transport configuration
   */
  static validateSTDIOConfig(config: RemoteServerConfig): asserts config is STDIOTransportConfig {
    if (config.transport !== 'stdio') {
      throw new ProxyConfigurationError(
        'Invalid transport type for STDIO validation',
        { expected: 'stdio', actual: config.transport }
      );
    }

    if (!config.command) {
      throw new ProxyConfigurationError(
        'STDIO transport requires a command',
        { transport: 'stdio', command: config.command }
      );
    }
  }

  /**
   * Validate SSE transport configuration
   */
  static validateSSEConfig(config: RemoteServerConfig): asserts config is SSETransportConfig {
    if (config.transport !== 'sse') {
      throw new ProxyConfigurationError(
        'Invalid transport type for SSE validation',
        { expected: 'sse', actual: config.transport }
      );
    }

    if (!config.url) {
      throw new ProxyConfigurationError(
        'SSE transport requires a URL',
        { transport: 'sse', url: config.url }
      );
    }

    try {
      new URL(config.url);
    } catch (error) {
      throw new ProxyConfigurationError(
        'SSE transport requires a valid URL',
        { transport: 'sse', url: config.url, error: error instanceof Error ? error.message : String(error) }
      );
    }
  }

  /**
   * Validate WebSocket transport configuration
   */
  static validateWebSocketConfig(config: RemoteServerConfig): asserts config is WebSocketTransportConfig {
    if (config.transport !== 'websocket') {
      throw new ProxyConfigurationError(
        'Invalid transport type for WebSocket validation',
        { expected: 'websocket', actual: config.transport }
      );
    }

    if (!config.url) {
      throw new ProxyConfigurationError(
        'WebSocket transport requires a URL',
        { transport: 'websocket', url: config.url }
      );
    }

    try {
      const url = new URL(config.url);
      if (!['ws:', 'wss:'].includes(url.protocol)) {
        throw new ProxyConfigurationError(
          'WebSocket transport requires a ws:// or wss:// URL',
          { transport: 'websocket', url: config.url, protocol: url.protocol }
        );
      }
    } catch (error) {
      if (error instanceof ProxyConfigurationError) {
        throw error;
      }
      throw new ProxyConfigurationError(
        'WebSocket transport requires a valid URL',
        { transport: 'websocket', url: config.url, error: error instanceof Error ? error.message : String(error) }
      );
    }
  }
}

/**
 * Factory for creating transport instances
 */
export class TransportFactory {
  /**
   * Create a transport instance based on configuration
   */
  static async createTransport(config: RemoteServerConfig): Promise<StdioClientTransport | SSEClientTransport | WebSocketClientTransport> {
    switch (config.transport) {
      case 'stdio':
        return TransportFactory.createSTDIOTransport(config);
      
      case 'sse':
        return TransportFactory.createSSETransport(config);
      
      case 'websocket':
        return TransportFactory.createWebSocketTransport(config);
      
      default:
        throw new ProxyConfigurationError(
          `Unsupported transport type: ${(config as any).transport}`,
          {
            transport: (config as any).transport,
            supportedTransports: ['stdio', 'sse', 'websocket']
          }
        );
    }
  }

  /**
   * Create STDIO transport
   */
  private static createSTDIOTransport(config: RemoteServerConfig): StdioClientTransport {
    TransportConfigValidator.validateSTDIOConfig(config);

    // Prepare environment variables
    const envVars: Record<string, string> = {};
    Object.entries({ ...process.env, ...(config.env || {}) }).forEach(([key, value]) => {
      if (value !== undefined) {
        envVars[key] = value;
      }
    });

    return new StdioClientTransport({
      command: config.command,
      args: config.args || [],
      env: envVars,
      cwd: config.cwd || process.cwd()
    });
  }

  /**
   * Create SSE transport
   */
  private static createSSETransport(config: RemoteServerConfig): SSEClientTransport {
    TransportConfigValidator.validateSSEConfig(config);

    return new SSEClientTransport(new URL(config.url));
  }

  /**
   * Create WebSocket transport
   */
  private static createWebSocketTransport(config: RemoteServerConfig): WebSocketClientTransport {
    TransportConfigValidator.validateWebSocketConfig(config);

    return new WebSocketClientTransport(new URL(config.url));
  }

  /**
   * Detect transport type from a connection string or URL
   */
  static detectTransportType(connectionString: string): RemoteServerConfig['transport'] | null {
    try {
      const url = new URL(connectionString);
      
      switch (url.protocol) {
        case 'ws:':
        case 'wss:':
          return 'websocket';
        case 'http:':
        case 'https:':
          return 'sse';
        default:
          return null;
      }
    } catch {
      // If it's not a valid URL, it might be a command
      if (connectionString.includes(' ') || connectionString.includes('/') || connectionString.includes('\\')) {
        return 'stdio';
      }
      return null;
    }
  }

  /**
   * Create auto-detected transport configuration
   */
  static createAutoDetectedConfig(connectionString: string, options?: Partial<RemoteServerConfig>): RemoteServerConfig {
    const detectedType = TransportFactory.detectTransportType(connectionString);
    
    if (!detectedType) {
      throw new ProxyConfigurationError(
        'Could not auto-detect transport type from connection string',
        { connectionString, supportedFormats: ['ws://...', 'wss://...', 'http://...', 'https://...', 'command arg1 arg2'] }
      );
    }

    const baseConfig: RemoteServerConfig = {
      transport: detectedType,
      ...options
    };

    switch (detectedType) {
      case 'websocket':
      case 'sse':
        return {
          ...baseConfig,
          url: connectionString
        };
      
      case 'stdio': {
        const parts = connectionString.split(' ');
        return {
          ...baseConfig,
          command: parts[0],
          args: parts.slice(1)
        };
      }
      
      default:
        throw new ProxyConfigurationError(
          `Unsupported detected transport type: ${detectedType}`,
          { detectedType, connectionString }
        );
    }
  }
}

/**
 * Transport health checker
 */
export class TransportHealthChecker {
  /**
   * Check if a transport configuration is healthy
   */
  static async checkHealth(config: RemoteServerConfig): Promise<{
    healthy: boolean;
    error?: string;
    latency?: number;
  }> {
    const startTime = Date.now();
    
    try {
      // Validate configuration first
      switch (config.transport) {
        case 'stdio':
          TransportConfigValidator.validateSTDIOConfig(config);
          break;
        case 'sse':
          TransportConfigValidator.validateSSEConfig(config);
          break;
        case 'websocket':
          TransportConfigValidator.validateWebSocketConfig(config);
          break;
        default:
          throw new Error(`Unsupported transport: ${(config as any).transport}`);
      }

      // For URL-based transports, we can do a basic connectivity check
      if (config.transport === 'sse' || config.transport === 'websocket') {
        const response = await fetch(config.url!, { method: 'HEAD' });
        if (!response.ok) {
          return {
            healthy: false,
            error: `HTTP ${response.status}: ${response.statusText}`,
            latency: Date.now() - startTime
          };
        }
      }

      return {
        healthy: true,
        latency: Date.now() - startTime
      };
    } catch (error) {
      return {
        healthy: false,
        error: error instanceof Error ? error.message : String(error),
        latency: Date.now() - startTime
      };
    }
  }
}