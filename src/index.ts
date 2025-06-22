/**
 * @file MCP Proxy Wrapper - Main Entry Point
 * @version 2.0.0
 * @status STABLE - DO NOT MODIFY WITHOUT TESTS
 * @lastModified 2024-12-14
 * 
 * This is the main entry point for the MCP Proxy Wrapper.
 * It exports both v1 and v2 proxy wrappers and related interfaces.
 * 
 * IMPORTANT:
 * - Any changes to this file must be accompanied by tests
 * - Maintain backward compatibility when adding new features
 * 
 * Functionality:
 * - Exports both v1 and v2 proxy wrapper functions
 * - Exports hook interfaces
 * - Exports utility types
 * - Exports new lifecycle and execution interfaces
 */

// Export the original proxy wrapper (v1) for backward compatibility
export { wrapWithProxy } from './proxy-wrapper.js';

// Export the enhanced proxy wrapper (v2)
export { 
  wrapWithEnhancedProxy, 
  EnhancedProxyWrapper,
  getProxyWrapperInstance,
  type EnhancedProxyWrapperOptions
} from './proxy-wrapper-v2.js';

// Export hook interfaces
export {
  ProxyHooks,
  ProxyWrapperOptions,
  ToolCallContext,
  ToolCallResult
} from './interfaces/proxy-hooks.js';

// Export plugin system
export {
  ProxyPlugin,
  BasePlugin,
  PluginContext,
  PluginConfig,
  PluginMetadata,
  PluginStats,
  PluginManager
} from './interfaces/plugin.js';

// Export new v2 interfaces (experimental - moved to separate directory)
export {
  type IDisposable,
  type IResourceTrackingDisposable,
  type IPluginLifecycleManager,
  type IServerLifecycleAware,
  type HealthCheckResult,
  type ResourceInfo,
  HealthStatus,
  ServerLifecycleEvent
} from './experimental/v2-design/lifecycle.js';

export {
  type IHookExecutionManager,
  type ExecutionContext,
  type ExecutionResult,
  type ExecutionStats,
  type HookExecutionConfig,
  type PerformanceConfig,
  ExecutionMode
} from './experimental/v2-design/execution.js';

// Export utility classes
export { PluginLifecycleManager } from './utils/plugin-lifecycle-manager.js';
export { HookExecutionManager } from './utils/hook-execution-manager.js';

// Export plugins
export { LLMSummarizationPlugin } from './examples/plugins/llm-summarization.js';
export { ChatMemoryPlugin } from './examples/plugins/chat-memory.js';

// Example usage is available in example-proxy-wrapper-usage.ts file

/*
 * The MCP Proxy Wrapper adds a hook system to an existing MCP server.
 * It allows intercepting and modifying tool calls without requiring backend infrastructure.
 * 
 * Features:
 * 
 * - Instance Wrapping: Accepts an instance of an existing MCP server
 * - Pre-call Hooks: Execute code before tool calls
 * - Post-call Hooks: Execute code after tool calls
 * - Argument Modification: Modify tool call arguments
 * - Result Modification: Modify tool call results
 * - Short-circuit Capability: Return custom results without calling the original tool
 * 
 * Hook System:
 * 
 * The wrapper provides a flexible hook system that allows you to:
 * 
 * - Execute code before tool calls
 * - Execute code after tool calls
 * - Modify tool call arguments
 * - Modify tool call results
 * - Short-circuit tool calls with custom results
 */ 