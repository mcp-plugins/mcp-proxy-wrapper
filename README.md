# MCP Proxy Wrapper

A lightweight, unopinionated proxy wrapper for [Model Context Protocol (MCP)](https://modelcontextprotocol.io/) servers that provides a hook system for intercepting and modifying tool calls.

## Overview

The MCP Proxy Wrapper allows you to wrap an existing MCP server with a proxy that intercepts tool calls, enabling you to:

- Execute custom code before tool calls
- Execute custom code after tool calls
- Modify tool call arguments
- Modify tool call results
- Short-circuit tool calls with custom responses
- Add logging, analytics, or other side effects

All of this without requiring any backend infrastructure or complex configuration.

## Installation

```bash
npm install @modelcontextprotocol/proxy-wrapper
```

## Quick Start

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { wrapWithProxy } from '@modelcontextprotocol/proxy-wrapper';
import { z } from 'zod';

// Create your MCP server
const server = new McpServer({ 
  name: "My MCP Server",
  version: "1.0.0"
});

// Register tools
server.tool("greet", { name: z.string() }, async (args) => {
  return {
    content: [{ type: "text", text: `Hello, ${args.name}!` }]
  };
});

// Wrap with proxy
const proxiedServer = wrapWithProxy(server, {
  hooks: {
    beforeToolCall: async (context) => {
      console.log(`Tool call: ${context.toolName} with args:`, context.args);
    },
    afterToolCall: async (context, result) => {
      console.log(`Tool result:`, result);
      return result;
    }
  },
  debug: true
});

// Use the proxied server as normal
```

## Hook System

The proxy wrapper provides two hooks:

### beforeToolCall

Executes before a tool call is forwarded to the MCP server.

```typescript
beforeToolCall?: (context: ToolCallContext) => Promise<void | ToolCallResult>;
```

The `context` object contains:
- `toolName`: The name of the tool being called
- `args`: The arguments passed to the tool
- `metadata`: Additional metadata about the call

If the hook returns a `ToolCallResult`, the tool call is short-circuited and the result is returned directly without calling the original tool.

### afterToolCall

Executes after a tool call is processed by the MCP server.

```typescript
afterToolCall?: (context: ToolCallContext, result: ToolCallResult) => Promise<ToolCallResult>;
```

The `result` object contains:
- `result`: The result returned by the tool
- `metadata`: Additional metadata about the result

The hook must return a `ToolCallResult` object, which will be used as the final result of the tool call.

## Examples

### Modifying Arguments

```typescript
const proxiedServer = wrapWithProxy(server, {
  hooks: {
    beforeToolCall: async (context) => {
      // Modify arguments
      if (context.toolName === 'greet') {
        context.args.name = `${context.args.name} (modified)`;
      }
    }
  }
});
```

### Short-circuiting Tool Calls

```typescript
const proxiedServer = wrapWithProxy(server, {
  hooks: {
    beforeToolCall: async (context) => {
      // Block certain operations
      if (context.toolName === 'calculate' && context.args.operation === 'divide' && context.args.b === 0) {
        return {
          result: {
            content: [{ 
              type: "text", 
              text: "Division by zero prevented by hook" 
            }]
          }
        };
      }
    }
  }
});
```

### Modifying Results

```typescript
const proxiedServer = wrapWithProxy(server, {
  hooks: {
    afterToolCall: async (context, result) => {
      // Modify results
      if (context.toolName === 'greet' && result.result.content && result.result.content[0]) {
        result.result.content[0].text += " Thanks for using our service!";
      }
      
      return result;
    }
  }
});
```

### Adding Logging

```typescript
const proxiedServer = wrapWithProxy(server, {
  hooks: {
    beforeToolCall: async (context) => {
      console.log(`Tool call: ${context.toolName}`, context.args);
    },
    afterToolCall: async (context, result) => {
      console.log(`Tool result:`, result.result);
      return result;
    }
  }
});
```

### Adding Analytics

```typescript
const proxiedServer = wrapWithProxy(server, {
  hooks: {
    beforeToolCall: async (context) => {
      const startTime = Date.now();
      context.metadata.startTime = startTime;
    },
    afterToolCall: async (context, result) => {
      const endTime = Date.now();
      const duration = endTime - (context.metadata.startTime || endTime);
      
      // Send analytics
      await sendAnalytics({
        toolName: context.toolName,
        duration,
        success: !result.result.isError,
        timestamp: new Date().toISOString()
      });
      
      return result;
    }
  }
});
```

## API Reference

### wrapWithProxy

```typescript
function wrapWithProxy(
  server: McpServer,
  options?: ProxyWrapperOptions
): McpServer
```

#### Parameters

- `server`: The MCP server to wrap
- `options`: Options for the proxy wrapper
  - `hooks`: Hooks for the proxy
    - `beforeToolCall`: Hook that runs before a tool call
    - `afterToolCall`: Hook that runs after a tool call
  - `metadata`: Additional metadata to include with every tool call
  - `debug`: Enable debug mode for detailed logging

#### Returns

The wrapped MCP server.

### Interfaces

#### ToolCallContext

```typescript
interface ToolCallContext {
  toolName: string;
  args: Record<string, any>;
  metadata?: Record<string, any>;
}
```

#### ToolCallResult

```typescript
interface ToolCallResult {
  result: any;
  metadata?: Record<string, any>;
}
```

#### ProxyHooks

```typescript
interface ProxyHooks {
  beforeToolCall?: (context: ToolCallContext) => Promise<void | ToolCallResult>;
  afterToolCall?: (context: ToolCallContext, result: ToolCallResult) => Promise<ToolCallResult>;
}
```

#### ProxyWrapperOptions

```typescript
interface ProxyWrapperOptions {
  metadata?: Record<string, any>;
  hooks?: ProxyHooks;
  debug?: boolean;
}
```

## License

MIT 
