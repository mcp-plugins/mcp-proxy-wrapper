/**
 * @file Remote MCP Server Proxy Wrapper
 * @version 1.0.0
 * @status DEVELOPMENT
 * 
 * This module provides a proxy wrapper that can connect to remote MCP servers
 * and add plugin functionality without modifying the remote server.
 * 
 * Architecture:
 * Client → Remote Proxy Wrapper → [Plugins] → Remote MCP Server (HTTP/SSE/STDIO)
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { createLogger } from './utils/logger.js';
import { ProxyWrapperOptions, ToolCallContext, ToolCallResult, PluginRegistration } from './interfaces/proxy-hooks.js';
import { ProxyPlugin } from './interfaces/plugin.js';
import { DefaultPluginManager } from './utils/plugin-manager.js';
import { TransportFactory } from './utils/transport-factory.js';
import { ConfigValidator } from './utils/config-validator.js';
import { 
  ProxyConfigurationError, 
  HookExecutionError, 
  ToolCallError,
  createErrorResponse
} from './utils/errors.js';

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
interface RemoteToolDefinition {
  name: string;
  description?: string;
  inputSchema?: any;
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
}

/**
 * Wraps a remote MCP server with proxy functionality
 */
export class RemoteMcpServerProxy {
  private proxyServer: McpServer;
  private remoteClient: Client;
  private pluginManager: DefaultPluginManager;
  private logger = createLogger({ level: 'info', prefix: 'REMOTE-PROXY' });
  private connected = false;
  private remoteTools: Map<string, RemoteToolDefinition> = new Map();
  private pluginConfig: (ProxyPlugin | PluginRegistration)[];

  constructor(private config: RemoteProxyWrapperOptions) {
    // Initialize logger first
    if (config.debug) {
      this.logger = createLogger({ level: 'debug', prefix: 'REMOTE-PROXY' });
    }

    // Validate configuration using Zod schemas
    try {
      ConfigValidator.validateWithHelpfulErrors(config.remoteServer);
      this.logger.debug('Configuration validation passed');
    } catch (error) {
      this.logger.error('Invalid remote server configuration:', error);
      throw error;
    }

    // Create the proxy server that will expose tools to clients
    this.proxyServer = new McpServer({
      name: config.proxyServerName || `Proxy for ${config.remoteServer.name || 'Remote Server'}`,
      version: config.proxyServerVersion || '1.0.0'
    });

    // Create the client to connect to the remote server
    this.remoteClient = new Client({
      name: `Proxy Client for ${config.remoteServer.name || 'Remote Server'}`,
      version: '1.0.0'
    }, {
      capabilities: {}
    });

    // Initialize plugin manager
    this.pluginManager = new DefaultPluginManager('1.0.0', {
      debug: config.debug || false,
      enableHealthChecks: true,
      defaultTimeout: 30000
    });

    // Store plugin configuration for later registration
    this.pluginConfig = config.plugins || [];

    this.logger.info('Remote MCP Server Proxy created', {
      remoteServer: config.remoteServer.name,
      transport: config.remoteServer.transport,
      url: config.remoteServer.url,
      command: config.remoteServer.command
    });
  }

  /**
   * Connect to the remote server and set up proxying
   */
  async connect(): Promise<McpServer> {
    if (this.connected) {
      return this.proxyServer;
    }

    try {
      // Register plugins first
      await this.registerPlugins();
      
      // Create transport for remote server connection
      const transport = await this.createRemoteTransport();
      
      // Connect to remote server
      await this.remoteClient.connect(transport);
      
      // Discover remote tools
      await this.discoverRemoteTools();
      
      // Set up proxy tools on the proxy server
      await this.setupProxyTools();
      
      this.connected = true;
      this.logger.info('Successfully connected to remote MCP server and set up proxy');
      
      return this.proxyServer;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      this.logger.error('Failed to connect to remote server:', error);
      throw new ProxyConfigurationError(
        `Failed to connect to remote MCP server: ${errorMessage}`,
        {
          remoteServer: this.config.remoteServer.name || 'Unknown',
          transport: this.config.remoteServer.transport,
          error: errorMessage
        },
        error instanceof Error ? error : new Error(errorMessage)
      );
    }
  }

