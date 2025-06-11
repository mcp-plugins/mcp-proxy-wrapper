# MCP Proxy Wrapper Plugin System Specification

## Overview

The MCP Proxy Wrapper Plugin System is a comprehensive middleware architecture that allows developers to intercept, modify, and enhance Model Context Protocol (MCP) tool calls through a flexible plugin ecosystem. The system enables powerful capabilities like authentication, rate limiting, caching, payment processing, logging, and custom business logic without modifying the core MCP server implementation.

## Core Capabilities

### 🎯 **Tool Call Interception**
The plugin system can intercept MCP tool calls at multiple points in the execution lifecycle:

- **Pre-execution**: Modify arguments, validate inputs, enforce policies
- **Post-execution**: Transform results, add metadata, perform cleanup
- **Short-circuiting**: Completely bypass tool execution with custom responses
- **Error handling**: Custom error processing and recovery

### 🔄 **Request/Response Transformation**
Plugins can modify tool calls in real-time:

```typescript
// Before tool call - modify arguments
async beforeToolCall(context: PluginContext): Promise<void | ToolCallResult> {
  // Add authentication headers
  context.args.apiKey = await this.getApiKey();
  
  // Validate required parameters
  if (!context.args.userId) {
    return { result: { content: [{ type: 'text', text: 'User ID required' }], isError: true } };
  }
  
  // Transform arguments
  context.args.timestamp = new Date().toISOString();
}

// After tool call - modify results
async afterToolCall(context: PluginContext, result: ToolCallResult): Promise<ToolCallResult> {
  // Add metadata
  result.result._metadata = {
    processedAt: new Date().toISOString(),
    version: this.version
  };
  
  // Transform response format
  if (context.toolName === 'calculate') {
    result.result.formatted = `Result: ${result.result.content[0].text}`;
  }
  
  return result;
}
```

## Plugin Architecture

### **Plugin Interface**
Every plugin implements the `ProxyPlugin` interface:

```typescript
interface ProxyPlugin {
  // Required properties
  readonly name: string;
  readonly version: string;
  readonly metadata?: PluginMetadata;
  config?: PluginConfig;
  
  // Lifecycle hooks (all optional)
  initialize?(context: PluginInitContext): Promise<void>;
  beforeToolCall?(context: PluginContext): Promise<void | ToolCallResult>;
  afterToolCall?(context: PluginContext, result: ToolCallResult): Promise<ToolCallResult>;
  onError?(error: PluginError): Promise<void | ToolCallResult>;
  destroy?(): Promise<void>;
  healthCheck?(): Promise<boolean>;
  getStats?(): Promise<PluginStats>;
}
```

### **Plugin Context**
Rich context object available to all plugin hooks:

```typescript
interface PluginContext extends ToolCallContext {
  pluginData: Map<string, any>;      // Persistent plugin data
  requestId: string;                 // Unique request identifier
  startTime: number;                 // Request start timestamp
  previousResults?: Map<string, any>; // Results from previous plugins
  
  // From ToolCallContext
  toolName: string;                  // Name of the tool being called
  args: Record<string, any>;         // Tool arguments (mutable)
  metadata?: Record<string, any>;    // Request metadata
}
```

## Real-World Use Cases

### 🔐 **Authentication & Authorization**
```typescript
class AuthPlugin extends BasePlugin {
  async beforeToolCall(context: PluginContext): Promise<void | ToolCallResult> {
    // Require API key for sensitive operations
    if (this.isSensitiveTool(context.toolName)) {
      if (!context.args.apiKey || !await this.validateApiKey(context.args.apiKey)) {
        return {
          result: {
            content: [{ type: 'text', text: 'Authentication required' }],
            isError: true
          }
        };
      }
    }
    
    // Remove API key from args (security)
    delete context.args.apiKey;
  }
}
```

