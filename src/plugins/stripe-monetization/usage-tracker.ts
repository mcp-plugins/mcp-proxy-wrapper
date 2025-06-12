/**
 * @file Usage Tracker for Stripe Monetization Plugin
 * @version 1.0.0
 * @description Tracks API usage, implements rate limiting, and manages quotas
 * 
 * Features:
 * - Real-time usage tracking
 * - Rate limiting with multiple windows
 * - Quota management
 * - Usage analytics and reporting
 * - Memory-efficient sliding window counters
 */

import { DatabaseManager } from './database.js';
import { MonetizationError, RateLimitExceededError } from './interfaces.js';

/**
 * Rate limiting configuration
 */
export interface RateLimitConfig {
  enabled: boolean;
  windowMs: number;
  maxRequests: number;
  enableBurst?: boolean;
  burstMultiplier?: number;
}

/**
 * Usage tracking entry
 */
export interface UsageEntry {
  customerId: string;
  toolName: string;
  timestamp: number;
  cost: number;
  success: boolean;
}

/**
 * Rate limit status
 */
export interface RateLimitStatus {
  limited: boolean;
  remaining: number;
  resetTime: number;
  windowMs: number;
}

/**
 * Usage statistics
 */
export interface UsageStats {
  totalCalls: number;
  successfulCalls: number;
  failedCalls: number;
  totalCost: number;
  averageCallsPerMinute: number;
  topTools: Array<{
    toolName: string;
    calls: number;
    cost: number;
  }>;
}

/**
 * Sliding window counter for rate limiting
 */
class SlidingWindowCounter {
  private windows: Map<string, number[]> = new Map();
  private windowSize: number;
  private maxRequests: number;

  constructor(windowMs: number, maxRequests: number) {
    this.windowSize = windowMs;
    this.maxRequests = maxRequests;
  }

  /**
   * Check if request is allowed and add it to the counter
   */
  isAllowed(key: string, now = Date.now()): { allowed: boolean; remaining: number; resetTime: number } {
    const window = this.getWindow(key);
    const windowStart = now - this.windowSize;
    
    // Remove old entries
    const validEntries = window.filter(timestamp => timestamp > windowStart);
    
    // Check if we can add another request
    const allowed = validEntries.length < this.maxRequests;
    
    if (allowed) {
      validEntries.push(now);
    }
    
    this.windows.set(key, validEntries);
    
    return {
      allowed,
      remaining: Math.max(0, this.maxRequests - validEntries.length),
      resetTime: validEntries.length > 0 ? Math.min(...validEntries) + this.windowSize : now + this.windowSize
    };
  }

  /**
   * Get current status without modifying the counter
   */
  getStatus(key: string, now = Date.now()): { remaining: number; resetTime: number } {
    const window = this.getWindow(key);
    const windowStart = now - this.windowSize;
    const validEntries = window.filter(timestamp => timestamp > windowStart);
    
    return {
      remaining: Math.max(0, this.maxRequests - validEntries.length),
      resetTime: validEntries.length > 0 ? Math.min(...validEntries) + this.windowSize : now + this.windowSize
    };
  }

  private getWindow(key: string): number[] {
    return this.windows.get(key) || [];
  }

  /**
   * Clean up old windows to prevent memory leaks
   */
  cleanup(now = Date.now()): void {
    const cutoff = now - this.windowSize * 2; // Keep extra buffer
    
    for (const [key, window] of this.windows.entries()) {
      const validEntries = window.filter(timestamp => timestamp > cutoff);
      
      if (validEntries.length === 0) {
        this.windows.delete(key);
      } else {
        this.windows.set(key, validEntries);
      }
    }
  }
}

/**
 * In-memory usage tracking for real-time statistics
 */
class MemoryUsageTracker {
  private entries: Map<string, UsageEntry[]> = new Map();
  private maxEntriesPerCustomer = 1000;
  private cleanupInterval = 5 * 60 * 1000; // 5 minutes
  private lastCleanup = Date.now();

  /**
   * Add usage entry
   */
  addEntry(entry: UsageEntry): void {
    const customerEntries = this.entries.get(entry.customerId) || [];
    customerEntries.push(entry);
    
    // Keep only recent entries
    if (customerEntries.length > this.maxEntriesPerCustomer) {
      customerEntries.splice(0, customerEntries.length - this.maxEntriesPerCustomer);
    }
    
    this.entries.set(entry.customerId, customerEntries);
    
    // Periodic cleanup
    if (Date.now() - this.lastCleanup > this.cleanupInterval) {
      this.cleanup();
    }
  }

