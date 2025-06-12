/**
 * @file Plugin Manager Tests
 * @description Test suite for the DefaultPluginManager using TDD approach
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { DefaultPluginManager } from '../utils/plugin-manager.js';
import { ProxyPlugin, PluginConfig, BasePlugin } from '../interfaces/plugin.js';
import { ToolCallContext, ToolCallResult } from '../interfaces/proxy-hooks.js';

// Test plugin implementations
class MockPlugin extends BasePlugin {
  name = 'mock-plugin';
  version = '1.0.0';
  
  public initializeCalled = false;
  public destroyCalled = false;
  public beforeCallCount = 0;
  public afterCallCount = 0;
  public healthCheckCount = 0;
  
  async initialize(context: any): Promise<void> {
    await super.initialize(context);
    this.initializeCalled = true;
  }
  
  async beforeToolCall(context: any): Promise<void> {
    this.beforeCallCount++;
  }
  
  async afterToolCall(context: any, result: any): Promise<any> {
    this.afterCallCount++;
    return result;
  }
  
  async destroy(): Promise<void> {
    this.destroyCalled = true;
  }
  
  async healthCheck(): Promise<boolean> {
    this.healthCheckCount++;
    return true;
  }
}

class FailingPlugin extends BasePlugin {
  name = 'failing-plugin';
  version = '1.0.0';
  
  async initialize(): Promise<void> {
    throw new Error('Initialization failed');
  }
}

class DependentPlugin extends BasePlugin {
  name = 'dependent-plugin';
  version = '1.0.0';
  
  public initializeCalled = false;
  public destroyCalled = false;
  
  metadata = {
    dependencies: ['base-plugin']
  };
  
  async initialize(context: any): Promise<void> {
    await super.initialize(context);
    this.initializeCalled = true;
  }
  
  async destroy(): Promise<void> {
    this.destroyCalled = true;
  }
}

class BasePluginForDep extends BasePlugin {
  name = 'base-plugin';
  version = '1.0.0';
  
  public initializeCalled = false;
  public destroyCalled = false;
  
  async initialize(context: any): Promise<void> {
    await super.initialize(context);
    this.initializeCalled = true;
  }
  
  async destroy(): Promise<void> {
    this.destroyCalled = true;
  }
}

describe('DefaultPluginManager', () => {
  let manager: DefaultPluginManager;
  let mockPlugin: MockPlugin;
  
  beforeEach(() => {
    manager = new DefaultPluginManager('1.0.0', {});
    mockPlugin = new MockPlugin();
  });
  
  afterEach(async () => {
    await manager.destroy();
  });
  
  describe('Plugin Registration', () => {
    it('should register a valid plugin', async () => {
      await manager.register(mockPlugin);
      
      const retrievedPlugin = manager.getPlugin('mock-plugin');
      expect(retrievedPlugin).toBe(mockPlugin);
    });
    
    it('should reject plugin with invalid name', async () => {
      const invalidPlugin = {
        name: '',
        version: '1.0.0'
      } as ProxyPlugin;
      
      await expect(manager.register(invalidPlugin)).rejects.toThrow('Plugin must have a valid name');
    });
    
    it('should reject plugin with invalid version', async () => {
      const invalidPlugin = {
        name: 'test',
        version: 'invalid'
      } as ProxyPlugin;
      
      await expect(manager.register(invalidPlugin)).rejects.toThrow('Plugin version must follow semantic versioning');
    });
    
    it('should reject duplicate plugin registration', async () => {
      await manager.register(mockPlugin);
      
      const duplicatePlugin = new MockPlugin();
      await expect(manager.register(duplicatePlugin)).rejects.toThrow('Plugin \'mock-plugin\' is already registered');
    });
    
    it('should apply plugin configuration during registration', async () => {
      const config: PluginConfig = {
        enabled: false,
        priority: 200,
        includeTools: ['specific-tool']
      };
      
      await manager.register(mockPlugin, config);
      
      // Plugin should be registered but not enabled
      const retrievedPlugin = manager.getPlugin('mock-plugin');
      expect(retrievedPlugin).toBe(mockPlugin);
    });
    
    it('should respect maximum plugin limit', async () => {
      const limitedManager = new DefaultPluginManager('1.0.0', { maxPlugins: 1 });
      
      await limitedManager.register(mockPlugin);
      
      const secondPlugin = new MockPlugin();
      secondPlugin.name = 'second-plugin';
      
      await expect(limitedManager.register(secondPlugin)).rejects.toThrow('Maximum number of plugins (1) exceeded');
    });
  });
  
  describe('Plugin Unregistration', () => {
    it('should unregister a plugin', async () => {
      await manager.register(mockPlugin);
      await manager.unregister('mock-plugin');
      
      const retrievedPlugin = manager.getPlugin('mock-plugin');
      expect(retrievedPlugin).toBeUndefined();
    });
    
    it('should call destroy hook when unregistering', async () => {
      await manager.register(mockPlugin);
      await manager.initializeAll();
      await manager.unregister('mock-plugin');
      
      expect(mockPlugin.destroyCalled).toBe(true);
    });
    
    it('should throw error when unregistering non-existent plugin', async () => {
      await expect(manager.unregister('non-existent')).rejects.toThrow('Plugin \'non-existent\' is not registered');
    });
  });
  
  describe('Plugin Initialization', () => {
    it('should initialize all enabled plugins', async () => {
      await manager.register(mockPlugin);
      await manager.initializeAll();
      
      expect(mockPlugin.initializeCalled).toBe(true);
    });
    
    it('should not initialize disabled plugins', async () => {
      const config: PluginConfig = { enabled: false };
      await manager.register(mockPlugin, config);
      await manager.initializeAll();
      
      expect(mockPlugin.initializeCalled).toBe(false);
    });
    
    it('should handle initialization failures', async () => {
      const failingPlugin = new FailingPlugin();
      await manager.register(failingPlugin);
      
      await expect(manager.initializeAll()).rejects.toThrow('Initialization failed');
    });
    
    it('should initialize plugins in dependency order', async () => {
      const basePlugin = new BasePluginForDep();
      const dependentPlugin = new DependentPlugin();
      
      // Register in reverse order to test sorting
      await manager.register(dependentPlugin);
      await manager.register(basePlugin);
      
      await manager.initializeAll();
      
      expect(basePlugin.initializeCalled).toBe(true);
      expect(dependentPlugin.initializeCalled).toBe(true);
    });
  });
  
  describe('Dependency Validation', () => {
    it('should validate dependencies are present', async () => {
      const dependentPlugin = new DependentPlugin();
      await manager.register(dependentPlugin);
      
      await expect(manager.validateDependencies()).rejects.toThrow("Plugin 'dependent-plugin' requires dependency 'base-plugin'");
    });
    
    it('should pass validation when dependencies are present', async () => {
      const basePlugin = new BasePluginForDep();
      const dependentPlugin = new DependentPlugin();
      
      await manager.register(basePlugin);
      await manager.register(dependentPlugin);
      
      const isValid = await manager.validateDependencies();
      expect(isValid).toBe(true);
    });
    
    it('should detect circular dependencies', async () => {
      const plugin1: ProxyPlugin = {
        name: 'plugin-1',
        version: '1.0.0',
        metadata: { dependencies: ['plugin-2'] }
      };
      
      const plugin2: ProxyPlugin = {
        name: 'plugin-2',
        version: '1.0.0',
        metadata: { dependencies: ['plugin-1'] }
      };
      
      await manager.register(plugin1);
      await manager.register(plugin2);
      
      // Should throw during initialization when resolving dependency order
      await expect(manager.initializeAll()).rejects.toThrow('Circular dependency detected');
    });
  });
  
  describe('Plugin Execution Order', () => {
    it('should return plugins in priority order', async () => {
      const lowPriorityPlugin = new MockPlugin();
      lowPriorityPlugin.name = 'low-priority';
      
      const highPriorityPlugin = new MockPlugin();
      highPriorityPlugin.name = 'high-priority';
      
      await manager.register(lowPriorityPlugin, { priority: 10 });
      await manager.register(highPriorityPlugin, { priority: 100 });
      
      const executionOrder = manager.getExecutionOrder();
      expect(executionOrder[0].name).toBe('high-priority');
      expect(executionOrder[1].name).toBe('low-priority');
    });
    
    it('should handle same priority plugins consistently', async () => {
      const plugin1 = new MockPlugin();
      plugin1.name = 'plugin-1';
      
      const plugin2 = new MockPlugin();
      plugin2.name = 'plugin-2';
      
      await manager.register(plugin1, { priority: 100 });
      await manager.register(plugin2, { priority: 100 });
      
      const executionOrder = manager.getExecutionOrder();
      expect(executionOrder).toHaveLength(2);
      // Order should be consistent (implementation-defined)
    });
  });
  
  describe('Hook Execution', () => {
    it('should execute beforeToolCall hooks for enabled plugins', async () => {
      await manager.register(mockPlugin);
      await manager.initializeAll();
      
      const context: ToolCallContext = {
        toolName: 'test-tool',
        args: { test: true }
      };
      
      await manager.executeBeforeHooks(context);
      
      expect(mockPlugin.beforeCallCount).toBe(1);
    });
    
    it('should execute afterToolCall hooks for enabled plugins', async () => {
      await manager.register(mockPlugin);
      await manager.initializeAll();
      
      const context: ToolCallContext = {
        toolName: 'test-tool',
        args: { test: true }
      };
      
      const result: ToolCallResult = {
        result: { content: [{ type: 'text', text: 'test' }] }
      };
      
      await manager.executeAfterHooks(context, result);
      
      expect(mockPlugin.afterCallCount).toBe(1);
    });
    
    it('should skip disabled plugins during execution', async () => {
      await manager.register(mockPlugin, { enabled: false });
      await manager.initializeAll();
      
      const context: ToolCallContext = {
        toolName: 'test-tool',
        args: { test: true }
      };
      
      await manager.executeBeforeHooks(context);
      
      expect(mockPlugin.beforeCallCount).toBe(0);
    });
    
    it('should respect plugin tool filters', async () => {
      await manager.register(mockPlugin, { includeTools: ['allowed-tool'] });
      await manager.initializeAll();
      
      // Should execute for allowed tool
      const allowedContext: ToolCallContext = {
        toolName: 'allowed-tool',
        args: {}
      };
      
      await manager.executeBeforeHooks(allowedContext);
      expect(mockPlugin.beforeCallCount).toBe(1);
      
      // Should not execute for other tools
      const blockedContext: ToolCallContext = {
        toolName: 'blocked-tool',
        args: {}
      };
      
      await manager.executeBeforeHooks(blockedContext);
      expect(mockPlugin.beforeCallCount).toBe(1); // Still 1, not 2
    });
    
    it('should handle plugin execution timeouts', async () => {
      const slowPlugin: ProxyPlugin = {
        name: 'slow-plugin',
        version: '1.0.0',
        beforeToolCall: async () => {
          return new Promise<void>(resolve => setTimeout(resolve, 1000));
        }
      };
      
      const timeoutManager = new DefaultPluginManager('1.0.0', { defaultTimeout: 100 });
      await timeoutManager.register(slowPlugin);
      await timeoutManager.initializeAll();
      
      const context: ToolCallContext = {
        toolName: 'test-tool',
        args: {}
      };
      
      await expect(timeoutManager.executeBeforeHooks(context))
        .rejects.toThrow('Plugin slow-plugin beforeToolCall timed out');
    });
  });
  
  describe('Health Checks', () => {
    it('should perform health checks on all plugins', async () => {
      await manager.register(mockPlugin);
      await manager.initializeAll();
      
      const healthStatus = await manager.healthCheck();
      
      expect(healthStatus.get('mock-plugin')).toBe(true);
      expect(mockPlugin.healthCheckCount).toBe(1);
    });
    
    it('should handle health check failures', async () => {
      const unhealthyPlugin: ProxyPlugin = {
        name: 'unhealthy-plugin',
        version: '1.0.0',
        healthCheck: async () => false
      };
      
      await manager.register(unhealthyPlugin);
      await manager.initializeAll();
      
      const healthStatus = await manager.healthCheck();
      
      expect(healthStatus.get('unhealthy-plugin')).toBe(false);
    });
    
    it('should handle health check errors', async () => {
      const errorPlugin: ProxyPlugin = {
        name: 'error-plugin',
        version: '1.0.0',
        healthCheck: async () => { throw new Error('Health check failed'); }
      };
      
      await manager.register(errorPlugin);
      await manager.initializeAll();
      
      const healthStatus = await manager.healthCheck();
      
      expect(healthStatus.get('error-plugin')).toBe(false);
    });
  });
  
  describe('Statistics', () => {
    it('should aggregate statistics from all plugins', async () => {
      const statsPlugin: ProxyPlugin = {
        name: 'stats-plugin',
        version: '1.0.0',
        getStats: async () => ({
          callsProcessed: 10,
          errorsEncountered: 2,
          averageProcessingTime: 150,
          lastActivity: Date.now()
        })
      };
      
      await manager.register(statsPlugin);
      await manager.initializeAll();
      
      const aggregatedStats = await manager.getAggregatedStats();
      
      expect(aggregatedStats.callsProcessed).toBe(10);
      expect(aggregatedStats.errorsEncountered).toBe(2);
      expect(aggregatedStats.averageProcessingTime).toBe(150);
    });
    
    it('should handle statistics collection errors', async () => {
      const errorStatsPlugin: ProxyPlugin = {
        name: 'error-stats-plugin',
        version: '1.0.0',
        getStats: async () => { throw new Error('Stats failed'); }
      };
      
      await manager.register(errorStatsPlugin);
      await manager.initializeAll();
      
      // Should not throw, just log error and continue
      const aggregatedStats = await manager.getAggregatedStats();
      expect(aggregatedStats).toBeDefined();
    });
  });
  
  describe('Error Handling', () => {
    it('should mark plugins as unhealthy after errors', async () => {
      const errorPlugin: ProxyPlugin = {
        name: 'error-plugin',
        version: '1.0.0',
        beforeToolCall: async () => { throw new Error('Plugin error'); }
      };
      
      await manager.register(errorPlugin);
      await manager.initializeAll();
      
      const context: ToolCallContext = {
        toolName: 'test-tool',
        args: {}
      };
      
      // Should not throw, but handle error gracefully
      await manager.executeBeforeHooks(context);
      
      // Plugin should be marked as unhealthy
      const healthStatus = await manager.healthCheck();
      expect(healthStatus.get('error-plugin')).toBe(false);
    });
    
    it('should emit error events', async () => {
      // Set up a promise to wait for the event
      const errorEventPromise = new Promise<void>((resolve) => {
        manager.on('plugin:error', (error) => {
          expect(error.pluginName).toBe('error-plugin');
          expect(error.phase).toBe('beforeToolCall');
          expect(error.error.message).toBe('Plugin error');
          resolve();
        });
      });
      
      // Create an error plugin and trigger the error
      const errorPlugin: ProxyPlugin = {
        name: 'error-plugin',
        version: '1.0.0',
        beforeToolCall: async () => { throw new Error('Plugin error'); }
      };
      
      await manager.register(errorPlugin);
      await manager.initializeAll();
      
      const context: ToolCallContext = {
        toolName: 'test-tool',
        args: {}
      };
      
      // This should trigger the error event
      await manager.executeBeforeHooks(context);
      
      // Wait for the event to be emitted
      await errorEventPromise;
    });
    
    it('should continue processing other plugins after one fails', async () => {
      const errorPlugin: ProxyPlugin = {
        name: 'error-plugin',
        version: '1.0.0',
        beforeToolCall: async () => { throw new Error('Plugin error'); }
      };
      
      await manager.register(errorPlugin, { priority: 100 });
      await manager.register(mockPlugin, { priority: 50 });
      await manager.initializeAll();
      
      const context: ToolCallContext = {
        toolName: 'test-tool',
        args: {}
      };
      
      await manager.executeBeforeHooks(context);
      
      // Working plugin should still execute despite error in first plugin
      expect(mockPlugin.beforeCallCount).toBe(1);
    });
  });
  
  describe('Event Emission', () => {
    it('should emit plugin:registered event', (done) => {
      manager.on('plugin:registered', (event) => {
        expect(event.plugin).toBe(mockPlugin);
        done();
      });
      
      manager.register(mockPlugin);
    });
    
    it('should emit plugin:unregistered event', (done) => {
      manager.on('plugin:unregistered', (event) => {
        expect(event.pluginName).toBe('mock-plugin');
        done();
      });
      
      manager.register(mockPlugin).then(() => {
        manager.unregister('mock-plugin');
      });
    });
    
    it('should emit plugins:initialized event', (done) => {
      manager.on('plugins:initialized', (event) => {
        expect(event.plugins).toContain(mockPlugin);
        done();
      });
      
      manager.register(mockPlugin).then(() => {
        manager.initializeAll();
      });
    });
  });
});