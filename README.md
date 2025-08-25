<div align="center">

# 🚀 MCP Proxy Wrapper

**Add hooks, plugins, and enterprise features to any MCP server without changing your code**

[![NPM Version](https://img.shields.io/npm/v/mcp-proxy-wrapper?style=for-the-badge&logo=npm)](https://www.npmjs.com/package/mcp-proxy-wrapper) [![GitHub Stars](https://img.shields.io/github/stars/mcp-plugins/mcp-proxy-wrapper?style=for-the-badge&logo=github)](https://github.com/mcp-plugins/mcp-proxy-wrapper) [![License](https://img.shields.io/github/license/mcp-plugins/mcp-proxy-wrapper?style=for-the-badge)](https://github.com/mcp-plugins/mcp-proxy-wrapper/blob/main/LICENSE) [![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)

### 📖 [**Complete Documentation**](https://mcp-plugins.github.io/mcp-proxy-wrapper) • 🚀 [**Quick Start**](https://mcp-plugins.github.io/mcp-proxy-wrapper/getting-started) • 🔌 [**Plugins**](https://mcp-plugins.github.io/mcp-proxy-wrapper/plugins) • 🏗️ [**Examples**](https://mcp-plugins.github.io/mcp-proxy-wrapper/examples)

</div>

A zero-modification wrapper that adds authentication, AI summarization, monitoring, and custom logic to existing MCP servers. Works with any MCP server instantly.

## 🚀 Quick Start

```bash
npm install mcp-proxy-wrapper
```

```typescript
import { wrapWithProxy, LLMSummarizationPlugin } from 'mcp-proxy-wrapper';

// Your existing server - no changes needed
const server = new McpServer({ name: 'My Server', version: '1.0.0' });
server.tool('getData', schema, getData);

// Add enterprise features instantly
const plugin = new LLMSummarizationPlugin();
plugin.updateConfig({
  options: {
    provider: 'openai',
    openaiApiKey: process.env.OPENAI_API_KEY
  }
});

const enhanced = await wrapWithProxy(server, {
  plugins: [plugin],
  hooks: {
    beforeToolCall: async (context) => {
      console.log(`🔧 ${context.toolName}`);
      // Add auth, rate limiting, etc.
    }
  }
});
```

**Result**: Your server now has AI summarization, logging, and custom hooks without any code changes.

## ✨ Key Features

- **🔧 Zero Code Changes** - Wrap existing servers instantly
- **🤖 AI Integration** - OpenAI-powered response summarization  
- **🪝 Hook System** - beforeToolCall/afterToolCall with full control
- **🔌 Plugin Architecture** - Reusable, composable functionality
- **🌐 Remote Servers** - Proxy external MCP servers over HTTP/WebSocket
- **🛡️ Enterprise Ready** - Auth, rate limiting, caching patterns
- **📊 Production Tested** - 273 tests with real MCP protocol validation

## 📖 Examples

### Authentication & Rate Limiting
```typescript
const secure = await wrapWithProxy(server, {
  hooks: {
    beforeToolCall: async (context) => {
      if (!await validateApiKey(context.args.apiKey)) {
        return { result: { content: [{ type: 'text', text: 'Unauthorized' }], isError: true }};
      }
    }
  }
});
```

### AI-Powered Summarization
```typescript
const plugin = new LLMSummarizationPlugin();
plugin.updateConfig({
  options: {
    provider: 'openai',
    openaiApiKey: process.env.OPENAI_API_KEY,
    summarizeTools: ['research', 'analyze']
  }
});

const intelligent = await wrapWithProxy(server, {
  plugins: [plugin]
});
```

### Remote Server Proxy
```typescript
// Proxy external servers and add features
const plugin = new LLMSummarizationPlugin();
plugin.updateConfig({
  options: {
    provider: 'openai',
    openaiApiKey: process.env.OPENAI_API_KEY
  }
});

const proxy = await createHttpServerProxy('https://api.example.com/mcp', {
  plugins: [plugin],
  hooks: { /* your custom logic */ }
});
```

## 🧪 Proven & Tested

- **273 passing tests** with real MCP client-server communication
- **Production-ready** with comprehensive error handling
- **TypeScript native** with full type safety
- **MCP SDK v1.6.0+** compatible

## 📚 Documentation

**[📖 Complete Documentation →](https://mcp-plugins.github.io/mcp-proxy-wrapper)**

- **[🚀 Getting Started](https://mcp-plugins.github.io/mcp-proxy-wrapper/getting-started)** - 5-minute setup guide
- **[🔧 How It Works](https://mcp-plugins.github.io/mcp-proxy-wrapper/how-it-works)** - Understanding the proxy
- **[🔌 Plugin System](https://mcp-plugins.github.io/mcp-proxy-wrapper/plugins)** - Build and use plugins  
- **[📚 API Reference](https://mcp-plugins.github.io/mcp-proxy-wrapper/api-reference)** - Complete API docs
- **[🏗️ Examples](https://mcp-plugins.github.io/mcp-proxy-wrapper/examples)** - Real-world examples
- **[🚀 Deployment](https://mcp-plugins.github.io/mcp-proxy-wrapper/deployment)** - Production guide

## 🤝 Contributing

Contributions welcome! See [Contributing Guide](./CONTRIBUTING.md) for details.

```bash
git clone https://github.com/mcp-plugins/mcp-proxy-wrapper.git
cd mcp-proxy-wrapper && npm install && npm test
```

## 📄 License

MIT License - see [LICENSE](./LICENSE) file for details.

---

<div align="center">
  <strong>Built for the MCP ecosystem</strong> • <a href="mailto:dennison@dennisonbertram.com">Dennison Bertram</a>
</div>