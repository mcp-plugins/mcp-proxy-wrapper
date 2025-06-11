/**
 * @file Plugin Interface for MCP Proxy Wrapper
 * @version 1.0.0
 * 
 * Defines the plugin system interface that allows extending the proxy wrapper
 * with additional functionality like payments, authentication, caching, etc.
 */

import { ToolCallContext, ToolCallResult } from './proxy-hooks.js';

/**
 * Plugin execution priority - higher numbers execute first
 */
export type PluginPriority = number;

/**
 * Plugin lifecycle phase
 */
export type PluginPhase = 'initialize' | 'beforeToolCall' | 'afterToolCall' | 'onError' | 'destroy';

/**
 * Plugin execution context with additional plugin-specific data
 */
export interface PluginContext extends ToolCallContext {
  /** Plugin-specific data that persists across hooks */
  pluginData: Map<string, any>;
  
  /** Request ID for tracking across plugin calls */
  requestId: string;
  
  /** Timestamp when the request started */
  startTime: number;
  
  /** Previous plugin results (for plugin chaining) */
  previousResults?: Map<string, any>;
}

/**
 * Plugin error information
 */
export interface PluginError {
  pluginName: string;
  phase: PluginPhase;
  error: Error;
  context: PluginContext;
}

/**
 * Plugin metadata and configuration
 */
export interface PluginMetadata {
  /** Human-readable description */
  description?: string;
  
  /** Plugin author */
  author?: string;
  
  /** Plugin homepage or repository */
  homepage?: string;
  
  /** Required dependencies (other plugins) */
  dependencies?: string[];
  
  /** Optional dependencies */
  optionalDependencies?: string[];
  
  /** Plugin tags for categorization */
  tags?: string[];
  
  /** Minimum required proxy wrapper version */
  minWrapperVersion?: string;
}

/**
 * Plugin configuration interface
 */
export interface PluginConfig {
  /** Enable/disable the plugin */
  enabled?: boolean;
  
  /** Plugin execution priority (higher = earlier) */
  priority?: PluginPriority;
  
  /** Plugin-specific configuration */
  options?: Record<string, any>;
  
  /** Tools this plugin should apply to (empty = all tools) */
  includeTools?: string[];
  
  /** Tools this plugin should NOT apply to */
  excludeTools?: string[];
  
  /** Enable debug logging for this plugin */
  debug?: boolean;
}

/**
 * Core plugin interface that all plugins must implement
 */
export interface ProxyPlugin {
  /** Unique plugin identifier */
  readonly name: string;
  
  /** Plugin version (semver) */
  readonly version: string;
  
  /** Plugin metadata */
  readonly metadata?: PluginMetadata;
  
  /** Plugin configuration */
  config?: PluginConfig;
  
  /**
   * Initialize the plugin
   * Called once when the proxy wrapper starts
   */
  initialize?(context: PluginInitContext): Promise<void>;
  
  /**
   * Hook executed before tool calls
   * Can modify context or short-circuit execution
   */
  beforeToolCall?(context: PluginContext): Promise<void | ToolCallResult>;
  
  /**
   * Hook executed after tool calls
   * Can modify results or perform cleanup
   */
  afterToolCall?(context: PluginContext, result: ToolCallResult): Promise<ToolCallResult>;
  
  /**
   * Hook executed when errors occur
   * Can handle errors or perform error recovery
   */
  onError?(error: PluginError): Promise<void | ToolCallResult>;
  
  /**
   * Cleanup hook called when proxy wrapper shuts down
   */
  destroy?(): Promise<void>;
  
  /**
   * Health check - return false if plugin is unhealthy
   */
  healthCheck?(): Promise<boolean>;
  
  /**
   * Get plugin runtime statistics
   */
  getStats?(): Promise<PluginStats>;
}

/**
 * Context provided during plugin initialization
 */
export interface PluginInitContext {
  /** Proxy wrapper version */
  wrapperVersion: string;
  
  /** Other loaded plugins */
  loadedPlugins: ProxyPlugin[];
  
  /** Global configuration */
  globalConfig: Record<string, any>;
  
