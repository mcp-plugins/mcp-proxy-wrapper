/**
 * @file Plugin Manager Implementation
 * @version 1.0.0
 * 
 * Manages plugin registration, execution order, dependency resolution,
 * health checks, and lifecycle management for the MCP Proxy Wrapper.
 */

import { EventEmitter } from 'events';
import { 
  ProxyPlugin, 
  PluginManager, 
  PluginConfig, 
  PluginContext, 
  PluginInitContext,
  PluginEvents,
  PluginError,
  PluginStats,
  PluginPhase
} from '../interfaces/plugin.js';
import { ToolCallContext, ToolCallResult } from '../interfaces/proxy-hooks.js';
import { createLogger } from './logger.js';

/**
 * Default plugin configuration
 */
const DEFAULT_PLUGIN_CONFIG: Required<PluginConfig> = {
  enabled: true,
  priority: 100,
  options: {},
  includeTools: [],
  excludeTools: [],
  debug: false
};

/**
 * Plugin registration entry
 */
interface PluginEntry {
  plugin: ProxyPlugin;
  config: Required<PluginConfig>;
  initialized: boolean;
  healthy: boolean;
  lastHealthCheck: number;
}

/**
 * Plugin manager implementation
 */
export class DefaultPluginManager extends EventEmitter implements PluginManager {
  private plugins = new Map<string, PluginEntry>();
  private logger = createLogger({ level: 'info', prefix: 'PLUGIN-MANAGER' });
  private healthCheckInterval?: NodeJS.Timeout;
  private wrapperVersion: string;
  private globalConfig: Record<string, any>;
  
  constructor(wrapperVersion: string, globalConfig: Record<string, any> = {}) {
    super();
    this.wrapperVersion = wrapperVersion;
    this.globalConfig = globalConfig;
  }
  
  /**
   * Register a plugin with the manager
   */
  async register(plugin: ProxyPlugin, config?: PluginConfig): Promise<void> {
    // Validate plugin
    this.validatePlugin(plugin);
    
    // Check if plugin already registered
    if (this.plugins.has(plugin.name)) {
      throw new Error(`Plugin '${plugin.name}' is already registered`);
    }
    
    // Merge configuration
    const finalConfig: Required<PluginConfig> = {
      ...DEFAULT_PLUGIN_CONFIG,
      ...plugin.config,
      ...config
    };
    
    // Check plugin limits
    if (this.globalConfig.maxPlugins && this.plugins.size >= this.globalConfig.maxPlugins) {
      throw new Error(`Maximum number of plugins (${this.globalConfig.maxPlugins}) exceeded`);
    }
    
    // Create plugin entry
    const entry: PluginEntry = {
      plugin,
      config: finalConfig,
      initialized: false,
      healthy: true,
      lastHealthCheck: Date.now()
    };
    
    this.plugins.set(plugin.name, entry);
    this.logger.info(`Registered plugin: ${plugin.name} v${plugin.version}`);
    
    // Emit event
    this.emit('plugin:registered', { plugin });
  }
  
  /**
   * Unregister a plugin
   */
  async unregister(pluginName: string): Promise<void> {
    const entry = this.plugins.get(pluginName);
    if (!entry) {
      throw new Error(`Plugin '${pluginName}' is not registered`);
    }
    
    // Call destroy hook if available
    if (entry.plugin.destroy) {
      try {
        await entry.plugin.destroy();
      } catch (error) {
        this.logger.error(`Error destroying plugin ${pluginName}:`, error);
      }
    }
    
    this.plugins.delete(pluginName);
    this.logger.info(`Unregistered plugin: ${pluginName}`);
    
    // Emit event
    this.emit('plugin:unregistered', { pluginName });
  }
  
  /**
   * Get plugin by name
   */
  getPlugin(name: string): ProxyPlugin | undefined {
    return this.plugins.get(name)?.plugin;
  }
  
