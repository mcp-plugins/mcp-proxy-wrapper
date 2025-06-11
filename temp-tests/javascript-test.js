/**
 * Test to validate findings about the JavaScript proxy wrapper
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { wrapWithProxy } from './proxy-wrapper.js';
import { z } from 'zod';

console.log('=== Testing JavaScript Proxy Wrapper ===');

// Create a server
const server = new McpServer({
  name: 'Test Server',
  version: '1.0.0'
});

// Print server methods
console.log('Server methods before wrapping:');
console.log(Object.getOwnPropertyNames(Object.getPrototypeOf(server))
  .filter(name => typeof server[name] === 'function' && name !== 'constructor'));

// Verify callTool doesn't exist initially
console.log('server.callTool exists before wrapping:', typeof server.callTool === 'function');

// Wrap with proxy
const proxiedServer = wrapWithProxy(server, {
  hooks: {
    beforeToolCall: async (context) => {
      console.log('beforeToolCall hook executed with:', context.toolName);
    }
  },
  debug: true
});

// Print server methods after wrapping
console.log('Server methods after wrapping:');
console.log(Object.getOwnPropertyNames(Object.getPrototypeOf(server))
  .filter(name => typeof server[name] === 'function' && name !== 'constructor'));

// Check specifically for callTool after wrapping
console.log('Own properties after wrapping:');
console.log(Object.getOwnPropertyNames(server));

// Verify if callTool exists after wrapping
console.log('server.callTool exists after JS wrapping:', typeof server.callTool === 'function');

// Register a tool
server.tool('echo', { message: z.string() }, async (args) => {
  return {
    content: [{ type: 'text', text: `Echo: ${args.message}` }]
  };
});

// Try to call the tool
console.log('Attempting to call tool directly on server...');
try {
  // This should succeed with the JS wrapper
  const result = await server.callTool('echo', { message: 'Hello' });
  console.log('Tool call result:', result);
} catch (error) {
  console.error('Error calling tool directly on server:', error.message);
}

console.log('=== Test Complete ===') 