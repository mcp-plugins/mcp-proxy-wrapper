# MCP Proxy Wrapper Development Guide

This document provides comprehensive guidance for developers working with the MCP Proxy Wrapper system, including setup, testing, tool development, and best practices.

## Table of Contents

1. [Getting Started](#getting-started)
2. [MCP Server Setup](#mcp-server-setup)
3. [Tool Development](#tool-development)
4. [Plugin Development](#plugin-development)
5. [Testing Guidelines](#testing-guidelines)
6. [Debugging and Troubleshooting](#debugging-and-troubleshooting)
7. [Performance Considerations](#performance-considerations)
8. [Deployment and Updates](#deployment-and-updates)
9. [Best Practices](#best-practices)

## Getting Started

### Prerequisites

- Node.js 18+ (LTS recommended)
- TypeScript 5.0+
- Git

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/mcp-proxy-wrapper.git
cd mcp-proxy-wrapper

# Install dependencies
npm install

# Build the project
npm run build

# Run tests to verify setup
npm test
```

### Project Structure

```
src/
├── proxy-wrapper.ts          # Core proxy wrapper functionality
├── interfaces/
│   ├── proxy-hooks.ts        # Hook and configuration interfaces
│   └── plugin.js             # Plugin system interfaces
├── utils/
│   ├── logger.ts            # Logging utility
│   └── plugin-manager.ts    # Plugin management system
├── test-utils/
│   └── mcp-client-server-test.ts  # Testing utilities
└── __tests__/               # Test files
```

## MCP Server Setup

### Correct MCP SDK Version

**IMPORTANT**: Always use the exact MCP SDK version specified in package.json:

```json
{
  "peerDependencies": {
    "@modelcontextprotocol/sdk": "^0.4.0"
  }
}
```

### Basic Server Setup

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { wrapWithProxy } from 'mcp-proxy-wrapper';

// Create base MCP server
const server = new McpServer({
  name: 'My MCP Server',
  version: '1.0.0'
});

// Wrap with proxy functionality
const proxiedServer = await wrapWithProxy(server, {
  debug: process.env.NODE_ENV === 'development',
  hooks: {
    beforeToolCall: async (context) => {
      console.log(`Tool called: ${context.toolName}`);
      // Optional: modify args or short-circuit
      return undefined; // Continue to tool
    },
    afterToolCall: async (context, result) => {
      console.log(`Tool completed: ${context.toolName}`);
      return result; // Return potentially modified result
    }
  }
});

// Connect to transport (stdio, websocket, etc.)
await proxiedServer.connect(transport);
```

### Server Configuration Options

```typescript
interface ProxyWrapperOptions {
  hooks?: {
    beforeToolCall?: (context: ToolCallContext) => Promise<void | ToolCallResult>;
    afterToolCall?: (context: ToolCallContext, result: ToolCallResult) => Promise<ToolCallResult>;
  };
  plugins?: Array<ProxyPlugin | PluginRegistration>;
  pluginConfig?: {
    enabled?: boolean;
    defaultTimeout?: number;
    maxPlugins?: number;
    enableHealthChecks?: boolean;
  };
  metadata?: Record<string, any>;
  debug?: boolean;
}
```

## Tool Development

### Registering Tools

**Correct Pattern** (3-argument version with schema):

```typescript
import { z } from 'zod';

// Define schema for arguments
const mathSchema = {
  operation: z.enum(['add', 'subtract', 'multiply', 'divide']),
  a: z.number(),
  b: z.number()
};

// Register tool with schema and handler
proxiedServer.tool('math', mathSchema, async (args) => {
  const { operation, a, b } = args;
  
  let result: number;
  switch (operation) {
    case 'add': result = a + b; break;
    case 'subtract': result = a - b; break;
    case 'multiply': result = a * b; break;
    case 'divide': result = a / b; break;
  }
  
  return {
    content: [{
      type: 'text',
      text: `${a} ${operation} ${b} = ${result}`
    }]
  };
});
```

**Legacy Pattern** (2-argument version):

```typescript
// For simple tools without complex schemas
proxiedServer.tool('hello', async (args) => {
  return {
    content: [{
      type: 'text',
      text: `Hello, ${args.name || 'World'}!`
    }]
  };
});
```

### Tool Response Format

MCP tools must return responses in this format:

```typescript
interface ToolResponse {
  content: Array<{
    type: 'text' | 'image' | 'resource';
    text?: string;        // For text content
    data?: string;        // For image/binary data (base64)
    mimeType?: string;    // For non-text content
  }>;
  isError?: boolean;      // Set to true for error responses
  _meta?: any;           // Optional metadata
}
```

### Error Handling in Tools

```typescript
proxiedServer.tool('risky-operation', riskSchema, async (args) => {
  try {
    const result = await performRiskyOperation(args);
    return {
      content: [{ type: 'text', text: result }]
    };
  } catch (error) {
    // Return error in MCP format
    return {
      isError: true,
      content: [{
        type: 'text',
        text: `Operation failed: ${error.message}`
      }]
    };
  }
});
```

## Plugin Development

### Creating a Plugin

```typescript
import { BasePlugin, ToolCallContext, ToolCallResult } from 'mcp-proxy-wrapper';

export class AuthPlugin extends BasePlugin {
  name = 'auth-plugin';
  version = '1.0.0';
  
  private apiKey: string;
  
  constructor(apiKey: string) {
    super();
    this.apiKey = apiKey;
    this.config = {
      priority: 100,  // Higher priority = executes first
      includeTools: ['secure-operation'] // Only run on specific tools
    };
  }
  
  async initialize(context: PluginInitContext): Promise<void> {
    await super.initialize(context);
    context.logger.info('Auth plugin initialized');
  }
  
  async beforeToolCall(context: ToolCallContext): Promise<void | ToolCallResult> {
    // Add authentication
    if (!context.args.apiKey) {
      context.args.apiKey = this.apiKey;
    }
    
    // Validate permissions
    if (!this.hasPermission(context.toolName)) {
      return {
        result: {
          isError: true,
          content: [{ type: 'text', text: 'Access denied' }]
        }
      };
    }
    
    // Continue to tool execution
    return undefined;
  }
  
  async afterToolCall(context: ToolCallContext, result: ToolCallResult): Promise<ToolCallResult> {
    // Log the operation
    this.logOperation(context.toolName, result);
    return result;
  }
  
  private hasPermission(toolName: string): boolean {
    // Implement permission logic
    return true;
  }
  
  private logOperation(toolName: string, result: ToolCallResult): void {
    // Implement logging
  }
}
```

### Plugin Registration

```typescript
const authPlugin = new AuthPlugin(process.env.API_KEY!);

const proxiedServer = await wrapWithProxy(server, {
  plugins: [
    // Simple registration
    authPlugin,
    
    // Registration with custom config
    {
      plugin: new CachePlugin(),
      config: {
        enabled: true,
        priority: 50,
        excludeTools: ['no-cache-tool']
      }
    }
  ],
  pluginConfig: {
    defaultTimeout: 5000,
    maxPlugins: 10,
    enableHealthChecks: true
  }
});
```

## Testing Guidelines

### Unit Testing with Jest

```typescript
import { wrapWithProxy } from '../proxy-wrapper.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

describe('My Tool', () => {
  let server: McpServer;
  let proxiedServer: McpServer;
  
  beforeEach(async () => {
    server = new McpServer({ name: 'Test Server', version: '1.0.0' });
    proxiedServer = await wrapWithProxy(server);
  });
  
  test('should handle math operations', async () => {
    // Register tool
    proxiedServer.tool('math', mathSchema, mathHandler);
    
    // Test directly (unit test)
    const result = await mathHandler({ operation: 'add', a: 2, b: 3 });
    
    expect(result.content[0].text).toContain('5');
  });
});
```

### Integration Testing with Real MCP

```typescript
import { createTestEnvironment } from '../test-utils/mcp-client-server-test.js';

describe('Integration Tests', () => {
  let testEnv: McpClientServerTest;
  
  beforeEach(async () => {
    testEnv = createTestEnvironment({
      proxyOptions: {
        plugins: [new MyPlugin()],
        debug: true
      }
    });
  });
  
  afterEach(async () => {
    await testEnv.disconnect();
  });
  
  test('should work through real MCP protocol', async () => {
    // Register tool
    await testEnv.registerTool('math', mathHandler);
    
    // Call through MCP client
    const result = await testEnv.callTool('math', {
      operation: 'add',
      a: 2,
      b: 3
    });
    
    expect(result.content[0].text).toContain('5');
  });
});
```

### Plugin Testing

```typescript
describe('Auth Plugin', () => {
  let manager: DefaultPluginManager;
  let authPlugin: AuthPlugin;
  
  beforeEach(async () => {
    manager = new DefaultPluginManager('1.0.0', {});
    authPlugin = new AuthPlugin('test-key');
    await manager.register(authPlugin);
    await manager.initializeAll();
  });
  
  test('should add API key to requests', async () => {
    const context: ToolCallContext = {
      toolName: 'secure-operation',
      args: { data: 'test' }
    };
    
    await manager.executeBeforeHooks(context);
    
    expect(context.args.apiKey).toBe('test-key');
  });
});
```

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- src/__tests__/my-feature.test.ts

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

## Debugging and Troubleshooting

### Enable Debug Logging

```typescript
const proxiedServer = await wrapWithProxy(server, {
  debug: true,  // Enables detailed logging
  hooks: {
    beforeToolCall: async (context) => {
      console.log('Hook context:', context);
      return undefined;
    }
  }
});
```

### Common Issues

#### 1. Plugin Hooks Not Executing

**Problem**: Plugin beforeToolCall/afterToolCall hooks are not being called.

**Solution**: Ensure plugin is properly registered and enabled:

```typescript
// Check plugin registration
const plugin = manager.getPlugin('my-plugin');
console.log('Plugin registered:', !!plugin);

// Check plugin execution order
const executionOrder = manager.getExecutionOrder();
console.log('Execution order:', executionOrder.map(p => p.name));
```

#### 2. Double Proxy Wrapping

**Problem**: Error about server already being wrapped.

**Solution**: Check for existing wrapper before applying:

```typescript
if (!(server as any)._isProxyWrapped) {
  proxiedServer = await wrapWithProxy(server, options);
} else {
  proxiedServer = server;
}
```

#### 3. Tool Arguments Not Modified

**Problem**: Modified arguments in hooks don't reach the tool handler.

**Solution**: Ensure you're modifying `context.args` directly:

```typescript
async beforeToolCall(context: ToolCallContext): Promise<void> {
  // Correct: modify context.args in place
  context.args.timestamp = Date.now();
  
  // Incorrect: creating new object doesn't work
  // context.args = { ...context.args, timestamp: Date.now() };
}
```

### Health Checks

```typescript
// Check plugin health
const healthStatus = await manager.healthCheck();
for (const [pluginName, isHealthy] of healthStatus) {
  console.log(`${pluginName}: ${isHealthy ? 'healthy' : 'unhealthy'}`);
}

// Get plugin statistics
const stats = await manager.getAggregatedStats();
console.log('Plugin stats:', stats);
```

## Performance Considerations

### Plugin Timeouts

```typescript
const proxiedServer = await wrapWithProxy(server, {
  pluginConfig: {
    defaultTimeout: 5000,  // 5 second timeout for plugin operations
  }
});
```

### Tool Filtering

```typescript
// Only run expensive plugins on specific tools
const expensivePlugin = new AnalyticsPlugin();
await manager.register(expensivePlugin, {
  includeTools: ['analyze-data', 'generate-report'],
  excludeTools: ['simple-math']
});
```

### Async Operations

```typescript
// Prefer Promise.all for parallel operations
async beforeToolCall(context: ToolCallContext): Promise<void> {
  await Promise.all([
    this.validateRequest(context),
    this.logRequest(context),
    this.updateMetrics(context)
  ]);
}
```

## Deployment and Updates

### Environment Configuration

```typescript
const proxiedServer = await wrapWithProxy(server, {
  debug: process.env.NODE_ENV === 'development',
  pluginConfig: {
    defaultTimeout: parseInt(process.env.PLUGIN_TIMEOUT || '10000'),
    maxPlugins: parseInt(process.env.MAX_PLUGINS || '50'),
    enableHealthChecks: process.env.ENABLE_HEALTH_CHECKS === 'true'
  }
});
```

### Version Management

Always pin your dependencies:

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "0.4.0",
    "mcp-proxy-wrapper": "1.0.0"
  }
}
```

### Update Process

1. **Test new versions thoroughly**:
   ```bash
   npm test
   npm run test:integration
   ```

2. **Check for breaking changes** in changelog

3. **Update gradually**:
   ```bash
   # Update patch versions first
   npm update --depth 0
   
   # Then update minor versions
   npm install @modelcontextprotocol/sdk@^0.5.0
   ```

4. **Run full test suite**:
   ```bash
   npm run test:all
   npm run lint
   npm run build
   ```

## Best Practices

### Code Organization

```typescript
// Keep plugins focused and single-purpose
class LoggingPlugin extends BasePlugin {
  name = 'logging-plugin';
  // Only handle logging concerns
}

class AuthPlugin extends BasePlugin {
  name = 'auth-plugin';
  // Only handle authentication concerns
}
```

### Error Handling

```typescript
// Always handle plugin errors gracefully
async beforeToolCall(context: ToolCallContext): Promise<void | ToolCallResult> {
  try {
    await this.doSomething(context);
  } catch (error) {
    // Log error but don't fail the entire request
    context.logger?.error('Plugin error:', error);
    return undefined; // Continue to tool execution
  }
}
```

### Resource Management

```typescript
class DatabasePlugin extends BasePlugin {
  private connection?: DatabaseConnection;
  
  async initialize(context: PluginInitContext): Promise<void> {
    this.connection = await createConnection();
  }
  
  async destroy(): Promise<void> {
    if (this.connection) {
      await this.connection.close();
    }
  }
}
```

### Security

```typescript
// Validate and sanitize inputs
async beforeToolCall(context: ToolCallContext): Promise<void> {
  // Sanitize string inputs
  if (typeof context.args.userInput === 'string') {
    context.args.userInput = sanitizeInput(context.args.userInput);
  }
  
  // Validate against schema
  const result = mySchema.safeParse(context.args);
  if (!result.success) {
    throw new Error('Invalid arguments');
  }
}
```

### Documentation

```typescript
/**
 * Cache Plugin - Caches tool responses for performance
 * 
 * Configuration:
 * - ttl: Cache time-to-live in milliseconds (default: 300000 = 5 minutes)
 * - maxSize: Maximum cache entries (default: 1000)
 * 
 * Example:
 * ```typescript
 * const cachePlugin = new CachePlugin({ ttl: 60000, maxSize: 500 });
 * ```
 */
export class CachePlugin extends BasePlugin {
  // Implementation...
}
```

---

## Additional Resources

- [MCP SDK Documentation](https://github.com/modelcontextprotocol/typescript-sdk)
- [TypeScript Best Practices](https://typescript-eslint.io/rules/)
- [Jest Testing Framework](https://jestjs.io/docs/getting-started)
- [Zod Schema Validation](https://zod.dev/)

## Contributing

When contributing to this project:

1. **Write tests first** - Use TDD approach
2. **Follow TypeScript strict mode** - No `any` types without justification
3. **Update documentation** - Keep this guide current
4. **Run full test suite** - All 204 tests must pass
5. **Use conventional commits** - Follow semantic commit messages

For questions or issues, please check the [GitHub Issues](https://github.com/your-org/mcp-proxy-wrapper/issues) or create a new one.