  /**
   * Get all registered plugins
   */
  getAllPlugins(): ProxyPlugin[] {
    return Array.from(this.plugins.values()).map(entry => entry.plugin);
  }
  
  /**
   * Initialize all plugins
   */
  async initializeAll(): Promise<void> {
    const loadedPlugins = this.getAllPlugins();
    
    // Validate dependencies first
    await this.validateDependencies();
    
    // Initialize plugins in dependency order
    const initOrder = this.resolveDependencyOrder();
    
    for (const plugin of initOrder) {
      const entry = this.plugins.get(plugin.name)!;
      
      if (entry.config.enabled && !entry.initialized) {
        try {
          const initContext: PluginInitContext = {
            wrapperVersion: this.wrapperVersion,
            loadedPlugins,
            globalConfig: this.globalConfig,
            logger: {
              debug: (msg, ...args) => this.logger.debug(`[${plugin.name}] ${msg}`, ...args),
              info: (msg, ...args) => this.logger.info(`[${plugin.name}] ${msg}`, ...args),
              warn: (msg, ...args) => this.logger.warn(`[${plugin.name}] ${msg}`, ...args),
              error: (msg, ...args) => this.logger.error(`[${plugin.name}] ${msg}`, ...args)
            }
          };
          
          if (plugin.initialize) {
            await this.executeWithTimeout(
              () => plugin.initialize!(initContext),
              this.globalConfig.defaultTimeout || 30000,
              `Plugin ${plugin.name} initialization`
            );
          }
          
          entry.initialized = true;
          this.logger.info(`Initialized plugin: ${plugin.name}`);
          
        } catch (error) {
          this.logger.error(`Failed to initialize plugin ${plugin.name}:`, error);
          entry.healthy = false;
          
          const pluginError: PluginError = {
            pluginName: plugin.name,
            phase: 'initialize',
            error: error as Error,
            context: {} as PluginContext // No context during init
          };
          
          this.emit('plugin:error', pluginError);
          throw error;
        }
      }
    }
    
    // Start health checks if enabled
    if (this.globalConfig.enableHealthChecks) {
      this.startHealthChecks();
    }
    
    this.emit('plugins:initialized', { plugins: loadedPlugins });
  }
  
  /**
   * Execute beforeToolCall hooks for all plugins
   */
  async executeBeforeHooks(context: ToolCallContext): Promise<void | ToolCallResult> {
    const pluginContext = this.createPluginContext(context);
    this.emit('tool:before', pluginContext);
    
    const plugins = this.getExecutionOrder().filter(p => 
      this.plugins.get(p.name)?.config.enabled &&
      this.shouldPluginProcessTool(p.name, context.toolName)
    );
    
    for (const plugin of plugins) {
      try {
        if (plugin.beforeToolCall) {
          const result = await this.executeWithTimeout(
            () => plugin.beforeToolCall!(pluginContext),
            this.globalConfig.defaultTimeout || 10000,
            `Plugin ${plugin.name} beforeToolCall`
          );
          
          if (result) {
            this.logger.debug(`Plugin ${plugin.name} short-circuited tool call`);
            return result;
          }
        }
      } catch (error) {
        await this.handlePluginError(plugin.name, 'beforeToolCall', error as Error, pluginContext);
        
        // Continue with other plugins unless this was a critical error
        if (this.isCriticalError(error as Error)) {
          throw error;
        }
      }
    }
  }
  
