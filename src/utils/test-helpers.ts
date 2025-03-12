/**
 * @file Test Helpers for MCP Payment Wrapper
 * @version 1.0.0
 * 
 * This module provides helper functions for testing the payment wrapper
 * using the Winston memory transport for logging capture and verification.
 */

import winston from 'winston';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { MemoryTransport, createMemoryTransport } from './logger.js';
import { PaymentWrapperOptions } from '../payment-wrapper.js';

// Valid JWT token for testing
export const VALID_JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTEyMyIsIm5hbWUiOiJKb2huIERvZSIsImlhdCI6MTUxNjIzOTAyMn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

// Enable debug mode for tests
export const DEBUG_MODE = true;

/**
 * A wrapper for memory transport and logger to simplify testing
 */
export class TestLogger {
  transport: MemoryTransport;
  logger: winston.Logger;
  
  constructor() {
    this.transport = createMemoryTransport();
    this.logger = winston.createLogger({
      level: 'debug',
      transports: [this.transport]
    });
  }
  
  /**
   * Checks if the logs contain a specific substring
   * 
   * @param substring The text to search for in logs
   * @param level Optional log level to filter by
   * @returns True if the substring is found in any log message
   */
  contains(substring: string, level?: string): boolean {
    const logs = level ? this.getLogsByLevel(level) : this.transport.logs;
    
    const contains = logs.some(log => 
      JSON.stringify(log).includes(substring)
    );
    
    if (!contains && DEBUG_MODE) {
      // Original console for debugging helper itself
      console.log(`Expected to find "${substring}" in logs, but it wasn't found.`);
      console.log('Available logs:', JSON.stringify(logs, null, 2));
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
    return this.transport.getLogsByLevel(level);
  }
  
  /**
   * Gets all log messages
   * 
   * @returns Array of all log entries
   */
  getAllLogs(): Record<string, any>[] {
    return this.transport.logs;
  }
  
  /**
   * Clears all logs
   */
  clear(): void {
    this.transport.clear();
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