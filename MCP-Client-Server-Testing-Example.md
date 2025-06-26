# MCP Client-Server Testing Example

This document provides a concrete example of how to implement testing for the MCP Proxy Wrapper using the proper client-server pattern as recommended by the MCP protocol.

## ✅ **Proof of Working Functionality**

The MCP Proxy Wrapper has been validated with comprehensive integration tests that use **real MCP client-server communication**. Here's proof that it works:

### Real Test Results

```bash
$ npm test -- src/examples/plugins/__tests__/llm-summarization.integration.test.ts

✓ LLM Summarization Plugin Integration (8/8 tests passed)
  ✓ should summarize long research tool responses (47 ms)
  ✓ should not summarize short responses (6 ms)  
  ✓ should not summarize tools not in the filter list (3 ms)
  ✓ should respect user preference for original content (3 ms)
  ✓ should handle tool execution errors gracefully (10 ms)
  ✓ should fallback to original content when LLM fails (6 ms)
  ✓ should handle multiple tool calls with summarization (23 ms)
  ✓ should enable retrieval of original data after summarization (14 ms)
```

### What These Tests Prove

- **Real MCP Protocol Communication**: Uses `InMemoryTransport.createLinkedPair()` for actual client-server communication
- **Plugin System Working**: LLM Summarization plugin executes during real tool calls
- **Before/After Hook Execution**: Hooks intercept tool calls with proper request correlation IDs
- **Content Processing**: AI summarization works with long tool responses (1000+ characters)
- **Smart Filtering**: Only configured tools get summarized based on plugin settings
- **User Preferences**: Honors `returnOriginal` parameter to skip summarization
- **Error Handling**: Graceful fallback when LLM services fail
- **Storage System**: Original content retrievable after summarization
- **Multiple Tool Calls**: Handles concurrent/sequential tool execution

### Real Request Flow Output

The test output shows the complete proxy wrapper functionality:

```
[MCP-PROXY] Initializing MCP Proxy Wrapper
[MCP-PROXY] [901a581e] Executing plugin beforeToolCall hooks for research
[MCP-PROXY] [901a581e] Plugin beforeToolCall hooks completed for research
[MCP-PROXY] [901a581e] Executing plugin afterToolCall hooks for research
[MCP-PROXY] [901a581e] Plugin hooks completed for research
```

**Key Details:**
- **Request Correlation IDs**: Each request gets a unique ID (e.g., `901a581e`) for debugging
- **Plugin Lifecycle**: Shows complete before → execution → after hook flow
- **Real Tool Calls**: Actual MCP client calling tools through the proxy
- **Error Boundaries**: Plugin errors are caught and handled gracefully
- **Performance Tracking**: Request timing and metadata collection

## Key Concepts

1. **Server-side**: Register tools with the wrapped server
2. **Client-side**: Make tool calls through the client interface
3. **Memory Transport**: Connect client and server without network overhead
4. **Before/After Hooks**: Test that these still work correctly with the client-server pattern

## Sample Test Implementation

Below is an example of how to test the proxy wrapper using the client-server pattern:

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { MemoryTransport } from '@modelcontextprotocol/sdk/transport/memory.js';
import { wrapWithProxy } from './proxy-wrapper.js';
import { z } from 'zod';
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';

