/**
 * @file Hook Execution Manager
 * @version 2.0.0
 * @status STABLE - DO NOT MODIFY WITHOUT TESTS
 * @lastModified 2024-12-14
 * 
 * Manages hook execution with support for parallel execution,
 * dependencies, retries, and performance monitoring.
 */

import { createLogger } from './logger.js';
import {
  IHookExecutionManager,
  ExecutionMode,
  HookExecutionConfig,
  ExecutionContext,
  ExecutionResult,
  ExecutionStats,
  HookCondition,
  PerformanceConfig
} from '../experimental/v2-design/execution.js';

/**
 * Hook function type
 */
type HookFunction = (context: ExecutionContext) => Promise<any>;

interface RegisteredHook {
  id: string;
  fn: HookFunction;
  config: HookExecutionConfig;
  stats: ExecutionStats;
}

/**
 * Default implementation of hook execution manager
 */
export class HookExecutionManager implements IHookExecutionManager {
  private readonly logger = createLogger({
    level: 'info',
    prefix: 'HOOK-EXEC'
  });
  
  private hooks = new Map<string, RegisteredHook>();
  private sharedState = new Map<string, any>();
  private executionHistory = new Map<string, ExecutionResult[]>();
  
  constructor(
    private readonly performanceConfig: PerformanceConfig = {
      enabled: true,
      samplingRate: 1.0,
      maxRecords: 1000,
      trackMemory: true,
      trackExecutionTime: true,
      thresholds: {
        executionTimeMs: 5000,
        memoryUsageBytes: 100 * 1024 * 1024 // 100MB
      }
    }
  ) {}
  
  /**
   * Register a hook function
   */
  registerHook(id: string, fn: HookFunction, config: HookExecutionConfig): void {
    if (this.hooks.has(id)) {
      throw new Error(`Hook with id '${id}' is already registered`);
    }
    
    const hook: RegisteredHook = {
      id,
      fn,
      config,
      stats: {
        hookId: id,
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        averageExecutionTimeMs: 0,
        p95ExecutionTimeMs: 0,
        totalMemoryUsageBytes: 0
      }
    };
    
    this.hooks.set(id, hook);
    this.logger.debug(`Registered hook: ${id}`, { config });
  }
  
  /**
   * Unregister a hook
   */
  unregisterHook(id: string): boolean {
    const removed = this.hooks.delete(id);
    if (removed) {
      this.executionHistory.delete(id);
      this.logger.debug(`Unregistered hook: ${id}`);
    }
    return removed;
  }
  
  /**
   * Execute a single hook with the given configuration
   */
  async executeHook(
    hookId: string,
    context: ExecutionContext,
    config?: HookExecutionConfig
  ): Promise<ExecutionResult> {
    const hook = this.hooks.get(hookId);
    if (!hook) {
      throw new Error(`Hook '${hookId}' not found`);
    }
    
    const effectiveConfig = config || hook.config;
    
    // Check conditions
    if (effectiveConfig.conditions && !await this.evaluateConditions(effectiveConfig.conditions, context)) {
      return {
        success: true,
        shortCircuited: true,
        durationMs: 0,
        metadata: { skipped: true, reason: 'conditions not met' }
      };
    }
    
    const startTime = Date.now();
    const startMemory = this.performanceConfig.trackMemory ? process.memoryUsage().heapUsed : 0;
    
    try {
      // Create execution context with shared state access
      const executionContext: ExecutionContext = {
        ...context,
        hookId,
        sharedState: Object.fromEntries(this.sharedState),
        updateSharedState: (key: string, value: any) => {
          this.sharedState.set(key, value);
        }
      };
      
      // Execute with timeout
      const result = await this.executeWithTimeout(
        hook.fn(executionContext),
        effectiveConfig.timeout || 30000
      );
      
      const endTime = Date.now();
      const endMemory = this.performanceConfig.trackMemory ? process.memoryUsage().heapUsed : 0;
      const durationMs = endTime - startTime;
      const memoryDelta = endMemory - startMemory;
      
      const executionResult: ExecutionResult = {
        success: true,
        result,
        durationMs,
        memoryDeltaBytes: memoryDelta,
        shortCircuited: false
      };
      
      // Update statistics
      this.updateStats(hook, executionResult);
      
      // Check performance thresholds
      this.checkPerformanceThresholds(hook, executionResult);
      
      return executionResult;
      
    } catch (error) {
      const endTime = Date.now();
      const durationMs = endTime - startTime;
      
      const executionResult: ExecutionResult = {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
        durationMs,
        shortCircuited: false
      };
      
      // Update statistics
      this.updateStats(hook, executionResult);
      
      // Handle retries
      if (effectiveConfig.retryable && context.metadata.retryAttempt < (effectiveConfig.maxRetries || 0)) {
        this.logger.warn(`Hook ${hookId} failed, retrying (attempt ${context.metadata.retryAttempt + 1})`, { error });
        
        const retryContext = {
          ...context,
          metadata: {
            ...context.metadata,
            isRetry: true,
            retryAttempt: context.metadata.retryAttempt + 1
          }
        };
        
        return this.executeHook(hookId, retryContext, config);
      }
      
      throw error;
    }
  }
  