  /**
   * Get usage statistics for a customer
   */
  getStats(customerId: string, windowMs = 24 * 60 * 60 * 1000): UsageStats {
    const entries = this.entries.get(customerId) || [];
    const cutoff = Date.now() - windowMs;
    const recentEntries = entries.filter(entry => entry.timestamp > cutoff);
    
    const totalCalls = recentEntries.length;
    const successfulCalls = recentEntries.filter(entry => entry.success).length;
    const failedCalls = totalCalls - successfulCalls;
    const totalCost = recentEntries.reduce((sum, entry) => sum + entry.cost, 0);
    
    // Calculate average calls per minute
    const windowMinutes = windowMs / (60 * 1000);
    const averageCallsPerMinute = totalCalls / Math.max(1, windowMinutes);
    
    // Calculate top tools
    const toolCounts = new Map<string, { calls: number; cost: number }>();
    for (const entry of recentEntries) {
      const current = toolCounts.get(entry.toolName) || { calls: 0, cost: 0 };
      current.calls++;
      current.cost += entry.cost;
      toolCounts.set(entry.toolName, current);
    }
    
    const topTools = Array.from(toolCounts.entries())
      .map(([toolName, stats]) => ({ toolName, ...stats }))
      .sort((a, b) => b.calls - a.calls)
      .slice(0, 10);

    return {
      totalCalls,
      successfulCalls,
      failedCalls,
      totalCost,
      averageCallsPerMinute,
      topTools
    };
  }

  /**
   * Clean up old entries
   */
  private cleanup(): void {
    const cutoff = Date.now() - 24 * 60 * 60 * 1000; // Keep 24 hours
    
    for (const [customerId, entries] of this.entries.entries()) {
      const recentEntries = entries.filter(entry => entry.timestamp > cutoff);
      
      if (recentEntries.length === 0) {
        this.entries.delete(customerId);
      } else {
        this.entries.set(customerId, recentEntries);
      }
    }
    
    this.lastCleanup = Date.now();
  }
}

/**
 * Main usage tracker class
 */
export class UsageTracker {
  private databaseManager: DatabaseManager;
  private rateLimitConfig?: RateLimitConfig;
  private rateLimitCounter?: SlidingWindowCounter;
  private burstCounter?: SlidingWindowCounter;
  private memoryTracker = new MemoryUsageTracker();
  private cleanupTimer?: NodeJS.Timeout;

  constructor(databaseManager: DatabaseManager, rateLimitConfig?: RateLimitConfig) {
    this.databaseManager = databaseManager;
    this.rateLimitConfig = rateLimitConfig;
    
    if (rateLimitConfig?.enabled) {
      this.rateLimitCounter = new SlidingWindowCounter(
        rateLimitConfig.windowMs,
        rateLimitConfig.maxRequests
      );
      
      if (rateLimitConfig.enableBurst) {
        const burstMax = Math.floor(rateLimitConfig.maxRequests * (rateLimitConfig.burstMultiplier || 2));
        this.burstCounter = new SlidingWindowCounter(
          Math.floor(rateLimitConfig.windowMs / 10), // Shorter window for burst
          burstMax
        );
      }
    }
    
    // Start cleanup timer
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  /**
   * Destroy usage tracker and clean up resources
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }
  }

  /**
   * Check rate limits for a customer and tool
   */
  async checkRateLimit(
    customerId: string,
    toolName: string,
    config?: RateLimitConfig
  ): Promise<boolean> {
    const rateLimitConfig = config || this.rateLimitConfig;
    
    if (!rateLimitConfig?.enabled || !this.rateLimitCounter) {
      return false; // Rate limiting disabled
    }

    const key = `${customerId}:${toolName}`;
    const now = Date.now();
    
    // Check burst limit first (if enabled)
    if (this.burstCounter) {
      const burstStatus = this.burstCounter.isAllowed(key, now);
      if (!burstStatus.allowed) {
        return true; // Rate limited by burst protection
      }
    }
    
    // Check main rate limit
    const status = this.rateLimitCounter.isAllowed(key, now);
    return !status.allowed;
  }

  /**
   * Get rate limit status for a customer and tool
   */
  async getRateLimitStatus(customerId: string, toolName: string): Promise<RateLimitStatus | null> {
    if (!this.rateLimitConfig?.enabled || !this.rateLimitCounter) {
      return null;
    }

    const key = `${customerId}:${toolName}`;
    const status = this.rateLimitCounter.getStatus(key);
    
    return {
      limited: status.remaining === 0,
      remaining: status.remaining,
      resetTime: status.resetTime,
      windowMs: this.rateLimitConfig.windowMs
    };
  }

  /**
   * Record a tool call
   */
  async recordCall(
    customerId: string,
    toolName: string,
    cost: number,
    success = true
  ): Promise<void> {
    const entry: UsageEntry = {
      customerId,
      toolName,
      timestamp: Date.now(),
      cost,
      success
    };

    // Add to memory tracker for real-time stats
    this.memoryTracker.addEntry(entry);
    
    // Note: Database recording is handled by the main plugin
    // This just handles in-memory tracking and rate limiting
  }

  /**
   * Get real-time usage statistics
   */
  async getUsageStats(customerId: string, windowMs?: number): Promise<UsageStats> {
    return this.memoryTracker.getStats(customerId, windowMs);
  }

  /**
   * Check if customer has exceeded their quota
   */
  async checkQuota(
    customerId: string,
    toolName: string,
    quotaLimit: number,
    windowMs = 24 * 60 * 60 * 1000 // 24 hours default
  ): Promise<{ exceeded: boolean; used: number; limit: number }> {
    // Get usage from database for accurate quota checking
    const used = await this.databaseManager.getUsageForPeriod(customerId, 'current');
    
    return {
      exceeded: used >= quotaLimit,
      used,
      limit: quotaLimit
    };
  }

  /**
   * Get usage trends for analytics
   */
  async getUsageTrends(
    customerId: string,
    days = 30
  ): Promise<Array<{ date: string; calls: number; cost: number }>> {
    // This would require database queries with date aggregation
    // Implementation depends on your specific database and requirements
    
    const trends: Array<{ date: string; calls: number; cost: number }> = [];
    const now = new Date();
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      
      // This is a simplified implementation
      // In a real scenario, you'd query the database for actual data
      trends.push({
        date: date.toISOString().split('T')[0],
        calls: 0, // Would be populated from database
        cost: 0   // Would be populated from database
      });
    }
    
    return trends;
  }