  /** Logger instance */
  logger: {
    debug(message: string, ...args: any[]): void;
    info(message: string, ...args: any[]): void;
    warn(message: string, ...args: any[]): void;
    error(message: string, ...args: any[]): void;
  };
}

/**
 * Plugin runtime statistics
 */
export interface PluginStats {
  /** Number of calls processed */
  callsProcessed: number;
  
  /** Number of errors encountered */
  errorsEncountered: number;
  
  /** Average processing time in milliseconds */
  averageProcessingTime: number;
  
  /** Plugin-specific metrics */
  customMetrics?: Record<string, number>;
  
  /** Last activity timestamp */
  lastActivity: number;
}

/**
 * Plugin manager interface for advanced plugin orchestration
 */
export interface PluginManager {
  /** Register a plugin */
  register(plugin: ProxyPlugin, config?: PluginConfig): Promise<void>;
  
  /** Unregister a plugin */
  unregister(pluginName: string): Promise<void>;
  
  /** Get registered plugin by name */
  getPlugin(name: string): ProxyPlugin | undefined;
  
  /** Get all registered plugins */
  getAllPlugins(): ProxyPlugin[];
  
  /** Check plugin dependencies */
  validateDependencies(): Promise<boolean>;
  
  /** Get plugin execution order */
  getExecutionOrder(): ProxyPlugin[];
  
  /** Execute health checks on all plugins */
  healthCheck(): Promise<Map<string, boolean>>;
  
  /** Get aggregated statistics from all plugins */
  getAggregatedStats(): Promise<PluginStats>;
}

/**
 * Events that plugins can listen to
 */
export interface PluginEvents {
  /** Emitted when a plugin is registered */
  'plugin:registered': { plugin: ProxyPlugin };
  
  /** Emitted when a plugin is unregistered */
  'plugin:unregistered': { pluginName: string };
  
  /** Emitted when a plugin encounters an error */
  'plugin:error': PluginError;
  
  /** Emitted when all plugins are initialized */
  'plugins:initialized': { plugins: ProxyPlugin[] };
  
  /** Emitted before tool call processing starts */
  'tool:before': PluginContext;
  
  /** Emitted after tool call processing completes */
  'tool:after': { context: PluginContext; result: ToolCallResult };
}

/**
 * Plugin registration configuration
 */
export interface PluginRegistration {
  plugin: ProxyPlugin;
  config?: PluginConfig;
}

/**
 * Utility types for plugin development
 */
export type PluginHook<T = void> = (context: PluginContext) => Promise<T>;
export type PluginFactory<TOptions = any> = (options: TOptions) => ProxyPlugin;

/**
 * Base class for easier plugin development
 */
export abstract class BasePlugin implements ProxyPlugin {
  abstract readonly name: string;
  abstract readonly version: string;
  
  readonly metadata?: PluginMetadata;
  config?: PluginConfig;
  
  protected stats: PluginStats = {
    callsProcessed: 0,
    errorsEncountered: 0,
    averageProcessingTime: 0,
    lastActivity: Date.now()
  };
  
  protected logger?: PluginInitContext['logger'];
  
  async initialize(context: PluginInitContext): Promise<void> {
    this.logger = context.logger;
    this.logger.info(`Initializing plugin: ${this.name} v${this.version}`);
  }
  
  async healthCheck(): Promise<boolean> {
    return true;
  }
  
  async getStats(): Promise<PluginStats> {
    return { ...this.stats };
  }
  
  protected updateStats(processingTime: number, hasError: boolean = false): void {
    this.stats.callsProcessed++;
    if (hasError) this.stats.errorsEncountered++;
    
    // Update rolling average
    const total = this.stats.averageProcessingTime * (this.stats.callsProcessed - 1) + processingTime;
    this.stats.averageProcessingTime = total / this.stats.callsProcessed;
    
    this.stats.lastActivity = Date.now();
  }
  
  public shouldProcessTool(toolName: string): boolean {
    if (!this.config) return true;
    
    // Check exclusions first
    if (this.config.excludeTools?.includes(toolName)) {
      return false;
    }
    
    // Check inclusions (empty means include all)
    if (this.config.includeTools && this.config.includeTools.length > 0) {
      return this.config.includeTools.includes(toolName);
    }
    
    return true;
  }
}