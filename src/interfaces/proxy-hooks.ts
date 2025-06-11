/**
 * @file Proxy Hooks Interfaces
 * @version 1.1.0
 * @status STABLE - DO NOT MODIFY WITHOUT TESTS
 * @lastModified 2024-03-17
 * 
 * Defines the interfaces for the proxy hook system and plugin support.
 * 
 * IMPORTANT:
 * - All changes must be accompanied by tests
 * - Do not modify the interface without updating documentation
 * 
 * Functionality:
 * - Tool call context definition
 * - Tool call result definition
 * - Hook interfaces for pre and post processing
 * - Plugin system integration
 * - Configuration options
 */

import type { ProxyPlugin, PluginConfig } from './plugin.js';

/**
 * Context for a tool call
 */
export interface ToolCallContext {
  /** Name of the tool being called */
  toolName: string;
  
  /** Arguments passed to the tool */
  args: Record<string, any>;
  
  /** Additional metadata */
  metadata?: Record<string, any>;
}

/**
 * Result of a tool call
 */
export interface ToolCallResult {
  /** Result returned by the tool */
  result: any;
  
  /** Additional metadata */
  metadata?: Record<string, any>;
}

/**
 * Hooks for the proxy wrapper
 */
export interface ProxyHooks {
  /**
   * Hook that runs before a tool call
   * @param context Context for the tool call
   * @returns Void or a custom result to short-circuit the tool call
   */
  beforeToolCall?: (context: ToolCallContext) => Promise<void | ToolCallResult>;
  
  /**
   * Hook that runs after a tool call
   * @param context Context for the tool call
   * @param result Result of the tool call
   * @returns Modified result
   */
  afterToolCall?: (context: ToolCallContext, result: ToolCallResult) => Promise<ToolCallResult>;
}

/**
 * Plugin registration configuration
 */
export interface PluginRegistration {
  /** The plugin instance */
  plugin: ProxyPlugin;
  
  /** Plugin-specific configuration */
  config?: PluginConfig;
}

/**
 * Options for the proxy wrapper
 */
export interface ProxyWrapperOptions {
  /** Additional metadata to include with every tool call */
  metadata?: Record<string, any>;
  
  /** Hooks for the proxy */
  hooks?: ProxyHooks;
  
  /** Plugins to register with the proxy wrapper */
  plugins?: (ProxyPlugin | PluginRegistration)[];
  
  /** Enable debug mode for detailed logging */
  debug?: boolean;
  
  /** Global plugin configuration */
  pluginConfig?: {
    /** Enable plugin system */
    enabled?: boolean;
    
    /** Default execution timeout for plugins in milliseconds */
    defaultTimeout?: number;
    
    /** Maximum number of plugins allowed */
    maxPlugins?: number;
    
    /** Enable plugin health checks */
    enableHealthChecks?: boolean;
    
    /** Health check interval in milliseconds */
    healthCheckInterval?: number;
  };
} 