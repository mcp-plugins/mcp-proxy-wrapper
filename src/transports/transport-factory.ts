/**
 * @file Transport Factory with Dependency Injection
 * @version 2.0.0
 * @status STABLE - Core factory for creating transport connections
 * 
 * Implements the factory pattern with dependency injection for creating transport
 * connections. This allows runtime selection of transport adapters without
 * tight coupling to specific implementations.
 */

import { 
  IConnection, 
  IConnectionAdapter, 
  TransportConfig, 
  TransportType,
  AdapterMetadata,
  ConnectionError
} from '../interfaces/connection.js';
import { createLogger } from '../utils/logger.js';

/**
 * Transport factory configuration
 */
export interface TransportFactoryConfig {
  /** Enable debug logging */
  debug?: boolean;
  
  /** Default timeout for connections */
  defaultTimeout?: number;
  
  /** Maximum concurrent connections */
  maxConnections?: number;
  
  /** Auto-discovery of transport adapters */
  autoDiscovery?: boolean;
}

/**
 * Transport adapter registration information
 */
export interface AdapterRegistration {
  /** The adapter instance */
  adapter: IConnectionAdapter;
  
  /** Transport type this adapter handles */
  transport: TransportType;
  
  /** Adapter metadata */
  metadata: AdapterMetadata;
  
  /** Priority for adapter selection (higher = preferred) */
  priority?: number;
  
  /** Whether this adapter is enabled */
  enabled?: boolean;
}

/**
 * Connection pool entry
 */
interface PooledConnection {
  /** The connection instance */
  connection: IConnection;
  
  /** When this connection was created */
  createdAt: Date;
  
  /** Number of times this connection has been used */
  useCount: number;
  
  /** Whether this connection is currently in use */
  inUse: boolean;
  
  /** Connection configuration hash for matching */
  configHash: string;
}

/**
 * Factory for creating transport connections with dependency injection
 * and connection pooling support
 */
export class TransportFactory {
  private adapters = new Map<TransportType, AdapterRegistration[]>();
  private connectionPool = new Map<string, PooledConnection[]>();
  private activeConnections = new Set<IConnection>();
  private logger = createLogger({ level: 'info', prefix: 'TRANSPORT-FACTORY' });
  
  constructor(private config: TransportFactoryConfig = {}) {
    this.logger = createLogger({
      level: this.config.debug ? 'debug' : 'info',
      prefix: 'TRANSPORT-FACTORY'
    });
    
    this.logger.info('Initializing Transport Factory', {
      debug: this.config.debug,
      defaultTimeout: this.config.defaultTimeout,
      maxConnections: this.config.maxConnections,
      autoDiscovery: this.config.autoDiscovery
    });
  }
  
  /**
   * Register a transport adapter
   * @param adapter The adapter to register
   * @param options Registration options
   */
  registerAdapter(
    adapter: IConnectionAdapter, 
    options: { 
      priority?: number; 
      enabled?: boolean;
      override?: boolean;
    } = {}
  ): void {
    const metadata = adapter.getMetadata();
    const transport = metadata.transport;
    
    this.logger.debug(`Registering adapter for transport: ${transport}`, {
      name: metadata.name,
      version: metadata.version,
      priority: options.priority || 0,
      enabled: options.enabled !== false
    });
    
    // Get existing adapters for this transport type
    const existing = this.adapters.get(transport) || [];
    
    // Check for duplicates unless override is specified
    if (!options.override) {
      const duplicate = existing.find(reg => reg.metadata.name === metadata.name);
      if (duplicate) {
        throw new Error(`Adapter '${metadata.name}' for transport '${transport}' already registered. Use override option to replace.`);
      }
    }
    
    // Create registration
    const registration: AdapterRegistration = {
      adapter,
      transport,
      metadata,
      priority: options.priority || 0,
      enabled: options.enabled !== false
    };
    
    // Remove existing adapter with same name if override is specified
    if (options.override) {
      const filtered = existing.filter(reg => reg.metadata.name !== metadata.name);
      filtered.push(registration);
      this.adapters.set(transport, filtered);
    } else {
      existing.push(registration);
      this.adapters.set(transport, existing);
    }
    
    // Sort by priority (higher first)
    const sorted = this.adapters.get(transport)!.sort((a, b) => (b.priority || 0) - (a.priority || 0));
    this.adapters.set(transport, sorted);
    
    this.logger.info(`Registered adapter: ${metadata.name} for ${transport}`, {
      totalAdapters: this.getTotalAdapterCount(),
      transportAdapters: sorted.length
    });
  }
  
