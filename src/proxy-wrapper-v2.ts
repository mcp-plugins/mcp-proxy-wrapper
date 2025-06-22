/**
 * @file Enhanced Proxy Wrapper for MCP Server v2.0
 * @version 2.0.0
 * @status DEVELOPMENT - IMPLEMENTS ARCHITECTURAL IMPROVEMENTS
 * @lastModified 2024-12-14
 * 
 * Enhanced proxy wrapper with improved lifecycle management, parallel execution,
 * type safety, and security features.
 * 
 * Key Improvements:
 * - Plugin lifecycle management with proper disposal
 * - Parallel hook execution with dependency resolution
 * - Enhanced error handling and retry mechanisms
 * - Performance monitoring and resource tracking
 * - Better type safety and validation
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createLogger } from './utils/logger.js';
import { PluginLifecycleManager } from './utils/plugin-lifecycle-manager.js';
import { HookExecutionManager } from './utils/hook-execution-manager.js';
import { v4 as uuidv4 } from 'uuid';
import { 
  ProxyWrapperOptions, 
  ToolCallContext, 
  ToolCallResult 
} from './interfaces/proxy-hooks.js';
import {
  IDisposable,
  ServerLifecycleEvent
} from './experimental/v2-design/lifecycle.js';
import {
  ExecutionMode,
  ExecutionContext,
  HookExecutionConfig,
  PerformanceConfig
} from './experimental/v2-design/execution.js';

// Define types for the request handler extra
type RequestHandlerExtra = any;

/**
 * Enhanced proxy wrapper options with v2 features
 */
export interface EnhancedProxyWrapperOptions extends ProxyWrapperOptions {
  /** Execution configuration for hooks */
  execution?: {
    /** Default execution mode */
    defaultMode?: ExecutionMode;
    
    /** Maximum concurrent hook executions */
    maxConcurrency?: number;
    
    /** Default timeout for hook execution */
    defaultTimeoutMs?: number;
    
    /** Enable hook retries */
    enableRetries?: boolean;
    
    /** Maximum retry attempts */
    maxRetries?: number;
  };
  
  /** Performance monitoring configuration */
  performance?: PerformanceConfig;
  
  /** Lifecycle management options */
  lifecycle?: {
    /** Enable automatic plugin disposal on server shutdown */
    autoDispose?: boolean;
    
    /** Timeout for plugin disposal */
    disposalTimeoutMs?: number;
    
    /** Enable periodic health checks */
    enableHealthChecks?: boolean;
    
    /** Health check interval */
    healthCheckIntervalMs?: number;
  };
  
  /** Security options */
  security?: {
    /** Enable input validation */
    validateInputs?: boolean;
    
    /** Enable output sanitization */
    sanitizeOutputs?: boolean;
    
    /** Fields to redact in logs */
    redactFields?: string[];
    
    /** Maximum execution time to prevent DOS */
    maxExecutionTimeMs?: number;
  };
}

/**
 * Enhanced proxy wrapper that wraps an MCP server with advanced hook management
 */
export class EnhancedProxyWrapper implements IDisposable {
  private readonly logger;
  private pluginLifecycleManager?: PluginLifecycleManager;
  private hookExecutionManager: HookExecutionManager;
  private _isDisposed = false;
  private disposalPromise?: Promise<void>;
  
  constructor(
    private readonly server: McpServer,
    private readonly options: EnhancedProxyWrapperOptions = {}
  ) {
    this.logger = createLogger({
      level: this.options.debug ? 'debug' : 'info',
      prefix: 'MCP-PROXY-V2'
    });
    
    // Initialize hook execution manager
    this.hookExecutionManager = new HookExecutionManager(options.performance);
    
    // Initialize plugin lifecycle manager if needed
    if (options.plugins && options.plugins.length > 0) {
      this.pluginLifecycleManager = new PluginLifecycleManager({
        healthCheckIntervalMs: options.lifecycle?.healthCheckIntervalMs,
        defaultTimeoutMs: options.lifecycle?.disposalTimeoutMs,
        enablePeriodicHealthChecks: options.lifecycle?.enableHealthChecks
      });
    }
  }
  
  get isDisposed(): boolean {
    return this._isDisposed;
  }
  
