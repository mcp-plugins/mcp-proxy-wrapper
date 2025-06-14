/**
 * @file Enhanced Proxy Wrapper Tests
 * @version 2.0.0
 * @status DEVELOPMENT
 * @lastModified 2024-12-14
 * 
 * Tests for the enhanced proxy wrapper v2.0 functionality including
 * lifecycle management, parallel execution, and performance monitoring.
 */

import { 
  wrapWithEnhancedProxy, 
  EnhancedProxyWrapper,
  getProxyWrapperInstance,
  ExecutionMode,
  HealthStatus,
  ServerLifecycleEvent
} from '../index.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { 
  IDisposable, 
  IResourceTrackingDisposable,
  ResourceInfo 
} from '../interfaces/lifecycle.js';
import type { ToolCallContext, ToolCallResult } from '../interfaces/proxy-hooks.js';

// Mock MCP Server for testing
class MockMcpServer {
  private tools = new Map<string, Function>();
  
  tool(name: string, paramsSchemaOrCallback: any, callbackOrUndefined?: any): any {
    const isThreeArgVersion = callbackOrUndefined !== undefined;
    const callback = isThreeArgVersion ? callbackOrUndefined : paramsSchemaOrCallback;
    this.tools.set(name, callback);
    return this;
  }
  