  /**
   * Unregister a transport adapter
   * @param transport The transport type
   * @param adapterName Optional specific adapter name to remove
   */
  unregisterAdapter(transport: TransportType, adapterName?: string): boolean {
    const existing = this.adapters.get(transport) || [];
    
    if (adapterName) {
      const filtered = existing.filter(reg => reg.metadata.name !== adapterName);
      if (filtered.length === existing.length) {
        return false; // No adapter found with that name
      }
      this.adapters.set(transport, filtered);
      this.logger.info(`Unregistered adapter: ${adapterName} for ${transport}`);
      return true;
    } else {
      // Remove all adapters for this transport
      const hadAdapters = existing.length > 0;
      this.adapters.delete(transport);
      if (hadAdapters) {
        this.logger.info(`Unregistered all adapters for ${transport}`);
      }
      return hadAdapters;
    }
  }
  
  /**
   * Create a new connection using the appropriate adapter
   * @param config Transport configuration
   * @param options Connection options
   * @returns Promise that resolves to a connection instance
   */
  async createConnection(
    config: TransportConfig, 
    options: {
      /** Force creation of new connection (skip pooling) */
      forceNew?: boolean;
      
      /** Prefer specific adapter by name */
      preferAdapter?: string;
      
      /** Connection timeout override */
      timeout?: number;
    } = {}
  ): Promise<IConnection> {
    this.logger.debug(`Creating connection for transport: ${config.transport}`, {
      forceNew: options.forceNew,
      preferAdapter: options.preferAdapter,
      timeout: options.timeout
    });
    
    // Check connection limits
    if (this.config.maxConnections && this.activeConnections.size >= this.config.maxConnections) {
      throw new ConnectionError(
        `Maximum connections (${this.config.maxConnections}) exceeded`,
        'CONNECTION_LIMIT_EXCEEDED',
        config.transport
      );
    }
    
    // Try to reuse pooled connection first (unless forceNew is specified)
    if (!options.forceNew) {
      const pooled = this.getPooledConnection(config);
      if (pooled) {
        this.logger.debug(`Reusing pooled connection for ${config.transport}`, {
          useCount: pooled.useCount,
          createdAt: pooled.createdAt
        });
        pooled.useCount++;
        pooled.inUse = true;
        return pooled.connection;
      }
    }
    
    // Find appropriate adapter
    const adapter = this.findAdapter(config.transport, options.preferAdapter);
    if (!adapter) {
      throw new ConnectionError(
        `No adapter found for transport: ${config.transport}`,
        'NO_ADAPTER_FOUND',
        config.transport
      );
    }
    
    const adapterMetadata = adapter.getMetadata();
    this.logger.debug(`Using adapter: ${adapterMetadata.name} for ${config.transport}`, {
      version: adapterMetadata.version,
      capabilities: adapterMetadata.capabilities
    });
    
    // Apply factory defaults to config
    const finalConfig = this.applyDefaults(config, options.timeout);
    
    try {
      // Create connection using adapter
      const connection = await adapter.connect(finalConfig);
      
      // Track active connection
      this.activeConnections.add(connection);
      
      // Set up connection cleanup on close
      connection.onStateChange((state) => {
        if (state === 'closed' || state === 'error') {
          this.activeConnections.delete(connection);
          this.removeFromPool(connection);
        }
      });
      
      // Add to pool for potential reuse
      this.addToPool(connection, finalConfig);
      
      this.logger.info(`Created connection for ${config.transport}`, {
        connectionId: connection.id,
        activeConnections: this.activeConnections.size,
        adapter: adapterMetadata.name
      });
      
      return connection;
    } catch (error) {
      this.logger.error(`Failed to create connection for ${config.transport}:`, error);
      throw new ConnectionError(
        `Failed to create connection: ${error instanceof Error ? error.message : String(error)}`,
        'CONNECTION_CREATION_FAILED',
        config.transport,
        error instanceof Error ? error : undefined
      );
    }
  }
  
