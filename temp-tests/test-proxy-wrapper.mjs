/**
 * @file test-proxy-wrapper.mjs
 * @version 1.0.0
 * @description Simple test script for the MCP Proxy Wrapper
 */

// Import from the compiled JavaScript files in dist
// Note: We need to run `npm run build` first to generate these files
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';

// First, let's build the project to ensure we have the compiled JavaScript files
console.log('Testing MCP Proxy Wrapper...');

// Create a simple MCP server
const server = new McpServer({
  name: 'Example Server',
  version: '1.0.0'
});

// Register a simple tool
server.registerTool({
  name: 'greet',
  description: 'Greets a person by name',
  parameters: z.object({
    name: z.string().describe('The name of the person to greet')
  }),
  handler: async (params) => {
    return `Hello, ${params.name}!`;
  }
});

// Helper function to find tool handlers (accessing private properties)
const findToolHandler = (server, toolName) => {
  // @ts-ignore - Accessing private property
  const tools = server._tools;
  return tools.find(tool => tool.name === toolName);
};

// Test function
const testProxyWrapper = async () => {
  try {
    // Import the proxy wrapper dynamically after build
    const { wrapWithProxy } = await import('../dist/proxy-wrapper.js');
    
    // Find the greet tool handler
    const greetTool = findToolHandler(server, 'greet');
    
    if (!greetTool) {
      console.error('Greet tool not found');
      return;
    }
    
    // Define hooks
    const beforeHook = (toolName, args) => {
      console.log(`Before calling ${toolName} with args:`, args);
      return args;
    };
    
    const afterHook = (toolName, result) => {
      console.log(`After calling ${toolName} with result:`, result);
      return result;
    };
    
    // Wrap the tool handler with our proxy
    const wrappedHandler = wrapWithProxy(greetTool.handler, {
      beforeHook,
      afterHook,
      errorHook: (toolName, error) => {
        console.error(`Error in ${toolName}:`, error);
        throw error;
      },
      metadata: {
        toolName: 'greet'
      }
    });
    
    // Replace the original handler with our wrapped version
    greetTool.handler = wrappedHandler;
    
    // Call the tool
    const result = await server.callTool('greet', { name: 'World' });
    console.log('Final result:', result);
    
    // Verify the result
    if (result === 'Hello, World!') {
      console.log('✅ Test passed!');
    } else {
      console.error('❌ Test failed! Expected "Hello, World!" but got:', result);
    }
  } catch (error) {
    console.error('Error testing proxy wrapper:', error);
  }
};

// Run the test
testProxyWrapper(); 