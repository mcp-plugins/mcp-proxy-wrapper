/**
 * @file Client-Side Plugin System
 * @version 2.0.0
 * @status STABLE - Thread-safe plugin system for client-side proxy
 * 
 * Implements a comprehensive plugin system specifically designed for client-side
 * MCP proxy operations. This system provides thread-safe execution, lifecycle
 * management, and performance monitoring for plugins that process tool calls
 * in the universal proxy architecture.
 */

import { EventEmitter } from 'events';
// import { JsonRpcMessage } from '../interfaces/connection.js';
import { ToolCallContext, ToolCallResult, ProxyPlugin, PluginContext } from '../interfaces/proxy-hooks.js';
import { createLogger } from '../utils/logger.js';

/**
 * Plugin execution state
 */
export enum PluginExecutionState {
  IDLE = 'idle',
  INITIALIZING = 'initializing',
  ACTIVE = 'active',
  PAUSED = 'paused',
  ERROR = 'error',
  SHUTDOWN = 'shutdown'
}

/**
 * Plugin execution metrics
 */
export interface PluginMetrics {
  /** Total executions */
  totalExecutions: number;
  
  /** Successful executions */
  successfulExecutions: number;
  
  /** Failed executions */
  failedExecutions: number;
  
  /** Average execution time in milliseconds */
  averageExecutionTime: number;
  
  /** Last execution timestamp */
  lastExecution?: Date;
  
  /** Last error */
  lastError?: Error;
  
  /** Memory usage statistics */
  memoryUsage: {
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
}

/**
 * Plugin execution context with enhanced metadata
 */
export interface ClientPluginContext extends PluginContext {
  /** Unique execution ID */
  executionId: string;
  
  /** Plugin execution state */
  executionState: PluginExecutionState;
  
  /** Connection information */
  connection: {
    id: string;
    transport: string;
    state: string;
  };
  
  /** Proxy metadata */
  proxy: {
    version: string;
    mode: 'client' | 'server';
    instanceId: string;
  };
}

/**
 * Plugin registration with enhanced options
 */
export interface ClientPluginRegistration {
  /** The plugin instance */
  plugin: ProxyPlugin;
  
  /** Plugin configuration */
  config?: Record<string, any>;
  
  /** Execution priority (higher = earlier execution) */
  priority: number;
  
  /** Whether plugin is enabled */
  enabled: boolean;
  
  /** Concurrency limit for this plugin */
  concurrencyLimit: number;
  
  /** Execution timeout in milliseconds */
  timeout: number;
  
  /** Whether to isolate plugin execution */
  isolated: boolean;
  
  /** Plugin-specific metadata */
  metadata: Record<string, any>;
}

/**
 * Plugin execution queue item
 */
interface ExecutionQueueItem {
  executionId: string;
  pluginName: string;
  context: ClientPluginContext;
  resolve: (result: any) => void;
  reject: (error: Error) => void;
  createdAt: Date;
  timeout?: NodeJS.Timeout;
}

/**
 * Thread-safe plugin manager for client-side proxy operations
 */
export class ClientPluginManager extends EventEmitter {
  private plugins = new Map<string, ClientPluginRegistration>();
  private metrics = new Map<string, PluginMetrics>();
  private executionQueue = new Map<string, ExecutionQueueItem[]>();
  private activeExecutions = new Map<string, Set<string>>();
  private executionStates = new Map<string, PluginExecutionState>();
  private logger = createLogger({ level: 'info', prefix: 'CLIENT-PLUGIN-MANAGER' });
  private shutdownRequested = false;
  private instanceId: string;
  
