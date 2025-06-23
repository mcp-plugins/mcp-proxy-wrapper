/**
 * @file Advanced Connection Pooling and Load Balancing
 * @version 2.0.0
 * @status STABLE - Enterprise-grade connection management
 * 
 * Provides advanced connection pooling, load balancing, and health monitoring
 * for high-performance MCP proxy operations. Supports multiple load balancing
 * strategies, automatic failover, and comprehensive metrics.
 */

import { EventEmitter } from 'events';
import { 
  IConnection, 
  ConnectionState, 
  TransportConfig, 
  JsonRpcMessage,
  ConnectionError,
  TransportError
} from '../interfaces/connection.js';
import { TransportFactory } from './transport-factory.js';
import { createLogger } from '../utils/logger.js';

/**
 * Load balancing strategies
 */
export type LoadBalancingStrategy = 
  | 'round-robin' 
  | 'least-connections' 
  | 'weighted-round-robin'
  | 'least-response-time'
  | 'random'
  | 'resource-based';

/**
 * Connection pool configuration
 */
export interface ConnectionPoolConfig {
  /** Minimum number of connections to maintain */
  minConnections: number;
  
  /** Maximum number of connections allowed */
  maxConnections: number;
  
  /** Connection acquisition timeout */
  acquireTimeout: number;
  
  /** Maximum time a connection can be idle */
  maxIdleTime: number;
  
  /** Maximum lifetime of a connection */
  maxLifetime: number;
  
  /** Health check interval */
  healthCheckInterval: number;
  
  /** Load balancing strategy */
  loadBalancingStrategy: LoadBalancingStrategy;
  
  /** Connection weights (for weighted strategies) */
  connectionWeights?: Map<string, number>;
  
  /** Enable automatic scaling */
  autoScale: boolean;
  
  /** Scale up threshold (utilization %) */
  scaleUpThreshold: number;
  
  /** Scale down threshold (utilization %) */
  scaleDownThreshold: number;
  
  /** Enable connection pre-warming */
  preWarm: boolean;
  
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Pool connection wrapper with metadata
 */
export interface PooledConnection {
  /** The actual connection */
  connection: IConnection;
  
  /** When this connection was created */
  createdAt: Date;
  
  /** When this connection was last used */
  lastUsedAt: Date;
  
  /** Number of times this connection has been used */
  useCount: number;
  
  /** Current number of active operations */
  activeOperations: number;
  
  /** Average response time */
  averageResponseTime: number;
  
  /** Connection weight for load balancing */
  weight: number;
  
  /** Whether this connection is healthy */
  isHealthy: boolean;
  
  /** Health check failure count */
  healthCheckFailures: number;
  
  /** Custom metadata */
  metadata: Record<string, any>;
}

/**
 * Pool statistics
 */
export interface PoolStats {
  /** Total connections in pool */
  totalConnections: number;
  
  /** Active connections */
  activeConnections: number;
  
  /** Idle connections */
  idleConnections: number;
  
  /** Unhealthy connections */
  unhealthyConnections: number;
  
  /** Current pool utilization (%) */
  utilization: number;
  
  /** Total operations processed */
  totalOperations: number;
  
  /** Failed operations */
  failedOperations: number;
  
  /** Average response time */
  averageResponseTime: number;
  
  /** Connections created */
  connectionsCreated: number;
  
  /** Connections destroyed */
  connectionsDestroyed: number;
  
  /** Pool configuration */
  config: ConnectionPoolConfig;
}

/**
 * Advanced connection pool with load balancing
 */
export class ConnectionPool extends EventEmitter {
  private connections = new Map<string, PooledConnection>();
  private availableConnections = new Set<string>();
  private loadBalancer: LoadBalancer;
  private healthChecker: HealthChecker;
  private scaler: ConnectionScaler;
  private stats: PoolStats;
  private logger = createLogger({ level: 'info', prefix: 'CONNECTION-POOL' });
  private isShuttingDown = false;
  
