/**
 * @file Test Proxy Wrapper
 * @version 1.0.0
 * 
 * A simple script to test the proxy wrapper directly with Node.js.
 */

// Import the required modules
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { wrapWithProxy } from './proxy-wrapper.ts';
import { z } from 'zod';

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

// Create hooks
const beforeToolCall = async (context) => {
  console.log(`Before tool call: ${context.toolName}`);
  console.log(`Arguments:`, context.args);
  
  // Modify the name argument
  if (context.toolName === 'greet') {
    context.args.name = `${context.args.name} (modified)`;
  }
};

const afterToolCall = async (context, result) => {
  console.log(`After tool call: ${context.toolName}`);
  console.log(`Result:`, result.result);
  
  // Modify the result
  if (context.toolName === 'greet' && result.result.content && result.result.content[0]) {
    result.result.content[0].text += ' Thanks for using our service!';
  }
  
  return result;
};

// Wrap with proxy
const proxiedServer = wrapWithProxy(server, {
  hooks: {
    beforeToolCall,
    afterToolCall
  },
  debug: true
});

console.log('Proxy wrapper created successfully!');
console.log('Server name:', proxiedServer.name);
console.log('Server version:', proxiedServer.version);

// Test that the proxy wrapper works by calling a tool directly
const testToolCall = async () => {
  try {
    // Find the tool handler
    const toolHandler = findToolHandler(proxiedServer, 'greet');
    
    if (!toolHandler) {
      console.error('Could not find tool handler for greet');
      return;
    }
    
    // Call the tool handler directly
    const result = await toolHandler({ name: 'World' }, {});
    
    console.log('Tool call result:', result);
    
    // Verify the result
    if (result.content[0].text === 'Hello, World (modified)! Thanks for using our service!') {
      console.log('Test passed! The proxy wrapper is working correctly.');
    } else {
      console.log('Test failed! The proxy wrapper is not working correctly.');
      console.log('Expected: Hello, World (modified)! Thanks for using our service!');
      console.log('Actual:', result.content[0].text);
    }
  } catch (error) {
    console.error('Error calling tool:', error);
  }
};

/**
 * Helper function to find a tool handler in an MCP server
 */
function findToolHandler(server, toolName) {
  // This is a hack to access the private tools map
  const anyServer = server;
  
  // Try different ways to access the tools
  if (anyServer._tools && anyServer._tools.get) {
    return anyServer._tools.get(toolName).handler;
  }
  
  if (anyServer.tools && anyServer.tools.get) {
    return anyServer.tools.get(toolName).handler;
  }
  
  // If we can't find the tools map, return null
  return null;
}

// Run the test
testToolCall().catch(error => {
  console.error('Unhandled error:', error);
}); 