  constructor(
    private proxyVersion: string,
    private globalConfig: Record<string, any> = {},
    private options: {
      /** Maximum concurrent executions across all plugins */
      maxConcurrentExecutions?: number;
      
      /** Default plugin timeout */
      defaultTimeout?: number;
      
      /** Enable performance monitoring */
      enableMetrics?: boolean;
      
      /** Queue processing interval */
      queueProcessingInterval?: number;
      
      /** Memory monitoring interval */
      memoryMonitoringInterval?: number;
      
      /** Debug logging */
      debug?: boolean;
    } = {}
  ) {
    super();
    
    this.instanceId = `client_plugin_manager_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    this.logger = createLogger({
      level: this.options.debug ? 'debug' : 'info',
      prefix: `CLIENT-PLUGIN-MANAGER:${this.instanceId.substring(-8)}`
    });
    
    // Set up queue processing
    if (this.options.queueProcessingInterval) {
      setInterval(() => this.processExecutionQueues(), this.options.queueProcessingInterval);
    }
    
    // Set up memory monitoring
    if (this.options.memoryMonitoringInterval && this.options.enableMetrics) {
      setInterval(() => this.updateMemoryMetrics(), this.options.memoryMonitoringInterval);
    }
    
    this.logger.info('Client Plugin Manager initialized', {
      instanceId: this.instanceId,
      proxyVersion: this.proxyVersion,
      options: this.options
    });
  }
  
  /**
   * Register a plugin with the manager
   */
  async register(
    plugin: ProxyPlugin, 
    config?: Record<string, any>,
    options: {
      priority?: number;
      enabled?: boolean;
      concurrencyLimit?: number;
      timeout?: number;
      isolated?: boolean;
      metadata?: Record<string, any>;
    } = {}
  ): Promise<void> {
    if (this.shutdownRequested) {
      throw new Error('Cannot register plugins during shutdown');
    }
    
    const pluginName = plugin.name;
    
    if (this.plugins.has(pluginName)) {
      throw new Error(`Plugin '${pluginName}' is already registered`);
    }
    
    this.logger.debug(`Registering plugin: ${pluginName}`, {
      version: plugin.version,
      priority: options.priority || 0,
      enabled: options.enabled !== false
    });
    
    // Create registration
    const registration: ClientPluginRegistration = {
      plugin,
      config: { ...this.globalConfig, ...config },
      priority: options.priority || 0,
      enabled: options.enabled !== false,
      concurrencyLimit: options.concurrencyLimit || 10,
      timeout: options.timeout || this.options.defaultTimeout || 30000,
      isolated: options.isolated || false,
      metadata: options.metadata || {}
    };
    
    // Initialize plugin
    if (plugin.initialize) {
      this.executionStates.set(pluginName, PluginExecutionState.INITIALIZING);
      
      try {
        const initContext = {
          wrapperVersion: this.proxyVersion,
          loadedPlugins: Array.from(this.plugins.values()).map(reg => reg.plugin),
          globalConfig: this.globalConfig,
          logger: this.logger
        };
        await plugin.initialize(initContext);
        this.logger.info(`Plugin initialized: ${pluginName}`);
      } catch (error) {
        this.executionStates.set(pluginName, PluginExecutionState.ERROR);
        throw new Error(`Failed to initialize plugin '${pluginName}': ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    
    // Register plugin
    this.plugins.set(pluginName, registration);
    this.executionStates.set(pluginName, PluginExecutionState.ACTIVE);
    this.executionQueue.set(pluginName, []);
    this.activeExecutions.set(pluginName, new Set());
    
    // Initialize metrics
    if (this.options.enableMetrics) {
      this.metrics.set(pluginName, {
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        averageExecutionTime: 0,
        memoryUsage: {
          heapUsed: 0,
          heapTotal: 0,
          external: 0
        }
      });
    }
    
    this.emit('pluginRegistered', { pluginName, registration });
    this.logger.info(`Plugin registered: ${pluginName}`, {
      totalPlugins: this.plugins.size
    });
  }
  
