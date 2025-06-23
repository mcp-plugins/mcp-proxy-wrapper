/**
 * @file Graceful Shutdown Manager
 * @version 2.0.0
 * @status STABLE - Graceful shutdown and resource cleanup
 * 
 * Manages graceful shutdown of the MCP Proxy Wrapper application,
 * ensuring all resources are properly cleaned up when the process
 * receives termination signals.
 */

import { createLogger } from './logger.js';

/**
 * Shutdown handler function type
 */
export type ShutdownHandler = () => Promise<void> | void;

/**
 * Shutdown configuration
 */
export interface ShutdownConfig {
  /** Timeout for graceful shutdown in milliseconds */
  timeout?: number;
  
  /** Whether to exit the process after shutdown */
  exitProcess?: boolean;
  
  /** Exit code to use when exiting */
  exitCode?: number;
  
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Registered shutdown handler
 */
interface RegisteredHandler {
  /** Unique handler ID */
  id: string;
  
  /** The handler function */
  handler: ShutdownHandler;
  
  /** Handler description for logging */
  description: string;
  
  /** Priority (higher = executed first) */
  priority: number;
  
  /** Timeout for this specific handler */
  timeout?: number;
}

/**
 * Graceful shutdown manager
 */
export class ShutdownManager {
  private handlers = new Map<string, RegisteredHandler>();
  private isShuttingDown = false;
  private shutdownStartTime?: Date;
  private logger = createLogger({ level: 'info', prefix: 'SHUTDOWN-MANAGER' });
  private signalHandlers = new Map<string, (...args: any[]) => void>();
  
  constructor(private config: ShutdownConfig = {}) {
    this.logger = createLogger({
      level: this.config.debug ? 'debug' : 'info',
      prefix: 'SHUTDOWN-MANAGER'
    });
    
    // Set up signal handlers
    this.setupSignalHandlers();
    
    this.logger.info('Shutdown Manager initialized', {
      timeout: this.config.timeout || 30000,
      exitProcess: this.config.exitProcess !== false
    });
  }
  
  /**
   * Register a shutdown handler
   */
  register(
    id: string,
    handler: ShutdownHandler,
    options: {
      description?: string;
      priority?: number;
      timeout?: number;
    } = {}
  ): void {
    if (this.isShuttingDown) {
      this.logger.warn(`Cannot register handler '${id}' during shutdown`);
      return;
    }
    
    if (this.handlers.has(id)) {
      this.logger.warn(`Handler '${id}' already registered, replacing`);
    }
    
    const registered: RegisteredHandler = {
      id,
      handler,
      description: options.description || id,
      priority: options.priority || 0,
      timeout: options.timeout
    };
    
    this.handlers.set(id, registered);
    
    this.logger.debug(`Registered shutdown handler: ${registered.description}`, {
      id,
      priority: registered.priority,
      timeout: registered.timeout
    });
  }
  
  /**
   * Unregister a shutdown handler
   */
  unregister(id: string): boolean {
    if (this.isShuttingDown) {
      this.logger.warn(`Cannot unregister handler '${id}' during shutdown`);
      return false;
    }
    
    const removed = this.handlers.delete(id);
    if (removed) {
      this.logger.debug(`Unregistered shutdown handler: ${id}`);
    }
    
    return removed;
  }
  
  /**
   * Trigger graceful shutdown manually
   */
  async shutdown(reason: string = 'Manual shutdown'): Promise<void> {
    if (this.isShuttingDown) {
      this.logger.warn('Shutdown already in progress');
      return;
    }
    
    this.isShuttingDown = true;
    this.shutdownStartTime = new Date();
    
    this.logger.info(`Initiating graceful shutdown: ${reason}`, {
      handlerCount: this.handlers.size,
      timeout: this.config.timeout || 30000
    });
    
    try {
      await this.executeShutdownHandlers();
      
      const shutdownTime = Date.now() - this.shutdownStartTime.getTime();
      this.logger.info('Graceful shutdown completed successfully', {
        duration: shutdownTime,
        handlersExecuted: this.handlers.size
      });
      
      if (this.config.exitProcess !== false) {
        process.exit(this.config.exitCode || 0);
      }
      
    } catch (error) {
      const shutdownTime = this.shutdownStartTime 
        ? Date.now() - this.shutdownStartTime.getTime() 
        : 0;
      
      this.logger.error('Graceful shutdown failed:', error, {
        duration: shutdownTime
      });
      
      if (this.config.exitProcess !== false) {
        process.exit(this.config.exitCode || 1);
      }
      
      throw error;
    }
  }
  
  /**
   * Check if shutdown is in progress
   */
  isShutdownInProgress(): boolean {
    return this.isShuttingDown;
  }
  
  /**
   * Get shutdown statistics
   */
  getStats() {
    return {
      handlerCount: this.handlers.size,
      isShuttingDown: this.isShuttingDown,
      shutdownStartTime: this.shutdownStartTime,
      handlers: Array.from(this.handlers.values()).map(h => ({
        id: h.id,
        description: h.description,
        priority: h.priority,
        timeout: h.timeout
      }))
    };
  }
  
  /**
   * Cleanup and remove signal handlers
   */
  cleanup(): void {
    this.logger.debug('Cleaning up shutdown manager');
    
    // Remove signal handlers
    for (const [signal, handler] of this.signalHandlers) {
      try {
        process.removeListener(signal as NodeJS.Signals, handler);
      } catch (error) {
        this.logger.error(`Error removing ${signal} handler:`, error);
      }
    }
    
    this.signalHandlers.clear();
    this.handlers.clear();
  }
  
