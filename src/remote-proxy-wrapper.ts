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
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { WebSocketClientTransport } from '@modelcontextprotocol/sdk/client/websocket.js';
import { createLogger } from './utils/logger.js';
import { ProxyWrapperOptions, ToolCallContext, ToolCallResult } from './interfaces/proxy-hooks.js';
import { DefaultPluginManager } from './utils/plugin-manager.js';
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
      debug: config.debug || false
    });

    // Store plugin configuration for later registration
    this.pluginConfig = config.plugins || [];

    if (config.debug) {
      this.logger = createLogger({ level: 'debug', prefix: 'REMOTE-PROXY' });
    }

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
        'REMOTE_CONNECTION_FAILED'
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
   * Create the appropriate transport for the remote server
   */
  private async createRemoteTransport() {
    const { transport, url, command, args, env, cwd, timeout } = this.config.remoteServer;

    switch (transport) {
      case 'stdio':
        if (!command) {
          throw new ProxyConfigurationError('STDIO transport requires a command', 'MISSING_COMMAND');
        }
        
        this.logger.debug('Creating STDIO transport', { command, args });
        const envVars: Record<string, string> = {};
        Object.entries({ ...process.env, ...(env || {}) }).forEach(([key, value]) => {
          if (value !== undefined) {
            envVars[key] = value;
          }
        });
        
        return new StdioClientTransport({
          command,
          args: args || [],
          env: envVars,
          cwd: cwd || process.cwd()
        });

      case 'sse':
        if (!url) {
          throw new ProxyConfigurationError('SSE transport requires a URL', 'MISSING_URL');
        }
        
        this.logger.debug('Creating SSE transport', { url });
        return new SSEClientTransport(new URL(url), {
          eventSourceInit: {
            headers: this.config.remoteServer.headers
          }
        });

      case 'websocket':
        if (!url) {
          throw new ProxyConfigurationError('WebSocket transport requires a URL', 'MISSING_URL');
        }
        
        this.logger.debug('Creating WebSocket transport', { url });
        return new WebSocketClientTransport(new URL(url));

      default:
        throw new ProxyConfigurationError(
          `Unsupported transport type: ${transport}`,
          'UNSUPPORTED_TRANSPORT'
        );
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
        'TOOL_DISCOVERY_FAILED'
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
      
      // Register the tool on the proxy server
      this.proxyServer.tool(
        toolName, 
        toolDef.description || `Proxied tool: ${toolName}`,
        toolDef.inputSchema || {},
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
    return async (args: any, extra?: any): Promise<ToolCallResult> => {
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

        return finalResult.result;

      } catch (error) {
        this.logger.error('Remote tool call failed', {
          tool: toolName,
          requestId,
          error: error instanceof Error ? error.message : String(error)
        });

        // Return error response in MCP format
        return createErrorResponse(
          new Error(error instanceof Error ? error.message : String(error)),
          `Remote tool call failed: ${toolName}`
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