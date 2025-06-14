/**
 * @file Plugin Lifecycle Manager
 * @version 2.0.0
 * @status STABLE - DO NOT MODIFY WITHOUT TESTS
 * @lastModified 2024-12-14
 * 
 * Manages plugin lifecycle including registration, health checks,
 * resource tracking, and graceful disposal.
 */

import { createLogger } from './logger.js';
import {
  IPluginLifecycleManager,
  IDisposable,
  IResourceTrackingDisposable,
  IServerLifecycleAware,
  HealthCheckResult,
  HealthStatus,
  ResourceInfo,
  ServerLifecycleEvent,
  ServerLifecycleEventData
} from '../interfaces/lifecycle.js';

interface PluginRegistration {
  id: string;
  plugin: IDisposable;
  metadata: Record<string, any>;
  registeredAt: Date;
  isDisposed: boolean;
}

/**
 * Default implementation of plugin lifecycle manager
 */
export class PluginLifecycleManager implements IPluginLifecycleManager {
  private readonly logger = createLogger({
    level: 'info',
    prefix: 'LIFECYCLE-MGR'
  });
  
  private plugins = new Map<string, PluginRegistration>();
  private _isDisposed = false;
  private disposalPromise?: Promise<void>;
  private healthCheckInterval?: NodeJS.Timeout;
  
  constructor(
    private readonly options: {
      healthCheckIntervalMs?: number;
      defaultTimeoutMs?: number;
      enablePeriodicHealthChecks?: boolean;
    } = {}
  ) {
    if (options.enablePeriodicHealthChecks) {
      this.startPeriodicHealthChecks();
    }
  }
  
  get isDisposed(): boolean {
    return this._isDisposed;
  }
  
  /**
   * Register a plugin for lifecycle management
   */
  register(plugin: IDisposable, metadata: Record<string, any> = {}): void {
    if (this._isDisposed) {
      throw new Error('Cannot register plugins on disposed lifecycle manager');
    }
    
    const id = this.generatePluginId(plugin, metadata);
    
    if (this.plugins.has(id)) {
      this.logger.warn(`Plugin ${id} is already registered, skipping`);
      return;
    }
    
    const registration: PluginRegistration = {
      id,
      plugin,
      metadata: { ...metadata, registeredAt: new Date() },
      registeredAt: new Date(),
      isDisposed: false
    };
    
    this.plugins.set(id, registration);
    this.logger.info(`Registered plugin: ${id}`, { metadata });
  }
  
  /**
   * Unregister a plugin from lifecycle management
   */
  unregister(pluginId: string): boolean {
    const registration = this.plugins.get(pluginId);
    if (!registration) {
      return false;
    }
    
    // Dispose the plugin if not already disposed
    if (!registration.isDisposed && !registration.plugin.isDisposed) {
      this.disposePlugin(registration).catch(error => {
        this.logger.error(`Error disposing plugin ${pluginId} during unregister:`, error);
      });
    }
    
    this.plugins.delete(pluginId);
    this.logger.info(`Unregistered plugin: ${pluginId}`);
    return true;
  }
  
  /**
   * Perform health checks on all managed plugins
   */
  async healthCheck(): Promise<HealthCheckResult[]> {
    const results: HealthCheckResult[] = [];
    
    for (const [id, registration] of this.plugins) {
      const startTime = Date.now();
      let result: HealthCheckResult;
      
      try {
        if (registration.isDisposed) {
          result = {
            id,
            name: registration.metadata.name || id,
            status: HealthStatus.UNHEALTHY,
            details: 'Plugin is disposed',
            timestamp: new Date(),
            checkDurationMs: 0
          };
        } else if (registration.plugin.isDisposed) {
          result = {
            id,
            name: registration.metadata.name || id,
            status: HealthStatus.UNHEALTHY,
            details: 'Plugin reports as disposed',
            timestamp: new Date(),
            checkDurationMs: 0
          };
          registration.isDisposed = true;
        } else {
          // For now, consider non-disposed plugins as healthy
          // Future enhancement: add IHealthCheckable interface
          result = {
            id,
            name: registration.metadata.name || id,
            status: HealthStatus.HEALTHY,
            details: 'Plugin is active',
            timestamp: new Date(),
            checkDurationMs: Date.now() - startTime
          };
        }
      } catch (error) {
        result = {
          id,
          name: registration.metadata.name || id,
          status: HealthStatus.UNHEALTHY,
          details: 'Health check failed',
          timestamp: new Date(),
          checkDurationMs: Date.now() - startTime,
          error: error instanceof Error ? error : new Error(String(error))
        };
      }
      
      results.push(result);
    }
    
    return results;
  }
  
