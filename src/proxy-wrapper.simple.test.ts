/**
 * @file Proxy Wrapper Simple Test
 * @version 1.0.0
 * 
 * A very simple test that verifies the proxy wrapper can be created and doesn't throw errors.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { wrapWithProxy } from './proxy-wrapper.js';
import { z } from 'zod';

describe('MCP Proxy Wrapper Simple Test', () => {
  test('should create a proxy wrapper without errors', () => {
    // Create a simple MCP server
    const server = new McpServer({
      name: "Example Server",
      version: "1.0.0"
    });

    // Register a tool
    server.tool("greet", { name: z.string() }, async (args) => {
      return {
        content: [{ type: "text", text: `Hello, ${args.name}!` }]
      };
    });

    // This should not throw an error
    const proxiedServer = wrapWithProxy(server, {
      hooks: {
        beforeToolCall: async (context) => {
          // Just a simple hook that doesn't do anything
          console.log(`Tool call: ${context.toolName}`);
        },
        afterToolCall: async (context, result) => {
          // Just a simple hook that doesn't do anything
          console.log(`Tool result: ${context.toolName}`);
          return result;
        }
      },
      debug: true
    });

    // Verify that the proxied server has the same properties as the original server
    expect(proxiedServer).toBe(server);
    expect(typeof proxiedServer.tool).toBe('function');
  });
}); 