  /**
   * Set up signal handlers for graceful shutdown
   */
  private setupSignalHandlers(): void {
    const signals: NodeJS.Signals[] = ['SIGTERM', 'SIGINT'];
    
    for (const signal of signals) {
      const handler = () => {
        this.logger.info(`Received ${signal}, initiating graceful shutdown`);
        this.shutdown(`${signal} signal received`).catch(error => {
          this.logger.error(`Error during ${signal} shutdown:`, error);
          process.exit(1);
        });
      };
      
      this.signalHandlers.set(signal, handler);
      process.on(signal, handler);
      
      this.logger.debug(`Registered ${signal} handler`);
    }
    
    // Handle uncaught exceptions
    const uncaughtExceptionHandler = (error: Error) => {
      this.logger.error('Uncaught exception, initiating emergency shutdown:', error);
      this.shutdown('Uncaught exception').catch(() => {
        process.exit(1);
      });
    };
    
    const unhandledRejectionHandler = (reason: any, promise: Promise<any>) => {
      this.logger.error('Unhandled promise rejection, initiating shutdown:', {
        reason: reason instanceof Error ? reason.message : String(reason),
        promise: String(promise)
      });
      this.shutdown('Unhandled promise rejection').catch(() => {
        process.exit(1);
      });
    };
    
    process.on('uncaughtException', uncaughtExceptionHandler);
    process.on('unhandledRejection', unhandledRejectionHandler);
    
    this.signalHandlers.set('uncaughtException', uncaughtExceptionHandler);
    this.signalHandlers.set('unhandledRejection', unhandledRejectionHandler);
  }
  
  /**
   * Execute all shutdown handlers in priority order
   */
  private async executeShutdownHandlers(): Promise<void> {
    if (this.handlers.size === 0) {
      this.logger.debug('No shutdown handlers to execute');
      return;
    }
    
    // Sort handlers by priority (highest first)
    const sortedHandlers = Array.from(this.handlers.values())
      .sort((a, b) => b.priority - a.priority);
    
    this.logger.debug(`Executing ${sortedHandlers.length} shutdown handlers`, {
      handlers: sortedHandlers.map(h => ({
        id: h.id,
        description: h.description,
        priority: h.priority
      }))
    });
    
    const globalTimeout = this.config.timeout || 30000;
    const startTime = Date.now();
    
    for (const handler of sortedHandlers) {
      const remainingTime = globalTimeout - (Date.now() - startTime);
      
      if (remainingTime <= 0) {
        this.logger.warn(`Global shutdown timeout exceeded, skipping remaining handlers`);
        break;
      }
      
      const handlerTimeout = Math.min(
        handler.timeout || remainingTime,
        remainingTime
      );
      
      this.logger.debug(`Executing shutdown handler: ${handler.description}`, {
        id: handler.id,
        timeout: handlerTimeout,
        remainingGlobalTime: remainingTime
      });
      
      try {
        await this.executeHandlerWithTimeout(handler, handlerTimeout);
        
        this.logger.debug(`Successfully executed handler: ${handler.description}`, {
          id: handler.id
        });
        
      } catch (error) {
        this.logger.error(`Error in shutdown handler '${handler.description}':`, error, {
          id: handler.id
        });
        
        // Continue with other handlers even if one fails
        continue;
      }
    }
    
    const totalTime = Date.now() - startTime;
    this.logger.debug('All shutdown handlers completed', {
      duration: totalTime,
      handlersExecuted: sortedHandlers.length
    });
  }
  
  /**
   * Execute a single handler with timeout
   */
  private async executeHandlerWithTimeout(
    handler: RegisteredHandler,
    timeout: number
  ): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Handler '${handler.description}' timed out after ${timeout}ms`));
      }, timeout);
      
      try {
        const result = handler.handler();
        
        if (result instanceof Promise) {
          result
            .then(() => {
              clearTimeout(timer);
              resolve();
            })
            .catch((error) => {
              clearTimeout(timer);
              reject(error);
            });
        } else {
          clearTimeout(timer);
          resolve();
        }
      } catch (error) {
        clearTimeout(timer);
        reject(error);
      }
    });
  }
}

/**
 * Global shutdown manager instance
 */
let globalShutdownManager: ShutdownManager | null = null;

/**
 * Get the global shutdown manager instance
 */
export function getShutdownManager(config?: ShutdownConfig): ShutdownManager {
  if (!globalShutdownManager) {
    globalShutdownManager = new ShutdownManager(config);
  }
  return globalShutdownManager;
}

/**
 * Set a custom shutdown manager instance
 */
export function setShutdownManager(manager: ShutdownManager): void {
  globalShutdownManager = manager;
}

/**
 * Register a shutdown handler with the global manager
 */
export function registerShutdownHandler(
  id: string,
  handler: ShutdownHandler,
  options?: {
    description?: string;
    priority?: number;
    timeout?: number;
  }
): void {
  const manager = getShutdownManager();
  manager.register(id, handler, options);
}

/**
 * Unregister a shutdown handler from the global manager
 */
export function unregisterShutdownHandler(id: string): boolean {
  if (!globalShutdownManager) {
    return false;
  }
  return globalShutdownManager.unregister(id);
}

/**
 * Trigger graceful shutdown
 */
export async function gracefulShutdown(reason?: string): Promise<void> {
  const manager = getShutdownManager();
  await manager.shutdown(reason);
}