  /**
   * Execute afterToolCall hooks for all plugins
   */
  async executeAfterHooks(context: ToolCallContext, result: ToolCallResult): Promise<ToolCallResult> {
    const pluginContext = this.createPluginContext(context);
    let currentResult = result;
    
    const plugins = this.getExecutionOrder().filter(p => 
      this.plugins.get(p.name)?.config.enabled &&
      this.shouldPluginProcessTool(p.name, context.toolName)
    );
    
    for (const plugin of plugins) {
      try {
        if (plugin.afterToolCall) {
          currentResult = await this.executeWithTimeout(
            () => plugin.afterToolCall!(pluginContext, currentResult),
            this.globalConfig.defaultTimeout || 10000,
            `Plugin ${plugin.name} afterToolCall`
          );
        }
      } catch (error) {
        await this.handlePluginError(plugin.name, 'afterToolCall', error as Error, pluginContext);
        
        // Continue with other plugins unless this was a critical error
        if (this.isCriticalError(error as Error)) {
          throw error;
        }
      }
    }
    
    this.emit('tool:after', { context: pluginContext, result: currentResult });
    return currentResult;
  }
  
  /**
   * Validate plugin dependencies
   */
  async validateDependencies(): Promise<boolean> {
    const allPlugins = this.getAllPlugins();
    const pluginNames = new Set(allPlugins.map(p => p.name));
    
    for (const plugin of allPlugins) {
      if (plugin.metadata?.dependencies) {
        for (const dep of plugin.metadata.dependencies) {
          if (!pluginNames.has(dep)) {
            throw new Error(`Plugin '${plugin.name}' requires dependency '${dep}' which is not loaded`);
          }
        }
      }
    }
    
    return true;
  }
  
  /**
   * Get plugin execution order based on priority and dependencies
   */
  getExecutionOrder(): ProxyPlugin[] {
    const plugins = Array.from(this.plugins.values())
      .filter(entry => entry.config.enabled)
      .map(entry => entry.plugin);
    
    // Sort by priority (higher priority first)
    return plugins.sort((a, b) => {
      const priorityA = this.plugins.get(a.name)?.config.priority || 100;
      const priorityB = this.plugins.get(b.name)?.config.priority || 100;
      return priorityB - priorityA;
    });
  }
  
  /**
   * Execute health checks on all plugins
   */
  async healthCheck(): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();
    
    for (const [name, entry] of this.plugins) {
      if (entry.config.enabled && entry.plugin.healthCheck) {
        try {
          const healthy = await entry.plugin.healthCheck();
          entry.healthy = healthy;
          entry.lastHealthCheck = Date.now();
          results.set(name, healthy);
          
          if (!healthy) {
            this.logger.warn(`Plugin ${name} failed health check`);
          }
        } catch (error) {
          this.logger.error(`Health check failed for plugin ${name}:`, error);
          entry.healthy = false;
          results.set(name, false);
        }
      } else {
        results.set(name, entry.healthy);
      }
    }
    