### 🚦 **Rate Limiting**
```typescript
class RateLimitPlugin extends BasePlugin {
  private limits = new Map<string, { count: number; resetTime: number }>();
  
  async beforeToolCall(context: PluginContext): Promise<void | ToolCallResult> {
    const userId = context.args.userId || 'anonymous';
    const limit = this.limits.get(userId) || { count: 0, resetTime: Date.now() + 60000 };
    
    if (Date.now() > limit.resetTime) {
      limit.count = 0;
      limit.resetTime = Date.now() + 60000;
    }
    
    if (limit.count >= 10) {
      return {
        result: {
          content: [{ type: 'text', text: 'Rate limit exceeded' }],
          isError: true
        }
      };
    }
    
    limit.count++;
    this.limits.set(userId, limit);
  }
}
```

### 💰 **Payment Processing**
```typescript
class StripePaymentPlugin extends BasePlugin {
  async beforeToolCall(context: PluginContext): Promise<void | ToolCallResult> {
    // Check if tool requires payment
    const cost = this.getToolCost(context.toolName);
    if (cost > 0) {
      // Validate payment method
      if (!context.args.paymentMethodId) {
        return {
          result: {
            content: [{ type: 'text', text: 'Payment method required' }],
            isError: true
          }
        };
      }
      
      // Process payment
      try {
        const charge = await this.stripe.charges.create({
          amount: cost * 100, // cents
          currency: 'usd',
          source: context.args.paymentMethodId
        });
        
        context.pluginData.set('chargeId', charge.id);
        delete context.args.paymentMethodId; // Remove sensitive data
      } catch (error) {
        return {
          result: {
            content: [{ type: 'text', text: 'Payment failed' }],
            isError: true
          }
        };
      }
    }
  }
}
```

### 🗄️ **Caching**
```typescript
class CachePlugin extends BasePlugin {
  private cache = new Map<string, { result: any; timestamp: number }>();
  
  async beforeToolCall(context: PluginContext): Promise<void | ToolCallResult> {
    // Only cache deterministic tools
    if (this.isDeterministic(context.toolName)) {
      const cacheKey = `${context.toolName}:${JSON.stringify(context.args)}`;
      const cached = this.cache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < 300000) { // 5 min TTL
        return {
          result: {
            ...cached.result,
            _cached: true
          }
        };
      }
    }
  }
  
  async afterToolCall(context: PluginContext, result: ToolCallResult): Promise<ToolCallResult> {
    if (this.isDeterministic(context.toolName) && !result.result.isError) {
      const cacheKey = `${context.toolName}:${JSON.stringify(context.args)}`;
      this.cache.set(cacheKey, {
        result: result.result,
        timestamp: Date.now()
      });
    }
    return result;
  }
}
```

### 📊 **Logging & Analytics**
```typescript
class AnalyticsPlugin extends BasePlugin {
  async beforeToolCall(context: PluginContext): Promise<void> {
    context.pluginData.set('startTime', Date.now());
    
    await this.analytics.track('tool_call_started', {
      toolName: context.toolName,
      userId: context.args.userId,
      timestamp: new Date().toISOString()
    });
  }
  
  async afterToolCall(context: PluginContext, result: ToolCallResult): Promise<ToolCallResult> {
    const startTime = context.pluginData.get('startTime');
    const duration = Date.now() - startTime;
    
    await this.analytics.track('tool_call_completed', {
      toolName: context.toolName,
      duration,
      success: !result.result.isError,
      userId: context.args.userId
    });
    
    return result;
  }
}
```

## Plugin Management Features

### **Dependency Resolution**
Plugins can declare dependencies on other plugins:

```typescript
class PaymentPlugin extends BasePlugin {
  metadata = {
    dependencies: ['auth-plugin'], // Must load after auth
    description: 'Handles payment processing'
  };
}
```

### **Priority-based Execution**
Control plugin execution order with priorities:

