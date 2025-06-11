**MCP Proxy Wrapper API Reference v1.0.0**

***

# MCP Proxy Wrapper

A proxy wrapper for Model Context Protocol (MCP) servers that provides a comprehensive hook system for intercepting, monitoring, and modifying tool calls.

## Installation

```bash
npm install mcp-proxy-wrapper
```

## Features

1. **Zero-Modification Wrapping:**  
   - ✅ Accepts an instance of an existing MCP server without code changes.
   - ✅ Uses transparent proxy wrapping to intercept method calls.
  
2. **Powerful Hook System:**  
   - ✅ beforeToolCall hooks for pre-processing and validation.
   - ✅ afterToolCall hooks for post-processing and result modification.
   - ✅ Short-circuit capability to skip tool execution.

3. **Plugin Architecture:**  
   - ✅ Extensible plugin system for advanced functionality.
   - ✅ Plugin lifecycle management with initialization and cleanup.
   - ✅ Dependency resolution and execution ordering.

4. **Argument & Result Modification:**  
   - ✅ Dynamic modification of tool arguments before execution.
   - ✅ Result transformation and enhancement after execution.
   - ✅ Context preservation throughout the call chain.

5. **Comprehensive Logging:**  
   - ✅ Built-in debug and info logging with configurable levels.
   - ✅ Request correlation and timing information.
   - ✅ Plugin-specific logging with namespacing.
  
6. **Error Handling:**  
   - ✅ Graceful error handling and recovery.
   - ✅ Plugin error isolation to prevent system failures.
   - ✅ Detailed error context and reporting.
  
7. **Full Type Safety:**  
   - ✅ Complete TypeScript support with generic types.
   - ✅ Interface definitions for all hooks and plugins.
   - ✅ Runtime type validation and safety checks.

Legend:
- ✅ Fully implemented and tested

## System Architecture

The MCP Proxy Wrapper uses a proxy-based architecture to intercept calls to the MCP server and add hook/plugin functionality without modifying the original server code.

```
┌─────────────────┐     ┌───────────────────────────────────────────────────────────────────┐
│                 │     │                                                                   │
│                 │     │                         Wrapped MCP Server                        │
│                 │     │                                                                   │
│     Client      │     │  ┌─────────────────────────────────────────────────────────────┐  │
│     (LLM)       │─────┼─▶│                    JavaScript Proxy                         │  │
│                 │     │  │                                                             │  │
│                 │     │  │  ┌───────────────┐  ┌─────────────────┐  ┌───────────────┐  │  │
└─────────────────┘     │  │  │               │  │                 │  │               │  │  │
                        │  │  │ Before Hooks  │──│ Original Method │──│ After Hooks   │  │  │
                        │  │  │               │  │   Execution     │  │               │  │  │
                        │  │  └───────────────┘  └─────────────────┘  └───────────────┘  │  │
                        │  │                                                             │  │
                        │  │  ┌─────────────────────────────────────────────────────────┐  │  │
                        │  │  │                   Plugin System                         │  │  │
                        │  │  │                                                         │  │  │
                        │  │  │  Plugin A │ Plugin B │ Plugin C │ Plugin Manager       │  │  │
                        │  │  └─────────────────────────────────────────────────────────┘  │  │
                        │  └─────────────────────────────────────────────────────────────┘  │
                        │                                                                   │
                        │  ┌─────────────────────────────────────────────────────────────┐  │
                        │  │                    Original MCP Server                      │  │
                        │  │                                                             │  │
                        │  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │  │
                        │  │  │    Tools    │  │   Prompts   │  │      Resources      │  │  │
                        │  │  └─────────────┘  └─────────────┘  └─────────────────────┘  │  │
                        │  └─────────────────────────────────────────────────────────────┘  │
                        └───────────────────────────────────────────────────────────────────┘
```

## Quick Start

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { wrapWithProxy } from 'mcp-proxy-wrapper';
import { z } from 'zod';

// Create your MCP server instance
const server = new McpServer({ 
  name: "My MCP Server",
  version: "1.0.0",
  description: "MCP server with proxy functionality"
});

// Register tools on the server
server.tool("example_tool", { 
  param: z.string() 
}, async (args, extra) => {
  return {
    content: [{ 
      type: "text" as const, 
      text: `Processed: ${args.param}` 
    }]
  };
});

// Wrap the server with proxy functionality
const proxiedServer = wrapWithProxy(server, {
  hooks: {
    beforeToolCall: async (context) => {
      console.log(`Calling tool: ${context.toolName}`);
    },
    afterToolCall: async (context, result) => {
      console.log(`Tool completed: ${context.toolName}`);
      return result;
    }
  },
  debug: true
});

// Use the wrapped server as you would a normal MCP server
// All calls will now go through the hook system

// Connect to a transport
const transport = new StdioServerTransport();
await proxiedServer.connect(transport);
```

## Hook System

The proxy wrapper provides two main hooks:

### beforeToolCall Hook

Executed before the original tool function. Can:
- Modify arguments
- Add metadata
- Short-circuit execution by returning a result
- Perform validation, authentication, logging

```typescript
const proxiedServer = wrapWithProxy(server, {
  hooks: {
    beforeToolCall: async (context) => {
      // Add timestamp to all tool calls
      context.args.timestamp = new Date().toISOString();
      
      // Block certain tools
      if (context.toolName === 'restricted' && !context.args.adminKey) {
        return {
          result: {
            content: [{ type: 'text', text: 'Access denied' }],
            isError: true
          }
        };
      }
    }
  }
});
```

### afterToolCall Hook

Executed after the original tool function. Can:
- Modify the result
- Add metadata
- Perform post-processing, caching, analytics

```typescript
const proxiedServer = wrapWithProxy(server, {
  hooks: {
    afterToolCall: async (context, result) => {
      // Add metadata to all responses
      if (result.result.content) {
        result.result._meta = {
          toolName: context.toolName,
          processedAt: new Date().toISOString()
        };
      }
      return result;
    }
  }
});
```

## Plugin System

The proxy wrapper supports an extensible plugin architecture:

```typescript
import { ChatMemoryPlugin } from 'mcp-proxy-wrapper/examples/plugins';

const chatMemoryPlugin = new ChatMemoryPlugin();

const proxiedServer = wrapWithProxy(server, {
  plugins: [chatMemoryPlugin],
  pluginConfig: {
    enableHealthChecks: true,
    defaultTimeout: 30000
  }
});
```

## Development Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Build the project:
   ```bash
   npm run build
   ```

3. Run tests:
   ```bash
   npm test
   ```

## Testing Framework

The proxy wrapper includes comprehensive testing with real MCP client-server communication:

- **45 comprehensive tests** covering all functionality
- **Real MCP client-server communication** using InMemoryTransport  
- **Edge cases** including concurrency, large data, Unicode handling
- **Protocol compliance** validation
- **Error scenarios** and stress testing
- **Both TypeScript and JavaScript** compatibility

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request to [GitHub repository](https://github.com/crazyrabbitltc/mcp-proxy-wrapper).

## License

MIT