/**
 * @file Proxy Wrapper Example Test
 * @version 1.0.0
 * 
 * A simple example test that demonstrates the proxy wrapper functionality.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { wrapWithProxy } from './proxy-wrapper.js';
import { z } from 'zod';

describe('MCP Proxy Wrapper Example', () => {
  test('should demonstrate basic proxy functionality', () => {
    // Create a simple MCP server
    const server = new McpServer({
      name: "Example Server",
      version: "1.0.0"
    });

    // Register a tool
    const greetHandler = jest.fn().mockImplementation(async (args) => {
      return {
        content: [{ type: 'text', text: `Hello, ${args.name}!` }]
      };
    });

    server.tool('greet', { name: z.string() }, greetHandler);

    // Create hooks
    const beforeToolCall = jest.fn().mockImplementation(async (context) => {
      // Modify the name argument
      if (context.toolName === 'greet') {
        context.args.name = `${context.args.name} (modified)`;
      }
    });

    const afterToolCall = jest.fn().mockImplementation(async (context, result) => {
      // Modify the result
      if (context.toolName === 'greet' && result.result.content && result.result.content[0]) {
        result.result.content[0].text += ' Thanks for using our service!';
      }
      
      return result;
    });

    // Wrap with proxy
    const proxiedServer = wrapWithProxy(server, {
      hooks: {
        beforeToolCall,
        afterToolCall
      }
    });

    // Get the wrapped handler
    const toolDefinition = server.tool('greet', { name: z.string() }, async (args) => {
      return { content: [{ type: 'text', text: 'This should not be called' }] };
    });

    // Simulate a tool call
    const args = { name: 'World' };
    const extra = {};

    // Find the handler for the 'greet' tool
    const handler = findToolHandler(server, 'greet');
    
    // Call the handler directly
    return handler(args, extra).then((result: any) => {
      // Verify beforeToolCall was called
      expect(beforeToolCall).toHaveBeenCalledWith(expect.objectContaining({
        toolName: 'greet',
        args: { name: 'World' },
        metadata: expect.any(Object)
      }));

      // Verify the original handler was called with modified args
      expect(greetHandler).toHaveBeenCalledWith(
        { name: 'World (modified)' },
        expect.anything()
      );

      // Verify afterToolCall was called
      expect(afterToolCall).toHaveBeenCalledWith(
        expect.objectContaining({
          toolName: 'greet',
          args: { name: 'World (modified)' },
          metadata: expect.any(Object)
        }),
        expect.objectContaining({
          result: {
            content: [{ type: 'text', text: 'Hello, World (modified)!' }]
          },
          metadata: expect.any(Object)
        })
      );

      // Verify the final result
      expect(result).toEqual({
        content: [{ type: 'text', text: 'Hello, World (modified)! Thanks for using our service!' }]
      });
    });
  });
});

/**
 * Helper function to find a tool handler in an MCP server
 * Note: This is a workaround for testing and not part of the public API
 */
function findToolHandler(server: McpServer, toolName: string): Function {
  // This is a hack to access the private tools map
  const anyServer = server as any;
  
  // Try different ways to access the tools
  if (anyServer._tools && anyServer._tools.get) {
    return anyServer._tools.get(toolName).handler;
  }
  
  if (anyServer.tools && anyServer.tools.get) {
    return anyServer.tools.get(toolName).handler;
  }
  
  // If we can't find the tools map, throw an error
  throw new Error(`Could not find tool handler for ${toolName}`);
} 