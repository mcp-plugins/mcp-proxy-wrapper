/**
 * @file MCP Proxy Wrapper Client-Server Example Test
 * @version 1.0.0
 * 
 * This file demonstrates how to test the MCP Proxy Wrapper using the proper
 * client-server pattern as recommended by the MCP protocol. It shows how
 * to set up tests that follow MCP design principles while still maintaining
 * the ability to hook into tool calls.
 */

import { wrapWithProxy } from './proxy-wrapper.js';
import { TestClientServer } from './test-utils/client-server.js';
import { z } from 'zod';
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';

describe('MCP Proxy Wrapper (Client-Server Pattern)', () => {
  // Setup variables
  let testEnv: TestClientServer;
  let beforeHookCalled = false;
  let afterHookCalled = false;
  
  beforeEach(async () => {
    // Reset state
    beforeHookCalled = false;
    afterHookCalled = false;
    
    // Create a new test environment
    testEnv = new TestClientServer('Example Test Server', 'Example Test Client');
  });
  
  afterEach(async () => {
    // Clean up connections
    await testEnv.close();
  });
  
  test('should execute hooks when calling tools via client', async () => {
    // Wrap the server with our proxy
    const proxiedServer = wrapWithProxy(testEnv.server, {
      hooks: {
        beforeToolCall: async (context) => {
          // Verify context contains expected data
          expect(context.toolName).toBe('greet');
          expect(context.args.name).toBe('World');
          
          // Mark hook as called and record time
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
    
    // Connect server and client
    await testEnv.connect();
    
    // Call the tool via the test utility
    const result = await testEnv.callTool('greet', { name: 'World' });
    
    // Verify hooks were called
    expect(beforeHookCalled).toBe(true);
    expect(afterHookCalled).toBe(true);
    
    // Verify the result contains the expected modified content
    expect(result.content[0].type).toBe('text');
    expect(result.content[0].text).toBe('Hello, Modified World! (Modified)');
  });
  
  test('should short-circuit tool call if beforeToolCall returns a result', async () => {
    // Create a proxy with a short-circuiting beforeToolCall hook
    const proxiedServer = wrapWithProxy(testEnv.server, {
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
    
    // Call the tool via the test utility
    const result = await testEnv.callTool('test', { value: 'test' });
    
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
    const proxiedServer = wrapWithProxy(testEnv.server);
    
    // Register a tool that throws an error
    proxiedServer.tool('error', { }, async () => {
      throw new Error('Test error');
    });
    
    // Call the tool and expect it to return an error response
    const result = await testEnv.callTool('error', {});
    
    // Verify we get an error response
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Test error');
  });
  
  test('should demonstrate metadata tracking', async () => {
    // Create a proxy with metadata
    const metadata = { source: 'test', session: '12345' };
    
    // Create proxy with metadata
    const proxiedServer = wrapWithProxy(testEnv.server, {
      metadata,
      hooks: {
        beforeToolCall: async (context) => {
          // Verify metadata is included in context
          expect(context.metadata).toMatchObject(metadata);
          beforeHookCalled = true;
        },
        afterToolCall: async (context, result) => {
          // Verify metadata is included in result
          expect(result.metadata).toMatchObject(metadata);
          afterHookCalled = true;
          return result;
        }
      }
    });
    
    // Register a test tool
    proxiedServer.tool('meta-test', { }, async () => {
      return {
        content: [{ type: 'text', text: 'Metadata test' }]
      };
    });
    
    // Call the tool
    await testEnv.callTool('meta-test', {});
    
    // Verify hooks were called
    expect(beforeHookCalled).toBe(true);
    expect(afterHookCalled).toBe(true);
  });
  
  // This test demonstrates a more complex scenario with multiple tools
  test('should handle multiple tools and sequential calls', async () => {
    // Create a proxy wrapper that tracks call order
    const callOrder: string[] = [];
    
    const proxiedServer = wrapWithProxy(testEnv.server, {
      hooks: {
        beforeToolCall: async (context) => {
          callOrder.push(`before:${context.toolName}`);
        },
        afterToolCall: async (context, result) => {
          callOrder.push(`after:${context.toolName}`);
          return result;
        }
      }
    });
    
    // Register multiple tools
    proxiedServer.tool('tool1', { }, async () => {
      callOrder.push('execute:tool1');
      return { content: [{ type: 'text', text: 'Tool 1 result' }] };
    });
    
    proxiedServer.tool('tool2', { }, async () => {
      callOrder.push('execute:tool2');
      return { content: [{ type: 'text', text: 'Tool 2 result' }] };
    });
    
    // Call tools in sequence
    await testEnv.callTool('tool1', {});
    await testEnv.callTool('tool2', {});
    
    // Verify call order
    expect(callOrder).toEqual([
      'before:tool1',
      'execute:tool1',
      'after:tool1',
      'before:tool2',
      'execute:tool2',
      'after:tool2'
    ]);
  });
}); 