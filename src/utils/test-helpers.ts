/**
 * @file Test Helpers for MCP Payment Wrapper
 * @version 1.0.0
 * 
 * This module provides helper functions for testing the payment wrapper
 * using the MCP native logger for logging capture and verification.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { PaymentWrapperOptions } from '../payment-wrapper.js';
import { TestLogger as McpTestLogger } from './test-logger.js';
import { Logger } from './mcp-logger.js';

// Valid JWT token for testing
export const VALID_JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTEyMyIsIm5hbWUiOiJKb2huIERvZSIsImlhdCI6MTUxNjIzOTAyMn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

// Enable debug mode for tests
export const DEBUG_MODE = true;

/**
 * A wrapper for the MCP test logger to maintain compatibility with existing tests
 */
export class TestLogger {
  // Make this public for backward compatibility
  public mcpTestLogger: McpTestLogger;
  
  constructor() {
    this.mcpTestLogger = new McpTestLogger();
  }
  
  /**
   * Returns an object that can be used as a mock MCP server for logging
   */
  get logger(): Logger & { loggingNotification: (log: any) => void } {
    return {
      debug: (message: string, meta?: any) => {
        this.mcpTestLogger.logger.loggingNotification({
          level: 0,
          logger: 'test-logger',
          data: meta ? `${message} ${JSON.stringify(meta)}` : message
        });
      },
      info: (message: string, meta?: any) => {
        this.mcpTestLogger.logger.loggingNotification({
          level: 1,
          logger: 'test-logger',
          data: meta ? `${message} ${JSON.stringify(meta)}` : message
        });
      },
      warn: (message: string, meta?: any) => {
        this.mcpTestLogger.logger.loggingNotification({
          level: 3,
          logger: 'test-logger',
          data: meta ? `${message} ${JSON.stringify(meta)}` : message
        });
      },
      error: (message: string, meta?: any) => {
        this.mcpTestLogger.logger.loggingNotification({
          level: 4,
          logger: 'test-logger',
          data: meta ? `${message} ${JSON.stringify(meta)}` : message
        });
      },
      // Add loggingNotification method for backward compatibility
      loggingNotification: (log: any) => {
        this.mcpTestLogger.logger.loggingNotification(log);
      }
    };
  }
  
  /**
   * Checks if the logs contain a specific substring
   * 
   * @param substring The text to search for in logs
   * @param level Optional log level to filter by
   * @returns True if the substring is found in any log message
   */
  contains(substring: string, level?: string): boolean {
    // Convert string level to number if provided
    const numLevel = level ? this.stringLevelToNumber(level) : undefined;
    
    const contains = this.mcpTestLogger.contains(substring, numLevel);
    
    if (!contains && DEBUG_MODE) {
      // Original console for debugging helper itself
      console.log(`Expected to find "${substring}" in logs, but it wasn't found.`);
      console.log('Available logs:', JSON.stringify(this.mcpTestLogger.getAllLogs(), null, 2));
    }
    
    return contains;
  }
  
  /**
   * Gets all log messages of a specific level
   * 
   * @param level The log level to filter by
   * @returns Array of log entries with the specified level
   */
  getLogsByLevel(level: string): Record<string, any>[] {
    const numLevel = this.stringLevelToNumber(level);
    return this.mcpTestLogger.getLogsByLevel(numLevel);
  }
  
  /**
   * Gets all log messages
   * 
   * @returns Array of all log entries
   */
  getAllLogs(): Record<string, any>[] {
    return this.mcpTestLogger.getAllLogs();
  }
  
  /**
   * Clears all logs
   */
  clear(): void {
    this.mcpTestLogger.clear();
  }
  
  /**
   * Converts a string log level to its numeric equivalent
   * 
   * @param level The string log level
   * @returns The numeric log level
   */
  private stringLevelToNumber(level: string): number {
    const levelMap: Record<string, number> = {
      'debug': 0,
      'info': 1,
      'warn': 3,
      'error': 4
    };
    
    return levelMap[level] || 1; // Default to INFO if unknown
  }
}

/**
 * Creates a valid options object for the payment wrapper
 * 
 * @param testLogger The test logger instance
 * @param overrides Any options to override the defaults
 * @returns A configured PaymentWrapperOptions object
 */
export function createTestOptions(
  testLogger: TestLogger, 
  overrides: Partial<PaymentWrapperOptions> = {}
): PaymentWrapperOptions {
  return {
    apiKey: 'valid-api-key',
    userToken: VALID_JWT,
    debugMode: DEBUG_MODE,
    loggerOptions: {
      level: 'debug',
      loggerName: 'test-logger',
      customLogger: testLogger.logger
    },
    ...overrides
  };
}

/**
 * Creates a test MCP server
 * 
 * @param name Optional name for the server
 * @returns A new McpServer instance
 */
export function createTestServer(name = 'Test Server'): McpServer {
  return new McpServer({
    name,
    version: '1.0.0',
    description: 'Test server for payment wrapper tests'
  });
}

/**
 * Helper to inspect object structure for debugging
 * 
 * @param obj The object to inspect
 * @param depth Current depth (for recursion)
 * @param maxDepth Maximum depth to traverse
 * @returns A string representation of the object
 */
export function inspectObject(obj: any, depth = 0, maxDepth = 2): string {
  if (depth > maxDepth) return '...';
  if (obj === null) return 'null';
  if (obj === undefined) return 'undefined';
  if (typeof obj !== 'object') return String(obj);
  
  const indent = '  '.repeat(depth);
  const entries = Object.entries(obj)
    .map(([key, value]) => {
      const valueStr = typeof value === 'object' && value !== null
        ? `{\n${inspectObject(value, depth + 1, maxDepth)}\n${indent}}`
        : inspectObject(value, depth + 1, maxDepth);
      return `${indent}  ${key}: ${valueStr}`;
    })
    .join(',\n');
  
  return entries;
} 