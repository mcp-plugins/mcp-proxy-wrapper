/**
 * @file Hook Execution Interfaces
 * @version 2.0.0
 * @status STABLE - DO NOT MODIFY WITHOUT TESTS
 * @lastModified 2024-12-14
 * 
 * Defines interfaces for advanced hook execution patterns including
 * parallel execution, dependencies, and performance optimization.
 */

/**
 * Execution mode for hooks
 */
export enum ExecutionMode {
  /** Execute hooks in sequence (safest, default) */
  SERIAL = 'serial',
  
  /** Execute independent hooks in parallel */
  PARALLEL = 'parallel',
  
  /** Hybrid mode - parallel where safe, serial where dependencies exist */
  HYBRID = 'hybrid'
}

/**
 * Hook dependency information
 */
export interface HookDependency {
  /** Hook ID that this hook depends on */
  hookId: string;
  
  /** Type of dependency */
  type: 'before' | 'after' | 'exclusive';
  
  /** Whether this dependency is optional */
  optional?: boolean;
}

/**
 * Hook execution configuration
 */
export interface HookExecutionConfig {
  /** Execution mode for this hook */
  mode: ExecutionMode;
  
  /** Maximum number of concurrent executions */
  maxConcurrency?: number;
  
  /** Timeout for hook execution in milliseconds */
  timeout?: number;
  
  /** Dependencies for this hook */
  dependencies?: HookDependency[];
  
  /** Priority for execution order (higher = earlier) */
  priority?: number;
  
  /** Whether this hook can be retried on failure */
  retryable?: boolean;
  
  /** Maximum number of retry attempts */
  maxRetries?: number;
  
  /** Conditions under which this hook should execute */
  conditions?: HookCondition[];
}

/**
 * Condition for conditional hook execution
 */
export interface HookCondition {
  /** Type of condition */
  type: 'tool' | 'argument' | 'metadata' | 'custom';
  
  /** Field to check (for tool/argument/metadata conditions) */
  field?: string;
  
  /** Operator for comparison */
  operator: 'equals' | 'not_equals' | 'contains' | 'matches' | 'custom';
  
  /** Value to compare against */
  value?: any;
  
  /** Custom condition function (for custom type/operator) */
  customCondition?: (context: any) => boolean | Promise<boolean>;
}

/**
 * Hook execution context with enhanced metadata
 */
export interface ExecutionContext {
  /** Unique execution ID */
  executionId: string;
  
  /** Hook ID being executed */
  hookId: string;
  
  /** Tool name */
  toolName: string;
  
  /** Tool arguments */
  args: Record<string, any>;
  
  /** Execution metadata */
  metadata: {
    /** Request ID for correlation */
    requestId: string;
    
    /** Execution start time */
    startTime: Date;
    
    /** Execution mode used */
    executionMode: ExecutionMode;
    
    /** Whether this is a retry */
    isRetry: boolean;
    
    /** Retry attempt number (0 for first attempt) */
    retryAttempt: number;
    
    /** Parent execution ID if this is part of a chain */
    parentExecutionId?: string;
    
    /** Additional metadata */
    [key: string]: any;
  };
  
  /** Shared state between hooks (read-only) */
  readonly sharedState: Record<string, any>;
  
  /** Method to update shared state safely */
  updateSharedState: (key: string, value: any) => void;
}

/**
 * Hook execution result with performance metrics
 */
export interface ExecutionResult {
  /** Whether execution was successful */
  success: boolean;
  
  /** Result data if successful */
  result?: any;
  
  /** Error if failed */
  error?: Error;
  
  /** Execution duration in milliseconds */
  durationMs: number;
  
  /** Memory usage delta in bytes */
  memoryDeltaBytes?: number;
  
  /** Whether execution was short-circuited */
  shortCircuited: boolean;
  
  /** Additional execution metadata */
  metadata?: Record<string, any>;
}

/**
 * Hook execution statistics
 */
export interface ExecutionStats {
  /** Hook ID */
  hookId: string;
  
  /** Total number of executions */
  totalExecutions: number;
  
  /** Number of successful executions */
  successfulExecutions: number;
  
  /** Number of failed executions */
  failedExecutions: number;
  
  /** Average execution time in milliseconds */
  averageExecutionTimeMs: number;
  
  /** 95th percentile execution time */
  p95ExecutionTimeMs: number;
  
  /** Total memory usage in bytes */
  totalMemoryUsageBytes: number;
  
  /** Last execution timestamp */
  lastExecutionAt?: Date;
  
  /** Last error timestamp */
  lastErrorAt?: Date;
  
  /** Last error message */
  lastError?: string;
}

/**
 * Hook execution manager interface
 */
export interface IHookExecutionManager {
  /**
   * Execute a hook with the given configuration
   */
  executeHook(
    hookId: string,
    context: ExecutionContext,
    config: HookExecutionConfig
  ): Promise<ExecutionResult>;
  
  /**
   * Execute multiple hooks according to their dependencies and modes
   */
  executeHooks(
    hooks: Array<{ hookId: string; config: HookExecutionConfig }>,
    context: ExecutionContext
  ): Promise<ExecutionResult[]>;
  
  /**
   * Get execution statistics for a hook
   */
  getStats(hookId: string): ExecutionStats | undefined;
  
  /**
   * Get execution statistics for all hooks
   */
  getAllStats(): Map<string, ExecutionStats>;
  
  /**
   * Reset statistics for a hook
   */
  resetStats(hookId: string): void;
  
  /**
   * Check if hooks have circular dependencies
   */
  validateDependencies(
    hooks: Array<{ hookId: string; config: HookExecutionConfig }>
  ): { valid: boolean; errors: string[] };
}

/**
 * Performance monitoring configuration
 */
export interface PerformanceConfig {
  /** Enable performance monitoring */
  enabled: boolean;
  
  /** Sampling rate (0.0 to 1.0) */
  samplingRate: number;
  
  /** Maximum number of execution records to keep */
  maxRecords: number;
  
  /** Enable memory usage tracking */
  trackMemory: boolean;
  
  /** Enable execution time tracking */
  trackExecutionTime: boolean;
  
  /** Performance warning thresholds */
  thresholds: {
    /** Warn if execution takes longer than this (ms) */
    executionTimeMs: number;
    
    /** Warn if memory usage exceeds this (bytes) */
    memoryUsageBytes: number;
  };
}