  constructor(
    private transportConfigs: TransportConfig[],
    private factory: TransportFactory,
    private config: ConnectionPoolConfig
  ) {
    super();
    
    this.logger = createLogger({
      level: this.config.debug ? 'debug' : 'info',
      prefix: 'CONNECTION-POOL'
    });
    
    // Initialize components
    this.loadBalancer = new LoadBalancer(this.config.loadBalancingStrategy, this.config);
    this.healthChecker = new HealthChecker(this.config, this.logger);
    this.scaler = new ConnectionScaler(this.config, this.logger);
    
    // Initialize stats
    this.stats = {
      totalConnections: 0,
      activeConnections: 0,
      idleConnections: 0,
      unhealthyConnections: 0,
      utilization: 0,
      totalOperations: 0,
      failedOperations: 0,
      averageResponseTime: 0,
      connectionsCreated: 0,
      connectionsDestroyed: 0,
      config: this.config
    };
    
    this.logger.info('Connection pool initialized', {
      minConnections: this.config.minConnections,
      maxConnections: this.config.maxConnections,
      strategy: this.config.loadBalancingStrategy,
      transportConfigs: this.transportConfigs.length
    });
  }
  
  /**
   * Initialize the connection pool
   */
  async initialize(): Promise<void> {
    this.logger.info('Initializing connection pool');
    
    try {
      // Create minimum connections
      await this.createMinimumConnections();
      
      // Start health checking
      this.healthChecker.start(this.connections, (connectionId) => {
        this.handleUnhealthyConnection(connectionId);
      });
      
      // Start auto-scaling if enabled
      if (this.config.autoScale) {
        this.scaler.start(this.stats, async (action, count) => {
          if (action === 'scale-up') {
            await this.scaleUp(count);
          } else {
            await this.scaleDown(count);
          }
        });
      }
      
      this.logger.info('Connection pool initialization complete', {
        initialConnections: this.connections.size
      });
      
    } catch (error) {
      this.logger.error('Failed to initialize connection pool:', error);
      throw new Error(`Pool initialization failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * Acquire a connection from the pool
   */
  async acquireConnection(): Promise<IConnection> {
    if (this.isShuttingDown) {
      throw new ConnectionError('Pool is shutting down', 'POOL_SHUTDOWN', 'http');
    }
    
    const startTime = Date.now();
    
    try {
      // Select connection using load balancer
      const connectionId = await this.selectConnection();
      
      if (!connectionId) {
        throw new ConnectionError('No healthy connections available', 'NO_CONNECTIONS', 'http');
      }
      
      const pooled = this.connections.get(connectionId)!;
      
      // Mark as active
      pooled.activeOperations++;
      pooled.lastUsedAt = new Date();
      pooled.useCount++;
      
      // Remove from available if at capacity
      if (pooled.activeOperations >= this.getConnectionCapacity(pooled)) {
        this.availableConnections.delete(connectionId);
      }
      
      this.updateStats();
      
      const acquisitionTime = Date.now() - startTime;
      this.logger.debug('Connection acquired', {
        connectionId,
        acquisitionTime,
        activeOperations: pooled.activeOperations
      });
      
      return new PooledConnectionWrapper(pooled, this);
      
    } catch (error) {
      this.stats.failedOperations++;
      this.logger.error('Failed to acquire connection:', error);
      throw error;
    }
  }
  
  /**
   * Release a connection back to the pool
   */
  releaseConnection(connectionId: string, responseTime?: number): void {
    const pooled = this.connections.get(connectionId);
    if (!pooled) {
      this.logger.warn('Attempted to release unknown connection', { connectionId });
      return;
    }
    
    // Update operation count
    pooled.activeOperations = Math.max(0, pooled.activeOperations - 1);
    
    // Update response time
    if (responseTime !== undefined) {
      const count = pooled.useCount;
      pooled.averageResponseTime = ((pooled.averageResponseTime * (count - 1)) + responseTime) / count;
    }
    
    // Mark as available if healthy and not at idle limit
    if (pooled.isHealthy && pooled.activeOperations === 0) {
      this.availableConnections.add(connectionId);
    }
    
    this.updateStats();
    
    this.logger.debug('Connection released', {
      connectionId,
      activeOperations: pooled.activeOperations,
      responseTime
    });
  }
  
  /**
   * Get pool statistics
   */
  getStats(): PoolStats {
    this.updateStats();
    return { ...this.stats };
  }
  
  /**
   * Shutdown the connection pool
   */
  async shutdown(): Promise<void> {
    if (this.isShuttingDown) {
      return;
    }
    
    this.isShuttingDown = true;
    this.logger.info('Shutting down connection pool', {
      totalConnections: this.connections.size
    });
    
    try {
      // Stop components
      this.healthChecker.stop();
      this.scaler.stop();
      
      // Close all connections
      const closePromises: Promise<void>[] = [];
      for (const [connectionId, pooled] of this.connections) {
        closePromises.push(
          pooled.connection.close().catch(error => {
            this.logger.error(`Error closing connection ${connectionId}:`, error);
          })
        );
      }
      
      await Promise.allSettled(closePromises);
      
      // Clear collections
      this.connections.clear();
      this.availableConnections.clear();
      
      this.logger.info('Connection pool shutdown complete');
      
    } catch (error) {
      this.logger.error('Error during pool shutdown:', error);
      throw error;
    }
  }
  
  /**
   * Create minimum number of connections
   */
  private async createMinimumConnections(): Promise<void> {
    const promises: Promise<void>[] = [];
    
    for (let i = 0; i < this.config.minConnections; i++) {
      promises.push(this.createConnection().then(() => {}));
    }
    
    await Promise.all(promises);
  }
  
  /**
   * Create a new connection
   */
  private async createConnection(): Promise<string> {
    if (this.connections.size >= this.config.maxConnections) {
      throw new Error('Maximum connections limit reached');
    }
    
    // Select transport config (round-robin for now)
    const configIndex = this.stats.connectionsCreated % this.transportConfigs.length;
    const transportConfig = this.transportConfigs[configIndex];
    
    try {
      const connection = await this.factory.createConnection(transportConfig);
      
      const pooled: PooledConnection = {
        connection,
        createdAt: new Date(),
        lastUsedAt: new Date(),
        useCount: 0,
        activeOperations: 0,
        averageResponseTime: 0,
        weight: this.config.connectionWeights?.get(connection.id) || 1,
        isHealthy: true,
        healthCheckFailures: 0,
        metadata: {}
      };
      
      this.connections.set(connection.id, pooled);
      this.availableConnections.add(connection.id);
      this.stats.connectionsCreated++;
      
      // Set up connection event handlers
      this.setupConnectionHandlers(pooled);
      
      this.logger.debug('Connection created', {
        connectionId: connection.id,
        transport: connection.transport,
        totalConnections: this.connections.size
      });
      
      return connection.id;
      
    } catch (error) {
      this.logger.error('Failed to create connection:', error);
      throw error;
    }
  }
  
  /**
   * Set up event handlers for a pooled connection
   */
  private setupConnectionHandlers(pooled: PooledConnection): void {
    pooled.connection.onStateChange((state) => {
      if (state === ConnectionState.ERROR || state === ConnectionState.CLOSED) {
        this.handleConnectionFailure(pooled.connection.id);
      }
    });
    
    pooled.connection.onError((error) => {
      this.logger.error(`Connection ${pooled.connection.id} error:`, error);
      this.handleConnectionFailure(pooled.connection.id);
    });
  }
  
  /**
   * Handle connection failure
   */
  private handleConnectionFailure(connectionId: string): void {
    const pooled = this.connections.get(connectionId);
    if (!pooled) return;
    
    pooled.isHealthy = false;
    this.availableConnections.delete(connectionId);
    
    this.logger.warn('Connection failed', {
      connectionId,
      activeOperations: pooled.activeOperations
    });
    
    // Remove from pool if no active operations
    if (pooled.activeOperations === 0) {
      this.removeConnection(connectionId);
    }
  }
  
  /**
   * Handle unhealthy connection from health check
   */
  private handleUnhealthyConnection(connectionId: string): void {
    const pooled = this.connections.get(connectionId);
    if (!pooled) return;
    
    pooled.healthCheckFailures++;
    
    // Remove after multiple failures
    if (pooled.healthCheckFailures >= 3) {
      this.removeConnection(connectionId);
    } else {
      pooled.isHealthy = false;
      this.availableConnections.delete(connectionId);
    }
  }
  
  /**
   * Remove connection from pool
   */
  private async removeConnection(connectionId: string): Promise<void> {
    const pooled = this.connections.get(connectionId);
    if (!pooled) return;
    
    this.connections.delete(connectionId);
    this.availableConnections.delete(connectionId);
    this.stats.connectionsDestroyed++;
    
    try {
      await pooled.connection.close();
    } catch (error) {
      this.logger.error(`Error closing connection ${connectionId}:`, error);
    }
    
    this.logger.debug('Connection removed', {
      connectionId,
      remainingConnections: this.connections.size
    });
    
    // Create replacement if below minimum
    if (this.connections.size < this.config.minConnections && !this.isShuttingDown) {
      this.createConnection().catch(error => {
        this.logger.error('Failed to create replacement connection:', error);
      });
    }
  }
  
  /**
   * Select connection using load balancing strategy
   */
  private async selectConnection(): Promise<string | null> {
    const healthyConnections = Array.from(this.availableConnections)
      .filter(id => {
        const pooled = this.connections.get(id);
        return pooled && pooled.isHealthy;
      });
    
    if (healthyConnections.length === 0) {
      // Try to create new connection if possible
      if (this.connections.size < this.config.maxConnections) {
        try {
          return await this.createConnection();
        } catch (error) {
          this.logger.error('Failed to create new connection:', error);
        }
      }
      return null;
    }
    
    return this.loadBalancer.selectConnection(healthyConnections, this.connections);
  }
  
  /**
   * Scale up the pool
   */
  private async scaleUp(count: number): Promise<void> {
    this.logger.info(`Scaling up pool by ${count} connections`);
    
    const promises: Promise<string>[] = [];
    const maxNew = Math.min(count, this.config.maxConnections - this.connections.size);
    
    for (let i = 0; i < maxNew; i++) {
      promises.push(this.createConnection());
    }
    
    await Promise.allSettled(promises);
  }
  
  /**
   * Scale down the pool
   */
  private async scaleDown(count: number): Promise<void> {
    this.logger.info(`Scaling down pool by ${count} connections`);
    
    // Remove idle connections
    const idleConnections = Array.from(this.connections.entries())
      .filter(([id, pooled]) => pooled.activeOperations === 0 && pooled.isHealthy)
      .sort((a, b) => a[1].lastUsedAt.getTime() - b[1].lastUsedAt.getTime())
      .slice(0, count);
    
    for (const [connectionId] of idleConnections) {
      await this.removeConnection(connectionId);
    }
  }
  
  /**
   * Update pool statistics
   */
  private updateStats(): void {
    let activeConnections = 0;
    let idleConnections = 0;
    let unhealthyConnections = 0;
    let totalResponseTime = 0;
    let totalOperations = 0;
    
    for (const pooled of this.connections.values()) {
      if (pooled.activeOperations > 0) {
        activeConnections++;
      } else {
        idleConnections++;
      }
      
      if (!pooled.isHealthy) {
        unhealthyConnections++;
      }
      
      totalResponseTime += pooled.averageResponseTime * pooled.useCount;
      totalOperations += pooled.useCount;
    }
    
    this.stats.totalConnections = this.connections.size;
    this.stats.activeConnections = activeConnections;
    this.stats.idleConnections = idleConnections;
    this.stats.unhealthyConnections = unhealthyConnections;
    this.stats.utilization = this.connections.size > 0 
      ? (activeConnections / this.connections.size) * 100 
      : 0;
    this.stats.averageResponseTime = totalOperations > 0 
      ? totalResponseTime / totalOperations 
      : 0;
    this.stats.totalOperations = totalOperations;
  }
  
  /**
   * Get connection capacity (max concurrent operations)
   */
  private getConnectionCapacity(pooled: PooledConnection): number {
    // Could be transport-specific or configurable
    return pooled.connection.transport === 'stdio' ? 1 : 10;
  }
}

/**
 * Load balancer implementation
 */
class LoadBalancer {
  private roundRobinIndex = 0;
  
  constructor(
    private strategy: LoadBalancingStrategy,
    private config: ConnectionPoolConfig
  ) {}
  
  selectConnection(
    availableIds: string[],
    connections: Map<string, PooledConnection>
  ): string {
    switch (this.strategy) {
      case 'round-robin':
        return this.roundRobin(availableIds);
      
      case 'least-connections':
        return this.leastConnections(availableIds, connections);
      
      case 'weighted-round-robin':
        return this.weightedRoundRobin(availableIds, connections);
      
      case 'least-response-time':
        return this.leastResponseTime(availableIds, connections);
      
      case 'random':
        return this.random(availableIds);
      
      case 'resource-based':
        return this.resourceBased(availableIds, connections);
      
      default:
        return this.roundRobin(availableIds);
    }
  }
  
  private roundRobin(availableIds: string[]): string {
    const selected = availableIds[this.roundRobinIndex % availableIds.length];
    this.roundRobinIndex++;
    return selected;
  }
  
  private leastConnections(
    availableIds: string[],
    connections: Map<string, PooledConnection>
  ): string {
    return availableIds.reduce((best, id) => {
      const current = connections.get(id)!;
      const bestConn = connections.get(best)!;
      return current.activeOperations < bestConn.activeOperations ? id : best;
    });
  }
  
  private weightedRoundRobin(
    availableIds: string[],
    connections: Map<string, PooledConnection>
  ): string {
    // Simplified weighted selection
    const weighted = availableIds.flatMap(id => {
      const weight = connections.get(id)!.weight;
      return Array(Math.max(1, Math.round(weight))).fill(id);
    });
    
    return this.roundRobin(weighted);
  }
  
  private leastResponseTime(
    availableIds: string[],
    connections: Map<string, PooledConnection>
  ): string {
    return availableIds.reduce((best, id) => {
      const current = connections.get(id)!;
      const bestConn = connections.get(best)!;
      return current.averageResponseTime < bestConn.averageResponseTime ? id : best;
    });
  }
  
  private random(availableIds: string[]): string {
    return availableIds[Math.floor(Math.random() * availableIds.length)];
  }
  
  private resourceBased(
    availableIds: string[],
    connections: Map<string, PooledConnection>
  ): string {
    // Combine multiple factors
    return availableIds.reduce((best, id) => {
      const current = connections.get(id)!;
      const bestConn = connections.get(best)!;
      
      const currentScore = this.calculateResourceScore(current);
      const bestScore = this.calculateResourceScore(bestConn);
      
      return currentScore > bestScore ? id : best;
    });
  }
  
  private calculateResourceScore(pooled: PooledConnection): number {
    // Higher score = better choice
    let score = 100;
    
    // Penalize for active operations
    score -= pooled.activeOperations * 20;
    
    // Penalize for slow response time
    score -= Math.min(pooled.averageResponseTime / 100, 50);
    
    // Bonus for weight
    score += pooled.weight * 10;
    
    return Math.max(0, score);
  }
}

/**
 * Health checker implementation
 */
class HealthChecker {
  private interval?: NodeJS.Timeout;
  
  constructor(
    private config: ConnectionPoolConfig,
    private logger: any
  ) {}
  
  start(
    connections: Map<string, PooledConnection>,
    onUnhealthy: (connectionId: string) => void
  ): void {
    this.interval = setInterval(async () => {
      await this.checkConnections(connections, onUnhealthy);
    }, this.config.healthCheckInterval);
  }
  
  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = undefined;
    }
  }
  
  private async checkConnections(
    connections: Map<string, PooledConnection>,
    onUnhealthy: (connectionId: string) => void
  ): Promise<void> {
    for (const [connectionId, pooled] of connections) {
      try {
        // Basic health check
        if (!pooled.connection.isConnected()) {
          onUnhealthy(connectionId);
          continue;
        }
        
        // Check for idle timeout
        const idleTime = Date.now() - pooled.lastUsedAt.getTime();
        if (idleTime > this.config.maxIdleTime) {
          this.logger.debug(`Connection ${connectionId} exceeded idle time`);
          onUnhealthy(connectionId);
          continue;
        }
        
        // Check for lifetime limit
        const lifetime = Date.now() - pooled.createdAt.getTime();
        if (lifetime > this.config.maxLifetime) {
          this.logger.debug(`Connection ${connectionId} exceeded lifetime`);
          onUnhealthy(connectionId);
          continue;
        }
        
        // Reset health if previously unhealthy
        if (!pooled.isHealthy) {
          pooled.isHealthy = true;
          pooled.healthCheckFailures = 0;
        }
        
      } catch (error) {
        this.logger.error(`Health check failed for ${connectionId}:`, error);
        onUnhealthy(connectionId);
      }
    }
  }
}

/**
 * Connection scaler implementation
 */
class ConnectionScaler {
  private interval?: NodeJS.Timeout;
  
  constructor(
    private config: ConnectionPoolConfig,
    private logger: any
  ) {}
  
  start(
    stats: PoolStats,
    onScale: (action: 'scale-up' | 'scale-down', count: number) => Promise<void>
  ): void {
    this.interval = setInterval(() => {
      this.checkScaling(stats, onScale);
    }, 10000); // Check every 10 seconds
  }
  
  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = undefined;
    }
  }
  
  private checkScaling(
    stats: PoolStats,
    onScale: (action: 'scale-up' | 'scale-down', count: number) => Promise<void>
  ): void {
    if (stats.utilization > this.config.scaleUpThreshold) {
      const scaleCount = Math.ceil(stats.totalConnections * 0.2); // Scale by 20%
      onScale('scale-up', scaleCount).catch(error => {
        this.logger.error('Scale-up failed:', error);
      });
    } else if (stats.utilization < this.config.scaleDownThreshold) {
      const scaleCount = Math.floor(stats.totalConnections * 0.1); // Scale down by 10%
      if (stats.totalConnections - scaleCount >= this.config.minConnections) {
        onScale('scale-down', scaleCount).catch(error => {
          this.logger.error('Scale-down failed:', error);
        });
      }
    }
  }
}

/**
 * Wrapper that tracks connection usage
 */
class PooledConnectionWrapper implements IConnection {
  constructor(
    private pooled: PooledConnection,
    private pool: ConnectionPool
  ) {}
  
  get id(): string {
    return this.pooled.connection.id;
  }
  
  get transport() {
    return this.pooled.connection.transport;
  }
  
  get state() {
    return this.pooled.connection.state;
  }
  
  async send(message: JsonRpcMessage): Promise<void> {
    const startTime = Date.now();
    try {
      await this.pooled.connection.send(message);
      const responseTime = Date.now() - startTime;
      this.pool.releaseConnection(this.id, responseTime);
    } catch (error) {
      this.pool.releaseConnection(this.id);
      throw error;
    }
  }
  
  onMessage(handler: (message: JsonRpcMessage) => void): void {
    this.pooled.connection.onMessage(handler);
  }
  
  onStateChange(handler: (state: ConnectionState) => void): void {
    this.pooled.connection.onStateChange(handler);
  }
  
  onError(handler: (error: Error) => void): void {
    this.pooled.connection.onError(handler);
  }
  
  async close(): Promise<void> {
    // Don't actually close pooled connections
    this.pool.releaseConnection(this.id);
  }
  
  isConnected(): boolean {
    return this.pooled.connection.isConnected();
  }
  
  getStats() {
    return this.pooled.connection.getStats();
  }
}