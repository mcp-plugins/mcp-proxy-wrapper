/**
 * @file Proxy Wrapper Real Tests
 * @version 1.0.0
 * 
 * Real integration tests for the MCP Proxy Wrapper.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { wrapWithProxy } from './proxy-wrapper.js';
import { z } from 'zod';
import { MemoryTransport } from './test-utils/memory-transport.js';
import { jest, describe, test, expect, beforeEach, afterEach } from '@jest/globals';

// Add this to debug problems with the client and server
let debugLogging = true;
function log(...args: any[]) {
  if (debugLogging) {
    console.log(...args);
  }
}

describe('MCP Proxy Wrapper Real Tests', () => {
  let server: McpServer;
  let client: Client;
  let serverTransport: MemoryTransport;
  let clientTransport: MemoryTransport;
  
  beforeEach(async () => {
    // Create a pair of memory transports
    const transportPair = MemoryTransport.createPair();
    serverTransport = transportPair.serverTransport;
    clientTransport = transportPair.clientTransport;
    
    // Create and start the server
    server = new McpServer({
      name: 'Test Server',
      version: '1.0.0'
    }, {
      capabilities: {
        tools: {}
      }
    });
    
    await server.connect(serverTransport);
    log('Server connected');
    
    // Create and start the client
    client = new Client({
      name: 'Test Client',
      version: '1.0.0'
    }, {
      capabilities: {
        tools: {}
      }
    });
    await client.connect(clientTransport);
    log('Client connected');
  });
  
  afterEach(async () => {
    await client.close();
    await server.close();
  });
  
  test('should successfully call a tool', async () => {
    log('Starting tool call test');
    
    // Wrap the server with a proxy
    const proxiedServer = wrapWithProxy(server, {
      hooks: {}
    });
    
    // Register a tool
    proxiedServer.tool('echo', { message: z.string() }, async (args) => ({
      content: [{ type: 'text', text: args.message }]
    }));
    log('Tool registered');
    
    // Call the tool via the client - use the correct callTool signature
    const result = await client.callTool({
      name: 'echo',
      arguments: { message: 'Hello, world!' }
    });
    log('Tool call result:', result);
    
    // Verify the result
    expect(result).toHaveProperty('content');
    expect(result.content).toHaveLength(1);
    expect(result.content[0]).toHaveProperty('type', 'text');
    expect(result.content[0]).toHaveProperty('text', 'Hello, world!');
  });
  
  test('should modify arguments with beforeToolCall hook', async () => {
    let hookCalled = false;
    
    // Wrap the server with a proxy
    const proxiedServer = wrapWithProxy(server, {
      hooks: {
        beforeToolCall: async (context) => {
          hookCalled = true;
          // Modify the message argument
          context.args.message = `Modified: ${context.args.message}`;
        }
      }
    });
    
    // Register a tool
    proxiedServer.tool('echo', { message: z.string() }, async (args) => ({
      content: [{ type: 'text', text: args.message }]
    }));
    
    // Call the tool via the client - use the correct callTool signature
    const result = await client.callTool({
      name: 'echo',
      arguments: { message: 'Hello, world!' }
    });
    
    // Verify the hook was called and the result contains the modified message
    expect(hookCalled).toBe(true);
    expect(result).toEqual({
      content: [{ type: 'text', text: 'Modified: Hello, world!' }]
    });
  });
  
  test('should modify results with afterToolCall hook', async () => {
    let hookCalled = false;
    
    // Wrap the server with a proxy
    const proxiedServer = wrapWithProxy(server, {
      hooks: {
        afterToolCall: async (context, result) => {
          hookCalled = true;
          // Modify the result
          result.result.content[0].text = `Modified: ${result.result.content[0].text}`;
          return result;
        }
      }
    });
    
    // Register a tool
    proxiedServer.tool('echo', { message: z.string() }, async (args) => ({
      content: [{ type: 'text', text: args.message }]
    }));
    
    // Call the tool via the client
    const result = await client.callTool({
      name: 'echo',
      arguments: { message: 'Hello, world!' }
    });
    
    // Verify the hook was called and the result was modified
    expect(hookCalled).toBe(true);
    expect(result).toEqual({
      content: [{ type: 'text', text: 'Modified: Hello, world!' }]
    });
  });
  
  test('should short-circuit tool call if beforeToolCall returns a result', async () => {
    let toolHandlerCalled = false;
    
    // Wrap the server with a proxy
    const proxiedServer = wrapWithProxy(server, {
      hooks: {
        beforeToolCall: async () => {
          // Short-circuit the tool call by returning a result
          return {
            content: [{ type: 'text', text: 'Short-circuited result' }]
          };
        }
      }
    });
    
    // Register a tool that should not be called
    proxiedServer.tool('echo', { message: z.string() }, async (args) => {
      toolHandlerCalled = true;
      return {
        content: [{ type: 'text', text: args.message }]
      };
    });
    
    // Call the tool via the client
    const result = await client.callTool({
      name: 'echo',
      arguments: { message: 'Hello, world!' }
    });
    
    // Verify the tool handler was not called and the result is from the hook
    expect(toolHandlerCalled).toBe(false);
    expect(result).toEqual({
      content: [{ type: 'text', text: 'Short-circuited result' }]
    });
  });
  
  test('should handle errors in tool handlers', async () => {
    // Wrap the server with a proxy
    const proxiedServer = wrapWithProxy(server, {
      hooks: {}
    });
    
    // Register a tool that throws an error
    proxiedServer.tool('error', { message: z.string() }, async () => {
      throw new Error('Tool handler error');
    });
    
    // Call the tool via the client and expect it to throw
    await expect(client.callTool({
      name: 'error',
      arguments: { message: 'Hello, world!' }
    }))
      .rejects.toThrow();
  });
  
  test('should handle errors in beforeToolCall hook', async () => {
    // Wrap the server with a proxy
    const proxiedServer = wrapWithProxy(server, {
      hooks: {
        beforeToolCall: async () => {
          throw new Error('beforeToolCall hook error');
        }
      }
    });
    
    // Register a tool
    proxiedServer.tool('echo', { message: z.string() }, async (args) => ({
      content: [{ type: 'text', text: args.message }]
    }));
    
    // Call the tool via the client and expect it to throw
    await expect(client.callTool({
      name: 'echo',
      arguments: { message: 'Hello, world!' }
    }))
      .rejects.toThrow();
  });
  
  test('should handle errors in afterToolCall hook', async () => {
    // Wrap the server with a proxy
    const proxiedServer = wrapWithProxy(server, {
      hooks: {
        afterToolCall: async () => {
          throw new Error('afterToolCall hook error');
        }
      }
    });
    
    // Register a tool
    proxiedServer.tool('echo', { message: z.string() }, async (args) => ({
      content: [{ type: 'text', text: args.message }]
    }));
    
    // Call the tool via the client and expect it to throw
    await expect(client.callTool({
      name: 'echo',
      arguments: { message: 'Hello, world!' }
    }))
      .rejects.toThrow();
  });
  
  test('should pass tool metadata to hooks', async () => {
    let metadataReceived = false;
    
    // Wrap the server with a proxy
    const proxiedServer = wrapWithProxy(server, {
      hooks: {
        beforeToolCall: async (context) => {
          metadataReceived = 
            context.toolName === 'metadata' && 
            context.toolSchema.description === 'Test description';
        }
      }
    });
    
    // Register a tool with metadata
    proxiedServer.tool(
      'metadata', 
      { message: z.string() },
      async (args) => ({
        content: [{ type: 'text', text: args.message }]
      }),
      { description: 'Test description' }
    );
    
    // Call the tool via the client
    await client.callTool({
      name: 'metadata',
      arguments: { message: 'Hello, world!' }
    });
    
    // Verify the metadata was received by the hook
    expect(metadataReceived).toBe(true);
  });
  
  test('should handle multiple tools with different hooks', async () => {
    const toolResults: Record<string, string> = {};
    
    // Wrap the server with a proxy
    const proxiedServer = wrapWithProxy(server, {
      hooks: {
        beforeToolCall: async (context) => {
          if (context.toolName === 'tool1') {
            context.args.message = `Tool1 Modified: ${context.args.message}`;
          }
        },
        afterToolCall: async (context, result) => {
          if (context.toolName === 'tool2') {
            result.result.content[0].text = `Tool2 Modified: ${result.result.content[0].text}`;
          }
          return result;
        }
      }
    });
    
    // Register two tools
    proxiedServer.tool('tool1', { message: z.string() }, async (args) => {
      toolResults.tool1 = args.message;
      return {
        content: [{ type: 'text', text: args.message }]
      };
    });
    
    proxiedServer.tool('tool2', { message: z.string() }, async (args) => {
      toolResults.tool2 = args.message;
      return {
        content: [{ type: 'text', text: args.message }]
      };
    });
    
    // Call both tools
    const result1 = await client.callTool({
      name: 'tool1',
      arguments: { message: 'Hello from tool1' }
    });
    const result2 = await client.callTool({
      name: 'tool2',
      arguments: { message: 'Hello from tool2' }
    });
    
    // Verify the results
    expect(toolResults.tool1).toBe('Tool1 Modified: Hello from tool1');
    expect(toolResults.tool2).toBe('Hello from tool2');
    
    expect(result1).toEqual({
      content: [{ type: 'text', text: 'Tool1 Modified: Hello from tool1' }]
    });
    
    expect(result2).toEqual({
      content: [{ type: 'text', text: 'Tool2 Modified: Hello from tool2' }]
    });
  });
}); 