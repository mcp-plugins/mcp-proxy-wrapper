<div align="center">

# 🚀 MCP Proxy Wrapper

**Add powerful hooks, plugins, and enterprise features to any MCP server without changing a single line of your existing code**

[![NPM Version](https://img.shields.io/npm/v/mcp-proxy-wrapper?style=for-the-badge&logo=npm)](https://www.npmjs.com/package/mcp-proxy-wrapper) [![GitHub Stars](https://img.shields.io/github/stars/mcp-plugins/mcp-proxy-wrapper?style=for-the-badge&logo=github)](https://github.com/mcp-plugins/mcp-proxy-wrapper) [![License](https://img.shields.io/github/license/mcp-plugins/mcp-proxy-wrapper?style=for-the-badge)](https://github.com/mcp-plugins/mcp-proxy-wrapper/blob/main/LICENSE) [![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)

### 📖 [**View Full Documentation**](https://mcp-plugins.github.io/mcp-proxy-wrapper) | 🚀 [**Quick Start Guide**](https://mcp-plugins.github.io/mcp-proxy-wrapper/getting-started) | 🔌 [**Plugin System**](https://mcp-plugins.github.io/mcp-proxy-wrapper/plugins)

```bash
npm install mcp-proxy-wrapper
```

*A zero-modification wrapper that instantly adds AI-powered features, security, monitoring, and extensibility to your existing MCP servers. Works with any MCP server - no code changes required.*

</div>

---

## 🚀 Why MCP Proxy Wrapper?

### **The Problem**
You have an MCP server that works great, but you need to add authentication, rate limiting, AI summarization, caching, or monitoring. Traditional solutions require modifying your server code, adding dependencies, and maintaining additional complexity.

### **The Solution**
MCP Proxy Wrapper acts as an invisible layer between your MCP server and clients, adding powerful features without touching your existing code.

```typescript
// Your existing server - NO CHANGES NEEDED
const server = new McpServer({ name: 'My Server', version: '1.0.0' });
server.tool('getData', schema, getData); // Your existing tool

// Add enterprise features in seconds
const proxiedServer = await wrapWithProxy(server, {
  hooks: {
    beforeToolCall: async (context) => {
      // Add authentication, rate limiting, logging...
      console.log(`🔧 Calling: ${context.toolName}`);
    }
  },
  plugins: [
    new LLMSummarizationPlugin(), // Auto-summarize long responses
    new ChatMemoryPlugin()        // Add conversation memory
  ]
});
// That's it! Your server now has enterprise features
```

## ✨ Features

- **🔧 Zero Code Changes**: Wrap any existing MCP server instantly
- **🌐 Remote Server Support**: Connect to external MCP servers over HTTP/SSE, STDIO, WebSocket
- **🪝 Powerful Hooks**: beforeToolCall and afterToolCall with full context
- **🔌 Smart Plugins**: Pre-built LLM summarization and chat memory
- **🛡️ Enterprise Ready**: Authentication, rate limiting, caching patterns
- **🔄 Transform Anything**: Modify arguments, results, add metadata
- **⚡ Short-Circuit Logic**: Skip execution with custom responses  
- **📊 Built-in Monitoring**: Comprehensive logging and debugging
- **🧪 Production Tested**: 65+ tests with real MCP client-server validation
- **📘 TypeScript Native**: Full type safety and IntelliSense support
- **🌐 Universal**: Works with any MCP SDK v1.6.0+ server

## 📦 Installation

```bash
npm install mcp-proxy-wrapper
```

## 🎯 5-Minute Quick Start

Transform your existing MCP server in under 5 minutes:

### Step 1: Install (30 seconds)
```bash
npm install mcp-proxy-wrapper
```

### Step 2: Wrap Your Existing Server (2 minutes)
```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { wrapWithProxy, LLMSummarizationPlugin } from 'mcp-proxy-wrapper';

// Your existing server (UNCHANGED)
const server = new McpServer({ name: 'My Server', version: '1.0.0' });

// Add enterprise features with zero code changes
const enhancedServer = await wrapWithProxy(server, {
  plugins: [
    new LLMSummarizationPlugin({
      options: {
        provider: 'openai',
        openaiApiKey: process.env.OPENAI_API_KEY
      }
    })
  ],
  hooks: {
    beforeToolCall: async (context) => {
      console.log(`🔧 [${new Date().toISOString()}] Calling: ${context.toolName}`);
    }
  }
});

// Register your existing tools exactly as before
enhancedServer.tool('myTool', mySchema, myHandler);
```

### Step 3: See the Magic (2 minutes)
```typescript
// Your tool responses are now automatically:
// ✅ Logged with timestamps
// ✅ Summarized if over 500 characters  
// ✅ Enhanced with metadata
// ✅ All without changing your original tool code!

// Test it
const result = await client.callTool({
  name: 'myTool',
  arguments: { data: 'test' }
});

console.log(result._meta.summarized); // true (if content was long)
console.log(result._meta.originalLength); // Original response length
console.log(result.content); // Summarized content
```

### Before vs After

**Before (your existing code):**
```typescript
server.tool('research', schema, async (args) => {
  const data = await fetchResearchData(args.topic);
  return { content: [{ type: 'text', text: data }] };
}); // Works but no additional features
```

**After (with proxy wrapper):**
```typescript
const proxiedServer = await wrapWithProxy(server, { 
  plugins: [new LLMSummarizationPlugin()] 
});

proxiedServer.tool('research', schema, async (args) => {
  const data = await fetchResearchData(args.topic);
  return { content: [{ type: 'text', text: data }] };
}); // Same code + AI summarization + logging + monitoring
```

**✨ Your server instantly gains:**
- 🤖 AI-powered response summarization
- 📊 Automatic request/response logging
- ⚡ Performance monitoring
- 🔧 Request modification capabilities
- 🛡️ Authentication hooks (add your own)
- 💾 Response caching (add your own)

**📖 [Complete Quick Start Guide →](https://mcp-plugins.github.io/mcp-proxy-wrapper/getting-started)**

## 🌐 Remote Server Proxying

**NEW**: Connect to external MCP servers and add plugin functionality without modifying the remote server:

```typescript
import { createHttpServerProxy, LLMSummarizationPlugin } from 'mcp-proxy-wrapper';

// Connect to remote HTTP/SSE MCP server and add AI summarization
const proxyServer = await createHttpServerProxy('https://api.example.com/mcp', {
  plugins: [new LLMSummarizationPlugin()],
  remoteServer: {
    name: 'External API',
    headers: { 'Authorization': 'Bearer your-token' }
  }
});

// Remote server now has AI summarization + all plugin features!
```

**📡 [Remote Server Guide →](https://mcp-plugins.github.io/mcp-proxy-wrapper/remote-servers)**

## 🔌 Plugin System

The MCP Proxy Wrapper includes a powerful plugin architecture that allows you to create reusable, composable functionality.

### Using Built-in Plugins

```typescript
import { LLMSummarizationPlugin, ChatMemoryPlugin } from 'mcp-proxy-wrapper';

const summarizationPlugin = new LLMSummarizationPlugin();
const memoryPlugin = new ChatMemoryPlugin();

const proxiedServer = await wrapWithProxy(server, {
  plugins: [
    summarizationPlugin,
    memoryPlugin
  ]
});
```

### LLM Summarization Plugin

Automatically summarizes long tool responses using AI:

```typescript
import { LLMSummarizationPlugin } from 'mcp-proxy-wrapper';

const plugin = new LLMSummarizationPlugin();
plugin.updateConfig({
  options: {
    provider: 'openai', // or 'mock' for testing
    openaiApiKey: process.env.OPENAI_API_KEY,
    model: 'gpt-4o-mini',
    minContentLength: 500,
    summarizeTools: ['research', 'analyze', 'fetch-data'],
    saveOriginal: true // Store original responses for retrieval
  }
});

const proxiedServer = await wrapWithProxy(server, {
  plugins: [plugin]
});

// Tool responses are automatically summarized
const result = await client.callTool({
  name: 'research',
  arguments: { topic: 'artificial intelligence' }
});

console.log(result._meta.summarized); // true
console.log(result._meta.originalLength); // 2000
console.log(result._meta.summaryLength); // 200
console.log(result.content[0].text); // "Summary: ..."
```

### Chat Memory Plugin

Provides conversational interface for saved tool responses:

```typescript
import { ChatMemoryPlugin } from 'mcp-proxy-wrapper';

const memoryPlugin = new ChatMemoryPlugin();
memoryPlugin.updateConfig({
  options: {
    provider: 'openai',
    openaiApiKey: process.env.OPENAI_API_KEY,
    saveResponses: true,
    enableChat: true,
    maxEntries: 1000
  }
});

const proxiedServer = await wrapWithProxy(server, {
  plugins: [memoryPlugin]
});

// Tool responses are automatically saved
await client.callTool({
  name: 'research',
  arguments: { topic: 'climate change', userId: 'user123' }
});

// Chat with your saved data
const sessionId = await memoryPlugin.startChatSession('user123');
const response = await memoryPlugin.chatWithMemory(
  sessionId,
  "What did I research about climate change?",
  'user123'
);
console.log(response); // AI response based on saved research
```

### Creating Custom Plugins

```typescript
import { BasePlugin, PluginContext, ToolCallResult } from 'mcp-proxy-wrapper';

class MyCustomPlugin extends BasePlugin {
  name = 'my-custom-plugin';
  version = '1.0.0';
  
  async afterToolCall(context: PluginContext, result: ToolCallResult): Promise<ToolCallResult> {
    // Add custom metadata
    return {
      ...result,
      result: {
        ...result.result,
        _meta: {
          ...result.result._meta,
          processedBy: this.name,
          customField: 'custom value'
        }
      }
    };
  }
}

const proxiedServer = await wrapWithProxy(server, {
  plugins: [new MyCustomPlugin()]
});
```

### Plugin Configuration

```typescript
const plugin = new LLMSummarizationPlugin();

// Runtime configuration updates
plugin.updateConfig({
  enabled: true,
  priority: 10,
  options: {
    minContentLength: 200,
    provider: 'openai'
  },
  includeTools: ['research', 'analyze'], // Only these tools
  excludeTools: ['chat'], // Skip these tools
  debug: true
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

### Core Functions

#### `wrapWithProxy(server, options)` (v1 API)

Wraps an MCP server instance with proxy functionality.

**Parameters:**
- `server` (McpServer): The MCP server to wrap
- `options` (ProxyWrapperOptions): Configuration options

**Returns:** 
`Promise<McpServer>` - A new MCP server instance with proxy capabilities

#### `wrapWithEnhancedProxy(server, options)` (v2 API)

Enhanced version with advanced lifecycle management and performance features.

**Parameters:**
- `server` (McpServer): The MCP server to wrap  
- `options` (EnhancedProxyWrapperOptions): Enhanced configuration options

**Returns:**
`Promise<McpServer>` - Enhanced server with v2 proxy capabilities

### Available Exports

```typescript
// Core wrapper functions
export { wrapWithProxy } from 'mcp-proxy-wrapper';
export { wrapWithEnhancedProxy, EnhancedProxyWrapper, getProxyWrapperInstance } from 'mcp-proxy-wrapper';

// Plugin system
export { BasePlugin, LLMSummarizationPlugin, ChatMemoryPlugin } from 'mcp-proxy-wrapper';

// Lifecycle and execution management
export { PluginLifecycleManager, HookExecutionManager } from 'mcp-proxy-wrapper';

// Types and enums
export { ExecutionMode, HealthStatus, ServerLifecycleEvent } from 'mcp-proxy-wrapper';
```

### ProxyWrapperOptions

```typescript
interface ProxyWrapperOptions {
  hooks?: ProxyHooks;              // Hook functions
  plugins?: ProxyPlugin[];         // Plugin instances
  pluginConfig?: Record<string, any>; // Global plugin configuration
  metadata?: Record<string, any>;  // Global metadata
  debug?: boolean;                 // Enable debug logging
}
```

### EnhancedProxyWrapperOptions (v2)

```typescript
interface EnhancedProxyWrapperOptions extends ProxyWrapperOptions {
  lifecycle?: LifecycleConfig;     // Plugin lifecycle management
  execution?: ExecutionConfig;    // Hook execution configuration  
  performance?: PerformanceConfig; // Performance monitoring
}
```

### ProxyHooks

```typescript
interface ProxyHooks {
  beforeToolCall?: (context: ToolCallContext) => Promise<void | ToolCallResult>;
  afterToolCall?: (context: ToolCallContext, result: ToolCallResult) => Promise<ToolCallResult>;
}
```

## 🧪 Testing & Validation

The MCP Proxy Wrapper includes comprehensive testing with **real MCP client-server communication** to prove functionality:

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test suites
npm test -- --testNamePattern="Comprehensive Tests"
npm test -- --testNamePattern="Edge Cases"
npm test -- --testNamePattern="Protocol Compliance"

# Test plugin functionality with real MCP communication
npm test -- src/examples/plugins/__tests__/llm-summarization.integration.test.ts
```

### ✅ **Proof of Working Functionality**

Our integration tests demonstrate the proxy wrapper works with real MCP servers:

```bash
$ npm test -- src/examples/plugins/__tests__/llm-summarization.integration.test.ts

✓ LLM Summarization Plugin Integration (8/8 tests passed)
  ✓ should summarize long research tool responses
  ✓ should not summarize short responses  
  ✓ should not summarize tools not in the filter list
  ✓ should respect user preference for original content
  ✓ should handle tool execution errors gracefully
  ✓ should fallback to original content when LLM fails
  ✓ should handle multiple tool calls with summarization
  ✓ should enable retrieval of original data after summarization
```

**What the tests prove:**

- **Real MCP Protocol**: Uses `InMemoryTransport.createLinkedPair()` for actual client-server communication
- **Plugin Execution**: Shows plugins intercepting and enhancing tool calls in real-time
- **Request Tracking**: Demonstrates correlation IDs and proper request lifecycle management
- **Error Handling**: Validates graceful fallback when plugins encounter issues
- **Content Processing**: Proves AI summarization works with long tool responses
- **Storage System**: Confirms original content can be retrieved after summarization

**Sample test output showing real functionality:**
```
[MCP-PROXY] Executing plugin beforeToolCall hooks for research [901a581e]
[MCP-PROXY] Plugin beforeToolCall hooks completed for research [901a581e] 
[MCP-PROXY] Executing plugin afterToolCall hooks for research [901a581e]
[MCP-PROXY] Plugin hooks completed for research [901a581e]
```

### Test Coverage

- ✅ **65+ comprehensive tests** covering all functionality
- ✅ **Real MCP client-server communication** using InMemoryTransport
- ✅ **Plugin system validation** with integration tests
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
const proxiedServer = await wrapWithProxy(server, { 
  hooks: myHooks,
  plugins: [new LLMSummarizationPlugin()]
});
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
const monitoredProxy = await wrapWithProxy(server, {
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

### 5. AI-Powered Enhancement

```typescript
import { LLMSummarizationPlugin, ChatMemoryPlugin } from 'mcp-proxy-wrapper';

const aiEnhancedProxy = await wrapWithProxy(server, {
  plugins: [
    new LLMSummarizationPlugin({
      options: {
        provider: 'openai',
        openaiApiKey: process.env.OPENAI_API_KEY,
        summarizeTools: ['research', 'analyze', 'fetch-data'],
        minContentLength: 500
      }
    }),
    new ChatMemoryPlugin({
      options: {
        provider: 'openai',
        openaiApiKey: process.env.OPENAI_API_KEY,
        saveResponses: true,
        enableChat: true
      }
    })
  ]
});

// Long research responses are automatically summarized
// All responses are saved for conversational querying
```

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](./CONTRIBUTING.md) for details.

### Development Setup

```bash
git clone https://github.com/crazyrabbitLTC/mcp-proxy-wrapper.git
cd mcp-proxy-wrapper
npm install
npm run build
npm test
```

## 📄 License

MIT License - see [LICENSE](./LICENSE) file for details.

## 📖 Documentation

For comprehensive guides, API reference, and examples:

### 🌟 [**Complete Documentation Site**](https://mcp-plugins.github.io/mcp-proxy-wrapper)

- 🚀 [**Getting Started**](https://mcp-plugins.github.io/mcp-proxy-wrapper/getting-started) - 5-minute setup guide
- 🔧 [**How It Works**](https://mcp-plugins.github.io/mcp-proxy-wrapper/how-it-works) - Understanding the proxy mechanism
- 🏗️ [**Architecture**](https://mcp-plugins.github.io/mcp-proxy-wrapper/architecture) - Technical deep dive
- 🔌 [**Plugin System**](https://mcp-plugins.github.io/mcp-proxy-wrapper/plugins) - Build and use plugins
- 📚 [**API Reference**](https://mcp-plugins.github.io/mcp-proxy-wrapper/api-reference) - Complete API docs
- 🚀 [**Deployment Guide**](https://mcp-plugins.github.io/mcp-proxy-wrapper/deployment) - Production deployment

## 🔗 Links

- [Model Context Protocol](https://modelcontextprotocol.io/)
- [MCP TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk)
- [GitHub Repository](https://github.com/mcp-plugins/mcp-proxy-wrapper)
- [Issues & Support](https://github.com/mcp-plugins/mcp-proxy-wrapper/issues)

---

<div align="center">
  <strong>Built with ❤️ for the MCP ecosystem</strong><br>
  <em>Created by <a href="mailto:dennison@dennisonbertram.com">Dennison Bertram</a></em>
</div>