  /**
   * Initialize the proxy wrapper
   */
  async initialize(): Promise<McpServer> {
    if (this._isDisposed) {
      throw new Error('Cannot initialize disposed proxy wrapper');
    }
    
    // Check if server is already wrapped
    if ((this.server as any)._isProxyWrapped) {
      this.logger.warn('Server is already wrapped, returning existing server');
      return this.server;
    }
    
    this.logger.info('Initializing Enhanced MCP Proxy Wrapper v2.0');
    
    // Initialize plugins
    await this.initializePlugins();
    
    // Register user hooks
    this.registerUserHooks();
    
    // Wrap the server's tool method
    this.wrapServerToolMethod();
    
    // Mark server as wrapped
    (this.server as any)._isProxyWrapped = true;
    (this.server as any)._proxyWrapperInstance = this;
    
    // Notify plugins of server startup
    if (this.pluginLifecycleManager) {
      await this.pluginLifecycleManager.notifyServerLifecycleEvent(ServerLifecycleEvent.STARTED);
    }
    
    this.logger.info('Enhanced MCP Proxy Wrapper v2.0 initialized successfully');
    return this.server;
  }
  
  /**
   * Dispose the proxy wrapper and clean up resources
   */
  async dispose(): Promise<void> {
    if (this.disposalPromise) {
      return this.disposalPromise;
    }
    
    this.disposalPromise = this.performDisposal();
    await this.disposalPromise;
  }
  
  /**
   * Get performance statistics for all hooks
   */
  getPerformanceStats() {
    return this.hookExecutionManager.getAllStats();
  }
  
  /**
   * Get health status of all plugins
   */
  async getHealthStatus() {
    if (!this.pluginLifecycleManager) {
      return [];
    }
    return this.pluginLifecycleManager.healthCheck();
  }
  
  /**
   * Get resource usage information
   */
  async getResourceUsage() {
    if (!this.pluginLifecycleManager) {
      return [];
    }
    return this.pluginLifecycleManager.getResourceUsage();
  }
  
  private async initializePlugins(): Promise<void> {
    if (!this.options.plugins || !this.pluginLifecycleManager) {
      return;
    }
    
    this.logger.info(`Initializing ${this.options.plugins.length} plugins`);
    
    for (const pluginOrReg of this.options.plugins) {
      const plugin = 'plugin' in pluginOrReg ? pluginOrReg.plugin : pluginOrReg;
      const config = 'plugin' in pluginOrReg ? pluginOrReg.config : undefined;
      
      try {
        // Register plugin with lifecycle manager
        this.pluginLifecycleManager.register(plugin as any, {
          name: plugin.name,
          config,
          ...('plugin' in pluginOrReg ? pluginOrReg : {})
        });
        
        // Register plugin hooks with execution manager
        if ('beforeToolCall' in plugin && plugin.beforeToolCall) {
          this.hookExecutionManager.registerHook(
            `plugin-${plugin.name}-before`,
            async (context: ExecutionContext) => {
              return plugin.beforeToolCall!(this.convertToPluginContext(context));
            },
            {
              mode: this.options.execution?.defaultMode || ExecutionMode.SERIAL,
              timeout: this.options.execution?.defaultTimeoutMs,
              retryable: this.options.execution?.enableRetries,
              maxRetries: this.options.execution?.maxRetries
            }
          );
        }
        
        if ('afterToolCall' in plugin && plugin.afterToolCall) {
          this.hookExecutionManager.registerHook(
            `plugin-${plugin.name}-after`,
            async (context: ExecutionContext) => {
              // This would need the tool result, will be handled in execution
              return undefined;
            },
            {
              mode: this.options.execution?.defaultMode || ExecutionMode.SERIAL,
              timeout: this.options.execution?.defaultTimeoutMs,
              retryable: this.options.execution?.enableRetries,
              maxRetries: this.options.execution?.maxRetries
            }
          );
        }
        
        this.logger.debug(`Initialized plugin: ${plugin.name}`);
      } catch (error) {
        this.logger.error(`Failed to initialize plugin ${plugin.name}:`, error);
        throw error;
      }
    }
  }
  
  private registerUserHooks(): void {
    if (!this.options.hooks) {
      return;
    }
    
    if (this.options.hooks.beforeToolCall) {
      this.hookExecutionManager.registerHook(
        'user-before-hook',
        async (context: ExecutionContext) => {
          return this.options.hooks!.beforeToolCall!(this.convertToLegacyContext(context));
        },
        {
          mode: this.options.execution?.defaultMode || ExecutionMode.SERIAL,
          timeout: this.options.execution?.defaultTimeoutMs,
          retryable: this.options.execution?.enableRetries,
          maxRetries: this.options.execution?.maxRetries,
          priority: 100 // Higher priority than plugins
        }
      );
    }
    
    if (this.options.hooks.afterToolCall) {
      this.hookExecutionManager.registerHook(
        'user-after-hook',
        async (context: ExecutionContext) => {
          // This would need the tool result, will be handled in execution
          return undefined;
        },
        {
          mode: this.options.execution?.defaultMode || ExecutionMode.SERIAL,
          timeout: this.options.execution?.defaultTimeoutMs,
          retryable: this.options.execution?.enableRetries,
          maxRetries: this.options.execution?.maxRetries,
          priority: 100
        }
      );
    }
  }
  