  /**
   * Get resource usage information for all plugins
   */
  async getResourceUsage(): Promise<ResourceInfo[]> {
    const resources: ResourceInfo[] = [];
    
    for (const [id, registration] of this.plugins) {
      if (registration.isDisposed) {
        continue;
      }
      
      try {
        if (this.isResourceTrackingDisposable(registration.plugin)) {
          const pluginResources = registration.plugin.getResources();
          resources.push(...pluginResources.map(resource => ({
            ...resource,
            metadata: {
              ...resource.metadata,
              pluginId: id,
              pluginName: registration.metadata.name || id
            }
          })));
        } else {
          // Basic resource info for non-tracking plugins
          resources.push({
            type: 'plugin',
            id,
            description: `Plugin: ${registration.metadata.name || id}`,
            acquiredAt: registration.registeredAt,
            metadata: {
              pluginId: id,
              pluginName: registration.metadata.name || id,
              registrationMetadata: registration.metadata
            }
          });
        }
      } catch (error) {
        this.logger.error(`Error getting resources for plugin ${id}:`, error);
      }
    }
    
    return resources;
  }
  
  /**
   * Gracefully shutdown all plugins
   */
  async shutdown(timeoutMs: number = this.options.defaultTimeoutMs || 30000): Promise<void> {
    if (this.isDisposed) {
      return this.disposalPromise;
    }
    
    this.logger.info('Starting plugin lifecycle manager shutdown');
    
    // Stop periodic health checks
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = undefined;
    }
    
    // Dispose all plugins with timeout
    const disposalPromises = Array.from(this.plugins.values()).map(async registration => {
      if (registration.isDisposed || registration.plugin.isDisposed) {
        return;
      }
      
      try {
        await this.disposePluginWithTimeout(registration, timeoutMs);
      } catch (error) {
        this.logger.error(`Error disposing plugin ${registration.id}:`, error);
      }
    });
    
    await Promise.allSettled(disposalPromises);
    
    this.plugins.clear();
    this.logger.info('Plugin lifecycle manager shutdown complete');
  }
  
  /**
   * Dispose this lifecycle manager
   */
  async dispose(): Promise<void> {
    if (this.disposalPromise) {
      return this.disposalPromise;
    }
    
    this.disposalPromise = this.shutdown();
    await this.disposalPromise;
    this._isDisposed = true;
  }
  
  /**
   * Notify plugins of server lifecycle events
   */
  async notifyServerLifecycleEvent(event: ServerLifecycleEvent, data?: Partial<ServerLifecycleEventData>): Promise<void> {
    const eventData: ServerLifecycleEventData = {
      event,
      timestamp: new Date(),
      ...data
    };
    
    const notifications = Array.from(this.plugins.values()).map(async registration => {
      if (registration.isDisposed || !this.isServerLifecycleAware(registration.plugin)) {
        return;
      }
      
      try {
        await registration.plugin.onServerLifecycleEvent(eventData);
      } catch (error) {
        this.logger.error(`Error notifying plugin ${registration.id} of lifecycle event ${event}:`, error);
      }
    });
    
    await Promise.allSettled(notifications);
  }
  
  private generatePluginId(plugin: IDisposable, metadata: Record<string, any>): string {
    const name = metadata.name || plugin.constructor.name || 'UnknownPlugin';
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${name}-${timestamp}-${random}`;
  }
  
  private async disposePlugin(registration: PluginRegistration): Promise<void> {
    if (registration.isDisposed) {
      return;
    }
    
    try {
      await registration.plugin.dispose();
      registration.isDisposed = true;
      this.logger.info(`Disposed plugin: ${registration.id}`);
    } catch (error) {
      registration.isDisposed = true; // Mark as disposed even if disposal failed
      this.logger.error(`Error disposing plugin ${registration.id}:`, error);
      throw error;
    }
  }
  
  private async disposePluginWithTimeout(registration: PluginRegistration, timeoutMs: number): Promise<void> {
    const timeoutPromise = new Promise<void>((_, reject) => {
      setTimeout(() => reject(new Error(`Plugin disposal timeout after ${timeoutMs}ms`)), timeoutMs);
    });
    
    if (this.isResourceTrackingDisposable(registration.plugin)) {
      // Use force dispose for resource tracking plugins
      await Promise.race([
        registration.plugin.forceDispose(timeoutMs),
        timeoutPromise
      ]);
    } else {
      await Promise.race([
        this.disposePlugin(registration),
        timeoutPromise
      ]);
    }
  }
  
  private startPeriodicHealthChecks(): void {
    const interval = this.options.healthCheckIntervalMs || 60000; // Default 1 minute
    
    this.healthCheckInterval = setInterval(async () => {
      try {
        const results = await this.healthCheck();
        const unhealthyPlugins = results.filter(r => r.status === HealthStatus.UNHEALTHY);
        
        if (unhealthyPlugins.length > 0) {
          this.logger.warn(`Found ${unhealthyPlugins.length} unhealthy plugins:`, 
            unhealthyPlugins.map(p => ({ id: p.id, details: p.details })));
        }
      } catch (error) {
        this.logger.error('Error during periodic health check:', error);
      }
    }, interval);
  }
  
  private isResourceTrackingDisposable(plugin: IDisposable): plugin is IResourceTrackingDisposable {
    return 'getResources' in plugin && 'forceDispose' in plugin;
  }
  
  private isServerLifecycleAware(plugin: any): plugin is IServerLifecycleAware {
    return plugin && typeof plugin.onServerLifecycleEvent === 'function';
  }
}