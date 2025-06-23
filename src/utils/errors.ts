/**
 * @file Custom Error Classes
 * @version 2.0.0
 * @status STABLE - Comprehensive error hierarchy for MCP Proxy
 * 
 * Provides custom error classes for improved error handling and debugging
 * throughout the MCP Proxy Wrapper system. Each error type includes
 * specific context and metadata for better error tracking.
 */

/**
 * Base error class for all MCP Proxy errors
 */
export abstract class McpProxyError extends Error {
  /** Error code for programmatic handling */
  public readonly code: string;
  
  /** Additional error context */
  public readonly context: Record<string, any>;
  
  /** Timestamp when error occurred */
  public readonly timestamp: Date;
  
  /** Component that generated the error */
  public readonly component: string;
  
  /** Original error that caused this error (if any) */
  public readonly cause?: Error;
  
  constructor(
    message: string,
    code: string,
    component: string,
    context: Record<string, any> = {},
    cause?: Error
  ) {
    super(message);
    
    this.name = this.constructor.name;
    this.code = code;
    this.component = component;
    this.context = context;
    this.timestamp = new Date();
    this.cause = cause;
    
    // Maintain proper stack trace (when available)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
  
  /**
   * Convert error to JSON for logging/serialization
   */
  toJSON(): Record<string, any> {
    return {
      name: this.name,
      message: this.message,
      code: this.code,
      component: this.component,
      context: this.context,
      timestamp: this.timestamp.toISOString(),
      stack: this.stack,
      cause: this.cause ? {
        name: this.cause.name,
        message: this.cause.message,
        stack: this.cause.stack
      } : undefined
    };
  }
  
  /**
   * Get a formatted error string for display
   */
  toString(): string {
    const contextStr = Object.keys(this.context).length > 0 
      ? ` (${JSON.stringify(this.context)})` 
      : '';
    
    return `${this.name} [${this.code}]: ${this.message}${contextStr}`;
  }
}

/**
 * Proxy wrapper configuration and initialization errors
 */
export class ProxyConfigurationError extends McpProxyError {
  constructor(
    message: string,
    context: Record<string, any> = {},
    cause?: Error
  ) {
    super(message, 'PROXY_CONFIG_ERROR', 'proxy-wrapper', context, cause);
  }
}

/**
 * Plugin-related errors
 */
export class PluginError extends McpProxyError {
  /** Plugin name that caused the error */
  public readonly pluginName: string;
  
  /** Plugin operation that failed */
  public readonly operation: 'register' | 'initialize' | 'execute' | 'cleanup';
  
  constructor(
    message: string,
    pluginName: string,
    operation: 'register' | 'initialize' | 'execute' | 'cleanup',
    context: Record<string, any> = {},
    cause?: Error
  ) {
    super(
      message, 
      `PLUGIN_${operation.toUpperCase()}_ERROR`, 
      'plugin-manager', 
      { ...context, pluginName, operation }, 
      cause
    );
    
    this.pluginName = pluginName;
    this.operation = operation;
  }
}

/**
 * Plugin execution timeout errors
 */
export class PluginTimeoutError extends PluginError {
  /** Timeout duration in milliseconds */
  public readonly timeout: number;
  
  constructor(
    pluginName: string,
    timeout: number,
    operation: 'register' | 'initialize' | 'execute' | 'cleanup' = 'execute',
    context: Record<string, any> = {}
  ) {
    super(
      `Plugin '${pluginName}' ${operation} timed out after ${timeout}ms`,
      pluginName,
      operation,
      { ...context, timeout }
    );
    
    this.timeout = timeout;
  }
}

/**
 * Hook execution errors
 */
export class HookExecutionError extends McpProxyError {
  /** Hook type that failed */
  public readonly hookType: 'beforeToolCall' | 'afterToolCall';
  
  /** Tool name being processed */
  public readonly toolName: string;
  
  /** Request ID for correlation */
  public readonly requestId?: string;
  