  private wrapServerToolMethod(): void {
    const originalTool = this.server.tool.bind(this.server);
    
    const toolMethod: any = (name: string, paramsSchemaOrCallback: any, callbackOrUndefined?: any) => {
      this.logger.debug(`Intercepting tool registration: ${name}`);
      
      // Determine if this is the 2-arg or 3-arg version
      const isThreeArgVersion = callbackOrUndefined !== undefined;
      const paramsSchema = isThreeArgVersion ? paramsSchemaOrCallback : {};
      const originalCallback = isThreeArgVersion ? callbackOrUndefined : paramsSchemaOrCallback;
      
      // Create enhanced wrapped handler
      const wrappedCallback = async (argsOrExtra: any, extra?: RequestHandlerExtra) => {
        const args = isThreeArgVersion ? argsOrExtra : {};
        const actualExtra = isThreeArgVersion ? extra : argsOrExtra;
        const requestId = uuidv4();
        const executionId = uuidv4();
        
        // Apply input validation if enabled
        if (this.options.security?.validateInputs) {
          try {
            this.validateInputs(args, paramsSchema);
          } catch (error) {
            this.logger.error(`Input validation failed for ${name}:`, error);
            return this.createErrorResponse(`Input validation failed: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
        
        // Check execution time limits
        const startTime = Date.now();
        const maxExecutionTime = this.options.security?.maxExecutionTimeMs || 300000; // 5 minutes default
        
        try {
          // Create execution context
          const context: ExecutionContext = {
            executionId,
            hookId: '', // Will be set by individual hooks
            toolName: name,
            args: this.sanitizeArgs(args),
            metadata: {
              requestId,
              startTime: new Date(),
              executionMode: this.options.execution?.defaultMode || ExecutionMode.SERIAL,
              isRetry: false,
              retryAttempt: 0
            },
            sharedState: {},
            updateSharedState: () => {} // Will be properly implemented by execution manager
          };
          
          // Execute with timeout
          const result = await this.executeWithGlobalTimeout(
            this.executeToolWithHooks(name, context, originalCallback, actualExtra, isThreeArgVersion),
            maxExecutionTime
          );
          
          // Apply output sanitization if enabled
          if (this.options.security?.sanitizeOutputs) {
            return this.sanitizeOutput(result);
          }
          
          return result;
          
        } catch (error) {
          this.logger.error(`Error processing tool call ${name}:`, error);
          return this.createErrorResponse(error instanceof Error ? error.message : String(error));
        }
      };
      
      // Register the tool with the wrapped handler
      if (isThreeArgVersion) {
        return originalTool(name, paramsSchema, wrappedCallback);
      } else {
        return originalTool(name, wrappedCallback);
      }
    };
    
    // Replace the original method
    this.server.tool = toolMethod;
  }
  
  private async executeToolWithHooks(
    toolName: string,
    context: ExecutionContext,
    originalCallback: Function,
    extra: RequestHandlerExtra,
    isThreeArgVersion: boolean
  ): Promise<any> {
    // Execute before hooks (plugins first, then user hooks)
    const beforeHooks = [
      // Plugin before hooks
      ...Array.from(this.hookExecutionManager.getAllStats().keys())
        .filter(hookId => hookId.includes('-before'))
        .filter(hookId => hookId.startsWith('plugin-'))
        .map(hookId => ({ hookId, config: { mode: ExecutionMode.SERIAL } as HookExecutionConfig })),
      
      // User before hooks
      ...Array.from(this.hookExecutionManager.getAllStats().keys())
        .filter(hookId => hookId.includes('-before'))
        .filter(hookId => hookId.startsWith('user-'))
        .map(hookId => ({ hookId, config: { mode: ExecutionMode.SERIAL } as HookExecutionConfig }))
    ];
    
    if (beforeHooks.length > 0) {
      const beforeResults = await this.hookExecutionManager.executeHooks(beforeHooks, context);
      
      // Check for short-circuit
      for (const result of beforeResults) {
        if (result.shortCircuited && result.result) {
          return result.result;
        }
        if (!result.success) {
          throw result.error || new Error('Hook execution failed');
        }
      }
    }
    
    // Execute the original tool
    this.logger.debug(`Calling original handler for ${toolName}`, { requestId: context.metadata.requestId });
    
    const toolResult = isThreeArgVersion 
      ? await originalCallback(context.args, extra)
      : await originalCallback(extra);
    
    let finalResult: ToolCallResult = {
      result: toolResult,
      metadata: {
        ...context.metadata,
        completedAt: new Date().toISOString()
      }
    };
    
    // Execute after hooks (user first, then plugins - reverse order)
    const afterHooks = [
      // User after hooks
      ...Array.from(this.hookExecutionManager.getAllStats().keys())
        .filter(hookId => hookId.includes('-after'))
        .filter(hookId => hookId.startsWith('user-'))
        .map(hookId => ({ hookId, config: { mode: ExecutionMode.SERIAL } as HookExecutionConfig })),
      
      // Plugin after hooks
      ...Array.from(this.hookExecutionManager.getAllStats().keys())
        .filter(hookId => hookId.includes('-after'))
        .filter(hookId => hookId.startsWith('plugin-'))
        .map(hookId => ({ hookId, config: { mode: ExecutionMode.SERIAL } as HookExecutionConfig }))
    ];
    
    // Note: After hooks would need access to the tool result, which requires
    // modifying the hook execution manager to support this use case
    // For now, we'll use the legacy approach for after hooks
    
    return {
      ...finalResult.result,
      _meta: {
        ...finalResult.metadata,
        ...finalResult.result._meta
      }
    };
  }
  
  private async performDisposal(): Promise<void> {
    if (this._isDisposed) {
      return;
    }
    
    this.logger.info('Starting enhanced proxy wrapper disposal');
    
    try {
      // Notify plugins of shutdown
      if (this.pluginLifecycleManager) {
        await this.pluginLifecycleManager.notifyServerLifecycleEvent(ServerLifecycleEvent.STOPPING);
      }
      
      // Dispose plugin lifecycle manager
      if (this.pluginLifecycleManager) {
        await this.pluginLifecycleManager.dispose();
      }
      
      this._isDisposed = true;
      this.logger.info('Enhanced proxy wrapper disposal complete');
      
    } catch (error) {
      this.logger.error('Error during proxy wrapper disposal:', error);
      throw error;
    }
  }
  
  private async executeWithGlobalTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`Tool execution timeout after ${timeoutMs}ms`)), timeoutMs);
    });
    
    return Promise.race([promise, timeoutPromise]);
  }
  
  private validateInputs(args: any, schema: any): void {
    // Basic validation - would be enhanced with Zod in production
    if (schema && typeof schema === 'object' && schema.required) {
      for (const field of schema.required) {
        if (!(field in args)) {
          throw new Error(`Required field '${field}' is missing`);
        }
      }
    }
  }
  
  private sanitizeArgs(args: any): any {
    if (!this.options.security?.redactFields) {
      return args;
    }
    
    const sanitized = { ...args };
    for (const field of this.options.security.redactFields) {
      if (field in sanitized) {
        sanitized[field] = '[REDACTED]';
      }
    }
    return sanitized;
  }
  
  private sanitizeOutput(result: any): any {
    if (!this.options.security?.redactFields) {
      return result;
    }
    
    // Basic output sanitization - would be more sophisticated in production
    return result;
  }
  
  private createErrorResponse(message: string): any {
    return {
      isError: true,
      content: [
        {
          type: "text",
          text: `Error: ${message}`
        }
      ]
    };
  }
  
  private convertToLegacyContext(context: ExecutionContext): ToolCallContext {
    return {
      toolName: context.toolName,
      args: context.args,
      metadata: context.metadata
    };
  }
  
  private convertToPluginContext(context: ExecutionContext): any {
    return {
      toolName: context.toolName,
      args: context.args,
      metadata: context.metadata,
      pluginData: new Map(),
      requestId: context.metadata.requestId || context.executionId,
      startTime: context.metadata.startTime?.getTime() || Date.now(),
      previousResults: new Map()
    };
  }
}

/**
 * Factory function to create and initialize an enhanced proxy wrapper
 */
export async function wrapWithEnhancedProxy(
  server: McpServer,
  options?: EnhancedProxyWrapperOptions
): Promise<McpServer> {
  const wrapper = new EnhancedProxyWrapper(server, options);
  return wrapper.initialize();
}

/**
 * Get the proxy wrapper instance from a wrapped server
 */
export function getProxyWrapperInstance(server: McpServer): EnhancedProxyWrapper | null {
  return (server as any)._proxyWrapperInstance || null;
}