    return results;
  }
  
  /**
   * Get aggregated statistics from all plugins
   */
  async getAggregatedStats(): Promise<PluginStats> {
    const stats: PluginStats = {
      callsProcessed: 0,
      errorsEncountered: 0,
      averageProcessingTime: 0,
      lastActivity: 0
    };
    
    let totalProcessingTime = 0;
    let pluginCount = 0;
    
    for (const [name, entry] of this.plugins) {
      if (entry.plugin.getStats) {
        try {
          const pluginStats = await entry.plugin.getStats();
          stats.callsProcessed += pluginStats.callsProcessed;
          stats.errorsEncountered += pluginStats.errorsEncountered;
          totalProcessingTime += pluginStats.averageProcessingTime * pluginStats.callsProcessed;
          stats.lastActivity = Math.max(stats.lastActivity, pluginStats.lastActivity);
          pluginCount++;
        } catch (error) {
          this.logger.error(`Failed to get stats for plugin ${name}:`, error);
        }
      }
    }
    
    if (stats.callsProcessed > 0) {
      stats.averageProcessingTime = totalProcessingTime / stats.callsProcessed;
    }
    
    return stats;
  }
  
  /**
   * Destroy all plugins and cleanup
   */
  async destroy(): Promise<void> {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }
    
    const plugins = Array.from(this.plugins.keys());
    for (const pluginName of plugins) {
      await this.unregister(pluginName);
    }
  }
  
  // Private helper methods
  
  private validatePlugin(plugin: ProxyPlugin): void {
    if (!plugin.name || typeof plugin.name !== 'string') {
      throw new Error('Plugin must have a valid name');
    }
    
    if (!plugin.version || typeof plugin.version !== 'string') {
      throw new Error('Plugin must have a valid version');
    }
    
    // Validate semver format (basic check)
    if (!/^\d+\.\d+\.\d+/.test(plugin.version)) {
      throw new Error('Plugin version must follow semantic versioning (x.y.z)');
    }
  }
  
  private createPluginContext(context: ToolCallContext): PluginContext {
    return {
      ...context,
      pluginData: new Map(),
      requestId: Math.random().toString(36).substr(2, 9),
      startTime: Date.now(),
      previousResults: new Map()
    };
  }
  
  private shouldPluginProcessTool(pluginName: string, toolName: string): boolean {
    const entry = this.plugins.get(pluginName);
    if (!entry || !entry.healthy) return false;
    
    const { includeTools, excludeTools } = entry.config;
    
    // Check exclusions first
    if (excludeTools.length > 0 && excludeTools.includes(toolName)) {
      return false;
    }
    
    // Check inclusions (empty means include all)
    if (includeTools.length > 0) {
      return includeTools.includes(toolName);
    }
    
    return true;
  }
  
  private async executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeoutMs: number,
    description: string
  ): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`${description} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      
      fn()
        .then(result => {
          clearTimeout(timeout);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timeout);
          reject(error);
        });
    });
  }
  
  private async handlePluginError(
    pluginName: string,
    phase: PluginPhase,
    error: Error,
    context: PluginContext
  ): Promise<void> {
    const entry = this.plugins.get(pluginName);
    if (entry) {
      entry.healthy = false;
    }
    
    const pluginError: PluginError = {
      pluginName,
      phase,
      error,
      context
    };
    
    this.logger.error(`Plugin ${pluginName} error in ${phase}:`, error);
    this.emit('plugin:error', pluginError);
    
    // Try to call plugin's error handler
    const plugin = entry?.plugin;
    if (plugin?.onError) {
      try {
        await plugin.onError(pluginError);
      } catch (handlerError) {
        this.logger.error(`Plugin ${pluginName} error handler failed:`, handlerError);
      }
    }
  }
  
  private isCriticalError(error: Error): boolean {
    // Define what constitutes a critical error that should stop processing
    return error.message.includes('critical') || 
           error.message.includes('fatal') ||
           error.message.includes('security');
  }
  
  private resolveDependencyOrder(): ProxyPlugin[] {
    // Simple topological sort for dependency resolution
    const plugins = this.getAllPlugins();
    const resolved: ProxyPlugin[] = [];
    const resolving = new Set<string>();
    
    const resolve = (plugin: ProxyPlugin) => {
      if (resolving.has(plugin.name)) {
        throw new Error(`Circular dependency detected: ${plugin.name}`);
      }
      
      if (resolved.find(p => p.name === plugin.name)) {
        return; // Already resolved
      }
      
      resolving.add(plugin.name);
      
      // Resolve dependencies first
      if (plugin.metadata?.dependencies) {
        for (const depName of plugin.metadata.dependencies) {
          const depPlugin = plugins.find(p => p.name === depName);
          if (depPlugin) {
            resolve(depPlugin);
          }
        }
      }
      
      resolving.delete(plugin.name);
      resolved.push(plugin);
    };
    
    for (const plugin of plugins) {
      resolve(plugin);
    }
    
    return resolved;
  }
  
  private startHealthChecks(): void {
    const interval = this.globalConfig.healthCheckInterval || 60000; // 1 minute default
    
    this.healthCheckInterval = setInterval(async () => {
      await this.healthCheck();
    }, interval);
  }
}