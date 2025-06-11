/**
 * @file Plugin Validation Tests
 * @description Tests to validate the plugin interface design using the example plugin
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { ExamplePlugin } from '../test-helpers/example-plugin.js';
import { PluginContext } from '../interfaces/plugin.js';
import { ToolCallContext, ToolCallResult } from '../interfaces/proxy-hooks.js';

describe('Plugin Interface Validation', () => {
  let plugin: ExamplePlugin;
  
  beforeEach(() => {
    plugin = new ExamplePlugin();
  });
  
  describe('Plugin Metadata', () => {
    it('should have required properties', () => {
      expect(plugin.name).toBe('example-plugin');
      expect(plugin.version).toBe('1.0.0');
      expect(plugin.metadata).toBeDefined();
      expect(plugin.metadata?.description).toBeTruthy();
      expect(plugin.metadata?.author).toBeTruthy();
    });
    
    it('should have valid configuration', () => {
      expect(plugin.config).toBeDefined();
      expect(plugin.config?.enabled).toBe(true);
      expect(plugin.config?.priority).toBe(100);
      expect(plugin.config?.options).toBeDefined();
    });
  });
  
  describe('Plugin Lifecycle', () => {
    it('should initialize correctly', async () => {
      if (plugin.initialize) {
        await plugin.initialize({
          wrapperVersion: '1.0.0',
          loadedPlugins: [],
          globalConfig: {},
          logger: {
            debug: () => {},
            info: () => {},
            warn: () => {},
            error: () => {}
          }
        });
      }
      
      expect(plugin.initializeCalled).toBe(true);
    });
    
    it('should perform health checks', async () => {
      const isHealthy = await plugin.healthCheck();
      expect(typeof isHealthy).toBe('boolean');
      expect(isHealthy).toBe(true); // Should be healthy initially
    });
    
    it('should provide statistics', async () => {
      const stats = await plugin.getStats();
      
      expect(stats).toBeDefined();
      expect(typeof stats.callsProcessed).toBe('number');
      expect(typeof stats.errorsEncountered).toBe('number');
      expect(typeof stats.averageProcessingTime).toBe('number');
      expect(typeof stats.lastActivity).toBe('number');
      expect(stats.customMetrics).toBeDefined();
    });
    
    it('should cleanup on destroy', async () => {
      plugin.clearHistory(); // Add some test data
      
      await plugin.destroy();
      
      expect(plugin.destroyCalled).toBe(true);
    });
  });
  
  describe('Hook Functionality', () => {
    it('should execute beforeToolCall hook', async () => {
      const context: PluginContext = {
        toolName: 'test-tool',
        args: { input: 'test' },
        pluginData: new Map(),
        requestId: 'test-request',
        startTime: Date.now()
      };
      
      const result = await plugin.beforeToolCall(context);
      
      // Should not short-circuit for normal tools
      expect(result).toBeUndefined();
      
      // Should modify context
      expect(context.args._requestId).toBeDefined();
      expect(context.args._timestamp).toBeDefined();
      
      // Should track the call
      const history = plugin.getCallHistory();
      expect(history).toHaveLength(1);
      expect(history[0].toolName).toBe('test-tool');
    });
    
    it('should short-circuit dangerous tools', async () => {
      const context: PluginContext = {
        toolName: 'dangerous-tool',
        args: {},
        pluginData: new Map(),
        requestId: 'test-request',
        startTime: Date.now()
      };
      
      const result = await plugin.beforeToolCall(context);
      
      expect(result).toBeDefined();
      expect(result?.result.isError).toBe(true);
      expect(result?.result.content[0].text).toContain('blocked');
    });
    
    it('should validate arguments', async () => {
      const context: PluginContext = {
        toolName: 'calculate',
        args: { a: 'not-a-number', b: 5 },
        pluginData: new Map(),
        requestId: 'test-request',
        startTime: Date.now()
      };
      
      const result = await plugin.beforeToolCall(context);
      
      expect(result).toBeDefined();
      expect(result?.result.isError).toBe(true);
      expect(result?.result.content[0].text).toContain('Invalid arguments');
    });
    
    it('should execute afterToolCall hook', async () => {
      // First, call beforeToolCall to set up context
      const context: PluginContext = {
        toolName: 'greet',
        args: { name: 'World' },
        pluginData: new Map(),
        requestId: 'test-request',
        startTime: Date.now()
      };
      
      await plugin.beforeToolCall(context);
      
      // Then call afterToolCall
      const inputResult: ToolCallResult = {
        result: {
          content: [{ type: 'text', text: 'Hello, World!' }]
        }
      };
      
      const outputResult = await plugin.afterToolCall(context, inputResult);
      
      // Should add metadata
      expect(outputResult.result._plugin_metadata).toBeDefined();
      expect(outputResult.result._plugin_metadata.processedBy).toBe('example-plugin');
      
      // Should transform greet results
      expect(outputResult.result.content[0].text).toBe('🎉 Hello, World!');
    });
    
    it('should track performance metrics', async () => {
      const context: PluginContext = {
        toolName: 'slow-tool',
        args: {},
        pluginData: new Map(),
        requestId: 'test-request',
        startTime: Date.now()
      };
      
      await plugin.beforeToolCall(context);
      
      // Simulate slow execution
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const result: ToolCallResult = {
        result: {
          content: [{ type: 'text', text: 'Slow result' }]
        }
      };
      
      const outputResult = await plugin.afterToolCall(context, result);
      
      expect(outputResult.result._plugin_metadata.processingTime).toBeGreaterThan(0);
      
      const history = plugin.getCallHistory();
      expect(history[0].duration).toBeGreaterThan(0);
    });
  });
  
  describe('Configuration Management', () => {
    it('should allow configuration updates', () => {
      const newConfig = {
        options: {
          logRequests: false,
          maxProcessingTime: 2000
        }
      };
      
      plugin.updateConfig(newConfig);
      
      const config = plugin.getConfig();
      expect(config.options?.logRequests).toBe(false);
      expect(config.options?.maxProcessingTime).toBe(2000);
    });
    
    it('should respect tool filtering configuration', () => {
      // Test that config can be updated with filtering options
      plugin.config = {
        ...plugin.config!,
        includeTools: ['allowed-tool']
      };
      expect(plugin.config!.includeTools).toContain('allowed-tool');
      
      plugin.config = {
        ...plugin.config!,
        includeTools: [],
        excludeTools: ['blocked-tool']
      };
      expect(plugin.config!.excludeTools).toContain('blocked-tool');
    });
  });
  
  describe('Error Handling', () => {
    it('should handle errors gracefully', async () => {
      const errorInfo = {
        pluginName: 'example-plugin',
        phase: 'beforeToolCall' as const,
        error: new Error('Test error'),
        context: {
          toolName: 'test-tool',
          args: {},
          pluginData: new Map(),
          requestId: 'test-request',
          startTime: Date.now()
        } as PluginContext
      };
      
      // Should not throw
      await expect(plugin.onError(errorInfo)).resolves.not.toThrow();
    });
  });
  
  describe('Statistics and Monitoring', () => {
    it('should track call statistics', async () => {
      // Make several calls to generate stats
      for (let i = 0; i < 3; i++) {
        const context: PluginContext = {
          toolName: `tool-${i}`,
          args: {},
          pluginData: new Map(),
          requestId: `test-request-${i}`,
          startTime: Date.now()
        };
        
        await plugin.beforeToolCall(context);
        
        const result: ToolCallResult = {
          result: { content: [{ type: 'text', text: 'result' }] }
        };
        
        await plugin.afterToolCall(context, result);
      }
      
      const stats = await plugin.getStats();
      expect(stats.callsProcessed).toBe(3);
      expect(stats.customMetrics?.totalCalls).toBe(3);
      expect(stats.customMetrics?.successfulCalls).toBe(3);
    });
    
    it('should detect unhealthy state', async () => {
      // Simulate failures
      plugin.clearHistory();
      
      for (let i = 0; i < 6; i++) {
        const context: ToolCallContext = {
          toolName: 'failing-tool',
          args: {}
        };
        
        // Manually add failed calls to history
        (plugin as any).callHistory.push({
          toolName: 'failing-tool',
          timestamp: Date.now(),
          success: false
        });
      }
      
      const isHealthy = await plugin.healthCheck();
      expect(isHealthy).toBe(false);
    });
  });
  
  describe('Integration Validation', () => {
    it('should work with different tool types', async () => {
      const testCases = [
        { toolName: 'greet', args: { name: 'Alice' } },
        { toolName: 'calculate', args: { a: 5, b: 3 } },
        { toolName: 'echo', args: { message: 'Hello' } }
      ];
      
      for (const testCase of testCases) {
        const context: PluginContext = {
          ...testCase,
          pluginData: new Map(),
          requestId: 'test-request',
          startTime: Date.now()
        };
        
        const beforeResult = await plugin.beforeToolCall(context);
        expect(beforeResult).toBeUndefined(); // Should not short-circuit
        
        const result: ToolCallResult = {
          result: { content: [{ type: 'text', text: 'test result' }] }
        };
        
        const afterResult = await plugin.afterToolCall(context, result);
        expect(afterResult.result._plugin_metadata).toBeDefined();
      }
      
      const history = plugin.getCallHistory();
      expect(history).toHaveLength(3);
    });
  });
});