  /**
   * Probe if a transport configuration is supported
   * @param config Transport configuration to probe
   * @returns Promise that resolves to true if supported
   */
  async probe(config: TransportConfig): Promise<boolean> {
    const adapters = this.getAdaptersForTransport(config.transport);
    
    // Try each adapter in priority order
    for (const registration of adapters) {
      if (!registration.enabled) continue;
      
      try {
        if (registration.adapter.probe) {
          const supported = await registration.adapter.probe(config);
          if (supported) {
            this.logger.debug(`Transport probe successful with adapter: ${registration.metadata.name}`, {
              transport: config.transport
            });
            return true;
          }
        } else {
          // If adapter doesn't implement probe, assume it can handle the config
          this.logger.debug(`Adapter ${registration.metadata.name} doesn't implement probe, assuming supported`, {
            transport: config.transport
          });
          return true;
        }
      } catch (error) {
        this.logger.debug(`Probe failed for adapter ${registration.metadata.name}:`, error);
        continue;
      }
    }
    
    this.logger.debug(`No adapter can handle transport: ${config.transport}`);
    return false;
  }
  
  /**
   * Get all registered adapters
   */
  getAdapters(): AdapterRegistration[] {
    const allAdapters: AdapterRegistration[] = [];
    for (const adapters of this.adapters.values()) {
      allAdapters.push(...adapters);
    }
    return allAdapters.sort((a, b) => (b.priority || 0) - (a.priority || 0));
  }
  
  /**
   * Get adapters for a specific transport type
   */
  getAdaptersForTransport(transport: TransportType): AdapterRegistration[] {
    return this.adapters.get(transport) || [];
  }
  
  /**
   * Get supported transport types
   */
  getSupportedTransports(): TransportType[] {
    return Array.from(this.adapters.keys());
  }
  
  /**
   * Get factory statistics
   */
  getStats() {
    const poolStats = new Map<TransportType, number>();
    for (const [transport, connections] of this.connectionPool) {
      poolStats.set(transport as TransportType, connections.length);
    }
    
    return {
      totalAdapters: this.getTotalAdapterCount(),
      supportedTransports: this.getSupportedTransports(),
      activeConnections: this.activeConnections.size,
      maxConnections: this.config.maxConnections || -1,
      pooledConnections: poolStats,
      config: this.config
    };
  }
  
  /**
   * Close all active connections and clear pools
   */
  async shutdown(): Promise<void> {
    this.logger.info('Shutting down Transport Factory', {
      activeConnections: this.activeConnections.size,
      pooledConnections: this.getTotalPooledConnections()
    });
    
    // Close all active connections
    const closePromises: Promise<void>[] = [];
    for (const connection of this.activeConnections) {
      closePromises.push(connection.close());
    }
    
    // Close all pooled connections
    for (const connections of this.connectionPool.values()) {
      for (const pooled of connections) {
        if (!pooled.connection.isConnected()) continue;
        closePromises.push(pooled.connection.close());
      }
    }
    
    // Wait for all connections to close
    await Promise.allSettled(closePromises);
    
    // Clear collections
    this.activeConnections.clear();
    this.connectionPool.clear();
    
    this.logger.info('Transport Factory shutdown complete');
  }
  
  /**
   * Find the best adapter for a transport type
   */
  private findAdapter(transport: TransportType, preferAdapter?: string): IConnectionAdapter | null {
    const adapters = this.getAdaptersForTransport(transport);
    
    // Filter only enabled adapters
    const enabledAdapters = adapters.filter(reg => reg.enabled);
    if (enabledAdapters.length === 0) {
      return null;
    }
    
    // If specific adapter is preferred, try to find it first
    if (preferAdapter) {
      const preferred = enabledAdapters.find(reg => reg.metadata.name === preferAdapter);
      if (preferred) {
        return preferred.adapter;
      }
      this.logger.warn(`Preferred adapter '${preferAdapter}' not found, using default selection`);
    }
    
    // Return highest priority adapter
    return enabledAdapters[0].adapter;
  }
  
