/**
 * @file MCP Proxy Wrapper Entry Point
 * @version 1.0.0
 * @status STABLE - DO NOT MODIFY WITHOUT TESTS
 * @lastModified 2024-03-17
 * 
 * Main entry point for the MCP Proxy Wrapper package.
 * Exports the wrapWithProxy function and related types.
 * 
 * IMPORTANT:
 * - All changes must be accompanied by tests
 * - Do not modify the interface without updating documentation
 * 
 * Functionality:
 * - Main export for the proxy wrapper
 * - Type definitions
 * - Utility exports
 */

// Export main function and types
export { wrapWithProxy, ProxyWrapperOptions } from './proxy-wrapper.js';

// Export interfaces
export {
  ToolCallContext,
  ToolCallResult,
  ProxyHooks
} from './interfaces/proxy-hooks.js';

// Export utilities
export { createLogger, LoggerOptions, Logger, LogLevel } from './utils/logger.js';

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