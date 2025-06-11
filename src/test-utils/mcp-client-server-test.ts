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
import { z } from 'zod';

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
   * Using Zod schema to ensure arguments are passed correctly
   */
  registerTool(name: string, handler: (args: any, extra?: any) => Promise<any>): void {
    // Use a comprehensive Zod schema that accepts all common test properties
    const testSchema = {
      // Basic test properties
      name: z.string().optional(),
      value: z.any().optional(),
      message: z.string().optional(),
      operation: z.string().optional(),
      a: z.number().optional(),
      b: z.number().optional(),
      
      // Collection properties
      items: z.array(z.any()).optional(),
      data: z.array(z.any()).optional(),
      
      // Text content properties
      text: z.string().optional(),
      unicode: z.string().optional(),
      json: z.string().optional(),
      
      // Identifiers
      id: z.number().optional(),
      param: z.string().optional(),
      
      // Null handling test properties
      nullValue: z.null().optional(),
      undefinedValue: z.undefined().optional(),
      emptyString: z.string().optional(),
      
      // Special character test properties
      specialChars: z.string().optional(),
      quotes: z.string().optional(),
      
      // Performance test properties
      index: z.number().optional(),
      callNumber: z.number().optional(),
      
      // Hook test properties
      shouldFail: z.boolean().optional(),
      failCount: z.number().optional(),
      
      // Large data properties
      largeText: z.string().optional(),
      largeArray: z.array(z.any()).optional(),
    };
    this.proxiedServer.tool(name, testSchema, handler);
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