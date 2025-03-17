/**
 * @file Proxy Wrapper Real Tests
 * @version 1.0.0
 * 
 * Integration tests for the MCP Proxy Wrapper using real MCP server and client instances.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { wrapWithProxy } from './proxy-wrapper.js';
import { z } from 'zod';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';

describe('MCP Proxy Wrapper Real Tests', () => {
  let server: McpServer;
  let client: Client;
  
  beforeEach(async () => {
    // Create a new server for each test
    server = new McpServer({
      name: 'Test Server',
      version: '1.0.0'
    });
    
    // Create a client
    client = new Client({
      name: 'Test Client',
      version: '1.0.0'
    }, {
      capabilities: {}
    });
  });
  
  afterEach(async () => {
    // Disconnect the client
    await client.disconnect();
  });
  
  test('should successfully call tools through the proxy', async () => {
    // Register a tool
    server.tool('greet', { name: z.string() }, async (args) => {
      return {
        content: [{ type: 'text', text: `Hello, ${args.name}!` }]
      };
    });
    
    // Wrap with proxy
    const proxiedServer = wrapWithProxy(server);
    
    // Create a direct connection between client and server for testing
    const { clientTransport, serverTransport } = createDirectTransports();
    
    // Connect the server and client
    await proxiedServer.connect(serverTransport);
    await client.connect(clientTransport);
    
    // Call the tool
    const result = await client.callTool('greet', { name: 'World' });
    
    // Check the result
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toBe('Hello, World!');
  });
  
  test('should modify arguments with beforeToolCall hook', async () => {
    // Register a tool
    server.tool('greet', { name: z.string() }, async (args) => {
      return {
        content: [{ type: 'text', text: `Hello, ${args.name}!` }]
      };
    });
    
    // Wrap with proxy and hooks
    const proxiedServer = wrapWithProxy(server, {
      hooks: {
        beforeToolCall: async (context) => {
          // Modify the name argument
          if (context.toolName === 'greet') {
            context.args.name = `${context.args.name} (modified)`;
          }
        }
      }
    });
    
    // Create a direct connection between client and server for testing
    const { clientTransport, serverTransport } = createDirectTransports();
    
    // Connect the server and client
    await proxiedServer.connect(serverTransport);
    await client.connect(clientTransport);
    
    // Call the tool
    const result = await client.callTool('greet', { name: 'World' });
    
    // Check the result
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toBe('Hello, World (modified)!');
  });
  
  test('should modify results with afterToolCall hook', async () => {
    // Register a tool
    server.tool('greet', { name: z.string() }, async (args) => {
      return {
        content: [{ type: 'text', text: `Hello, ${args.name}!` }]
      };
    });
    
    // Wrap with proxy and hooks
    const proxiedServer = wrapWithProxy(server, {
      hooks: {
        afterToolCall: async (context, result) => {
          // Modify the result
          if (context.toolName === 'greet' && result.result.content && result.result.content[0]) {
            result.result.content[0].text += ' Thanks for using our service!';
          }
          
          return result;
        }
      }
    });
    
    // Create a direct connection between client and server for testing
    const { clientTransport, serverTransport } = createDirectTransports();
    
    // Connect the server and client
    await proxiedServer.connect(serverTransport);
    await client.connect(clientTransport);
    
    // Call the tool
    const result = await client.callTool('greet', { name: 'World' });
    
    // Check the result
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toBe('Hello, World! Thanks for using our service!');
  });
  
  test('should short-circuit tool calls with beforeToolCall hook', async () => {
    // Register a tool
    server.tool('greet', { name: z.string() }, async (args) => {
      return {
        content: [{ type: 'text', text: `Hello, ${args.name}!` }]
      };
    });
    
    // Wrap with proxy and hooks
    const proxiedServer = wrapWithProxy(server, {
      hooks: {
        beforeToolCall: async (context) => {
          // Short-circuit the call if the name is 'blocked'
          if (context.toolName === 'greet' && context.args.name === 'blocked') {
            return {
              result: {
                content: [{ type: 'text', text: 'This name is blocked.' }]
              }
            };
          }
        }
      }
    });
    
    // Create a direct connection between client and server for testing
    const { clientTransport, serverTransport } = createDirectTransports();
    
    // Connect the server and client
    await proxiedServer.connect(serverTransport);
    await client.connect(clientTransport);
    
    // Call the tool with a blocked name
    const result = await client.callTool('greet', { name: 'blocked' });
    
    // Check the result
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toBe('This name is blocked.');
  });
  
  test('should handle errors in tool handlers', async () => {
    // Register a tool that throws an error
    server.tool('error', { message: z.string() }, async (args) => {
      throw new Error(args.message);
    });
    
    // Wrap with proxy
    const proxiedServer = wrapWithProxy(server);
    
    // Create a direct connection between client and server for testing
    const { clientTransport, serverTransport } = createDirectTransports();
    
    // Connect the server and client
    await proxiedServer.connect(serverTransport);
    await client.connect(clientTransport);
    
    // Call the tool
    const result = await client.callTool('error', { message: 'Test error' });
    
    // Check the result
    expect(result.isError).toBe(true);
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toBe('Error: Test error');
  });
  
  test('should handle errors in beforeToolCall hook', async () => {
    // Register a tool
    server.tool('greet', { name: z.string() }, async (args) => {
      return {
        content: [{ type: 'text', text: `Hello, ${args.name}!` }]
      };
    });
    
    // Wrap with proxy and hooks
    const proxiedServer = wrapWithProxy(server, {
      hooks: {
        beforeToolCall: async () => {
          throw new Error('Hook error');
        }
      }
    });
    
    // Create a direct connection between client and server for testing
    const { clientTransport, serverTransport } = createDirectTransports();
    
    // Connect the server and client
    await proxiedServer.connect(serverTransport);
    await client.connect(clientTransport);
    
    // Call the tool
    const result = await client.callTool('greet', { name: 'World' });
    
    // Check the result
    expect(result.isError).toBe(true);
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toContain('Hook error');
  });
  
  test('should handle errors in afterToolCall hook', async () => {
    // Register a tool
    server.tool('greet', { name: z.string() }, async (args) => {
      return {
        content: [{ type: 'text', text: `Hello, ${args.name}!` }]
      };
    });
    
    // Wrap with proxy and hooks
    const proxiedServer = wrapWithProxy(server, {
      hooks: {
        afterToolCall: async () => {
          throw new Error('Hook error');
        }
      }
    });
    
    // Create a direct connection between client and server for testing
    const { clientTransport, serverTransport } = createDirectTransports();
    
    // Connect the server and client
    await proxiedServer.connect(serverTransport);
    await client.connect(clientTransport);
    
    // Call the tool
    const result = await client.callTool('greet', { name: 'World' });
    
    // Check the result
    expect(result.isError).toBe(true);
    expect(result.content).toHaveLength(1);
    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toContain('Hook error');
  });
});

/**
 * Creates a pair of transports that are directly connected to each other
 * for testing purposes.
 */
function createDirectTransports() {
  const messages = [];
  const clientCallbacks = [];
  const serverCallbacks = [];

  const clientTransport = {
    connect: async () => {},
    disconnect: async () => {},
    send: (message) => {
      messages.push(message);
      if (serverCallbacks.length > 0) {
        const callback = serverCallbacks.shift();
        callback(message);
      }
    },
    receive: (callback) => {
      clientCallbacks.push(callback);
    }
  };

  const serverTransport = {
    connect: async () => {},
    disconnect: async () => {},
    send: (message) => {
      if (clientCallbacks.length > 0) {
        const callback = clientCallbacks.shift();
        callback(message);
      }
    },
    receive: (callback) => {
      serverCallbacks.push(callback);
    }
  };

  return { clientTransport, serverTransport };
} 