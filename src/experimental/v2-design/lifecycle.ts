/**
 * @file Lifecycle Management Interfaces
 * @version 2.0.0
 * @status STABLE - DO NOT MODIFY WITHOUT TESTS
 * @lastModified 2024-12-14
 * 
 * Defines interfaces for plugin and hook lifecycle management,
 * including disposal, health checks, and resource tracking.
 */

/**
 * Interface for components that require cleanup
 */
export interface IDisposable {
  /**
   * Release all resources held by this component
   * @returns Promise that resolves when disposal is complete
   */
  dispose(): Promise<void>;
  
  /**
   * Indicates if the component has been disposed
   */
  readonly isDisposed: boolean;
}

/**
 * Health status for a component
 */
export enum HealthStatus {
  HEALTHY = 'healthy',
  DEGRADED = 'degraded',
  UNHEALTHY = 'unhealthy',
  UNKNOWN = 'unknown'
}

/**
 * Health check result for a plugin or component
 */
export interface HealthCheckResult {
  /** Component identifier */
  id: string;
  
  /** Component name */
  name: string;
  
  /** Current health status */
  status: HealthStatus;
  
  /** Additional details about the health status */
  details?: string;
  
  /** Timestamp of the health check */
  timestamp: Date;
  
  /** Time taken to perform the health check in milliseconds */
  checkDurationMs: number;
  
  /** Any error that occurred during health check */
  error?: Error;
}

/**
 * Resource tracking information
 */
export interface ResourceInfo {
  /** Type of resource (e.g., 'database', 'file', 'network') */
  type: string;
  
  /** Resource identifier */
  id: string;
  
  /** Human-readable description */
  description: string;
  
  /** When the resource was acquired */
  acquiredAt: Date;
  
  /** Size or count of the resource if applicable */
  size?: number;
  
  /** Additional metadata */
  metadata?: Record<string, any>;
}

/**
 * Enhanced disposal interface with resource tracking
 */
export interface IResourceTrackingDisposable extends IDisposable {
  /**
   * Get all resources currently held by this component
   */
  getResources(): ResourceInfo[];
  
  /**
   * Force disposal with timeout
   * @param timeoutMs Maximum time to wait for disposal
   */
  forceDispose(timeoutMs?: number): Promise<void>;
}

/**
 * Plugin lifecycle manager interface
 */
export interface IPluginLifecycleManager extends IDisposable {
  /**
   * Perform health checks on all managed plugins
   */
  healthCheck(): Promise<HealthCheckResult[]>;
  
  /**
   * Gracefully shutdown all plugins
   * @param timeoutMs Maximum time to wait for shutdown
   */
  shutdown(timeoutMs?: number): Promise<void>;
  
  /**
   * Get resource usage information for all plugins
   */
  getResourceUsage(): Promise<ResourceInfo[]>;
  
  /**
   * Register a plugin for lifecycle management
   */
  register(plugin: IDisposable, metadata?: Record<string, any>): void;
  
  /**
   * Unregister a plugin from lifecycle management
   */
  unregister(pluginId: string): boolean;
}

/**
 * Server lifecycle events that plugins can hook into
 */
export enum ServerLifecycleEvent {
  STARTING = 'starting',
  STARTED = 'started',
  STOPPING = 'stopping',
  STOPPED = 'stopped',
  ERROR = 'error'
}

/**
 * Server lifecycle event data
 */
export interface ServerLifecycleEventData {
  event: ServerLifecycleEvent;
  timestamp: Date;
  serverId?: string;
  error?: Error;
  metadata?: Record<string, any>;
}

/**
 * Interface for components that want to receive server lifecycle events
 */
export interface IServerLifecycleAware {
  /**
   * Handle server lifecycle events
   */
  onServerLifecycleEvent(data: ServerLifecycleEventData): Promise<void>;
}