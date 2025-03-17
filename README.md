# MCP Proxy Wrapper

A lightweight wrapper for MCP Server that allows intercepting and modifying tool calls.

## Features

- Wrap an existing MCP Server instance
- Execute hooks before and after tool calls
- Short-circuit tool calls
- Handle errors gracefully
- Detailed logging

## Installation

```bash
npm install @modelcontextprotocol/mcp-proxy-wrapper
```

## Usage

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { wrapWithProxy } from '@modelcontextprotocol/mcp-proxy-wrapper';

// Create an MCP server
const server = new McpServer({
  name: 'My Server',
  version: '1.0.0'
});

// Wrap the server with the proxy
const proxy = wrapWithProxy(server, {
  debug: true, // Enable debug logging
  hooks: {
    // Hook that runs before a tool call
    beforeToolCall: async (context) => {
      console.log(`Before calling ${context.toolName}`);
      
      // You can modify the arguments
      context.args.modified = true;
      
      // Or return a result to short-circuit the tool call
      // return { result: { short: 'circuit' } };
    },
    
    // Hook that runs after a tool call
    afterToolCall: async (context, result) => {
      console.log(`After calling ${context.toolName}`);
      
      // You can modify the result
      return {
        result: { ...result.result, modified: true },
        metadata: result.metadata
      };
    }
  }
});

// Register a tool with the proxy
proxy.tool('greet', async (args) => {
  return { greeting: `Hello, ${args.name}!` };
});

// Call the tool
const result = await server.callTool('greet', { name: 'World' });
console.log(result); // { greeting: 'Hello, World!', modified: true }
```

## JavaScript Implementation

For projects not using TypeScript, a pure JavaScript implementation is also available:

```javascript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { wrapWithProxy } from '@modelcontextprotocol/mcp-proxy-wrapper/dist/proxy-wrapper.simple.js';

// Create an MCP server
const server = new McpServer({
  name: 'My Server',
  version: '1.0.0'
});

// Wrap the server with the proxy
const proxy = wrapWithProxy(server, {
  debug: true,
  hooks: {
    beforeToolCall: async (context) => {
      console.log(`Before calling ${context.toolName}`);
      context.args.modified = true;
    },
    afterToolCall: async (context, result) => {
      console.log(`After calling ${context.toolName}`);
      return { ...result, modified: true };
    }
  }
});

// Register a tool with the proxy
proxy.tool('greet', (args) => {
  return { greeting: `Hello, ${args.name}!` };
});

// Call the tool
const result = await server.callTool('greet', { name: 'World' });
console.log(result); // { greeting: 'Hello, World!', modified: true }
```

## Testing

The MCP Proxy Wrapper has been thoroughly tested using both TypeScript and JavaScript tests:

### TypeScript Tests

The TypeScript tests use Jest and mock the MCP Server to test the proxy wrapper functionality. The tests verify:

1. Tool registration
2. Execution of beforeToolCall hooks
3. Execution of afterToolCall hooks
4. Short-circuiting of tool calls
5. Error handling in tool handlers and hooks

To run the TypeScript tests:

```bash
npm test -- src/proxy-wrapper.test.ts
```

### JavaScript Tests

The JavaScript tests use a simple test runner without complex dependencies. They test the same functionality as the TypeScript tests.

To run the JavaScript tests:

```bash
node src/proxy-wrapper.simple.test.js
```

## API Reference

### wrapWithProxy(server, options)

Wraps an MCP server with a proxy that allows intercepting tool calls.

#### Parameters

- `server` (McpServer): The MCP server to wrap
- `options` (ProxyWrapperOptions): Options for the proxy wrapper

#### Returns

- (McpServer): A new MCP server with the proxy functionality

### ProxyWrapperOptions

Options for the proxy wrapper.

#### Properties

- `metadata` (Record<string, any>): Additional metadata to include with every tool call
- `hooks` (ProxyHooks): Hooks for the proxy
- `debug` (boolean): Enable debug mode for detailed logging

### ProxyHooks

Hooks for the proxy wrapper.

#### Properties

- `beforeToolCall` (function): Hook that runs before a tool call
- `afterToolCall` (function): Hook that runs after a tool call

### ToolCallContext

Context for a tool call.

#### Properties

- `toolName` (string): Name of the tool being called
- `args` (Record<string, any>): Arguments passed to the tool
- `metadata` (Record<string, any>): Additional metadata

### ToolCallResult

Result of a tool call.

#### Properties

- `result` (any): Result returned by the tool
- `metadata` (Record<string, any>): Additional metadata

## Important Notes

- The proxy wrapper is designed to be a lightweight wrapper around an MCP Server.
- It does not modify the original server's behavior, only intercepts tool calls.
- The hooks are executed in the order: beforeToolCall -> tool handler -> afterToolCall.
- If beforeToolCall returns a result, the tool handler is not called.
- Errors in hooks and tool handlers are caught and formatted as error responses.

## License

MIT 
