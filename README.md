# MCP Proxy Wrapper

A lightweight, powerful wrapper for Model Context Protocol (MCP) servers that provides a comprehensive hook system for intercepting, monitoring, and modifying tool calls without changing your existing server code.

[![npm version](https://img.shields.io/npm/v/mcp-proxy-wrapper.svg)](https://www.npmjs.com/package/mcp-proxy-wrapper)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

## 🚀 Features

- **🔧 Zero-Modification Wrapping**: Wrap existing MCP servers without changing their code
- **🪝 Powerful Hook System**: Execute custom logic before and after tool calls
- **🔄 Argument & Result Modification**: Transform inputs and outputs on-the-fly
- **⚡ Short-Circuit Capability**: Skip tool execution with custom responses
- **📊 Comprehensive Logging**: Built-in monitoring and debugging support
- **🧪 Fully Tested**: 100% test coverage with real MCP client-server validation
- **📘 TypeScript First**: Complete TypeScript support with full type safety
- **🌐 Universal Compatibility**: Works with any MCP SDK v1.6.0+ server

## 📦 Installation

```bash
npm install mcp-proxy-wrapper
```

## 🎯 Quick Start

### Basic Usage

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { wrapWithProxy } from 'mcp-proxy-wrapper';
import { z } from 'zod';

// Create your existing MCP server
const server = new McpServer({
  name: 'My Server',
  version: '1.0.0'
});

// Wrap it with proxy functionality
const proxiedServer = wrapWithProxy(server, {
  hooks: {
    // Monitor all tool calls
    beforeToolCall: async (context) => {
      console.log(`🔧 Calling tool: ${context.toolName}`);
      console.log(`📝 Arguments:`, context.args);
    },
    
    // Process results
    afterToolCall: async (context, result) => {
      console.log(`✅ Tool completed: ${context.toolName}`);
      return result; // Pass through unchanged
    }
  },
  debug: true // Enable detailed logging
});

// Register tools normally
proxiedServer.tool('greet', { name: z.string() }, async (args) => {
  return {
    content: [{ type: 'text', text: `Hello, ${args.name}!` }]
  };
});
```

### Advanced Hook Examples

#### 1. Argument Modification

```typescript
const proxiedServer = wrapWithProxy(server, {
  hooks: {
    beforeToolCall: async (context) => {
      // Add timestamp to all tool calls
      context.args.timestamp = new Date().toISOString();
      
      // Sanitize user input
      if (context.args.message) {
        context.args.message = context.args.message.trim();
      }
    }
  }
});
```

#### 2. Result Enhancement

```typescript
const proxiedServer = wrapWithProxy(server, {
  hooks: {
    afterToolCall: async (context, result) => {
      // Add metadata to all responses
      if (result.result.content) {
        result.result._meta = {
          toolName: context.toolName,
          processedAt: new Date().toISOString(),
          version: '1.0.0'
        };
      }
      return result;
    }
  }
});
```

#### 3. Access Control & Short-Circuiting

```typescript
const proxiedServer = wrapWithProxy(server, {
  hooks: {
    beforeToolCall: async (context) => {
      // Block certain tools
      if (context.toolName === 'delete' && !context.args.adminKey) {
        return {
          result: {
            content: [{ type: 'text', text: 'Access denied: Admin key required' }],
            isError: true
          }
        };
      }
      
      // Rate limiting
      if (await isRateLimited(context.args.userId)) {
        return {
          result: {
            content: [{ type: 'text', text: 'Rate limit exceeded. Try again later.' }],
            isError: true
          }
        };
      }
    }
  }
});
```

#### 4. Error Handling & Monitoring

```typescript
const proxiedServer = wrapWithProxy(server, {
  hooks: {
    beforeToolCall: async (context) => {
      // Log to monitoring service
      await analytics.track('tool_call_started', {
        tool: context.toolName,
        userId: context.args.userId,
        timestamp: Date.now()
      });
    },
    
    afterToolCall: async (context, result) => {
      // Handle errors
      if (result.result.isError) {
        await errorLogger.log({
          tool: context.toolName,
          error: result.result.content[0].text,
          context: context.args
        });
      }
      
      return result;
    }
  }
});
```

## 📚 Core Concepts

### Hook System

The proxy wrapper provides two main hooks:

- **`beforeToolCall`**: Executed before the original tool function
  - Can modify arguments
  - Can short-circuit execution by returning a result
  - Perfect for validation, authentication, logging

- **`afterToolCall`**: Executed after the original tool function
  - Can modify the result
  - Must return a `ToolCallResult`
  - Ideal for post-processing, caching, analytics

### Context Object

Every hook receives a `ToolCallContext` with:

```typescript
interface ToolCallContext {
  toolName: string;              // Name of the tool being called
  args: Record<string, any>;     // Tool arguments (mutable)
  metadata?: Record<string, any>; // Additional context data
}
```

### Result Object

The `afterToolCall` hook works with `ToolCallResult`:

```typescript
interface ToolCallResult {
  result: any;                   // The tool's return value
  metadata?: Record<string, any>; // Additional result metadata
}
```

## 🔧 API Reference

### `wrapWithProxy(server, options)`

Wraps an MCP server instance with proxy functionality.

**Parameters:**
- `server` (McpServer): The MCP server to wrap
- `options` (ProxyWrapperOptions): Configuration options

**Returns:** 
A new `McpServer` instance with proxy capabilities

### ProxyWrapperOptions

```typescript
interface ProxyWrapperOptions {
  hooks?: ProxyHooks;              // Hook functions
  metadata?: Record<string, any>;  // Global metadata
  debug?: boolean;                 // Enable debug logging
}
```

### ProxyHooks

```typescript
interface ProxyHooks {
  beforeToolCall?: (context: ToolCallContext) => Promise<void | ToolCallResult>;
  afterToolCall?: (context: ToolCallContext, result: ToolCallResult) => Promise<ToolCallResult>;
}
```

## 🧪 Testing

The MCP Proxy Wrapper includes comprehensive testing with real MCP client-server communication:

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test suites
npm test -- --testNamePattern="Comprehensive Tests"
npm test -- --testNamePattern="Edge Cases"
npm test -- --testNamePattern="Protocol Compliance"
```

### Test Coverage

- ✅ **45 comprehensive tests** covering all functionality
- ✅ **Real MCP client-server communication** using InMemoryTransport
- ✅ **Edge cases** including concurrency, large data, Unicode handling
- ✅ **Protocol compliance** validation
- ✅ **Error scenarios** and stress testing
- ✅ **Both TypeScript and JavaScript** compatibility

## 🔄 Migration & Compatibility

### MCP SDK Compatibility

- **Supported**: MCP SDK v1.6.0 and higher
- **Tested**: Fully validated with MCP SDK v1.12.1
- **Note**: Requires Zod schemas for proper argument passing

### Upgrading Your Server

The proxy wrapper is designed to be a drop-in replacement:

```typescript
// Before
const server = new McpServer(config);
server.tool('myTool', schema, handler);

// After  
const server = new McpServer(config);
const proxiedServer = wrapWithProxy(server, { hooks: myHooks });
proxiedServer.tool('myTool', schema, handler); // Same API!
```

## 🛠 Use Cases

### 1. Authentication & Authorization

```typescript
const authProxy = wrapWithProxy(server, {
  hooks: {
    beforeToolCall: async (context) => {
      if (!await validateApiKey(context.args.apiKey)) {
        return { result: { content: [{ type: 'text', text: 'Invalid API key' }], isError: true }};
      }
    }
  }
});
```

### 2. Rate Limiting

```typescript
const rateLimitedProxy = wrapWithProxy(server, {
  hooks: {
    beforeToolCall: async (context) => {
      const userId = context.args.userId;
      if (await rateLimiter.isExceeded(userId)) {
        return { result: { content: [{ type: 'text', text: 'Rate limit exceeded' }], isError: true }};
      }
      await rateLimiter.increment(userId);
    }
  }
});
```

### 3. Caching

```typescript
const cachedProxy = wrapWithProxy(server, {
  hooks: {
    beforeToolCall: async (context) => {
      const cacheKey = `${context.toolName}:${JSON.stringify(context.args)}`;
      const cached = await cache.get(cacheKey);
      if (cached) {
        return { result: cached };
      }
    },
    afterToolCall: async (context, result) => {
      const cacheKey = `${context.toolName}:${JSON.stringify(context.args)}`;
      await cache.set(cacheKey, result.result, { ttl: 300 });
      return result;
    }
  }
});
```

### 4. Analytics & Monitoring

```typescript
const monitoredProxy = wrapWithProxy(server, {
  hooks: {
    beforeToolCall: async (context) => {
      await metrics.increment('tool_calls_total', { tool: context.toolName });
      context.startTime = Date.now();
    },
    afterToolCall: async (context, result) => {
      const duration = Date.now() - context.startTime;
      await metrics.histogram('tool_call_duration', duration, { tool: context.toolName });
      return result;
    }
  }
});
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](./CONTRIBUTING.md) for details.

### Development Setup

```bash
git clone https://github.com/your-username/mcp-proxy-wrapper.git
cd mcp-proxy-wrapper
npm install
npm run build
npm test
```

## 📄 License

MIT License - see [LICENSE](./LICENSE) file for details.

## 🔗 Links

- [Model Context Protocol](https://modelcontextprotocol.io/)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [Documentation Site](https://your-username.github.io/mcp-proxy-wrapper/)
- [API Reference](https://your-username.github.io/mcp-proxy-wrapper/api/)

---

<div align="center">
  <strong>Built with ❤️ for the MCP ecosystem</strong>
</div>