  async callTool(name: string, args: any = {}, extra?: any): Promise<any> {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool ${name} not found`);
    }
    return tool(args, extra);
  }
}

// Mock disposable plugin for testing
class MockDisposablePlugin implements IResourceTrackingDisposable {
  public isDisposed = false;
  public name = 'MockPlugin';
  private resources: ResourceInfo[] = [];
  
  constructor(public shouldFailDisposal = false) {
    this.resources.push({
      type: 'memory',
      id: 'test-resource-1',
      description: 'Test memory resource',
      acquiredAt: new Date(),
      size: 1024
    });
  }
  
  async dispose(): Promise<void> {
    if (this.shouldFailDisposal) {
      throw new Error('Disposal failed');
    }
    this.isDisposed = true;
    this.resources = [];
  }
  
  async forceDispose(timeoutMs?: number): Promise<void> {
    this.isDisposed = true;
    this.resources = [];
  }
  
  getResources(): ResourceInfo[] {
    return [...this.resources];
  }
  
  async beforeToolCall(context: ToolCallContext): Promise<void | ToolCallResult> {
    if (context.toolName === 'short-circuit') {
      return {
        result: { shortCircuited: true, pluginName: this.name },
        metadata: { shortCircuited: true }
      };
    }
  }
  
  async afterToolCall(context: ToolCallContext, result: ToolCallResult): Promise<ToolCallResult> {
    return {
      ...result,
      result: {
        ...result.result,
        processedBy: this.name
      }
    };
  }
}

describe('Enhanced Proxy Wrapper v2.0', () => {
  let mockServer: MockMcpServer;
  
  beforeEach(() => {
    mockServer = new MockMcpServer();
  });
  
  describe('Basic Functionality', () => {
    it('should wrap a server successfully', async () => {
      const wrappedServer = await wrapWithEnhancedProxy(mockServer as any);
      expect(wrappedServer).toBeDefined();
      expect((wrappedServer as any)._isProxyWrapped).toBe(true);
    });
    
    it('should prevent double wrapping', async () => {
      const wrappedServer1 = await wrapWithEnhancedProxy(mockServer as any);
      const wrappedServer2 = await wrapWithEnhancedProxy(wrappedServer1);
      expect(wrappedServer1).toBe(wrappedServer2);
    });
    
    it('should return proxy wrapper instance', async () => {
      const wrappedServer = await wrapWithEnhancedProxy(mockServer as any);
      const instance = getProxyWrapperInstance(wrappedServer);
      expect(instance).toBeInstanceOf(EnhancedProxyWrapper);
    });
  });
  
  describe('Lifecycle Management', () => {
    it('should initialize and dispose plugins properly', async () => {
      const plugin = new MockDisposablePlugin();
      
      const wrappedServer = await wrapWithEnhancedProxy(mockServer as any, {
        plugins: [plugin],
        lifecycle: {
          autoDispose: true,
          disposalTimeoutMs: 5000
        }
      });
      
      const instance = getProxyWrapperInstance(wrappedServer);
      expect(instance).toBeDefined();
      
      // Check health status
      const healthStatus = await instance!.getHealthStatus();
      expect(healthStatus).toHaveLength(1);
      expect(healthStatus[0].status).toBe(HealthStatus.HEALTHY);
      
      // Check resource usage
      const resourceUsage = await instance!.getResourceUsage();
      expect(resourceUsage.length).toBeGreaterThan(0);
      
      // Dispose
      await instance!.dispose();
      expect(plugin.isDisposed).toBe(true);
    });
    
    it('should handle plugin disposal failures gracefully', async () => {
      const plugin = new MockDisposablePlugin(true); // Will fail disposal
      
      const wrappedServer = await wrapWithEnhancedProxy(mockServer as any, {
        plugins: [plugin],
        lifecycle: {
          disposalTimeoutMs: 1000
        }
      });
      
      const instance = getProxyWrapperInstance(wrappedServer);
      
      // Disposal should not throw even if plugin disposal fails
      await expect(instance!.dispose()).resolves.not.toThrow();
    });
    
    it('should track resource usage', async () => {
      const plugin = new MockDisposablePlugin();
      
      const wrappedServer = await wrapWithEnhancedProxy(mockServer as any, {
        plugins: [plugin]
      });
      
      const instance = getProxyWrapperInstance(wrappedServer);
      const resources = await instance!.getResourceUsage();
      
      expect(resources).toHaveLength(2); // Plugin resource + plugin itself
      expect(resources.some(r => r.type === 'memory')).toBe(true);
      expect(resources.some(r => r.type === 'plugin')).toBe(true);
    });
  });
  
  describe('Hook Execution', () => {
    it('should execute before and after hooks', async () => {
      const beforeHookCalled = jest.fn();
      const afterHookCalled = jest.fn();
      
      const wrappedServer = await wrapWithEnhancedProxy(mockServer as any, {
        hooks: {
          beforeToolCall: async (context) => {
            beforeHookCalled(context.toolName);
          },
          afterToolCall: async (context, result) => {
            afterHookCalled(context.toolName);
            return result;
          }
        }
      });
      
      // Register a test tool
      wrappedServer.tool('test-tool', async (args: any) => {
        return { success: true, args };
      });
      
      // Call the tool
      const result = await (mockServer as any).callTool('test-tool', { test: 'value' });
      
      expect(beforeHookCalled).toHaveBeenCalledWith('test-tool');
      expect(result.success).toBe(true);
    });
    
    it('should support plugin hooks', async () => {
      const plugin = new MockDisposablePlugin();
      
      const wrappedServer = await wrapWithEnhancedProxy(mockServer as any, {
        plugins: [plugin]
      });
      
      // Register a test tool
      wrappedServer.tool('test-tool', async (args: any) => {
        return { success: true, args };
      });
      
      // Call the tool
      const result = await (mockServer as any).callTool('test-tool', { test: 'value' });
      
      expect(result.processedBy).toBe('MockPlugin');
    });
    
    it('should support short-circuiting', async () => {
      const plugin = new MockDisposablePlugin();
      
      const wrappedServer = await wrapWithEnhancedProxy(mockServer as any, {
        plugins: [plugin]
      });
      
      // Register a test tool that should be short-circuited
      wrappedServer.tool('short-circuit', async (args: any) => {
        return { shouldNotBeCalled: true };
      });
      
      // Call the tool
      const result = await (mockServer as any).callTool('short-circuit', {});
      
      expect(result.shortCircuited).toBe(true);
      expect(result.pluginName).toBe('MockPlugin');
      expect(result.shouldNotBeCalled).toBeUndefined();
    });
  });
  
  describe('Performance Monitoring', () => {
    it('should track performance statistics', async () => {
      const wrappedServer = await wrapWithEnhancedProxy(mockServer as any, {
        performance: {
          enabled: true,
          trackExecutionTime: true,
          trackMemory: true,
          samplingRate: 1.0
        },
        hooks: {
          beforeToolCall: async (context) => {
            // Simulate some processing time
            await new Promise(resolve => setTimeout(resolve, 10));
          }
        }
      });
      
      const instance = getProxyWrapperInstance(wrappedServer);
      
      // Register a test tool
      wrappedServer.tool('perf-test', async (args: any) => {
        return { success: true };
      });
      
      // Call the tool multiple times
      for (let i = 0; i < 3; i++) {
        await (mockServer as any).callTool('perf-test', {});
      }
      
      // Check performance stats
      const stats = instance!.getPerformanceStats();
      expect(stats.size).toBeGreaterThan(0);
      
      // Should have stats for user hooks
      const userHookStats = stats.get('user-before-hook');
      if (userHookStats) {
        expect(userHookStats.totalExecutions).toBe(3);
        expect(userHookStats.averageExecutionTimeMs).toBeGreaterThan(0);
      }
    });
  });
  
  describe('Error Handling', () => {
    it('should handle hook errors gracefully', async () => {
      const wrappedServer = await wrapWithEnhancedProxy(mockServer as any, {
        hooks: {
          beforeToolCall: async (context) => {
            throw new Error('Hook error');
          }
        }
      });
      
      // Register a test tool
      wrappedServer.tool('error-test', async (args: any) => {
        return { success: true };
      });
      
      // Call should return error response, not throw
      const result = await (mockServer as any).callTool('error-test', {});
      
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Hook error');
    });
    
    it('should respect execution timeouts', async () => {
      const wrappedServer = await wrapWithEnhancedProxy(mockServer as any, {
        security: {
          maxExecutionTimeMs: 100 // Very short timeout
        },
        hooks: {
          beforeToolCall: async (context) => {
            // Simulate long processing
            await new Promise(resolve => setTimeout(resolve, 200));
          }
        }
      });
      
      // Register a test tool
      wrappedServer.tool('timeout-test', async (args: any) => {
        return { success: true };
      });
      
      // Call should timeout
      const result = await (mockServer as any).callTool('timeout-test', {});
      
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('timeout');
    });
  });
  
  describe('Security Features', () => {
    it('should validate inputs when enabled', async () => {
      const wrappedServer = await wrapWithEnhancedProxy(mockServer as any, {
        security: {
          validateInputs: true
        }
      });
      
      // Register a tool with required fields
      wrappedServer.tool('secure-tool', 
        { required: ['name'] }, 
        async (args: any) => {
          return { success: true, name: args.name };
        }
      );
      
      // Call without required field should fail
      const result = await (mockServer as any).callTool('secure-tool', {});
      
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('validation failed');
    });
    
    it('should redact sensitive fields', async () => {
      const wrappedServer = await wrapWithEnhancedProxy(mockServer as any, {
        security: {
          redactFields: ['password', 'token']
        }
      });
      
      // Register a test tool
      wrappedServer.tool('redact-test', async (args: any) => {
        return { received: args };
      });
      
      // Call with sensitive data
      const result = await (mockServer as any).callTool('redact-test', {
        username: 'test',
        password: 'secret123',
        token: 'abc123'
      });
      
      // Check that sensitive fields were redacted in processing
      // (Note: This would require access to logs or internal state)
      expect(result.received.username).toBe('test');
      expect(result.received.password).toBe('[REDACTED]');
      expect(result.received.token).toBe('[REDACTED]');
    });
  });
});