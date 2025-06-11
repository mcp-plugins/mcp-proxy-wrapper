---
layout: default
title: Quick Start Guide
---

# Quick Start Guide

Get up and running with MCP Proxy Wrapper in just a few minutes! This guide will walk you through installation, basic setup, and your first proxy wrapper implementation.

## 📦 Installation

```bash
npm install mcp-proxy-wrapper
```

Make sure you have the MCP SDK installed as well:

```bash
npm install @modelcontextprotocol/sdk zod
```

## 🎯 Basic Example

Let's start with the simplest possible example:

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { wrapWithProxy } from 'mcp-proxy-wrapper';
import { z } from 'zod';

// 1. Create your existing MCP server
const server = new McpServer({
  name: 'My First Proxy Server',
  version: '1.0.0'
});

// 2. Wrap it with proxy functionality
const proxiedServer = wrapWithProxy(server, {
  hooks: {
    beforeToolCall: async (context) => {
      console.log(`🔧 About to call: ${context.toolName}`);
      console.log(`📋 Arguments:`, context.args);
    },
    afterToolCall: async (context, result) => {
      console.log(`✅ Completed: ${context.toolName}`);
      console.log(`📤 Result:`, result.result);
      return result; // Important: always return the result
    }
  },
  debug: true // Enable debug logging
});

// 3. Register tools exactly like before
proxiedServer.tool('greet', { 
  name: z.string() 
}, async (args) => {
  return {
    content: [{ type: 'text', text: `Hello, ${args.name}!` }]
  };
});

// 4. Connect and start (your existing code)
// proxiedServer.connect(transport);
```

## 🚀 Step-by-Step Walkthrough

### Step 1: Import Dependencies

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { wrapWithProxy } from 'mcp-proxy-wrapper';
import { z } from 'zod';
```

### Step 2: Create Your Server

```typescript
const server = new McpServer({
  name: 'My Server',
  version: '1.0.0'
});
```

### Step 3: Add Proxy Capabilities

```typescript
const proxiedServer = wrapWithProxy(server, {
  // Configuration options
  debug: true,
  
  // Hook functions
  hooks: {
    beforeToolCall: async (context) => {
      // This runs before every tool call
      console.log(`Calling tool: ${context.toolName}`);
    },
    afterToolCall: async (context, result) => {
      // This runs after every tool call
      console.log(`Tool result: ${JSON.stringify(result)}`);
      return result; // Must return the result
    }
  }
});
```

### Step 4: Register Tools Normally

```typescript
// The proxied server has the exact same API as the original
proxiedServer.tool('calculate', {
  operation: z.enum(['add', 'subtract', 'multiply', 'divide']),
  a: z.number(),
  b: z.number()
}, async (args) => {
  let result;
  switch (args.operation) {
    case 'add': result = args.a + args.b; break;
    case 'subtract': result = args.a - args.b; break;
    case 'multiply': result = args.a * args.b; break;
    case 'divide': result = args.a / args.b; break;
  }
  
  return {
    content: [{ 
      type: 'text', 
      text: `${args.a} ${args.operation} ${args.b} = ${result}` 
    }]
  };
});
```

## 🛠️ Common Patterns

### 1. Logging All Tool Calls

```typescript
const loggedServer = wrapWithProxy(server, {
  hooks: {
    beforeToolCall: async (context) => {
      console.log(`[${new Date().toISOString()}] Tool: ${context.toolName}`);
      console.log(`[${new Date().toISOString()}] Args: ${JSON.stringify(context.args)}`);
    },
    afterToolCall: async (context, result) => {
      const isError = result.result.isError;
      const status = isError ? 'ERROR' : 'SUCCESS';
      console.log(`[${new Date().toISOString()}] Result: ${status}`);
      return result;
    }
  }
});
```

### 2. Adding Timestamps to All Responses

```typescript
const timestampedServer = wrapWithProxy(server, {
  hooks: {
    afterToolCall: async (context, result) => {
      // Add timestamp to every response
      if (result.result.content) {
        result.result._meta = {
          ...result.result._meta,
          timestamp: new Date().toISOString(),
          tool: context.toolName
        };
      }
      return result;
    }
  }
});
```

