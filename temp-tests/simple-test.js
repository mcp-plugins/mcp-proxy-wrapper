/**
 * @file Simple Test for MCP Proxy Wrapper
 * @version 1.0.0
 * 
 * This is a simple JavaScript test for the MCP Proxy Wrapper.
 * It doesn't rely on TypeScript or complex testing frameworks.
 */

// Import the MCP Server and proxy wrapper
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { wrapWithProxy } from './simple-proxy-wrapper.js';
import { z } from 'zod';

// Create a simple test runner
const tests = [];
let passed = 0;
let failed = 0;

function test(name, fn) {
  tests.push({ name, fn });
}

async function runTests() {
  console.log('Running tests...\n');
  
  for (const { name, fn } of tests) {
    try {
      await fn();
      console.log(`✅ PASS: ${name}`);
      passed++;
    } catch (error) {
      console.error(`❌ FAIL: ${name}`);
      console.error(`   Error: ${error.message}`);
      if (error.stack) {
        console.error(`   Stack: ${error.stack.split('\n')[1]}`);
      }
      failed++;
    }
  }
  
  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  
  if (failed > 0) {
    process.exit(1);
  }
}

// Helper function for assertions
function assert(condition, message) {
  if (!condition) {
    throw new Error(message || 'Assertion failed');
  }
}

// Test: Basic wrapping
test('should wrap an MCP server', () => {
  const server = new McpServer({
    name: 'Test Server',
    version: '1.0.0'
  });
  
  const proxiedServer = wrapWithProxy(server);
  
  assert(proxiedServer === server, 'Proxy should return the same server instance');
  assert(typeof proxiedServer.tool === 'function', 'Proxied server should have a tool method');
});

// Test: Before hook
test('should execute beforeToolCall hook', async () => {
  const server = new McpServer({
    name: 'Test Server',
    version: '1.0.0'
  });
  
  let hookCalled = false;
  
  const proxiedServer = wrapWithProxy(server, {
    hooks: {
      beforeToolCall: async (context) => {
        hookCalled = true;
        assert(context.toolName === 'greet', 'Tool name should be correct');
        assert(context.args.name === 'World', 'Arguments should be correct');
      }
    }
  });
  
  // Register a tool
  proxiedServer.tool('greet', 
    z.object({
      name: z.string().describe('Name to greet')
    }),
    async ({ name }) => {
      return {
        content: [
          {
            type: 'text',
            text: `Hello, ${name}!`
          }
        ]
      };
    }
  );
  
  // Call the tool through the server's API
  const result = await proxiedServer.callTool('greet', { name: 'World' });
  
  assert(hookCalled, 'Before hook should have been called');
});

// Test: After hook
test('should execute afterToolCall hook', async () => {
  const server = new McpServer({
    name: 'Test Server',
    version: '1.0.0'
  });
  
  let hookCalled = false;
  
  const proxiedServer = wrapWithProxy(server, {
    hooks: {
      afterToolCall: async (context, result) => {
        hookCalled = true;
        assert(context.toolName === 'greet', 'Tool name should be correct');
        assert(context.args.name === 'World', 'Arguments should be correct');
        assert(result.result.content[0].text === 'Hello, World!', 'Result should be correct');
        
        // Modify the result
        return {
          result: {
            content: [
              {
                type: 'text',
                text: 'Modified result'
              }
            ]
          }
        };
      }
    }
  });
  
  // Register a tool
  proxiedServer.tool('greet', 
    z.object({
      name: z.string().describe('Name to greet')
    }),
    async ({ name }) => {
      return {
        content: [
          {
            type: 'text',
            text: `Hello, ${name}!`
          }
        ]
      };
    }
  );
  
  // Call the tool through the server's API
  const result = await proxiedServer.callTool('greet', { name: 'World' });
  
  assert(hookCalled, 'After hook should have been called');
  assert(result.content[0].text === 'Hello, Modified World!', 'Result should be modified by after hook');
});

// Run the tests
runTests().catch(error => {
  console.error('Error running tests:', error);
  process.exit(1);
}); 