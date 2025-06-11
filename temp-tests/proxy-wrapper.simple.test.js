/**
 * Simple inspection script to understand MCP SDK interfaces
 * Run with: NODE_ENV=development DEBUG_MCP_PROXY=true node src/proxy-wrapper.simple.test.js
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { wrapWithProxy } from './proxy-wrapper.js';
import { z } from 'zod';

// Utility for inspecting and logging objects
function inspectObject(obj, label) {
  console.log(`\n==== INSPECT: ${label} ====`);
  console.log('Type:', typeof obj);
  console.log('Constructor:', obj?.constructor?.name);
  
  if (obj) {
    console.log('Properties:', Object.keys(obj));
    
    // Inspect methods if they exist
    if (typeof obj === 'object') {
      for (const key of Object.keys(obj)) {
        const value = obj[key];
        if (typeof value === 'function') {
          try {
            console.log(`Method ${key}:`, {
              name: value.name,
              parameters: value.length,
              toString: value.toString().substring(0, 100) + '...'
            });
          } catch (e) {
            console.log(`Method ${key}: [Error inspecting method]`);
          }
        }
      }
    }
    
    // If it's a function, inspect its properties
    if (typeof obj === 'function') {
      console.log('Function Name:', obj.name);
      console.log('Parameter Count:', obj.length);
      console.log('Function String:', obj.toString().substring(0, 100) + '...');
    }
    
    // Get prototype chain
    let proto = Object.getPrototypeOf(obj);
    let protoChain = [];
    while (proto !== null) {
      protoChain.push(proto.constructor?.name || 'unknown');
      proto = Object.getPrototypeOf(proto);
    }
    console.log('Prototype Chain:', protoChain.join(' -> '));
  }
  
  console.log(`==== END INSPECT: ${label} ====\n`);
}

// Start of our test
console.log("\n===== MCP SDK Interface Inspection =====\n");

// Check Node environment
console.log("Node Version:", process.version);
console.log("Module Type:", import.meta.url ? "ESM" : "CommonJS");
console.log("Import Meta URL:", import.meta.url);
console.log("Current Directory:", process.cwd());

// Create a server
const server = new McpServer({
  name: "Test Server",
  version: "1.0.0"
});

console.log("\n----- Server Object -----");
inspectObject(server, "McpServer Instance");
inspectObject(server.tool, "server.tool Method");
inspectObject(server.callTool, "server.callTool Method");

// Register a tool
console.log("\n----- Tool Registration -----");
const toolHandler = async (args) => {
  return {
    content: [{ type: "text", text: `Hello, ${args.name}!` }]
  };
};
inspectObject(toolHandler, "Tool Handler");

server.tool("greet", { name: z.string() }, toolHandler);
console.log("Tool registered");

// Create a proxy wrapper
console.log("\n----- Proxy Wrapper -----");
const beforeHook = async (context) => {
  console.log("Before Hook Called with:", context);
};
const afterHook = async (context, result) => {
  console.log("After Hook Called with:", context, result);
  return result;
};

inspectObject(beforeHook, "Before Hook");
inspectObject(afterHook, "After Hook");

const proxiedServer = wrapWithProxy(server, {
  hooks: {
    beforeToolCall: beforeHook,
    afterToolCall: afterHook
  },
  debug: true
});

// Test calling a tool
console.log("\n----- Tool Call -----");
const testToolCall = async () => {
  try {
    console.log("Calling tool 'greet'");
    const result = await server.callTool("greet", { name: "World" });
    console.log("Tool call result:", result);
    
    console.log("\n----- Test 1: Basic Tool Call -----");
    console.log("PASS: Successfully wrapped MCP server");
  } catch (error) {
    console.error("Error calling tool:", error);
  }
};

await testToolCall();

// Test beforeToolCall hook
console.log("\n----- Test beforeToolCall Hook -----");
let beforeHookCalled = false;
server.tool("test-before", { value: z.string() }, async (args) => {
  console.log("Tool handler called with:", args);
  return {
    content: [{ type: "text", text: `Value: ${args.value}` }]
  };
});

const proxiedServer2 = wrapWithProxy(server, {
  hooks: {
    beforeToolCall: async (context) => {
      beforeHookCalled = true;
      console.log("Before hook called with:", context);
      // Modify args
      context.args.value = `${context.args.value} (modified)`;
    }
  }
});

try {
  const result = await server.callTool("test-before", { value: "original" });
  console.log("Tool call result:", result);
  console.log(`beforeToolCall hook called: ${beforeHookCalled}`);
  console.log(`PASS: ${result.content[0]?.text?.includes('original (modified)') ? "Argument was modified" : "Argument was NOT modified"}`);
} catch (error) {
  console.error("Error testing beforeToolCall:", error);
}

// Test afterToolCall hook
console.log("\n----- Test afterToolCall Hook -----");
let afterHookCalled = false;
server.tool("test-after", { value: z.string() }, async (args) => {
  console.log("Tool handler called with:", args);
  return {
    content: [{ type: "text", text: `Value: ${args.value}` }]
  };
});

const proxiedServer3 = wrapWithProxy(server, {
  hooks: {
    afterToolCall: async (context, result) => {
      afterHookCalled = true;
      console.log("After hook called with:", context, result);
      // Modify result
      if (result.result.content && result.result.content[0]) {
        result.result.content[0].text += " (modified)";
      }
      return result;
    }
  }
});

try {
  const result = await server.callTool("test-after", { value: "test" });
  console.log("Tool call result:", result);
  console.log(`afterToolCall hook called: ${afterHookCalled}`);
  console.log(`PASS: ${result.content[0]?.text?.includes('(modified)') ? "Result was modified" : "Result was NOT modified"}`);
} catch (error) {
  console.error("Error testing afterToolCall:", error);
}

// Test error handling
console.log("\n----- Test Error Handling -----");
server.tool("error", { }, async () => {
  throw new Error("Test error");
});

try {
  const result = await server.callTool("error", {});
  console.log("Error tool call result:", result);
  console.log(`PASS: ${result.isError ? "Error was handled" : "Error was NOT handled"}`);
} catch (error) {
  console.error("Unhandled error:", error);
  console.log("FAIL: Error was not handled by proxy wrapper");
}

console.log("\n===== All Tests Complete ====="); 