  /**
   * Apply factory defaults to transport config
   */
  private applyDefaults(config: TransportConfig, timeoutOverride?: number): TransportConfig {
    return {
      ...config,
      timeout: timeoutOverride || config.timeout || this.config.defaultTimeout || 30000,
      debug: config.debug || this.config.debug || false
    };
  }
  
  /**
   * Get a pooled connection if available
   */
  private getPooledConnection(config: TransportConfig): PooledConnection | null {
    const configHash = this.hashConfig(config);
    const pooledConnections = this.connectionPool.get(configHash) || [];
    
    // Find an available connection that's still connected
    const available = pooledConnections.find(pooled => 
      !pooled.inUse && pooled.connection.isConnected()
    );
    
    return available || null;
  }
  
  /**
   * Add connection to pool for reuse
   */
  private addToPool(connection: IConnection, config: TransportConfig): void {
    const configHash = this.hashConfig(config);
    const existing = this.connectionPool.get(configHash) || [];
    
    const pooled: PooledConnection = {
      connection,
      createdAt: new Date(),
      useCount: 1,
      inUse: true,
      configHash
    };
    
    existing.push(pooled);
    this.connectionPool.set(configHash, existing);
  }
  
  /**
   * Remove connection from pool
   */
  private removeFromPool(connection: IConnection): void {
    for (const [hash, connections] of this.connectionPool) {
      const filtered = connections.filter(pooled => pooled.connection !== connection);
      if (filtered.length !== connections.length) {
        this.connectionPool.set(hash, filtered);
        if (filtered.length === 0) {
          this.connectionPool.delete(hash);
        }
        break;
      }
    }
  }
  
  /**
   * Hash transport config for pooling
   */
  private hashConfig(config: TransportConfig): string {
    // Create a deterministic hash of the config for pooling
    const key = {
      transport: config.transport,
      ...('url' in config ? { url: config.url } : {}),
      ...('command' in config ? { command: config.command, args: config.args } : {}),
      ...('path' in config ? { path: config.path } : {})
    };
    
    return JSON.stringify(key);
  }
  
  /**
   * Get total number of registered adapters
   */
  private getTotalAdapterCount(): number {
    let count = 0;
    for (const adapters of this.adapters.values()) {
      count += adapters.length;
    }
    return count;
  }
  
  /**
   * Get total number of pooled connections
   */
  private getTotalPooledConnections(): number {
    let count = 0;
    for (const connections of this.connectionPool.values()) {
      count += connections.length;
    }
    return count;
  }
}

/**
 * Default transport factory instance
 * This provides a global factory that can be used across the application
 */
let defaultFactory: TransportFactory | null = null;

/**
 * Get the default transport factory instance
 * @param config Optional configuration for the factory
 * @returns The default transport factory instance
 */
export function getTransportFactory(config?: TransportFactoryConfig): TransportFactory {
  if (!defaultFactory) {
    defaultFactory = new TransportFactory(config);
  }
  return defaultFactory;
}

/**
 * Set a custom default transport factory
 * @param factory The factory instance to use as default
 */
export function setTransportFactory(factory: TransportFactory): void {
  defaultFactory = factory;
}

/**
 * Reset the default transport factory (mainly for testing)
 */
export function resetTransportFactory(): void {
  defaultFactory = null;
}

/**
 * Convenience function to create a connection using the default factory
 * @param config Transport configuration
 * @param options Connection options
 * @returns Promise that resolves to a connection instance
 */
export async function createConnection(
  config: TransportConfig, 
  options?: {
    forceNew?: boolean;
    preferAdapter?: string;
    timeout?: number;
  }
): Promise<IConnection> {
  const factory = getTransportFactory();
  return factory.createConnection(config, options);
}