  /**
   * Execute multiple hooks according to their dependencies and modes
   */
  async executeHooks(
    hookConfigs: Array<{ hookId: string; config: HookExecutionConfig }>,
    context: ExecutionContext
  ): Promise<ExecutionResult[]> {
    // Validate dependencies
    const validation = this.validateDependencies(hookConfigs);
    if (!validation.valid) {
      throw new Error(`Invalid hook dependencies: ${validation.errors.join(', ')}`);
    }
    
    // Sort hooks by dependencies and priority
    const sortedHooks = this.sortHooksByDependencies(hookConfigs);
    
    // Group hooks by execution mode
    const serialHooks: typeof hookConfigs = [];
    const parallelHooks: typeof hookConfigs = [];
    
    for (const hookConfig of sortedHooks) {
      if (hookConfig.config.mode === ExecutionMode.PARALLEL || 
          (hookConfig.config.mode === ExecutionMode.HYBRID && !this.hasDependencies(hookConfig))) {
        parallelHooks.push(hookConfig);
      } else {
        serialHooks.push(hookConfig);
      }
    }
    
    const results: ExecutionResult[] = [];
    
    // Execute serial hooks first
    for (const hookConfig of serialHooks) {
      try {
        const result = await this.executeHook(hookConfig.hookId, context, hookConfig.config);
        results.push(result);
        
        // Short-circuit if hook returns a result
        if (result.shortCircuited && result.result) {
          break;
        }
      } catch (error) {
        results.push({
          success: false,
          error: error instanceof Error ? error : new Error(String(error)),
          durationMs: 0,
          shortCircuited: false
        });
        
        // Stop execution on error unless configured otherwise
        break;
      }
    }
    
    // Execute parallel hooks
    if (parallelHooks.length > 0) {
      const parallelPromises = parallelHooks.map(hookConfig =>
        this.executeHook(hookConfig.hookId, context, hookConfig.config)
          .catch(error => ({
            success: false,
            error: error instanceof Error ? error : new Error(String(error)),
            durationMs: 0,
            shortCircuited: false
          } as ExecutionResult))
      );
      
      const parallelResults = await Promise.all(parallelPromises);
      results.push(...parallelResults);
    }
    
    return results;
  }
  
  /**
   * Get execution statistics for a hook
   */
  getStats(hookId: string): ExecutionStats | undefined {
    const hook = this.hooks.get(hookId);
    return hook ? { ...hook.stats } : undefined;
  }
  
  /**
   * Get execution statistics for all hooks
   */
  getAllStats(): Map<string, ExecutionStats> {
    const stats = new Map<string, ExecutionStats>();
    for (const [id, hook] of this.hooks) {
      stats.set(id, { ...hook.stats });
    }
    return stats;
  }
  
  /**
   * Reset statistics for a hook
   */
  resetStats(hookId: string): void {
    const hook = this.hooks.get(hookId);
    if (hook) {
      hook.stats = {
        hookId,
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        averageExecutionTimeMs: 0,
        p95ExecutionTimeMs: 0,
        totalMemoryUsageBytes: 0
      };
      this.executionHistory.delete(hookId);
    }
  }
  
  /**
   * Validate hook dependencies for circular references
   */
  validateDependencies(
    hookConfigs: Array<{ hookId: string; config: HookExecutionConfig }>
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    const hookIds = new Set(hookConfigs.map(h => h.hookId));
    
    // Check for missing dependencies
    for (const hookConfig of hookConfigs) {
      if (hookConfig.config.dependencies) {
        for (const dep of hookConfig.config.dependencies) {
          if (!hookIds.has(dep.hookId)) {
            errors.push(`Hook '${hookConfig.hookId}' depends on missing hook '${dep.hookId}'`);
          }
        }
      }
    }
    
    // Check for circular dependencies using DFS
    const visited = new Set<string>();
    const visiting = new Set<string>();
    
    const hasCycle = (hookId: string): boolean => {
      if (visiting.has(hookId)) {
        return true;
      }
      if (visited.has(hookId)) {
        return false;
      }
      
      visiting.add(hookId);
      
      const hookConfig = hookConfigs.find(h => h.hookId === hookId);
      if (hookConfig?.config.dependencies) {
        for (const dep of hookConfig.config.dependencies) {
          if (hasCycle(dep.hookId)) {
            return true;
          }
        }
      }
      
      visiting.delete(hookId);
      visited.add(hookId);
      return false;
    };
    
    for (const hookConfig of hookConfigs) {
      if (hasCycle(hookConfig.hookId)) {
        errors.push(`Circular dependency detected involving hook '${hookConfig.hookId}'`);
        break;
      }
    }
    
    return { valid: errors.length === 0, errors };
  }
  