### 3. Input Validation and Sanitization

```typescript
const validatedServer = wrapWithProxy(server, {
  hooks: {
    beforeToolCall: async (context) => {
      // Sanitize string inputs
      Object.keys(context.args).forEach(key => {
        if (typeof context.args[key] === 'string') {
          context.args[key] = context.args[key].trim();
        }
      });
      
      // Add request ID for tracking
      context.args._requestId = Math.random().toString(36).substr(2, 9);
    }
  }
});
```

### 4. Simple Access Control

```typescript
const secureServer = wrapWithProxy(server, {
  hooks: {
    beforeToolCall: async (context) => {
      // Check for API key
      if (!context.args.apiKey) {
        return {
          result: {
            content: [{ type: 'text', text: 'API key required' }],
            isError: true
          }
        };
      }
      
      // Simple key validation (use proper validation in production!)
      if (context.args.apiKey !== 'your-secret-key') {
        return {
          result: {
            content: [{ type: 'text', text: 'Invalid API key' }],
            isError: true
          }
        };
      }
      
      // Remove API key from args before processing
      delete context.args.apiKey;
    }
  }
});
```

## 🔍 Testing Your Setup

You can test your proxy wrapper using the MCP SDK's testing utilities:

```typescript
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';

async function testProxyWrapper() {
  // Create linked transports
  const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();
  
  // Connect server
  await proxiedServer.connect(serverTransport);
  
  // Create and connect client
  const client = new Client({ name: 'Test Client', version: '1.0.0' }, {});
  await client.connect(clientTransport);
  
  // Test tool call
  const result = await client.callTool({
    name: 'greet',
    arguments: { name: 'World' }
  });
  
  console.log('Test result:', result);
  
  // Cleanup
  await clientTransport.close();
  await serverTransport.close();
}

// Run the test
testProxyWrapper().catch(console.error);
```

## 🎉 Next Steps

Congratulations! You now have a working MCP Proxy Wrapper. Here's what to explore next:

1. **[Examples](./examples)** - See real-world usage patterns
2. **[API Reference](./api)** - Detailed API documentation
3. **[Getting Started Guide](./getting-started)** - Comprehensive tutorial
4. **Advanced Features** - Caching, rate limiting, authentication

## 💡 Tips & Best Practices

### Always Return Results

```typescript
// ✅ Good - always return the result
afterToolCall: async (context, result) => {
  // Do your processing
  console.log('Processing result...');
  return result; // Important!
}

// ❌ Bad - missing return statement
afterToolCall: async (context, result) => {
  console.log('Processing result...');
  // Missing return - this will break your server!
}
```

### Handle Errors Gracefully

```typescript
beforeToolCall: async (context) => {
  try {
    await someAsyncOperation(context);
  } catch (error) {
    // Return error response instead of throwing
    return {
      result: {
        content: [{ type: 'text', text: `Error: ${error.message}` }],
        isError: true
      }
    };
  }
}
```

### Use Debug Mode During Development

```typescript
const proxiedServer = wrapWithProxy(server, {
  debug: process.env.NODE_ENV === 'development', // Only in dev
  hooks: {
    // Your hooks
  }
});
```

## 🆘 Troubleshooting

### Common Issues

**Problem**: "TypeError: Cannot read property 'hooks' of undefined"
**Solution**: Make sure to pass an options object, even if empty:
```typescript
const proxiedServer = wrapWithProxy(server, {}); // At minimum
```

**Problem**: Tool calls hang or timeout
**Solution**: Ensure your `afterToolCall` hook returns the result:
```typescript
afterToolCall: async (context, result) => {
  // Your logic here
  return result; // This is required!
}
```

**Problem**: Arguments not being passed to tools
**Solution**: Make sure you're using Zod schemas when registering tools:
```typescript
// ✅ Good
proxiedServer.tool('myTool', { name: z.string() }, handler);

// ❌ Bad (arguments won't be passed correctly)
proxiedServer.tool('myTool', {}, handler);
```

Ready to build something amazing? Check out our [Examples](./examples) section for inspiration!