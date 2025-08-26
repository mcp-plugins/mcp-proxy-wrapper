<div align="center">

# 🚀 MCP Proxy Wrapper

**Add hooks and plugins to any MCP server without changing your code**

[![NPM Version](https://img.shields.io/npm/v/mcp-proxy-wrapper?style=for-the-badge&logo=npm)](https://www.npmjs.com/package/mcp-proxy-wrapper) [![GitHub Stars](https://img.shields.io/github/stars/mcp-plugins/mcp-proxy-wrapper?style=for-the-badge&logo=github)](https://github.com/mcp-plugins/mcp-proxy-wrapper) [![License](https://img.shields.io/github/license/mcp-plugins/mcp-proxy-wrapper?style=for-the-badge)](https://github.com/mcp-plugins/mcp-proxy-wrapper/blob/main/LICENSE) [![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue?style=for-the-badge&logo=typescript)](https://www.typescriptlang.org/)

### 📖 [**Complete Documentation**](https://mcp-plugins.github.io/mcp-proxy-wrapper) • 🚀 [**Quick Start**](https://mcp-plugins.github.io/mcp-proxy-wrapper/getting-started) • 🔌 [**Plugins**](https://mcp-plugins.github.io/mcp-proxy-wrapper/plugins) • 🏗️ [**Examples**](https://mcp-plugins.github.io/mcp-proxy-wrapper/examples)

</div>

A proxy wrapper that adds hooks, plugins, and custom logic to existing MCP servers without modifying the original code.

## 🚀 Quick Start

### Installation

```bash
npm install mcp-proxy-wrapper
```

### For Claude Code & Claude Desktop

#### Option 1: Direct Server Configuration
Create a wrapped MCP server and configure it in Claude:

```typescript
// server.js
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { wrapWithProxy, LLMSummarizationPlugin } from 'mcp-proxy-wrapper';

const server = new McpServer({ name: 'Enhanced Server', version: '1.0.0' });

// Add your tools
server.tool('getData', schema, getData);

// Add proxy wrapper with plugins
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
    }
  }
});

// Start the server
enhanced.start(process.stdin, process.stdout);
```

Then add to Claude Code:

```bash
# Add to local project
claude mcp add enhanced-server node /path/to/server.js

# Add to all projects (user scope)  
claude mcp add enhanced-server --scope user node /path/to/server.js

# Add to team projects (project scope)
claude mcp add enhanced-server --scope project node /path/to/server.js
```

#### Option 2: Proxy Existing Servers
Enhance existing MCP servers without modification:

```typescript
// proxy-server.js
import { createStdioServerProxy, LLMSummarizationPlugin } from 'mcp-proxy-wrapper';

const plugin = new LLMSummarizationPlugin();
plugin.updateConfig({
  options: { openaiApiKey: process.env.OPENAI_API_KEY }
});

// Proxy an existing server and add features
const proxy = await createStdioServerProxy({
  command: 'npx',
  args: ['@modelcontextprotocol/server-filesystem', '/tmp'],
  plugins: [plugin],
  hooks: {
    beforeToolCall: async (context) => {
      // Add authentication, logging, etc.
      console.log(`Tool called: ${context.toolName}`);
    }
  }
});

proxy.start(process.stdin, process.stdout);
```

Configure in Claude Code:

```bash
claude mcp add filesystem-enhanced node /path/to/proxy-server.js
```

### Basic Usage

```typescript
import { wrapWithProxy, LLMSummarizationPlugin } from 'mcp-proxy-wrapper';

// Your existing server - no changes needed
const server = new McpServer({ name: 'My Server', version: '1.0.0' });
server.tool('getData', schema, getData);

// Add plugins and hooks
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
- **🛡️ Authentication & Security** - Auth, rate limiting, access control patterns
- **📊 Comprehensive Tests** - 273 tests covering MCP protocol compatibility

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

## 🧪 Technical Details

- **273 passing tests** with real MCP client-server communication
- **Comprehensive error handling** with fallbacks and proper error propagation
- **TypeScript native** with full type safety and IntelliSense
- **MCP SDK v1.6.0+** compatible with any existing server

## 📚 Documentation

**[📖 Complete Documentation →](https://mcp-plugins.github.io/mcp-proxy-wrapper)**

- **[🚀 Getting Started](https://mcp-plugins.github.io/mcp-proxy-wrapper/getting-started)** - Step-by-step setup guide
- **[🔧 How It Works](https://mcp-plugins.github.io/mcp-proxy-wrapper/how-it-works)** - Understanding the proxy
- **[🔌 Plugin System](https://mcp-plugins.github.io/mcp-proxy-wrapper/plugins)** - Build and use plugins  
- **[📚 API Reference](https://mcp-plugins.github.io/mcp-proxy-wrapper/api-reference)** - Complete API docs
- **[🏗️ Examples](https://mcp-plugins.github.io/mcp-proxy-wrapper/examples)** - Real-world examples
- **[🚀 Deployment](https://mcp-plugins.github.io/mcp-proxy-wrapper/deployment)** - Deployment guide

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