  private async executeWithTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Hook execution timeout after ${timeoutMs}ms`)), timeoutMs);
    });
    
    return Promise.race([promise, timeoutPromise]);
  }
  
  private async evaluateConditions(conditions: HookCondition[], context: ExecutionContext): Promise<boolean> {
    for (const condition of conditions) {
      const result = await this.evaluateCondition(condition, context);
      if (!result) {
        return false;
      }
    }
    return true;
  }
  
  private async evaluateCondition(condition: HookCondition, context: ExecutionContext): Promise<boolean> {
    if (condition.type === 'custom' && condition.customCondition) {
      return condition.customCondition(context);
    }
    
    let fieldValue: any;
    
    switch (condition.type) {
      case 'tool':
        fieldValue = context.toolName;
        break;
      case 'argument':
        fieldValue = condition.field ? context.args[condition.field] : context.args;
        break;
      case 'metadata':
        fieldValue = condition.field ? context.metadata[condition.field] : context.metadata;
        break;
      default:
        return true;
    }
    
    switch (condition.operator) {
      case 'equals':
        return fieldValue === condition.value;
      case 'not_equals':
        return fieldValue !== condition.value;
      case 'contains':
        return Array.isArray(fieldValue) ? fieldValue.includes(condition.value) : 
               String(fieldValue).includes(String(condition.value));
      case 'matches':
        return new RegExp(String(condition.value)).test(String(fieldValue));
      case 'custom':
        return condition.customCondition ? condition.customCondition(context) : true;
      default:
        return true;
    }
  }
  
  private sortHooksByDependencies(
    hookConfigs: Array<{ hookId: string; config: HookExecutionConfig }>
  ): Array<{ hookId: string; config: HookExecutionConfig }> {
    const sorted: Array<{ hookId: string; config: HookExecutionConfig }> = [];
    const visited = new Set<string>();
    
    const visit = (hookId: string) => {
      if (visited.has(hookId)) {
        return;
      }
      
      const hookConfig = hookConfigs.find(h => h.hookId === hookId);
      if (!hookConfig) {
        return;
      }
      
      // Visit dependencies first
      if (hookConfig.config.dependencies) {
        for (const dep of hookConfig.config.dependencies) {
          visit(dep.hookId);
        }
      }
      
      visited.add(hookId);
      sorted.push(hookConfig);
    };
    
    // Sort by priority first, then visit
    const prioritySorted = [...hookConfigs].sort((a, b) => 
      (b.config.priority || 0) - (a.config.priority || 0)
    );
    
    for (const hookConfig of prioritySorted) {
      visit(hookConfig.hookId);
    }
    
    return sorted;
  }
  
  private hasDependencies(hookConfig: { hookId: string; config: HookExecutionConfig }): boolean {
    return !!(hookConfig.config.dependencies && hookConfig.config.dependencies.length > 0);
  }
  
  private updateStats(hook: RegisteredHook, result: ExecutionResult): void {
    hook.stats.totalExecutions++;
    
    if (result.success) {
      hook.stats.successfulExecutions++;
    } else {
      hook.stats.failedExecutions++;
      hook.stats.lastErrorAt = new Date();
      hook.stats.lastError = result.error?.message;
    }
    
    // Update timing statistics
    const totalTime = hook.stats.averageExecutionTimeMs * (hook.stats.totalExecutions - 1) + result.durationMs;
    hook.stats.averageExecutionTimeMs = totalTime / hook.stats.totalExecutions;
    
    // Update memory statistics
    if (result.memoryDeltaBytes) {
      hook.stats.totalMemoryUsageBytes += result.memoryDeltaBytes;
    }
    
    hook.stats.lastExecutionAt = new Date();
    
    // Store execution history for percentile calculations
    if (this.performanceConfig.enabled) {
      let history = this.executionHistory.get(hook.id) || [];
      history.push(result);
      
      // Keep only recent records
      if (history.length > this.performanceConfig.maxRecords) {
        history = history.slice(-this.performanceConfig.maxRecords);
      }
      
      this.executionHistory.set(hook.id, history);
      
      // Calculate P95
      const durations = history.map(r => r.durationMs).sort((a, b) => a - b);
      const p95Index = Math.floor(durations.length * 0.95);
      hook.stats.p95ExecutionTimeMs = durations[p95Index] || 0;
    }
  }
  
  private checkPerformanceThresholds(hook: RegisteredHook, result: ExecutionResult): void {
    if (!this.performanceConfig.enabled) {
      return;
    }
    
    if (result.durationMs > this.performanceConfig.thresholds.executionTimeMs) {
      this.logger.warn(`Hook '${hook.id}' execution time exceeded threshold`, {
        duration: result.durationMs,
        threshold: this.performanceConfig.thresholds.executionTimeMs
      });
    }
    
    if (result.memoryDeltaBytes && 
        result.memoryDeltaBytes > this.performanceConfig.thresholds.memoryUsageBytes) {
      this.logger.warn(`Hook '${hook.id}' memory usage exceeded threshold`, {
        memoryDelta: result.memoryDeltaBytes,
        threshold: this.performanceConfig.thresholds.memoryUsageBytes
      });
    }
  }
}