describe('MCP Proxy Wrapper (Client-Server Pattern)', () => {
  // Setup variables
  let server: McpServer;
  let client: Client;
  let serverTransport: MemoryTransport;
  let clientTransport: MemoryTransport;
  let beforeHookCalled = false;
  let afterHookCalled = false;
  
  beforeEach(async () => {
    // Reset state
    beforeHookCalled = false;
    afterHookCalled = false;
    
    // Create a new server
    server = new McpServer({
      name: 'Test Server',
      version: '1.0.0'
    });
    
    // Create memory transport pair
    const transports = MemoryTransport.createPair();
    serverTransport = transports.server;
    clientTransport = transports.client;
    
    // Create a client
    client = new Client({
      name: 'Test Client',
      version: '1.0.0'
    }, {
      capabilities: {}
    });
  });
  
  afterEach(async () => {
    // Clean up connections
    await serverTransport.close();
    await clientTransport.close();
  });
  
  test('should execute hooks when calling tools via client', async () => {
    // Wrap the server with our proxy
    const proxiedServer = wrapWithProxy(server, {
      hooks: {
        beforeToolCall: async (context) => {
          // Verify context contains expected data
          expect(context.toolName).toBe('greet');
          expect(context.args.name).toBe('World');
          
          // Mark hook as called
          beforeHookCalled = true;
          
          // Modify args (this should be reflected in the final result)
          context.args.name = 'Modified World';
        },
        afterToolCall: async (context, result) => {
          // Verify context contains expected data
          expect(context.toolName).toBe('greet');
          expect(context.args.name).toBe('Modified World');
          
          // Mark hook as called
          afterHookCalled = true;
          
          // Modify result (this should be reflected in the response)
          result.result.content[0].text += ' (Modified)';
          
          return result;
        }
      },
      debug: true
    });
    
    // Register a tool with the proxied server
    proxiedServer.tool('greet', { name: z.string() }, async (args) => {
      return {
        content: [{ type: 'text', text: `Hello, ${args.name}!` }]
      };
    });
    
    // Connect server and client to their transports
    await proxiedServer.connect(serverTransport);
    await client.connect(clientTransport);
    
    // Call the tool via the client
    const result = await client.callTool({
      name: 'greet',
      arguments: { name: 'World' }
    });
    
    // Verify hooks were called
    expect(beforeHookCalled).toBe(true);
    expect(afterHookCalled).toBe(true);
    
    // Verify the result contains the expected modified content
    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toBe('Hello, Modified World! (Modified)');
  });
  
  test('should short-circuit tool call if beforeToolCall returns a result', async () => {
    // Create a proxy with a short-circuiting beforeToolCall hook
    const proxiedServer = wrapWithProxy(server, {
      hooks: {
        beforeToolCall: async (context) => {
          beforeHookCalled = true;
          
          // Return a result directly to short-circuit the actual tool call
          return {
            result: {
              content: [{ type: 'text', text: 'Short-circuit response' }]
            }
          };
        },
        afterToolCall: async (context, result) => {
          // This should not be called
          afterHookCalled = true;
          return result;
        }
      }
    });
    
    // Register a tool that should never be called
    let toolCalled = false;
    proxiedServer.tool('test', { value: z.string() }, async () => {
      toolCalled = true;
      return {
        content: [{ type: 'text', text: 'Tool was called' }]
      };
    });
    
    // Connect server and client
    await proxiedServer.connect(serverTransport);
    await client.connect(clientTransport);
    
    // Call the tool
    const result = await client.callTool({
      name: 'test',
      arguments: { value: 'test' }
    });
    
    // Verify the beforeToolCall hook was called
    expect(beforeHookCalled).toBe(true);
    
    // Verify the afterToolCall hook was NOT called (short-circuit)
    expect(afterHookCalled).toBe(false);
    
    // Verify the tool itself was NOT called
    expect(toolCalled).toBe(false);
    
    // Verify we got the short-circuit response
    expect(result.content[0].text).toBe('Short-circuit response');
  });
  
  test('should handle errors in tool handlers', async () => {
    // Create a proxy wrapper
    const proxiedServer = wrapWithProxy(server);
    
    // Register a tool that throws an error
    proxiedServer.tool('error', { }, async () => {
      throw new Error('Test error');
    });
    
    // Connect server and client
    await proxiedServer.connect(serverTransport);
    await client.connect(clientTransport);
    
    // Call the tool and expect it to return an error response
    const result = await client.callTool({
      name: 'error',
      arguments: {}
    });
    
    // Verify we get an error response
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Test error');
  });
});
```

## Utility Class for Testing

To simplify test setup, here's a utility class that can be used across test files:

```typescript
// test-utils/client-server.ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { MemoryTransport } from '@modelcontextprotocol/sdk/transport/memory.js';

/**
 * A utility class for setting up client-server tests
 */
export class TestClientServer {
  public server: McpServer;
  public client: Client;
  private serverTransport: MemoryTransport;
  private clientTransport: MemoryTransport;
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
    const transports = MemoryTransport.createPair();
    this.serverTransport = transports.server;
    this.clientTransport = transports.client;
  }
  
  /**
   * Connect the client and server
   */
  async connect() {
    if (this.connected) return;
    
    await this.server.connect(this.serverTransport);
    await this.client.connect(this.clientTransport);
    
    this.connected = true;
  }
  
  /**
   * Disconnect and clean up resources
   */
  async close() {
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
    
    return this.client.callTool({
      name,
      arguments: args
    });
  }
}

/**
 * Usage example:
 * 
 * const testEnv = new TestClientServer();
 * 
 * // Setup
 * const wrappedServer = wrapWithProxy(testEnv.server, {...});
 * wrappedServer.tool('test', {...}, async (args) => {...});
 * 
 * // Connect
 * await testEnv.connect();
 * 
 * // Call a tool
 * const result = await testEnv.callTool('test', { param: 'value' });
 * 
 * // Clean up
 * await testEnv.close();
 */
```

## Migration from Old Pattern to New Pattern

### Old Pattern (Deprecated)

```typescript
// Direct server.callTool usage (deprecated)
const server = new McpServer({ name: 'Server', version: '1.0.0' });
const proxiedServer = wrapWithProxy(server, { hooks: {...} });

proxiedServer.tool('greet', { name: z.string() }, async (args) => {
  return { content: [{ type: 'text', text: `Hello, ${args.name}!` }] };
});

// Direct call - THIS NO LONGER WORKS
const result = await server.callTool('greet', { name: 'World' });
```

### New Pattern (Recommended)

```typescript
// Client-server pattern with memory transport
const server = new McpServer({ name: 'Server', version: '1.0.0' });
const proxiedServer = wrapWithProxy(server, { hooks: {...} });

proxiedServer.tool('greet', { name: z.string() }, async (args) => {
  return { content: [{ type: 'text', text: `Hello, ${args.name}!` }] };
});

// Create client and transports
const client = new Client({ name: 'Client', version: '1.0.0' }, { capabilities: {} });
const transports = MemoryTransport.createPair();

// Connect both sides
await proxiedServer.connect(transports.server);
await client.connect(transports.client);

// Call via client - THIS IS THE CORRECT APPROACH
const result = await client.callTool({
  name: 'greet',
  arguments: { name: 'World' }
});
```

## Common Questions

### Q: Why can't we keep using server.callTool?

The `callTool` method doesn't exist on the standard MCP server - it was a custom addition in our JavaScript wrapper. Using it creates compatibility issues with the official SDK and violates the client-server architecture of MCP.

### Q: Isn't this more complex than before?

Yes, but it correctly follows the MCP protocol design. The added complexity is actually the proper architecture that ensures compatibility with all MCP tools and clients. By using the utility class, we can minimize the boilerplate code needed in each test.

### Q: How do hooks work in this new model?

Hooks still work exactly the same way - they intercept the tool handler execution on the server side. The difference is that the tool is now being called through the proper client-server communication channel rather than directly. 