  constructor(
    message: string,
    hookType: 'beforeToolCall' | 'afterToolCall',
    toolName: string,
    context: Record<string, any> = {},
    cause?: Error
  ) {
    super(
      message,
      `HOOK_${hookType.toUpperCase()}_ERROR`,
      'proxy-wrapper',
      { ...context, hookType, toolName },
      cause
    );
    
    this.hookType = hookType;
    this.toolName = toolName;
    this.requestId = context.requestId;
  }
}

/**
 * Tool call processing errors
 */
export class ToolCallError extends McpProxyError {
  /** Tool name that failed */
  public readonly toolName: string;
  
  /** Request ID for correlation */
  public readonly requestId?: string;
  
  /** Tool arguments */
  public readonly args: Record<string, any>;
  
  constructor(
    message: string,
    toolName: string,
    args: Record<string, any> = {},
    context: Record<string, any> = {},
    cause?: Error
  ) {
    super(
      message,
      'TOOL_CALL_ERROR',
      'proxy-wrapper',
      { ...context, toolName, args },
      cause
    );
    
    this.toolName = toolName;
    this.args = args;
    this.requestId = context.requestId;
  }
}

/**
 * Transport-related errors
 */
export class TransportError extends McpProxyError {
  /** Transport type */
  public readonly transport: string;
  
  /** Connection ID (if available) */
  public readonly connectionId?: string;
  
  constructor(
    message: string,
    transport: string,
    context: Record<string, any> = {},
    cause?: Error
  ) {
    super(
      message,
      'TRANSPORT_ERROR',
      'transport',
      { ...context, transport },
      cause
    );
    
    this.transport = transport;
    this.connectionId = context.connectionId;
  }
}

/**
 * Connection-specific errors
 */
export class ConnectionError extends TransportError {
  /** Connection state when error occurred */
  public readonly connectionState?: string;
  
  /** Error category */
  public readonly category: 'connection' | 'timeout' | 'protocol' | 'authentication';
  
  constructor(
    message: string,
    category: 'connection' | 'timeout' | 'protocol' | 'authentication',
    transport: string,
    context: Record<string, any> = {},
    cause?: Error
  ) {
    super(
      message,
      transport,
      { ...context, category },
      cause
    );
    
    this.category = category;
    this.connectionState = context.connectionState;
    // Override the code to be more specific
    (this as any).code = `CONNECTION_${category.toUpperCase()}_ERROR`;
  }
}

/**
 * Connection pool errors
 */
export class ConnectionPoolError extends McpProxyError {
  /** Pool operation that failed */
  public readonly operation: 'acquire' | 'release' | 'create' | 'destroy' | 'scale';
  
  /** Current pool statistics */
  public readonly poolStats?: Record<string, any>;
  
  constructor(
    message: string,
    operation: 'acquire' | 'release' | 'create' | 'destroy' | 'scale',
    context: Record<string, any> = {},
    cause?: Error
  ) {
    super(
      message,
      `POOL_${operation.toUpperCase()}_ERROR`,
      'connection-pool',
      { ...context, operation },
      cause
    );
    
    this.operation = operation;
    this.poolStats = context.poolStats;
  }
}

/**
 * Configuration validation errors
 */
export class ValidationError extends McpProxyError {
  /** Field that failed validation */
  public readonly field: string;
  
  /** Expected value type or format */
  public readonly expected: string;
  
  /** Actual value received */
  public readonly received: any;
  
  constructor(
    message: string,
    field: string,
    expected: string,
    received: any,
    context: Record<string, any> = {}
  ) {
    super(
      message,
      'VALIDATION_ERROR',
      'configuration',
      { ...context, field, expected, received }
    );
    
    this.field = field;
    this.expected = expected;
    this.received = received;
  }
}

/**
 * Auto-detection errors
 */
export class AutoDetectionError extends McpProxyError {
  /** Input that failed detection */
  public readonly input: string;
  
  /** Detection confidence scores */
  public readonly candidates?: Array<{ transport: string; confidence: number }>;
  