  /**
   * Register plugins with the plugin manager
   */
  private async registerPlugins(): Promise<void> {
    for (const pluginOrRegistration of this.pluginConfig) {
      if ('plugin' in pluginOrRegistration) {
        // PluginRegistration format
        await this.pluginManager.register(pluginOrRegistration.plugin, pluginOrRegistration.config);
      } else {
        // Direct plugin format
        await this.pluginManager.register(pluginOrRegistration);
      }
    }
  }

  /**
   * Create the appropriate transport for the remote server using TransportFactory
   */
  private async createRemoteTransport() {
    this.logger.debug('Creating transport using TransportFactory', {
      transport: this.config.remoteServer.transport,
      url: this.config.remoteServer.url,
      command: this.config.remoteServer.command
    });

    try {
      return await TransportFactory.createTransport(this.config.remoteServer);
    } catch (error) {
      this.logger.error('Failed to create transport', error);
      throw error;
    }
  }

  /**
   * Discover available tools from the remote server
   */
  private async discoverRemoteTools(): Promise<void> {
    try {
      this.logger.debug('Discovering tools from remote server');
      
      const toolsResponse = await this.remoteClient.listTools();
      
      if (!toolsResponse.tools) {
        this.logger.warn('Remote server returned no tools');
        return;
      }

      this.logger.info(`Discovered ${toolsResponse.tools.length} tools from remote server`);
      
      // Store tool definitions
      for (const tool of toolsResponse.tools) {
        this.remoteTools.set(tool.name, tool);
        this.logger.debug('Found remote tool', { 
          name: tool.name, 
          description: tool.description 
        });
      }

    } catch (error) {
      this.logger.error('Failed to discover remote tools:', error);
      throw new ToolCallError(
        `Failed to discover remote tools: ${error instanceof Error ? error.message : String(error)}`,
        'remote_tool_discovery',
        {},
        { phase: 'discovery' },
        error instanceof Error ? error : new Error(String(error))
      );
    }
  }

  /**
   * Set up proxy tools that mirror remote tools with plugin enhancement
   */
  private async setupProxyTools(): Promise<void> {
    this.logger.debug('Setting up proxy tools');

    for (const [toolName, toolDef] of this.remoteTools) {
      // Create an enhanced tool handler that includes plugin functionality
      const enhancedHandler = this.createEnhancedToolHandler(toolName, toolDef);
      
      // Register the tool on the proxy server with proper MCP format
      this.proxyServer.tool(
        toolName,
        toolDef.inputSchema || {},
        {
          description: toolDef.description || `Proxied tool: ${toolName}`
        },
        enhancedHandler
      );
      
      this.logger.debug('Registered proxy tool', { name: toolName });
    }

    this.logger.info(`Set up ${this.remoteTools.size} proxy tools with plugin enhancement`);
  }

