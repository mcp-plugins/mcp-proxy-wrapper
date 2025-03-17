// Simple test for the MCP Proxy Wrapper
// This file is meant to be run directly with Node.js

// Import required modules
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { wrapWithProxy } from './simple-proxy-wrapper.js';

// Store tool handlers for testing
const toolHandlers = {};

// Create a simple MCP server
const server = new McpServer({
  name: 'Example Server',
  version: '1.0.0'
});

// Override the tool method to store handlers
const originalTool = server.tool;
server.tool = function(name, schema, handler) {
  console.log(`Registering original tool: ${name}`);
  // Store the handler for testing
  toolHandlers[name] = handler;
  // Call the original method
  return originalTool.call(server, name, schema, handler);
};

// Register a simple tool
server.tool("greet", { name: z.string() }, async (args) => {
  return {
    content: [{ type: "text", text: `Hello, ${args.name}!` }]
  };
});

// Wrap the server with our proxy wrapper
const proxiedServer = wrapWithProxy(server, {
  hooks: {
    // Before tool call hook
    beforeToolCall: async (context) => {
      console.log(`Before hook: ${context.toolName} with args:`, context.args);
      
      // Example: Modify arguments
      if (context.toolName === 'greet' && context.args.name) {
        context.args.name = `${context.args.name} (modified by hook)`;
      }
    },
    
    // After tool call hook
    afterToolCall: async (context, result) => {
      console.log(`After hook: ${context.toolName} with result:`, result);
      
      // Example: Modify results
      if (context.toolName === 'greet' && result.result.content && result.result.content[0]) {
        result.result.content[0].text += " (modified by after hook)";
      }
      
      return result;
    },
    
    // Error hook
    errorHook: async (context, error) => {
      console.error(`Error in ${context.toolName}:`, error);
      return {
        isError: true,
        content: [{ type: "text", text: `Error in ${context.toolName}: ${error.message}` }]
      };
    }
  },
  debug: true
});

// Register another tool after wrapping
proxiedServer.tool("farewell", { name: z.string() }, async (args) => {
  return {
    content: [{ type: "text", text: `Goodbye, ${args.name}!` }]
  };
});

// Register an error-throwing tool to test error handling
proxiedServer.tool("error", { message: z.string().optional() }, async (args) => {
  throw new Error(args.message || "Intentional error for testing");
});

// Test the tools using our stored handlers
const testTools = async () => {
  try {
    console.log('\nStored tool handlers:', Object.keys(toolHandlers));
    
    // Test the greet tool
    if (toolHandlers.greet) {
      console.log('\nTesting greet tool...');
      const greetResult = await toolHandlers.greet({ name: 'World' });
      console.log('Greet result:', greetResult);
    } else {
      console.error('Greet handler not found');
    }
    
    // Test the farewell tool
    if (toolHandlers.farewell) {
      console.log('\nTesting farewell tool...');
      const farewellResult = await toolHandlers.farewell({ name: 'World' });
      console.log('Farewell result:', farewellResult);
    } else {
      console.error('Farewell handler not found');
    }
    
    // Test the error tool
    if (toolHandlers.error) {
      console.log('\nTesting error tool...');
      const errorResult = await toolHandlers.error({ message: 'Test error' });
      console.log('Error result:', errorResult);
    } else {
      console.error('Error tool not found');
    }
    
    console.log('\nTests completed successfully!');
  } catch (error) {
    console.error('Error testing tools:', error);
  }
};

// Run the tests
testTools(); 