  constructor(
    message: string,
    input: string,
    context: Record<string, any> = {},
    cause?: Error
  ) {
    super(
      message,
      'AUTO_DETECTION_ERROR',
      'auto-detection',
      { ...context, input },
      cause
    );
    
    this.input = input;
    this.candidates = context.candidates;
  }
}

/**
 * Resource management errors
 */
export class ResourceError extends McpProxyError {
  /** Resource type */
  public readonly resourceType: string;
  
  /** Resource ID */
  public readonly resourceId?: string;
  
  /** Operation that failed */
  public readonly operation: 'allocate' | 'deallocate' | 'access' | 'cleanup';
  
  constructor(
    message: string,
    resourceType: string,
    operation: 'allocate' | 'deallocate' | 'access' | 'cleanup',
    context: Record<string, any> = {},
    cause?: Error
  ) {
    super(
      message,
      `RESOURCE_${operation.toUpperCase()}_ERROR`,
      'resource-manager',
      { ...context, resourceType, operation },
      cause
    );
    
    this.resourceType = resourceType;
    this.operation = operation;
    this.resourceId = context.resourceId;
  }
}

/**
 * Shutdown process errors
 */
export class ShutdownError extends McpProxyError {
  /** Handler that failed during shutdown */
  public readonly handlerName?: string;
  
  /** Shutdown phase */
  public readonly phase: 'signal' | 'handler' | 'cleanup' | 'timeout';
  
  constructor(
    message: string,
    phase: 'signal' | 'handler' | 'cleanup' | 'timeout',
    context: Record<string, any> = {},
    cause?: Error
  ) {
    super(
      message,
      `SHUTDOWN_${phase.toUpperCase()}_ERROR`,
      'shutdown-manager',
      { ...context, phase },
      cause
    );
    
    this.phase = phase;
    this.handlerName = context.handlerName;
  }
}

/**
 * Utility functions for error handling
 */

/**
 * Check if an error is a specific type of MCP Proxy error
 */
export function isErrorType<T extends McpProxyError>(
  error: unknown,
  errorClass: new (...args: any[]) => T
): error is T {
  return error instanceof errorClass;
}

/**
 * Extract error chain from a nested error
 */
export function getErrorChain(error: Error): Error[] {
  const chain: Error[] = [error];
  
  let current: Error | undefined = error;
  while (current && 'cause' in current && current.cause instanceof Error) {
    chain.push(current.cause);
    current = current.cause;
  }
  
  return chain;
}

/**
 * Get the root cause of an error chain
 */
export function getRootCause(error: Error): Error {
  const chain = getErrorChain(error);
  return chain[chain.length - 1];
}

/**
 * Format an error for logging
 */
export function formatErrorForLogging(error: Error): Record<string, any> {
  if (error instanceof McpProxyError) {
    return error.toJSON();
  }
  
  return {
    name: error.name,
    message: error.message,
    stack: error.stack,
    timestamp: new Date().toISOString()
  };
}

/**
 * Create a standardized error response for tool calls
 */
export function createErrorResponse(error: Error, requestId?: string): any {
  const errorInfo = formatErrorForLogging(error);
  
  return {
    isError: true,
    content: [
      {
        type: "text",
        text: `Error: ${error.message}`
      }
    ],
    _meta: {
      error: errorInfo,
      requestId,
      timestamp: new Date().toISOString()
    }
  };
}

/**
 * Wrap an async function with error conversion
 */
export function withErrorWrapping<T extends any[], R>(
  fn: (...args: T) => Promise<R>,
  errorFactory: (error: Error, ...args: T) => McpProxyError
): (...args: T) => Promise<R> {
  return async (...args: T): Promise<R> => {
    try {
      return await fn(...args);
    } catch (error) {
      if (error instanceof Error) {
        throw errorFactory(error, ...args);
      }
      throw errorFactory(new Error(String(error)), ...args);
    }
  };
}