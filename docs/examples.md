---
layout: default
title: Examples
---

# MCP Proxy Wrapper Examples

This page provides practical examples of how to use the MCP Proxy Wrapper in different scenarios and use cases.

## 🚀 Basic Integration

The simplest way to add proxy functionality to your existing MCP server:

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { wrapWithProxy } from 'mcp-proxy-wrapper';
import { z } from 'zod';

// Your existing MCP server
const server = new McpServer({ 
  name: "My MCP Server",
  version: "1.0.0"
});

// Add your tools
server.tool("echo", { message: z.string() }, async (args) => {
  return {
    content: [{ type: 'text', text: `Echo: ${args.message}` }]
  };
});

// Wrap with proxy functionality
const proxiedServer = wrapWithProxy(server, {
  hooks: {
    beforeToolCall: async (context) => {
      console.log(`📞 Calling: ${context.toolName} with args:`, context.args);
    },
    afterToolCall: async (context, result) => {
      console.log(`✅ Completed: ${context.toolName}`);
      return result;
    }
  }
});

// Use exactly like your original server
```

## 🔐 Authentication & Authorization

Implement API key authentication and permission checking:

```typescript
import { wrapWithProxy } from 'mcp-proxy-wrapper';

const VALID_API_KEYS = new Set(['key-1', 'key-2', 'admin-key']);
const ADMIN_KEYS = new Set(['admin-key']);

