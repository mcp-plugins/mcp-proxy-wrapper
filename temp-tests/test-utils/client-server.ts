/**
 * @file Client-Server Test Utility
 * @version 1.0.0
 * 
 * A utility class for setting up client-server tests for the MCP Proxy Wrapper.
 * This provides an easier way to create tests that follow the standard MCP pattern.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';

/**
 * A utility class for setting up client-server tests
 */
export class TestClientServer {
  public server: McpServer;
  public client: Client;
  private serverTransport: InMemoryTransport;
  private clientTransport: InMemoryTransport;
  private connected: boolean = false;
  
  /**
   * Creates a new TestClientServer instance
   * @param serverName The name of the test server
   * @param clientName The name of the test client
   */
  constructor(serverName = 'Test Server', clientName = 'Test Client') {
    // Create server
    this.server = new McpServer({
      name: serverName,
      version: '1.0.0'
    });
    
    // Create client
    this.client = new Client({
      name: clientName,
      version: '1.0.0'
    }, {
      capabilities: {}
    });
    
    // Create transports
    const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();
    this.serverTransport = serverTransport;
    this.clientTransport = clientTransport;
  }
  
  /**
   * Connect the client and server
   */
  async connect(): Promise<void> {
    if (this.connected) return;
    
    await this.server.connect(this.serverTransport);
    await this.client.connect(this.clientTransport);
    
    this.connected = true;
  }
  
  /**
   * Disconnect and clean up resources
   */
  async close(): Promise<void> {
    if (!this.connected) return;
    
    await this.clientTransport.close();
    await this.serverTransport.close();
    
    this.connected = false;
  }
  
  /**
   * Call a tool on the server via the client
   * @param name Tool name
   * @param args Tool arguments
   */
  async callTool(name: string, args: Record<string, any>) {
    if (!this.connected) {
      await this.connect();
    }
    
    return await this.client.callTool({
      name,
      arguments: args
    });
  }
  
  /**
   * List available tools from the server
   */
  async listTools() {
    if (!this.connected) {
      await this.connect();
    }
    
    return await this.client.listTools();
  }
}

/**
 * Usage example:
 * 
 * ```typescript
 * const testEnv = new TestClientServer();
 * 
 * // Setup
 * const wrappedServer = wrapWithProxy(testEnv.server, { hooks: { ... } });
 * wrappedServer.tool('test', { param: z.string() }, async (args) => { ... });
 * 
 * // Connect (optional - callTool will connect automatically if needed)
 * await testEnv.connect();
 * 
 * // Call a tool
 * const result = await testEnv.callTool('test', { param: 'value' });
 * 
 * // Clean up when done
 * await testEnv.close();
 * ```
 */ 