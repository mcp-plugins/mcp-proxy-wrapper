/**
 * @file Proxy Wrapper Example Test
 * @version 1.0.0
 * 
 * Minimal example test for the MCP Proxy Wrapper that demonstrates
 * the core functionality without using the actual MCP SDK.
 * 
 * NOTE: This is for demonstration only. In a real environment,
 * you should use proper types and not bypass TypeScript checks.
 */

// @ts-nocheck - Disable TypeScript checks for this example test
import { wrapWithProxy } from './proxy-wrapper.js';
import { jest, describe, test, expect } from '@jest/globals';

// Simple response type for our mock server
interface Response {
  content: Array<{ type: string, text: string }>;
}

describe('MCP Proxy Wrapper Example', () => {
  test('should demonstrate proxy functionality', async () => {
    // Create a mock server
    const mockServer = {
      tools: new Map(),
      tool: function(name, schema, handler) {
        this.tools.set(name, { handler });
        return { name, schema };
      }
    };

    // Track hook execution
    let beforeHookCalled = false;
    let afterHookCalled = false;
    let originalArgs = null;
    let modifiedArgs = null;

    // Wrap the server with a proxy
    const proxiedServer = wrapWithProxy(mockServer, {
      hooks: {
        beforeToolCall: async (context) => {
          beforeHookCalled = true;
          originalArgs = { ...context.args };
          context.args.name = `${context.args.name} (modified)`;
          modifiedArgs = { ...context.args };
        },
        
        afterToolCall: async (context, result) => {
          afterHookCalled = true;
          result.result.content[0].text += ' (modified result)';
          return result;
        }
      },
      debug: true
    });

    // Create a test handler
    const originalHandler = jest.fn().mockImplementation((args) => ({
      content: [{ type: 'text', text: `Hello, ${args.name}!` }]
    }));

    // Register the tool
    proxiedServer.tool('greet', 'A greeting tool', originalHandler);

    // Get the wrapped handler
    const wrappedHandler = mockServer.tools.get('greet').handler;

    // Call the wrapped handler directly
    const result = await wrappedHandler({ name: 'World' }, {});

    // Verify hooks were called
    expect(beforeHookCalled).toBe(true);
    expect(afterHookCalled).toBe(true);

    // Verify arguments were modified
    expect(originalArgs).toEqual({ name: 'World' });
    expect(modifiedArgs).toEqual({ name: 'World (modified)' });

    // Verify original handler was called with modified args
    expect(originalHandler).toHaveBeenCalledWith(
      { name: 'World (modified)' },
      {}
    );

    // Verify result was modified
    expect(result).toEqual({
      content: [{ type: 'text', text: 'Hello, World (modified)! (modified result)' }]
    });
  });
}); 