  /**
   * Unregister a plugin
   */
  async unregister(pluginName: string): Promise<void> {
    const registration = this.plugins.get(pluginName);
    if (!registration) {
      return;
    }
    
    this.logger.info(`Unregistering plugin: ${pluginName}`);
    
    // Set state to shutdown
    this.executionStates.set(pluginName, PluginExecutionState.SHUTDOWN);
    
    // Wait for active executions to complete
    const activeExecs = this.activeExecutions.get(pluginName);
    if (activeExecs && activeExecs.size > 0) {
      this.logger.debug(`Waiting for ${activeExecs.size} active executions to complete`);
      
      // Wait up to 10 seconds for active executions
      const maxWait = 10000;
      const start = Date.now();
      
      while (activeExecs.size > 0 && (Date.now() - start) < maxWait) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      
      if (activeExecs.size > 0) {
        this.logger.warn(`Force stopping ${activeExecs.size} active executions for plugin: ${pluginName}`);
      }
    }
    
    // Cleanup plugin
    if (registration.plugin.destroy) {
      try {
        await registration.plugin.destroy();
      } catch (error) {
        this.logger.error(`Error during plugin cleanup for ${pluginName}:`, error);
      }
    }
    
    // Remove from collections
    this.plugins.delete(pluginName);
    this.executionStates.delete(pluginName);
    this.executionQueue.delete(pluginName);
    this.activeExecutions.delete(pluginName);
    this.metrics.delete(pluginName);
    
    this.emit('pluginUnregistered', { pluginName });
    this.logger.info(`Plugin unregistered: ${pluginName}`);
  }
  
  /**
   * Execute beforeToolCall hooks for all registered plugins
   */
  async executeBeforeHooks(context: ToolCallContext): Promise<ToolCallResult | null> {
    if (this.shutdownRequested) {
      return null;
    }
    
    const clientContext = this.createClientContext(context, 'beforeToolCall');
    
    // Get enabled plugins sorted by priority
    const enabledPlugins = this.getEnabledPluginsSortedByPriority();
    
    for (const registration of enabledPlugins) {
      if (!registration.plugin.beforeToolCall) continue;
      
      try {
        const result = await this.executePluginHook(
          registration,
          'beforeToolCall',
          clientContext
        );
        
        // If plugin returns a result, short-circuit the execution
        if (result) {
          this.logger.debug(`Plugin ${registration.plugin.name} short-circuited tool call`, {
            toolName: context.toolName,
            executionId: clientContext.executionId
          });
          return result;
        }
      } catch (error) {
        this.logger.error(`Error in beforeToolCall hook for plugin ${registration.plugin.name}:`, error);
        
        // Update metrics
        this.updatePluginMetrics(registration.plugin.name, false, error instanceof Error ? error : new Error(String(error)));
        
        // Continue with other plugins unless this is a critical error
        if (error instanceof Error && error.message.includes('CRITICAL')) {
          throw error;
        }
      }
    }
    
    return null;
  }
  
  /**
   * Execute afterToolCall hooks for all registered plugins
   */
  async executeAfterHooks(context: ToolCallContext, result: ToolCallResult): Promise<ToolCallResult> {
    if (this.shutdownRequested) {
      return result;
    }
    
    const clientContext = this.createClientContext(context, 'afterToolCall');
    let currentResult = result;
    
    // Get enabled plugins sorted by priority
    const enabledPlugins = this.getEnabledPluginsSortedByPriority();
    
    for (const registration of enabledPlugins) {
      if (!registration.plugin.afterToolCall) continue;
      
      try {
        const pluginResult = await this.executePluginHook(
          registration,
          'afterToolCall',
          clientContext,
          currentResult
        );
        
        if (pluginResult) {
          currentResult = pluginResult;
        }
      } catch (error) {
        this.logger.error(`Error in afterToolCall hook for plugin ${registration.plugin.name}:`, error);
        
        // Update metrics
        this.updatePluginMetrics(registration.plugin.name, false, error instanceof Error ? error : new Error(String(error)));
        
        // Continue with other plugins unless this is a critical error
        if (error instanceof Error && error.message.includes('CRITICAL')) {
          throw error;
        }
      }
    }
    
    return currentResult;
  }
  
  /**
   * Get plugin by name
   */
  getPlugin(name: string): ProxyPlugin | null {
    const registration = this.plugins.get(name);
    return registration ? registration.plugin : null;
  }
  
  /**
   * Get all registered plugins
   */
  getPlugins(): ProxyPlugin[] {
    return Array.from(this.plugins.values()).map(reg => reg.plugin);
  }
  
