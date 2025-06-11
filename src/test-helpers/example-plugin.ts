/**
 * @file Example Test Plugin
 * @description A comprehensive example plugin that demonstrates all plugin features
 */

import { BasePlugin, PluginContext, PluginConfig } from '../interfaces/plugin.js';
import { ToolCallContext, ToolCallResult } from '../interfaces/proxy-hooks.js';

/**
 * Example plugin that demonstrates all plugin capabilities
 */
export class ExamplePlugin extends BasePlugin {
  name = 'example-plugin';
  version = '1.0.0';
  
  metadata = {
    description: 'An example plugin that demonstrates all plugin features',
    author: 'MCP Proxy Wrapper Team',
    tags: ['example', 'demo', 'test']
  };
  
  // Configuration
  config: PluginConfig = {
    enabled: true,
    priority: 100,
    options: {
      logRequests: true,
      addTimestamps: true,
      maxProcessingTime: 5000
    },
    includeTools: [],
    excludeTools: [],
    debug: false
  };
  
  // Internal state for testing
  public initializeCalled = false;
  public destroyCalled = false;
  
  private callHistory: Array<{
    toolName: string;
    timestamp: number;
    duration?: number;
    success: boolean;
  }> = [];
  
  private startTimes = new Map<string, number>();
  
  /**
   * Initialize the plugin
   */
  async initialize(context: any): Promise<void> {
    await super.initialize(context);
    this.initializeCalled = true;
    
    this.logger?.info('Example plugin initialized with config:', this.config.options);
    
    // Initialize any resources, connections, etc.
    this.callHistory = [];
    this.startTimes.clear();
  }
  
  /**
   * Before tool call hook - demonstrates argument modification and short-circuiting
   */
  async beforeToolCall(context: PluginContext): Promise<void | ToolCallResult> {
    const requestId = Math.random().toString(36).substr(2, 9);
    const startTime = Date.now();
    
    // Store start time for duration calculation
    this.startTimes.set(requestId, startTime);
    context.args._requestId = requestId;
    
    // Log request if enabled
    if (this.config.options?.logRequests) {
      this.logger?.debug(`Processing tool call: ${context.toolName}`, {
        requestId,
        args: context.args,
        timestamp: startTime
      });
    }
    
    // Add timestamps if enabled
    if (this.config.options?.addTimestamps) {
      context.args._timestamp = new Date().toISOString();
    }
    
    // Example: Block certain tools
    if (context.toolName === 'dangerous-tool') {
      this.callHistory.push({
        toolName: context.toolName,
        timestamp: startTime,
        success: false
      });
      
      return {
        result: {
          content: [{
            type: 'text',
            text: 'This tool has been blocked by the example plugin for safety reasons.'
          }],
          isError: true
        }
      };
    }
    
    // Example: Add default parameters
    if (context.toolName === 'greet' && !context.args.greeting) {
      context.args.greeting = 'Hello';
    }
    
    // Example: Validate arguments
    if (context.toolName === 'calculate') {
      if (typeof context.args.a !== 'number' || typeof context.args.b !== 'number') {
        return {
          result: {
            content: [{
              type: 'text',
              text: 'Invalid arguments: Both a and b must be numbers'
            }],
            isError: true
          }
        };
      }
    }
    
    // Track call start
    this.callHistory.push({
      toolName: context.toolName,
      timestamp: startTime,
      success: true
    });
  }
  
  /**
   * After tool call hook - demonstrates result modification and metadata addition
   */
  async afterToolCall(context: PluginContext, result: ToolCallResult): Promise<ToolCallResult> {
    const requestId = context.args._requestId;
    const startTime = this.startTimes.get(requestId);
    const duration = startTime ? Date.now() - startTime : 0;
    
    // Update call history with duration
    const historyEntry = this.callHistory.find(
      entry => entry.toolName === context.toolName && entry.timestamp === startTime
    );
    if (historyEntry) {
      historyEntry.duration = duration;
      historyEntry.success = !result.result.isError;
    }
    
    // Clean up
    if (requestId) {
      this.startTimes.delete(requestId);
    }
    
    // Add metadata to successful results
    if (!result.result.isError) {
      result.result._plugin_metadata = {
        processedBy: this.name,
        version: this.version,
        requestId,
        processingTime: duration,
        timestamp: new Date().toISOString()
      };
      
      // Example: Transform results for specific tools
      if (context.toolName === 'greet' && result.result.content) {
        const content = result.result.content[0];
        if (content.type === 'text') {
          content.text = `🎉 ${content.text}`;
        }
      }
      
      // Example: Add performance warnings
      if (duration > (this.config.options?.maxProcessingTime || 1000)) {
        this.logger?.warn(`Slow tool execution detected: ${context.toolName} took ${duration}ms`);
        
        result.result._performance_warning = {
          message: 'Tool execution exceeded expected time',
          duration,
          threshold: this.config.options?.maxProcessingTime
        };
      }
    }
    
    // Log completion
    if (this.config.options?.logRequests) {
      this.logger?.debug(`Completed tool call: ${context.toolName}`, {
        requestId,
        duration,
        success: !result.result.isError
      });
    }
    
    // Update stats
    this.updateStats(duration, !!result.result.isError);
    
    return result;
  }
  
  /**
   * Handle plugin errors
   */
  async onError(error: any): Promise<void> {
    this.logger?.error(`Plugin error in ${error.phase}:`, {
      pluginName: error.pluginName,
      error: error.error.message,
      toolName: error.context?.toolName
    });
    
    // Could implement error recovery logic here
    // For example, reset state, reconnect to services, etc.
  }
  
  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    // Check if plugin is functioning correctly
    const recentFailures = this.callHistory
      .filter(call => Date.now() - call.timestamp < 60000) // Last minute
      .filter(call => !call.success).length;
    
    // Consider unhealthy if too many recent failures
    const isHealthy = recentFailures < 5;
    
    if (!isHealthy) {
      this.logger?.warn(`Plugin health check failed: ${recentFailures} failures in last minute`);
    }
    
    return isHealthy;
  }
  
  /**
   * Get plugin statistics
   */
  async getStats() {
    const baseStats = await super.getStats();
    
    return {
      ...baseStats,
      customMetrics: {
        totalCalls: this.callHistory.length,
        successfulCalls: this.callHistory.filter(call => call.success).length,
        averageDuration: this.callHistory.reduce((sum, call) => 
          sum + (call.duration || 0), 0) / Math.max(this.callHistory.length, 1),
        slowCalls: this.callHistory.filter(call => 
          (call.duration || 0) > (this.config.options?.maxProcessingTime || 1000)).length
      }
    };
  }
  
  /**
   * Cleanup when plugin is destroyed
   */
  async destroy(): Promise<void> {
    this.destroyCalled = true;
    this.logger?.info('Example plugin shutting down');
    
    // Log final statistics
    const stats = await this.getStats();
    this.logger?.info('Final plugin statistics:', stats);
    
    // Cleanup resources
    this.callHistory = [];
    this.startTimes.clear();
  }
  
  // Public methods for testing
  
  /**
   * Get call history (for testing)
   */
  getCallHistory() {
    return [...this.callHistory];
  }
  
  /**
   * Get current configuration (for testing)
   */
  getConfig() {
    return { ...this.config };
  }
  
  /**
   * Update configuration (for testing)
   */
  updateConfig(newConfig: any) {
    this.config = { ...this.config, ...newConfig };
  }
  
  /**
   * Clear history (for testing)
   */
  clearHistory() {
    this.callHistory = [];
    this.startTimes.clear();
  }
}