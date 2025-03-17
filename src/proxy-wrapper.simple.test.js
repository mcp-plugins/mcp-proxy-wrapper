/**
 * @file Simple JavaScript Tests for MCP Proxy Wrapper
 * @version 1.0.0
 * 
 * This file contains simple tests for the MCP Proxy Wrapper that don't rely on TypeScript.
 */

import { wrapWithProxy } from './proxy-wrapper.simple.js';

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

// Helper function to create a valid MCP tool result
function createToolResult(text) {
  return {
    content: [
      {
        type: "text",
        text
      }
    ]
  };
}

// Mock MCP Server
function createMockServer() {
  const tools = new Map();
  
  return {
    name: 'Mock Server',
    version: '1.0.0',
    tool: function(name, schemaOrCallback, handlerOrUndefined) {
      // Handle both 2-arg and 3-arg versions
      const handler = handlerOrUndefined || schemaOrCallback;
      const schema = handlerOrUndefined ? schemaOrCallback : {};
      
      tools.set(name, { schema, handler });
      return { name, schema, handler };
    },
    getToolHandler: function(name) {
      return tools.get(name)?.handler;
    },
    callTool: async function(name, args, extra = {}) {
      const handler = this.getToolHandler(name);
      if (!handler) {
        throw new Error(`Tool not found: ${name}`);
      }
      return await handler(args, extra);
    }
  };
}

// Test: Basic wrapping
test('should wrap an MCP server', () => {
  const server = createMockServer();
  const proxiedServer = wrapWithProxy(server);
  
  assert(proxiedServer === server, 'Proxy should return the same server instance');
  assert(typeof proxiedServer.tool === 'function', 'Proxied server should have a tool method');
});

// Test: Before hook
test('should execute beforeToolCall hook', async () => {
  const server = createMockServer();
  
  let hookCalled = false;
  let argsModified = false;
  
  const proxiedServer = wrapWithProxy(server, {
    debug: true,
    hooks: {
      beforeToolCall: async (context) => {
        hookCalled = true;
        assert(context.toolName === 'greet', 'Tool name should be correct');
        assert(context.args.name === 'World', 'Arguments should be correct');
        
        // Modify the arguments
        context.args.name = 'Modified World';
        argsModified = true;
      }
    }
  });
  
  // Register a tool
  proxiedServer.tool('greet', {}, async (args, extra) => {
    assert(args.name === 'Modified World', 'Arguments should be modified by the hook');
    return createToolResult(`Hello, ${args.name}!`);
  });
  
  // Call the tool
  const result = await proxiedServer.callTool('greet', { name: 'World' });
  
  assert(hookCalled, 'Before hook should have been called');
  assert(argsModified, 'Arguments should have been modified');
  assert(result.content[0].text === 'Hello, Modified World!', 'Result should reflect modified arguments');
});

// Test: After hook
test('should execute afterToolCall hook', async () => {
  const server = createMockServer();
  
  let hookCalled = false;
  
  const proxiedServer = wrapWithProxy(server, {
    debug: true,
    hooks: {
      afterToolCall: async (context, { result }) => {
        hookCalled = true;
        assert(context.toolName === 'greet', 'Tool name should be correct');
        assert(result.content[0].text === 'Hello, World!', 'Result should be correct');
        
        // Modify the result
        result.content[0].text = 'Modified: ' + result.content[0].text;
        return { result };
      }
    }
  });
  
  // Register a tool
  proxiedServer.tool('greet', {}, async (args, extra) => {
    return createToolResult(`Hello, ${args.name}!`);
  });
  
  // Call the tool
  const result = await proxiedServer.callTool('greet', { name: 'World' });
  
  assert(hookCalled, 'After hook should have been called');
  assert(result.content[0].text === 'Modified: Hello, World!', 'Result should be modified by the hook');
});

// Test: Short-circuit
test('should short-circuit tool call if beforeToolCall returns a result', async () => {
  const server = createMockServer();
  
  let hookCalled = false;
  let handlerCalled = false;
  
  const proxiedServer = wrapWithProxy(server, {
    debug: true,
    hooks: {
      beforeToolCall: async (context) => {
        hookCalled = true;
        
        // Short-circuit the call
        return {
          result: createToolResult('Short-circuit result')
        };
      }
    }
  });
  
  // Register a tool
  proxiedServer.tool('greet', {}, async (args, extra) => {
    handlerCalled = true;
    return createToolResult(`Hello, ${args.name}!`);
  });
  
  // Call the tool
  const result = await proxiedServer.callTool('greet', { name: 'World' });
  
  assert(hookCalled, 'Before hook should have been called');
  assert(!handlerCalled, 'Handler should not have been called');
  assert(result.content[0].text === 'Short-circuit result', 'Result should be from the hook');
});

// Test: Error handling
test('should handle errors in tool handlers', async () => {
  const server = createMockServer();
  
  const proxiedServer = wrapWithProxy(server, {
    debug: true
  });
  
  // Register a tool that throws an error
  proxiedServer.tool('error', {}, async (args, extra) => {
    throw new Error('Test error');
  });
  
  // Call the tool
  const result = await proxiedServer.callTool('error', {});
  
  assert(result.isError, 'Result should be marked as an error');
  assert(result.content[0].text.includes('Test error'), 'Error message should be included in the result');
});

// Run the tests
runTests().catch(error => {
  console.error('Error running tests:', error);
  process.exit(1);
}); 