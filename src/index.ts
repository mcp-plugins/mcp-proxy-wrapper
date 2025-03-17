/**
 * @file MCP Proxy Wrapper - Main Entry Point
 * @version 1.0.0
 * @status STABLE - DO NOT MODIFY WITHOUT TESTS
 * @lastModified 2023-03-17
 * 
 * This is the main entry point for the MCP Proxy Wrapper.
 * It exports the proxy wrapper and related interfaces.
 * 
 * IMPORTANT:
 * - Any changes to this file must be accompanied by tests
 * - Maintain backward compatibility when adding new features
 * 
 * Functionality:
 * - Exports the proxy wrapper function
 * - Exports hook interfaces
 * - Exports utility types
 */

// Export the proxy wrapper
export { wrapWithProxy } from './proxy-wrapper';

// Export hook interfaces
export {
  BeforeHook,
  AfterHook,
  ErrorHook,
  ProxyOptions,
  HookContext,
  HookResult,
  ToolCallMetadata
} from './interfaces/hooks';

// Export utility types
export {
  ToolCallArgs,
  ToolCallResult,
  ProxiedMcpServer
} from './interfaces/types';

// Export error types
export {
  ProxyWrapperError,
  HookExecutionError,
  InvalidOptionsError,
  ToolCallError
} from './interfaces/errors';

// Export example usage
export { default as exampleUsage } from './example-proxy-wrapper-usage';

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