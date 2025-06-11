/**
 * @file MCP Client-Server Test Utility
 * @version 1.0.0
 * 
 * A comprehensive test utility that uses real MCP Client and Server instances
 * to test the proxy wrapper functionality through actual MCP protocol communication.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { wrapWithProxy } from '../proxy-wrapper.js';
import { ProxyWrapperOptions } from '../interfaces/proxy-hooks.js';

/**
 * Configuration for test client-server setup
 */
export interface TestConfig {
  serverName?: string;
  clientName?: string;
  proxyOptions?: ProxyWrapperOptions;
}

/**
 * Result of a tool call through the MCP Client
 */
export interface ToolCallResult {
  content: Array<{
    type: string;
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  isError?: boolean;
  _meta?: any;
}

/**
 * Test environment that sets up real MCP Client-Server communication
 * with the proxy wrapper in between.
 */
export class McpClientServerTest {
  public server: McpServer;
  public proxiedServer: McpServer;
  public client: Client;
  
  private serverTransport: InMemoryTransport;
  private clientTransport: InMemoryTransport;
  private connected: boolean = false;
  
  constructor(config: TestConfig = {}) {
    // Create server
    this.server = new McpServer({
      name: config.serverName || 'Test Server',
      version: '1.0.0'
    });
    
    // Wrap server with proxy
    this.proxiedServer = wrapWithProxy(this.server, config.proxyOptions);
    
    // Create client
    this.client = new Client({
      name: config.clientName || 'Test Client',
      version: '1.0.0'
    }, {
      capabilities: {}
    });
    
    // Create linked transports
    const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();
    this.serverTransport = serverTransport;
    this.clientTransport = clientTransport;
    
    // Set up error handlers
    this.client.onerror = (error) => {
      console.error('Client error:', error);
    };
  }
  
  /**
   * Connect client and server
   */
  async connect(): Promise<void> {
    if (this.connected) return;
    
    try {
      // Connect server first
      await this.proxiedServer.connect(this.serverTransport);
      
      // Then connect client
      await this.client.connect(this.clientTransport);
      
      this.connected = true;
    } catch (error) {
      throw new Error(`Failed to connect client-server: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Disconnect and cleanup
   */
  async disconnect(): Promise<void> {
    if (!this.connected) return;
    
    try {
      await this.clientTransport.close();
      await this.serverTransport.close();
      this.connected = false;
    } catch (error) {
      console.error('Error during disconnect:', error);
    }
  }
  
  /**
   * Register a tool on the server
   * Using the simple 2-arg version (name + handler) to avoid Zod schema requirements
   */
  registerTool(name: string, handler: (args: any, extra?: any) => Promise<any>): void {
    // Use the simple 2-arg version: tool(name, handler)
    this.proxiedServer.tool(name, handler);
  }
  
  /**
   * Call a tool via the MCP Client
   */
  async callTool(name: string, args: Record<string, any>): Promise<ToolCallResult> {
    if (!this.connected) {
      await this.connect();
    }
    
    try {
      const result = await this.client.callTool({
        name,
        arguments: args
      });
      
      return result as ToolCallResult;
    } catch (error) {
      throw new Error(`Tool call failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * List available tools via the MCP Client
   */
  async listTools(): Promise<any> {
    if (!this.connected) {
      await this.connect();
    }
    
    try {
      return await this.client.listTools();
    } catch (error) {
      throw new Error(`List tools failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Send a tools/list request via the MCP Client
   */
  async sendToolsListRequest(): Promise<any> {
    if (!this.connected) {
      await this.connect();
    }
    
    try {
      return await this.client.listTools();
    } catch (error) {
      throw new Error(`Tools list request failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Check if client and server are connected
   */
  isConnected(): boolean {
    return this.connected;
  }
}

/**
 * Utility function to create a basic test environment
 */
export function createTestEnvironment(config?: TestConfig): McpClientServerTest {
  return new McpClientServerTest(config);
}

/**
 * Utility function to create test environment with specific proxy options
 */
export function createTestWithProxy(proxyOptions: ProxyWrapperOptions): McpClientServerTest {
  return new McpClientServerTest({ proxyOptions });
}