const authProxy = wrapWithProxy(server, {
  hooks: {
    beforeToolCall: async (context) => {
      // Check for API key
      const apiKey = context.args.apiKey;
      if (!apiKey) {
        return {
          result: {
            content: [{ type: 'text', text: 'API key required' }],
            isError: true
          }
        };
      }

      // Validate API key
      if (!VALID_API_KEYS.has(apiKey)) {
        return {
          result: {
            content: [{ type: 'text', text: 'Invalid API key' }],
            isError: true
          }
        };
      }

      // Check admin permissions for sensitive tools
      if (context.toolName.startsWith('admin_') && !ADMIN_KEYS.has(apiKey)) {
        return {
          result: {
            content: [{ type: 'text', text: 'Admin access required' }],
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

## 📊 Rate Limiting & Quotas

Implement per-user rate limiting:

```typescript
import { wrapWithProxy } from 'mcp-proxy-wrapper';

// Simple in-memory rate limiter (use Redis in production)
const rateLimits = new Map();

const rateLimitedProxy = wrapWithProxy(server, {
  hooks: {
    beforeToolCall: async (context) => {
      const userId = context.args.userId || 'anonymous';
      const now = Date.now();
      const windowMs = 60 * 1000; // 1 minute window
      const maxRequests = 10; // Max 10 requests per minute

      // Get or create user's rate limit data
      if (!rateLimits.has(userId)) {
        rateLimits.set(userId, { count: 0, windowStart: now });
      }

      const userLimit = rateLimits.get(userId);

      // Reset window if expired
      if (now - userLimit.windowStart > windowMs) {
        userLimit.count = 0;
        userLimit.windowStart = now;
      }

      // Check if limit exceeded
      if (userLimit.count >= maxRequests) {
        const resetTime = new Date(userLimit.windowStart + windowMs);
        return {
          result: {
            content: [{
              type: 'text',
              text: `Rate limit exceeded. Try again after ${resetTime.toISOString()}`
            }],
            isError: true
          }
        };
      }

      // Increment counter
      userLimit.count++;
    }
  }
});
```

## 💾 Caching System

Implement intelligent response caching:

```typescript
import { wrapWithProxy } from 'mcp-proxy-wrapper';

// Simple cache (use Redis or similar in production)
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCacheKey(toolName, args) {
  // Create deterministic cache key
  const sortedArgs = Object.keys(args)
    .sort()
    .reduce((obj, key) => {
      obj[key] = args[key];
      return obj;
    }, {});
  return `${toolName}:${JSON.stringify(sortedArgs)}`;
}

const cachedProxy = wrapWithProxy(server, {
  hooks: {
    beforeToolCall: async (context) => {
      // Skip caching for non-cacheable tools
      if (context.toolName.includes('delete') || context.toolName.includes('modify')) {
        return;
      }

      const cacheKey = getCacheKey(context.toolName, context.args);
      const cached = cache.get(cacheKey);

      if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
        console.log(`🎯 Cache hit for ${context.toolName}`);
        return { result: cached.data };
      }

      // Store context for afterToolCall
      context.cacheKey = cacheKey;
    },
    afterToolCall: async (context, result) => {
      // Cache successful responses
      if (context.cacheKey && !result.result.isError) {
        cache.set(context.cacheKey, {
          data: result.result,
          timestamp: Date.now()
        });
        console.log(`💾 Cached result for ${context.toolName}`);
      }

      return result;
    }
  }
});
```

## 📈 Analytics & Monitoring

Comprehensive monitoring and metrics collection:

```typescript
import { wrapWithProxy } from 'mcp-proxy-wrapper';

// Mock analytics service (replace with your analytics provider)
class AnalyticsService {
  async track(event, properties) {
    console.log(`📊 Analytics: ${event}`, properties);
    // Send to your analytics service (Google Analytics, Mixpanel, etc.)
  }

  async increment(metric, tags = {}) {
    console.log(`📈 Metric: ${metric}`, tags);
    // Send to your metrics service (DataDog, New Relic, etc.)
  }
}

const analytics = new AnalyticsService();

const monitoredProxy = wrapWithProxy(server, {
  hooks: {
    beforeToolCall: async (context) => {
      // Start timing
      context.startTime = performance.now();
      context.requestId = Math.random().toString(36).substr(2, 9);

      // Track tool usage
      await analytics.track('tool_call_started', {
        tool: context.toolName,
        requestId: context.requestId,
        userId: context.args.userId,
        timestamp: Date.now()
      });

      // Increment counters
      await analytics.increment('tool_calls_total', {
        tool: context.toolName
      });
    },
    afterToolCall: async (context, result) => {
      const duration = performance.now() - context.startTime;
      const isError = result.result.isError;

      // Track completion
      await analytics.track('tool_call_completed', {
        tool: context.toolName,
        requestId: context.requestId,
        duration,
        success: !isError,
        timestamp: Date.now()
      });

      // Record metrics
      await analytics.increment('tool_call_duration', {
        tool: context.toolName,
        value: duration
      });

      await analytics.increment('tool_calls_status', {
        tool: context.toolName,
        status: isError ? 'error' : 'success'
      });

      // Add performance metadata to response
      if (result.result.content) {
        result.result._meta = {
          ...result.result._meta,
          requestId: context.requestId,
          duration: Math.round(duration * 100) / 100, // Round to 2 decimal places
          timestamp: new Date().toISOString()
        };
      }

      return result;
    }
  }
});
```

## 🛡️ Error Handling & Recovery

Robust error handling with fallback mechanisms:

```typescript
import { wrapWithProxy } from 'mcp-proxy-wrapper';

const resilientProxy = wrapWithProxy(server, {
  hooks: {
    beforeToolCall: async (context) => {
      // Input validation
      if (context.toolName === 'process_text' && !context.args.text) {
        return {
          result: {
            content: [{ type: 'text', text: 'Text parameter is required' }],
            isError: true
          }
        };
      }

      // Add timeout protection
      context.timeout = setTimeout(() => {
        console.warn(`⚠️ Tool ${context.toolName} is taking longer than expected`);
      }, 30000); // 30 second warning
    },
    afterToolCall: async (context, result) => {
      // Clear timeout
      if (context.timeout) {
        clearTimeout(context.timeout);
      }

      // Handle errors with graceful fallbacks
      if (result.result.isError) {
        console.error(`❌ Error in ${context.toolName}:`, result.result);

        // Attempt recovery for specific error types
        if (result.result.content[0]?.text?.includes('timeout')) {
          return {
            result: {
              content: [{
                type: 'text',
                text: 'The request timed out. Please try again with a smaller input or try again later.'
              }],
              isError: false
            }
          };
        }

        if (result.result.content[0]?.text?.includes('rate limit')) {
          return {
            result: {
              content: [{
                type: 'text',
                text: 'Service is currently busy. Please wait a moment and try again.'
              }],
              isError: false
            }
          };
        }

        // Log error for debugging but return user-friendly message
        console.error('Unhandled error:', result.result);
        return {
          result: {
            content: [{
              type: 'text',
              text: 'An error occurred while processing your request. Please try again or contact support if the problem persists.'
            }],
            isError: false
          }
        };
      }

      return result;
    }
  }
});
```

## 🧪 A/B Testing

Implement feature flags and A/B testing:

```typescript
import { wrapWithProxy } from 'mcp-proxy-wrapper';

// Mock feature flag service
class FeatureFlagService {
  constructor() {
    this.flags = {
      'new_algorithm': { enabled: true, rollout: 0.5 }, // 50% rollout
      'enhanced_responses': { enabled: true, rollout: 1.0 }, // 100% rollout
      'beta_features': { enabled: false, rollout: 0.0 }
    };
  }

  isEnabled(flagName, userId) {
    const flag = this.flags[flagName];
    if (!flag || !flag.enabled) return false;

    // Simple hash-based assignment for consistent user experience
    const hash = this.hashUserId(userId);
    return hash < flag.rollout;
  }

  hashUserId(userId) {
    let hash = 0;
    for (let i = 0; i < userId.length; i++) {
      const char = userId.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash) / 2147483647; // Normalize to 0-1
  }
}

const featureFlags = new FeatureFlagService();

const testingProxy = wrapWithProxy(server, {
  hooks: {
    beforeToolCall: async (context) => {
      const userId = context.args.userId || 'anonymous';

      // Feature: New Algorithm
      if (featureFlags.isEnabled('new_algorithm', userId)) {
        context.args.useNewAlgorithm = true;
        console.log(`🧪 User ${userId} is in new algorithm test group`);
      }

      // Feature: Enhanced Responses
      if (featureFlags.isEnabled('enhanced_responses', userId)) {
        context.enhancedResponses = true;
      }
    },
    afterToolCall: async (context, result) => {
      // Apply enhanced responses if enabled
      if (context.enhancedResponses && result.result.content) {
        result.result.content.forEach(item => {
          if (item.type === 'text') {
            item.text = `✨ ${item.text}`;
          }
        });

        result.result._meta = {
          ...result.result._meta,
          enhanced: true
        };
      }

      return result;
    }
  }
});
```

## 🔄 Complete Production Example

A comprehensive example combining multiple patterns:

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { wrapWithProxy } from 'mcp-proxy-wrapper';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

// Create your MCP server
const server = new McpServer({
  name: "Production AI Assistant",
  version: "1.0.0"
});

// Add your tools
server.tool("analyze_text", {
  text: z.string().describe("Text to analyze"),
  type: z.enum(['sentiment', 'summary', 'keywords']).describe("Analysis type")
}, async (args) => {
  // Your tool implementation
  return {
    content: [{
      type: 'text',
      text: `Analysis of "${args.text}" (${args.type}): Result here`
    }]
  };
});

// Production-ready proxy wrapper
const productionProxy = wrapWithProxy(server, {
  debug: process.env.NODE_ENV === 'development',
  hooks: {
    beforeToolCall: async (context) => {
      const startTime = performance.now();
      const requestId = Math.random().toString(36).substr(2, 9);
      
      // Store for later use
      context.startTime = startTime;
      context.requestId = requestId;

      // 1. Authentication
      if (!context.args.apiKey) {
        return {
          result: {
            content: [{ type: 'text', text: 'API key required' }],
            isError: true
          }
        };
      }

      // 2. Rate limiting (simplified)
      const userId = context.args.userId || context.args.apiKey;
      // ... rate limiting logic ...

      // 3. Input validation & sanitization
      if (context.args.text) {
        context.args.text = context.args.text.trim().slice(0, 10000); // Limit length
      }

      // 4. Analytics
      console.log(`📊 [${requestId}] ${context.toolName} called by ${userId}`);

      // Remove sensitive data from args
      delete context.args.apiKey;
    },
    afterToolCall: async (context, result) => {
      const duration = performance.now() - context.startTime;

      // 1. Error handling
      if (result.result.isError) {
        console.error(`❌ [${context.requestId}] Error:`, result.result.content[0]?.text);
      }

      // 2. Add metadata
      result.result._meta = {
        requestId: context.requestId,
        duration: Math.round(duration * 100) / 100,
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      };

      // 3. Log completion
      console.log(`✅ [${context.requestId}] Completed in ${duration.toFixed(2)}ms`);

      return result;
    }
  }
});

// Start the server
const transport = new StdioServerTransport(productionProxy);
transport.start().catch(console.error);
```

## 🧪 Testing Your Proxy

Test your proxy wrapper with real MCP communication:

```typescript
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';

async function testProxy() {
  // Create linked transports
  const [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();
  
  // Connect server
  await productionProxy.connect(serverTransport);
  
  // Create and connect client
  const client = new Client({ name: 'Test Client', version: '1.0.0' }, {});
  await client.connect(clientTransport);
  
  try {
    // Test successful call
    const result = await client.callTool({
      name: 'analyze_text',
      arguments: {
        text: 'Hello world!',
        type: 'sentiment',
        apiKey: 'valid-key',
        userId: 'test-user'
      }
    });
    
    console.log('✅ Success:', result);
    
    // Test error handling
    const errorResult = await client.callTool({
      name: 'analyze_text',
      arguments: {
        text: 'Test without API key',
        type: 'sentiment'
      }
    });
    
    console.log('⚠️ Expected error:', errorResult);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
  } finally {
    // Cleanup
    await clientTransport.close();
    await serverTransport.close();
  }
}

// Run tests
testProxy().catch(console.error);
```

These examples demonstrate the flexibility and power of the MCP Proxy Wrapper. You can mix and match patterns to create exactly the functionality your application needs!