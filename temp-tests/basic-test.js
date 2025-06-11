/**
 * @file basic-test.js
 * @version 1.0.0
 * 
 * A very basic test for the MCP Proxy Wrapper
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { wrapWithProxy } from './simple-proxy-wrapper.js';
import { z } from 'zod';

// Store tool handlers for testing
const toolHandlers = {};

// Monkey patch McpServer.prototype.tool to capture handlers
const originalTool = McpServer.prototype.tool;
McpServer.prototype.tool = function(name, schema, handler) {
  console.log(`Registering tool: ${name}`);
  // Store the handler for testing
  toolHandlers[name] = handler;
  // Call the original method
  return originalTool.call(this, name, schema, handler);
};

// Create a server
const server = new McpServer({
  name: 'Test Server',
  version: '1.0.0'
});

// Add a tool BEFORE wrapping
server.tool('greet-before', 
  z.object({
    name: z.string().describe('Name to greet')
  }),
  async ({ name }) => {
    console.log(`Original handler called with name: ${name}`);
    return {
      content: [
        {
          type: 'text',
          text: `Hello (before wrapping), ${name}!`
        }
      ]
    };
  }
);

// Track hook calls
let beforeHookCalled = false;
let afterHookCalled = false;

// Wrap the server with proxy
const proxiedServer = wrapWithProxy(server, {
  debug: true,
  hooks: {
    beforeToolCall: async (context) => {
      console.log('Before hook called with:', context.toolName, context.args);
      beforeHookCalled = true;
      
      // Modify the arguments
      context.args.name = `Modified ${context.args.name}`;
    },
    afterToolCall: async (context, { result }) => {
      console.log('After hook called with result:', result);
      afterHookCalled = true;
      
      // Modify the result
      if (result.content && result.content.length > 0) {
        result.content[0].text = `Modified: ${result.content[0].text}`;
        return { result };
      }
    }
  }
});

// Add another tool AFTER wrapping
proxiedServer.tool('greet-after', 
  z.object({
    name: z.string().describe('Name to greet')
  }),
  async ({ name }) => {
    console.log(`Original handler called with name: ${name}`);
    return {
      content: [
        {
          type: 'text',
          text: `Hello (after wrapping), ${name}!`
        }
      ]
    };
  }
);

// Test the tools
async function runTests() {
  console.log('\nTool handlers captured:', Object.keys(toolHandlers));
  
  console.log('\n=== Testing tool registered BEFORE wrapping ===');
  try {
    // Reset hook tracking
    beforeHookCalled = false;
    afterHookCalled = false;
    
    // Call the wrapped handler directly
    const beforeResult = await toolHandlers['greet-before']({ name: 'World' }, {});
    console.log('Result:', JSON.stringify(beforeResult, null, 2));
    console.log('Before hook called:', beforeHookCalled);
    console.log('After hook called:', afterHookCalled);
    console.log('IMPORTANT: Hooks are NOT called for tools registered BEFORE wrapping!');
  } catch (error) {
    console.error('Error testing tool registered before wrapping:', error);
  }
  
  console.log('\n=== Testing tool registered AFTER wrapping ===');
  try {
    // Reset hook tracking
    beforeHookCalled = false;
    afterHookCalled = false;
    
    // Call the wrapped handler directly
    const afterResult = await toolHandlers['greet-after']({ name: 'World' }, {});
    console.log('Result:', JSON.stringify(afterResult, null, 2));
    console.log('Before hook called:', beforeHookCalled);
    console.log('After hook called:', afterHookCalled);
    console.log('IMPORTANT: Hooks ARE called for tools registered AFTER wrapping!');
  } catch (error) {
    console.error('Error testing tool registered after wrapping:', error);
  }
}

// Run the tests
runTests().catch(error => {
  console.error('Test failed:', error);
}); 