  /**
   * Reset usage counters for a customer (useful for subscription renewals)
   */
  async resetUsage(customerId: string): Promise<void> {
    // Clear rate limiting counters
    if (this.rateLimitCounter) {
      // Implementation would depend on how you store customer-specific keys
      // For now, we'll just let them expire naturally
    }
    
    // Note: Database usage reset should be handled by the subscription processor
  }

  /**
   * Get top consumers across all customers (for admin analytics)
   */
  async getTopConsumers(limit = 10): Promise<Array<{
    customerId: string;
    calls: number;
    cost: number;
  }>> {
    // This would require database aggregation queries
    // Implementation depends on your specific requirements
    return [];
  }

  /**
   * Export usage data for a customer
   */
  async exportUsageData(
    customerId: string,
    startDate: Date,
    endDate: Date,
    format: 'csv' | 'json' = 'json'
  ): Promise<string> {
    const records = await this.databaseManager.getUsageRecords(customerId, 10000);
    
    const filteredRecords = records.filter(record => 
      record.timestamp >= startDate && record.timestamp <= endDate
    );

    if (format === 'csv') {
      return this.formatAsCSV(filteredRecords);
    } else {
      return JSON.stringify(filteredRecords, null, 2);
    }
  }

  /**
   * Clean up old data and optimize memory usage
   */
  private cleanup(): void {
    if (this.rateLimitCounter) {
      this.rateLimitCounter.cleanup();
    }
    
    if (this.burstCounter) {
      this.burstCounter.cleanup();
    }
  }

  /**
   * Format usage records as CSV
   */
  private formatAsCSV(records: any[]): string {
    if (records.length === 0) {
      return 'timestamp,toolName,cost,success,processingTime\n';
    }

    const headers = 'timestamp,toolName,cost,success,processingTime\n';
    const rows = records.map(record => 
      `${record.timestamp.toISOString()},${record.toolName},${record.cost},${record.success},${record.processingTime || 0}`
    ).join('\n');

    return headers + rows;
  }

  /**
   * Get aggregated usage metrics for reporting
   */
  async getAggregatedMetrics(
    startDate: Date,
    endDate: Date
  ): Promise<{
    totalCalls: number;
    totalRevenue: number;
    uniqueCustomers: number;
    averageCallCost: number;
    successRate: number;
  }> {
    // This would require complex database aggregation
    // Implementation depends on your specific database and requirements
    
    return {
      totalCalls: 0,
      totalRevenue: 0,
      uniqueCustomers: 0,
      averageCallCost: 0,
      successRate: 0
    };
  }
}