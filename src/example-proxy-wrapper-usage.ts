/**
 * @file Example usage of the MCP Proxy Wrapper
 * @version 1.0.0
 * 
 * This file demonstrates how to use the proxy wrapper to add
 * hook functionality to an existing MCP server.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
// When using the published package, import would be:
// import { wrapWithProxy } from '@modelcontextprotocol/proxy-wrapper';
// For local development, we use:
import { wrapWithProxy } from './proxy-wrapper.js';

async function main() {
  // Create a simple demo MCP server
  const demoServer = new McpServer({
    name: "Demo MCP Server",
    version: "1.0.0",
    description: "A simple demo MCP server"
  });

  // Register a simple tool for demonstration
  demoServer.tool("greet", { name: z.string() }, async (args, extra) => {
    return {
      content: [{ 
        type: "text" as const, 
        text: `Hello, ${args.name}!` 
      }]
    };
  });

  // Register a more complex tool for demonstration
  demoServer.tool("calculate", { 
    operation: z.enum(["add", "subtract", "multiply", "divide"]),
    a: z.number(),
    b: z.number()
  }, async (args, extra) => {
    let result: number;
    
    switch (args.operation) {
      case "add":
        result = args.a + args.b;
        break;
      case "subtract":
        result = args.a - args.b;
        break;
      case "multiply":
        result = args.a * args.b;
        break;
      case "divide":
        if (args.b === 0) {
          return {
            isError: true,
            content: [{ 
              type: "text" as const, 
              text: "Cannot divide by zero" 
            }]
          };
        }
        result = args.a / args.b;
        break;
    }
    
    return {
      content: [{ 
        type: "text" as const, 
        text: `Result of ${args.operation}: ${result}` 
      }]
    };
  });

  // Wrap the demo server with proxy functionality
  const proxiedServer = await wrapWithProxy(demoServer, {
    hooks: {
      // Before tool call hook
      beforeToolCall: async (context) => {
        console.log(`Tool call: ${context.toolName} with args:`, context.args);
        
        // Example: Modify arguments
        if (context.toolName === 'greet' && context.args.name) {
          context.args.name = `${context.args.name} (modified)`;
        }
        
        // Example: Block certain operations
        if (context.toolName === 'calculate' && context.args.operation === 'divide' && context.args.b === 0) {
          return {
            result: {
              content: [{ 
                type: "text" as const, 
                text: "Division by zero prevented by hook" 
              }]
            }
          };
        }
      },
      
      // After tool call hook
      afterToolCall: async (context, result) => {
        console.log(`Tool result:`, result.result);
        
        // Example: Modify results
        if (context.toolName === 'greet' && result.result.content && result.result.content[0]) {
          result.result.content[0].text += " Thanks for using our service!";
        }
        
        return result;
      }
    },
    debug: true
  });
  
  // Set up the transport
  const transport = new StdioServerTransport();
  
  // Connect the proxied server to the transport
  await proxiedServer.connect(transport);
}

// Start the example
main().catch(err => {
  console.error('Error starting the server:', err);
  process.exit(1);
}); 