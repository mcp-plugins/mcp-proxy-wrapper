/**
 * @file Plugin Integration Tests
 * @description End-to-end tests for plugin system integration with actual tool calls
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { wrapWithProxy } from '../proxy-wrapper.js';
import { BasePlugin, PluginContext } from '../interfaces/plugin.js';
import { ToolCallContext, ToolCallResult } from '../interfaces/proxy-hooks.js';
import { z } from 'zod';

// Real-world plugin examples for testing
class LoggingPlugin extends BasePlugin {
  name = 'logging-plugin';
  version = '1.0.0';
  
  public logs: Array<{ phase: string; toolName: string; timestamp: number }> = [];
  
  async beforeToolCall(context: PluginContext): Promise<void> {
    this.logs.push({
      phase: 'before',
      toolName: context.toolName,
      timestamp: Date.now()
    });
  }
  
  async afterToolCall(context: PluginContext, result: ToolCallResult): Promise<ToolCallResult> {
    this.logs.push({
      phase: 'after',
      toolName: context.toolName,
      timestamp: Date.now()
    });
    return result;
  }
}

class AuthenticationPlugin extends BasePlugin {
  name = 'auth-plugin';
  version = '1.0.0';
  
  async beforeToolCall(context: PluginContext): Promise<void | ToolCallResult> {
    // Check for API key
    if (!context.args.apiKey) {
      return {
        result: {
          content: [{ type: 'text', text: 'Authentication required: Missing API key' }],
          isError: true
        }
      };
    }
    
    // Validate API key (simple check for testing)
    if (context.args.apiKey !== 'valid-key') {
      return {
        result: {
          content: [{ type: 'text', text: 'Authentication failed: Invalid API key' }],
          isError: true
        }
      };
    }
    
    // Remove API key from args before passing to tool
    delete context.args.apiKey;
  }
}

class MetadataEnhancerPlugin extends BasePlugin {
  name = 'metadata-plugin';
  version = '1.0.0';
  
  async afterToolCall(context: PluginContext, result: ToolCallResult): Promise<ToolCallResult> {
    // Add metadata to successful results
    if (!result.result.isError && result.result.content) {
      result.result._metadata = {
        processedBy: this.name,
        toolName: context.toolName,
        timestamp: new Date().toISOString(),
        version: this.version
      };
    }
    return result;
  }
}

class RateLimitPlugin extends BasePlugin {
  name = 'rate-limit-plugin';
  version = '1.0.0';
  
  private callCounts = new Map<string, { count: number; resetTime: number }>();
  private readonly limit = 3;
  private readonly windowMs = 60000; // 1 minute
  
  async beforeToolCall(context: PluginContext): Promise<void | ToolCallResult> {
    const userId = context.args.userId || 'anonymous';
    const now = Date.now();
    
    const userLimit = this.callCounts.get(userId) || { count: 0, resetTime: now + this.windowMs };
    
    // Reset if window expired
    if (now > userLimit.resetTime) {
      userLimit.count = 0;
      userLimit.resetTime = now + this.windowMs;
    }
    
    // Check limit
    if (userLimit.count >= this.limit) {
      return {
        result: {
          content: [{
            type: 'text',
            text: `Rate limit exceeded. Try again after ${new Date(userLimit.resetTime).toISOString()}`
          }],
          isError: true
        }
      };
    }
    
    // Increment counter
    userLimit.count++;
    this.callCounts.set(userId, userLimit);
  }
}

class CachingPlugin extends BasePlugin {
  name = 'caching-plugin';
  version = '1.0.0';
  
  private cache = new Map<string, { result: any; timestamp: number }>();
  private readonly ttl = 30000; // 30 seconds
  
  async beforeToolCall(context: PluginContext): Promise<void | ToolCallResult> {
    // Only cache deterministic tools
    if (context.toolName === 'calculate' || context.toolName === 'echo') {
      const cacheKey = `${context.toolName}:${JSON.stringify(context.args)}`;
      const cached = this.cache.get(cacheKey);
      
      if (cached && Date.now() - cached.timestamp < this.ttl) {
        // Return cached result
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
    // Cache successful results from deterministic tools
    if ((context.toolName === 'calculate' || context.toolName === 'echo') && !result.result.isError) {
      const cacheKey = `${context.toolName}:${JSON.stringify(context.args)}`;
      this.cache.set(cacheKey, {
        result: result.result,
        timestamp: Date.now()
      });
    }
    
    return result;
  }
}

describe('Plugin Integration Tests', () => {
  let server: McpServer;
  let proxiedServer: McpServer;
  let serverTransport: InMemoryTransport;
  let clientTransport: InMemoryTransport;
  let client: Client;
  
  beforeEach(async () => {
    server = new McpServer({
      name: 'Test Server',
      version: '1.0.0'
    });
    
    // Create transports
    [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();
    
    // Create client
    client = new Client({
      name: 'Test Client',
      version: '1.0.0'
    }, {
      capabilities: {}
    });
  });
  
  afterEach(async () => {
    try {
      await clientTransport.close();
      await serverTransport.close();
    } catch (error) {
      // Ignore cleanup errors
    }
  });
  
  describe('Single Plugin Integration', () => {
    it('should execute logging plugin with real tool calls', async () => {
      const loggingPlugin = new LoggingPlugin();
      
      proxiedServer = await wrapWithProxy(server, {
        plugins: [loggingPlugin]
      });
      
      // Register a simple tool
      proxiedServer.tool('echo', {
        message: z.string()
      }, async (args) => {
        return {
          content: [{ type: 'text', text: args.message }]
        };
      });
      
      // Connect server and client
      await proxiedServer.connect(serverTransport);
      await client.connect(clientTransport);
      
      // Make tool call
      const result = await client.callTool({
        name: 'echo',
        arguments: { message: 'Hello, World!' }
      });
      
      // Verify result
      expect(result.content[0].text).toBe('Hello, World!');
      
      // Verify plugin was executed
      expect(loggingPlugin.logs).toHaveLength(2);
      expect(loggingPlugin.logs[0].phase).toBe('before');
      expect(loggingPlugin.logs[0].toolName).toBe('echo');
      expect(loggingPlugin.logs[1].phase).toBe('after');
      expect(loggingPlugin.logs[1].toolName).toBe('echo');
    });
    
    it('should handle authentication plugin blocking unauthorized calls', async () => {
      const authPlugin = new AuthenticationPlugin();
      
      proxiedServer = await wrapWithProxy(server, {
        plugins: [authPlugin]
      });
      
      proxiedServer.tool('secure-tool', {
        data: z.string(),
        apiKey: z.string().optional()
      }, async (args) => {
        return {
          content: [{ type: 'text', text: `Secure data: ${args.data}` }]
        };
      });
      
      await proxiedServer.connect(serverTransport);
      await client.connect(clientTransport);
      
      // Test without API key
      const unauthorizedResult = await client.callTool({
        name: 'secure-tool',
        arguments: { data: 'secret' }
      });
      
      expect(unauthorizedResult.isError).toBe(true);
      expect(unauthorizedResult.content[0].text).toContain('Authentication required');
      
      // Test with invalid API key
      const invalidResult = await client.callTool({
        name: 'secure-tool',
        arguments: { data: 'secret', apiKey: 'invalid' }
      });
      
      expect(invalidResult.isError).toBe(true);
      expect(invalidResult.content[0].text).toContain('Authentication failed');
      
      // Test with valid API key
      const validResult = await client.callTool({
        name: 'secure-tool',
        arguments: { data: 'secret', apiKey: 'valid-key' }
      });
      
      expect(validResult.isError).toBeFalsy();
      expect(validResult.content[0].text).toBe('Secure data: secret');
    });
    
    it('should enhance responses with metadata plugin', async () => {
      const metadataPlugin = new MetadataEnhancerPlugin();
      
      proxiedServer = await wrapWithProxy(server, {
        plugins: [metadataPlugin]
      });
      
      proxiedServer.tool('test-tool', {
        input: z.string()
      }, async (args) => {
        return {
          content: [{ type: 'text', text: `Processed: ${args.input}` }]
        };
      });
      
      await proxiedServer.connect(serverTransport);
      await client.connect(clientTransport);
      
      const result = await client.callTool({
        name: 'test-tool',
        arguments: { input: 'test data' }
      });
      
      expect(result.content[0].text).toBe('Processed: test data');
      expect(result._metadata).toBeDefined();
      expect(result._metadata.processedBy).toBe('metadata-plugin');
      expect(result._metadata.toolName).toBe('test-tool');
      expect(result._metadata.version).toBe('1.0.0');
    });
  });
  
  describe('Multiple Plugin Integration', () => {
    it('should execute multiple plugins in priority order', async () => {
      const loggingPlugin = new LoggingPlugin();
      const metadataPlugin = new MetadataEnhancerPlugin();
      
      // Set different priorities
      loggingPlugin.config = { priority: 100 };
      metadataPlugin.config = { priority: 50 };
      
      proxiedServer = await wrapWithProxy(server, {
        plugins: [metadataPlugin, loggingPlugin] // Register in different order
      });
      
      proxiedServer.tool('multi-plugin-tool', {
        data: z.string()
      }, async (args) => {
        return {
          content: [{ type: 'text', text: `Data: ${args.data}` }]
        };
      });
      
      await proxiedServer.connect(serverTransport);
      await client.connect(clientTransport);
      
      const result = await client.callTool({
        name: 'multi-plugin-tool',
        arguments: { data: 'test' }
      });
      
      // Both plugins should have executed
      expect(loggingPlugin.logs).toHaveLength(2);
      expect(result._metadata).toBeDefined();
      expect(result._metadata.processedBy).toBe('metadata-plugin');
    });
    
    it('should handle authentication and rate limiting together', async () => {
      const authPlugin = new AuthenticationPlugin();
      const rateLimitPlugin = new RateLimitPlugin();
      
      proxiedServer = await wrapWithProxy(server, {
        plugins: [authPlugin, rateLimitPlugin]
      });
      
      proxiedServer.tool('protected-tool', {
        action: z.string(),
        userId: z.string().optional(),
        apiKey: z.string().optional()
      }, async (args) => {
        return {
          content: [{ type: 'text', text: `Action: ${args.action}` }]
        };
      });
      
      await proxiedServer.connect(serverTransport);
      await client.connect(clientTransport);
      
      // Valid calls should work initially
      for (let i = 1; i <= 3; i++) {
        const result = await client.callTool({
          name: 'protected-tool',
          arguments: { 
            action: `action-${i}`, 
            userId: 'test-user',
            apiKey: 'valid-key'
          }
        });
        
        expect(result.isError).toBeFalsy();
        expect(result.content[0].text).toBe(`Action: action-${i}`);
      }
      
      // 4th call should be rate limited
      const rateLimitedResult = await client.callTool({
        name: 'protected-tool',
        arguments: { 
          action: 'action-4', 
          userId: 'test-user',
          apiKey: 'valid-key'
        }
      });
      
      expect(rateLimitedResult.isError).toBe(true);
      expect(rateLimitedResult.content[0].text).toContain('Rate limit exceeded');
    });
  });
  
  describe('Performance and Caching', () => {
    it('should cache repeated calls with caching plugin', async () => {
      const cachingPlugin = new CachingPlugin();
      
      proxiedServer = await wrapWithProxy(server, {
        plugins: [cachingPlugin]
      });
      
      let callCount = 0;
      proxiedServer.tool('calculate', {
        operation: z.string(),
        a: z.number(),
        b: z.number()
      }, async (args) => {
        callCount++;
        const result = args.operation === 'add' ? args.a + args.b : args.a * args.b;
        return {
          content: [{ type: 'text', text: `Result: ${result}` }]
        };
      });
      
      await proxiedServer.connect(serverTransport);
      await client.connect(clientTransport);
      
      // First call - should execute tool
      const result1 = await client.callTool({
        name: 'calculate',
        arguments: { operation: 'add', a: 2, b: 3 }
      });
      
      expect(result1.content[0].text).toBe('Result: 5');
      expect(result1._cached).toBeUndefined();
      expect(callCount).toBe(1);
      
      // Second call with same args - should use cache
      const result2 = await client.callTool({
        name: 'calculate',
        arguments: { operation: 'add', a: 2, b: 3 }
      });
      
      expect(result2.content[0].text).toBe('Result: 5');
      expect(result2._cached).toBe(true);
      expect(callCount).toBe(1); // Tool not called again
      
      // Different args - should execute tool again
      const result3 = await client.callTool({
        name: 'calculate',
        arguments: { operation: 'add', a: 5, b: 7 }
      });
      
      expect(result3.content[0].text).toBe('Result: 12');
      expect(result3._cached).toBeUndefined();
      expect(callCount).toBe(2);
    });
  });
  
  describe('Error Handling and Resilience', () => {
    it('should handle plugin errors gracefully without breaking tool calls', async () => {
      const errorPlugin = {
        name: 'error-plugin',
        version: '1.0.0',
        beforeToolCall: async () => { throw new Error('Plugin error'); }
      };
      
      const workingPlugin = new LoggingPlugin();
      
      proxiedServer = await wrapWithProxy(server, {
        plugins: [errorPlugin, workingPlugin]
      });
      
      proxiedServer.tool('resilient-tool', {
        data: z.string()
      }, async (args) => {
        return {
          content: [{ type: 'text', text: `Processed: ${args.data}` }]
        };
      });
      
      await proxiedServer.connect(serverTransport);
      await client.connect(clientTransport);
      
      const result = await client.callTool({
        name: 'resilient-tool',
        arguments: { data: 'test' }
      });
      
      // Tool call should succeed despite plugin error
      expect(result.content[0].text).toBe('Processed: test');
      
      // Working plugin should still execute
      expect(workingPlugin.logs).toHaveLength(2);
    });
    
    it('should handle tool execution errors with plugins active', async () => {
      const loggingPlugin = new LoggingPlugin();
      
      proxiedServer = await wrapWithProxy(server, {
        plugins: [loggingPlugin]
      });
      
      proxiedServer.tool('failing-tool', {
        shouldFail: z.boolean().optional()
      }, async (args) => {
        if (args.shouldFail) {
          throw new Error('Tool execution failed');
        }
        return {
          content: [{ type: 'text', text: 'Success' }]
        };
      });
      
      await proxiedServer.connect(serverTransport);
      await client.connect(clientTransport);
      
      const result = await client.callTool({
        name: 'failing-tool',
        arguments: { shouldFail: true }
      });
      
      // Should receive error response
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Tool execution failed');
      
      // Plugin should still log the attempt
      expect(loggingPlugin.logs).toHaveLength(1); // Only beforeToolCall
      expect(loggingPlugin.logs[0].phase).toBe('before');
    });
  });
  
  describe('Plugin Configuration', () => {
    it('should respect plugin tool filtering', async () => {
      const selectivePlugin = new LoggingPlugin();
      selectivePlugin.config = {
        includeTools: ['allowed-tool']
      };
      
      proxiedServer = await wrapWithProxy(server, {
        plugins: [selectivePlugin]
      });
      
      proxiedServer.tool('allowed-tool', {}, async () => ({
        content: [{ type: 'text', text: 'Allowed' }]
      }));
      
      proxiedServer.tool('blocked-tool', {}, async () => ({
        content: [{ type: 'text', text: 'Blocked' }]
      }));
      
      await proxiedServer.connect(serverTransport);
      await client.connect(clientTransport);
      
      // Call both tools
      await client.callTool({ name: 'allowed-tool', arguments: {} });
      await client.callTool({ name: 'blocked-tool', arguments: {} });
      
      // Plugin should only have logged the allowed tool
      expect(selectivePlugin.logs).toHaveLength(2); // before and after for allowed-tool
      expect(selectivePlugin.logs.every(log => log.toolName === 'allowed-tool')).toBe(true);
    });
  });
});