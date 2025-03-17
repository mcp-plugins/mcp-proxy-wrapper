# MCP Proxy Wrapper

A lightweight wrapper for the Model Context Protocol (MCP) server that allows intercepting and modifying tool calls.

## Features

- Wrap an existing MCP Server instance
- Execute hooks before and after tool calls
- Short-circuit tool calls
- Handle errors gracefully
- Detailed logging

## Installation

```bash
npm install mcp-proxy-wrapper
```

## Usage

### TypeScript

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { wrapWithProxy } from 'mcp-proxy-wrapper';
import { z } from 'zod';

// Create an MCP server
const server = new McpServer({
  name: 'My Server',
  version: '1.0.0'
});

// Wrap the server with a proxy
const proxiedServer = wrapWithProxy(server, {
  hooks: {
    // Hook for before a tool is called
    beforeToolCall: async (context) => {
      console.log(`Tool called: ${context.toolName}`);
      console.log(`Arguments: ${JSON.stringify(context.args)}`);
      
      // You can modify the arguments
      if (context.toolName === 'greet' && context.args.name) {
        context.args.name = `${context.args.name} (modified)`;
      }
      
      // You can also short-circuit the call by returning a result
      if (context.toolName === 'blocked') {
        return {
          content: [{ type: 'text', text: 'This tool is blocked!' }]
        };
      }
    },
    
    // Hook for after a tool is called
    afterToolCall: async (context, result) => {
      console.log(`Tool result: ${JSON.stringify(result.result)}`);
      
      // You can modify the result
      if (context.toolName === 'greet' && result.result.content) {
        result.result.content[0].text += ' (modified result)';
      }
      
      return result;
    }
  },
  debug: true // Enable debug logging
});

// Register tools as usual with the proxied server
proxiedServer.tool('greet', { name: z.string() }, async (args) => {
  return {
    content: [{ type: 'text', text: `Hello, ${args.name}!` }]
  };
});

// Start the server
server.connect(transport);
```

### JavaScript

```javascript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { wrapWithProxy } from 'mcp-proxy-wrapper';

// Create an MCP server
const server = new McpServer({
  name: 'My Server',
  version: '1.0.0'
});

// Wrap the server with a proxy
const proxiedServer = wrapWithProxy(server, {
  hooks: {
    // Hook for before a tool is called
    beforeToolCall: async (context) => {
      console.log(`Tool called: ${context.toolName}`);
      
      // You can modify the arguments
      if (context.args.name) {
        context.args.name = `${context.args.name} (modified)`;
      }
    },
    
    // Hook for after a tool is called
    afterToolCall: async (context, result) => {
      console.log(`Tool result:`, result.result);
      
      // You can modify the result
      if (result.result.content && result.result.content[0]) {
        result.result.content[0].text += ' (modified result)';
      }
      
      return result;
    }
  }
});

// Register tools as usual with the proxied server
proxiedServer.tool('greet', { name: 'string' }, async (args) => {
  return {
    content: [{ type: 'text', text: `Hello, ${args.name}!` }]
  };
});

// Start the server
server.connect(transport);
```

## API

### `wrapWithProxy(server, options)`

Wraps an MCP server with a proxy that allows for intercepting and modifying tool calls.

#### Parameters

- `server`: The MCP server to wrap.
- `options`: Configuration options for the proxy wrapper.
  - `hooks`: Hook functions to execute before and after tool calls.
    - `beforeToolCall`: Called before a tool is executed.
    - `afterToolCall`: Called after a tool is executed.
  - `debug`: Enable debug logging.

#### Returns

A proxied MCP server that has the same API as the original server.

### Hook Context

Both hook functions receive a context object with the following properties:

- `toolName`: The name of the tool being called.
- `args`: The arguments passed to the tool.
- `requestId`: A unique ID for the request.
- `metadata`: Additional metadata about the tool and request.

### Intercepting and Modifying

The hooks allow for:

1. **Argument Modification**: Modify the arguments before they're passed to the tool.
2. **Result Modification**: Modify the result before it's returned to the caller.
3. **Short-Circuiting**: Return a result directly from the `beforeToolCall` hook to skip the tool execution.
4. **Logging and Monitoring**: Log or monitor tool calls without modifying them.

## Testing

The MCP Proxy Wrapper is extensively tested to ensure its functionality and compatibility with the MCP Server.

### Test Suite

The test suite includes:

1. **Basic Unit Tests**: Verify core functionality with mock servers
2. **Example Tests**: Demonstrate usage with simplified examples
3. **Edge Case Tests**: Test handling of null/undefined values, complex objects, etc.
4. **Integration Tests**: Test integration with real MCP Server and Client
5. **JavaScript Tests**: Verify the JavaScript implementation works as expected

### Running Tests

```bash
npm test
```

For specific test files:

```bash
npm test -- src/proxy-wrapper.test.ts
```

To run JavaScript tests separately:

```bash
node src/proxy-wrapper.simple.test.js
```

## License

MIT 