  /**
   * Create an enhanced tool handler that adds plugin functionality
   */
  private createEnhancedToolHandler(toolName: string, toolDef: any) {
    return async (args: any, extra?: any): Promise<any> => {
      const requestId = `remote_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      
      // Create tool call context
      const context: ToolCallContext = {
        toolName,
        args,
        metadata: {
          requestId,
          timestamp: Date.now(),
          remoteServer: this.config.remoteServer.name || 'Unknown',
          transport: this.config.remoteServer.transport,
          ...(extra?.metadata || {})
        }
      };

      this.logger.debug('Processing remote tool call', {
        tool: toolName,
        requestId,
        args: Object.keys(args)
      });

      try {
        // Execute beforeToolCall hooks
        const beforeResult = await this.pluginManager.executeBeforeHooks(context);
        if (beforeResult) {
          this.logger.debug('Tool call short-circuited by beforeHook', { 
            tool: toolName, 
            requestId 
          });
          return beforeResult;
        }

        // Call the remote tool
        this.logger.debug('Calling remote tool', { tool: toolName, requestId });
        
        const remoteResult = await this.remoteClient.callTool({
          name: toolName,
          arguments: args
        });

        // Convert to our expected format
        const toolResult = {
          content: remoteResult.content || [],
          isError: remoteResult.isError || false,
          _meta: {
            requestId,
            remoteServer: this.config.remoteServer.name || 'Unknown',
            transport: this.config.remoteServer.transport,
            processedAt: new Date().toISOString(),
            ...remoteResult._meta
          }
        };

        // Execute afterToolCall hooks
        const finalResult = await this.pluginManager.executeAfterHooks(context, {
          result: toolResult,
          metadata: context.metadata
        });

        this.logger.debug('Remote tool call completed', {
          tool: toolName,
          requestId,
          enhanced: !!finalResult.result._meta?.enhanced
        });

        // Return the result in proper MCP format
        return {
          ...finalResult.result,
          _meta: {
            ...finalResult.metadata,
            ...finalResult.result._meta
          }
        };

      } catch (error) {
        this.logger.error('Remote tool call failed', {
          tool: toolName,
          requestId,
          error: error instanceof Error ? error.message : String(error)
        });

        // Return error response in MCP format
        return createErrorResponse(
          new Error(error instanceof Error ? error.message : String(error)),
          requestId
        );
      }
    };
  }

  /**
   * Get the proxy server instance
   */
  getProxyServer(): McpServer {
    return this.proxyServer;
  }

  /**
   * Get the remote client instance
   */
  getRemoteClient(): Client {
    return this.remoteClient;
  }

  /**
   * Check if connected to remote server
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * Get discovered remote tools
   */
  getRemoteTools(): Map<string, any> {
    return new Map(this.remoteTools);
  }

  /**
   * Disconnect from remote server and cleanup
   */
  async disconnect(): Promise<void> {
    if (!this.connected) {
      return;
    }

    try {
      await this.remoteClient.close();
      this.connected = false;
      this.logger.info('Disconnected from remote MCP server');
    } catch (error) {
      this.logger.error('Error during disconnect:', error);
      throw error;
    }
  }
}

/**
 * Create a proxy wrapper for a remote MCP server
 */
export async function createRemoteServerProxy(
  config: RemoteProxyWrapperOptions
): Promise<McpServer> {
  // Validate configuration upfront
  ConfigValidator.validateWithHelpfulErrors(config.remoteServer);
  
  const proxy = new RemoteMcpServerProxy(config);
  return await proxy.connect();
}

/**
 * Convenience function to create a proxy for an HTTP/SSE remote server
 */
export async function createHttpServerProxy(
  url: string,
  options?: Partial<RemoteProxyWrapperOptions>
): Promise<McpServer> {
  return createRemoteServerProxy({
    remoteServer: {
      transport: 'sse',
      url,
      name: options?.remoteServer?.name || 'HTTP Server',
      ...options?.remoteServer
    },
    ...options
  });
}

/**
 * Convenience function to create a proxy for a STDIO remote server
 */
export async function createStdioServerProxy(
  command: string,
  args?: string[],
  options?: Partial<RemoteProxyWrapperOptions>
): Promise<McpServer> {
  return createRemoteServerProxy({
    remoteServer: {
      transport: 'stdio',
      command,
      args,
      name: options?.remoteServer?.name || 'STDIO Server',
      ...options?.remoteServer
    },
    ...options
  });
}

/**
 * Convenience function to create a proxy using auto-detection
 * Automatically detects transport type from connection string
 */
export async function createAutoDetectedServerProxy(
  connectionString: string,
  options?: Partial<RemoteProxyWrapperOptions>
): Promise<McpServer> {
  const autoConfig = TransportFactory.createAutoDetectedConfig(
    connectionString,
    options?.remoteServer
  );

  return createRemoteServerProxy({
    remoteServer: autoConfig,
    ...options
  });
}