  /**
   * Get plugin metrics
   */
  getPluginMetrics(pluginName?: string): Map<string, PluginMetrics> | PluginMetrics | null {
    if (pluginName) {
      return this.metrics.get(pluginName) || null;
    }
    return new Map(this.metrics);
  }
  
  /**
   * Get manager statistics
   */
  getStats() {
    const totalExecutions = Array.from(this.metrics.values())
      .reduce((sum, metrics) => sum + metrics.totalExecutions, 0);
    
    const totalErrors = Array.from(this.metrics.values())
      .reduce((sum, metrics) => sum + metrics.failedExecutions, 0);
    
    return {
      instanceId: this.instanceId,
      totalPlugins: this.plugins.size,
      enabledPlugins: Array.from(this.plugins.values()).filter(reg => reg.enabled).length,
      totalExecutions,
      totalErrors,
      errorRate: totalExecutions > 0 ? (totalErrors / totalExecutions) * 100 : 0,
      activeExecutions: Array.from(this.activeExecutions.values())
        .reduce((sum, set) => sum + set.size, 0),
      queuedExecutions: Array.from(this.executionQueue.values())
        .reduce((sum, queue) => sum + queue.length, 0)
    };
  }
  
  /**
   * Shutdown the plugin manager
   */
  async shutdown(): Promise<void> {
    if (this.shutdownRequested) {
      return;
    }
    
    this.shutdownRequested = true;
    this.logger.info('Shutting down Plugin Manager', {
      totalPlugins: this.plugins.size
    });
    
    // Unregister all plugins
    const pluginNames = Array.from(this.plugins.keys());
    for (const pluginName of pluginNames) {
      await this.unregister(pluginName);
    }
    
    // Clear collections
    this.plugins.clear();
    this.metrics.clear();
    this.executionQueue.clear();
    this.activeExecutions.clear();
    this.executionStates.clear();
    
    this.emit('shutdown');
    this.logger.info('Plugin Manager shutdown complete');
  }
  