```typescript
const plugins = [
  { plugin: authPlugin, config: { priority: 100 } },    // Runs first
  { plugin: rateLimitPlugin, config: { priority: 50 } }, // Runs second
  { plugin: loggingPlugin, config: { priority: 10 } }    // Runs last
];
```

### **Tool Filtering**
Target specific tools with include/exclude patterns:

```typescript
const paymentPlugin = new PaymentPlugin();
paymentPlugin.config = {
  includeTools: ['premium-search', 'advanced-analysis'], // Only these tools
  excludeTools: ['free-tool'] // Never these tools
};
```

### **Health Monitoring**
Built-in health checks and monitoring:

```typescript
class MyPlugin extends BasePlugin {
  async healthCheck(): Promise<boolean> {
    // Check external service connectivity
    try {
      await this.externalService.ping();
      return true;
    } catch {
      return false;
    }
  }
  
  async getStats(): Promise<PluginStats> {
    return {
      callsProcessed: this.callCount,
      errorsEncountered: this.errorCount,
      averageProcessingTime: this.avgTime,
      lastActivity: this.lastCall,
      customMetrics: {
        cacheHitRate: this.cacheHits / this.totalCalls,
        activeConnections: this.connectionPool.size
      }
    };
  }
}
```

## Integration & Usage

### **Basic Setup**
```typescript
import { wrapWithProxy } from 'mcp-proxy-wrapper';
import { AuthPlugin, RateLimitPlugin, LoggingPlugin } from './plugins';

const server = new McpServer({ name: 'My Server', version: '1.0.0' });

// Wrap with plugins
const proxiedServer = await wrapWithProxy(server, {
  plugins: [
    new AuthPlugin(),
    { plugin: new RateLimitPlugin(), config: { priority: 90 } },
    new LoggingPlugin()
  ],
  pluginConfig: {
    defaultTimeout: 5000,
    enableHealthChecks: true,
    maxPlugins: 20
  }
});

// Register tools normally
proxiedServer.tool('search', { query: z.string() }, async (args) => {
  return { content: [{ type: 'text', text: `Results for: ${args.query}` }] };
});
```

### **Advanced Configuration**
```typescript
const proxiedServer = await wrapWithProxy(server, {
  plugins: [
    {
      plugin: new PaymentPlugin(),
      config: {
        enabled: true,
        priority: 95,
        includeTools: ['premium-search'],
        options: {
          stripeApiKey: process.env.STRIPE_KEY,
          defaultCurrency: 'usd'
        }
      }
    }
  ],
  pluginConfig: {
    defaultTimeout: 10000,
    enableHealthChecks: true,
    healthCheckInterval: 30000
  }
});
```

## Plugin Lifecycle

1. **Registration**: Plugin registered with manager
2. **Validation**: Dependencies and configuration validated
3. **Initialization**: `initialize()` called with context
4. **Active Phase**: Hooks called for matching tool calls
5. **Health Monitoring**: Periodic health checks (if enabled)
6. **Destruction**: `destroy()` called during shutdown

## Error Handling

- **Graceful Degradation**: Failed plugins don't break tool calls
- **Error Recovery**: `onError()` hook for custom error handling
- **Health Tracking**: Unhealthy plugins automatically disabled
- **Timeout Protection**: Configurable timeouts prevent hanging

## Performance Considerations

- **Minimal Overhead**: Plugins only execute for relevant tools
- **Parallel Execution**: Non-conflicting plugins can run concurrently
- **Caching**: Built-in result caching capabilities
- **Statistics**: Performance monitoring and optimization insights

## Security Features

- **Sandboxed Execution**: Plugins isolated from each other
- **Input Validation**: Automatic argument sanitization
- **Secret Management**: Secure handling of API keys and tokens
- **Access Control**: Fine-grained permission system

This plugin system transforms the MCP Proxy Wrapper into a powerful, extensible platform for building sophisticated AI agent integrations with enterprise-grade features like authentication, billing, monitoring, and custom business logic.