  /**
   * Create a client-specific plugin context
   */
  private createClientContext(
    baseContext: ToolCallContext, 
    _phase: 'beforeToolCall' | 'afterToolCall'
  ): ClientPluginContext {
    const executionId = `exec_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    
    return {
      ...baseContext,
      pluginData: new Map<string, any>(),
      requestId: executionId,
      startTime: Date.now(),
      executionId,
      executionState: PluginExecutionState.ACTIVE,
      connection: {
        id: 'client_proxy_connection',
        transport: 'client-proxy',
        state: 'connected'
      },
      proxy: {
        version: this.proxyVersion,
        mode: 'client',
        instanceId: this.instanceId
      }
    };
  }
  
  /**
   * Execute a plugin hook with concurrency control and error handling
   */
  private async executePluginHook(
    registration: ClientPluginRegistration,
    hookType: 'beforeToolCall' | 'afterToolCall',
    context: ClientPluginContext,
    result?: ToolCallResult
  ): Promise<ToolCallResult | null> {
    const pluginName = registration.plugin.name;
    const activeExecs = this.activeExecutions.get(pluginName)!;
    
    // Check concurrency limit
    if (activeExecs.size >= registration.concurrencyLimit) {
      this.logger.warn(`Concurrency limit reached for plugin ${pluginName}, queuing execution`);
      return this.queueExecution(registration, hookType, context, result);
    }
    
    const startTime = Date.now();
    activeExecs.add(context.executionId);
    
    try {
      this.logger.debug(`Executing ${hookType} for plugin ${pluginName}`, {
        executionId: context.executionId,
        activeExecutions: activeExecs.size
      });
      
      let hookResult: ToolCallResult | null = null;
      
      // Execute with timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Plugin execution timeout: ${registration.timeout}ms`));
        }, registration.timeout);
      });
      
      const executionPromise = hookType === 'beforeToolCall'
        ? registration.plugin.beforeToolCall!(context)
        : registration.plugin.afterToolCall!(context, result!);
      
      const promiseResult = await Promise.race([executionPromise, timeoutPromise]);
      hookResult = promiseResult || null;
      
      // Update metrics
      const executionTime = Date.now() - startTime;
      this.updatePluginMetrics(pluginName, true, undefined, executionTime);
      
      return hookResult;
      
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.logger.error(`Plugin execution failed for ${pluginName}:`, error);
      
      // Update metrics
      this.updatePluginMetrics(pluginName, false, error instanceof Error ? error : new Error(String(error)), executionTime);
      
      throw error;
    } finally {
      activeExecs.delete(context.executionId);
    }
  }
  
  /**
   * Queue an execution when concurrency limit is reached
   */
  private async queueExecution(
    registration: ClientPluginRegistration,
    hookType: 'beforeToolCall' | 'afterToolCall',
    context: ClientPluginContext,
    _result?: ToolCallResult
  ): Promise<ToolCallResult | null> {
    const pluginName = registration.plugin.name;
    const queue = this.executionQueue.get(pluginName)!;
    
    return new Promise<ToolCallResult | null>((resolve, reject) => {
      const queueItem: ExecutionQueueItem = {
        executionId: context.executionId,
        pluginName,
        context,
        resolve,
        reject,
        createdAt: new Date()
      };
      
      // Set timeout for queued item
      queueItem.timeout = setTimeout(() => {
        // Remove from queue
        const index = queue.indexOf(queueItem);
        if (index >= 0) {
          queue.splice(index, 1);
        }
        reject(new Error('Queued execution timeout'));
      }, registration.timeout);
      
      queue.push(queueItem);
    });
  }
  
  /**
   * Process execution queues for all plugins
   */
  private processExecutionQueues(): void {
    for (const [pluginName, queue] of this.executionQueue) {
      if (queue.length === 0) continue;
      
      const registration = this.plugins.get(pluginName);
      if (!registration || !registration.enabled) continue;
      
      const activeExecs = this.activeExecutions.get(pluginName)!;
      const availableSlots = registration.concurrencyLimit - activeExecs.size;
      
      if (availableSlots <= 0) continue;
      
      // Process queued executions
      const toProcess = queue.splice(0, availableSlots);
      
      for (const item of toProcess) {
        // Clear timeout
        if (item.timeout) {
          clearTimeout(item.timeout);
        }
        
        // Execute the queued item
        this.executePluginHook(registration, 'beforeToolCall', item.context)
          .then(item.resolve)
          .catch(item.reject);
      }
    }
  }
  
  /**
   * Update plugin metrics
   */
  private updatePluginMetrics(
    pluginName: string, 
    success: boolean, 
    error?: Error, 
    executionTime?: number
  ): void {
    if (!this.options.enableMetrics) return;
    
    const metrics = this.metrics.get(pluginName);
    if (!metrics) return;
    
    metrics.totalExecutions++;
    metrics.lastExecution = new Date();
    
    if (success) {
      metrics.successfulExecutions++;
    } else {
      metrics.failedExecutions++;
      if (error) {
        metrics.lastError = error;
      }
    }
    
    if (executionTime !== undefined) {
      // Update running average
      const totalTime = metrics.averageExecutionTime * (metrics.totalExecutions - 1) + executionTime;
      metrics.averageExecutionTime = totalTime / metrics.totalExecutions;
    }
  }
  
  /**
   * Update memory metrics for all plugins
   */
  private updateMemoryMetrics(): void {
    if (!this.options.enableMetrics) return;
    
    const memUsage = process.memoryUsage();
    
    for (const [_pluginName, metrics] of this.metrics) {
      metrics.memoryUsage = {
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external
      };
    }
  }
  
  /**
   * Get enabled plugins sorted by priority
   */
  private getEnabledPluginsSortedByPriority(): ClientPluginRegistration[] {
    return Array.from(this.plugins.values())
      .filter(reg => reg.enabled && this.executionStates.get(reg.plugin.name) === PluginExecutionState.ACTIVE)
      .sort((a, b) => b.priority - a.priority);
  }
}