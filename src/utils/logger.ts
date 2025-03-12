/**
 * @file Logger Module for MCP Payment Wrapper
 * @version 1.0.0
 * @status STABLE - DO NOT MODIFY WITHOUT TESTS
 * @lastModified 2024-03-12
 * 
 * This module provides logging functionality for the MCP Payment Wrapper.
 * It uses Winston for logging and handles different environments (stdio vs. non-stdio).
 * 
 * IMPORTANT:
 * - In stdio environments, logs are written to a file to avoid corrupting the protocol
 * - In non-stdio environments, logs can be written to the console
 * 
 * Functionality:
 * - Logger creation with appropriate transports
 * - Detection of stdio transport
 * - Memory transport for testing
 * - Structured logging with levels
 */

import * as winston from 'winston';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import * as path from 'path';
import * as fs from 'fs';
// Use require instead of import for CommonJS compatibility
const Transport = require('winston-transport');

/**
 * Options for configuring the logger
 */
export interface LoggerOptions {
  /**
   * Log level (debug, info, warn, error)
   */
  level?: string;
  
  /**
   * Whether the server is using stdio transport
   */
  stdioMode?: boolean;
  
  /**
   * Path to the log file
   */
  logFilePath?: string;
  
  /**
   * Custom logger instance (for testing)
   */
  customLogger?: winston.Logger;
}

/**
 * Creates a Winston logger configured based on the provided options
 * 
 * @param options Configuration options for the logger
 * @returns A configured Winston logger instance
 */
export function createLogger(options: LoggerOptions = {}): winston.Logger {
  // If a custom logger is provided, use it
  if (options.customLogger) {
    return options.customLogger;
  }
  
  const { 
    level = 'info', 
    stdioMode = false, 
    logFilePath = './logs/mcp-payment.log' 
  } = options;
  
  // Ensure log directory exists
  const logDir = path.dirname(logFilePath);
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  
  // Define log format
  const format = winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ level, message, timestamp, ...rest }) => {
      const meta = Object.keys(rest).length ? JSON.stringify(rest) : '';
      return `${timestamp} [${level.toUpperCase()}] ${message} ${meta}`;
    })
  );
  
  // Define transports based on environment
  const transports: winston.transport[] = [];
  
  // In stdio mode, only log to file to avoid corrupting the protocol
  if (stdioMode) {
    transports.push(
      new winston.transports.File({ 
        filename: logFilePath,
        level
      })
    );
  } else {
    // In non-stdio mode, we can log to console
    transports.push(
      new winston.transports.Console({
        level,
        format: winston.format.combine(
          winston.format.colorize(),
          format
        )
      })
    );
    
    // Optionally also log to file
    if (logFilePath) {
      transports.push(
        new winston.transports.File({ 
          filename: logFilePath,
          level
        })
      );
    }
  }
  
  // Create the logger
  return winston.createLogger({
    level,
    format,
    transports,
    exitOnError: false
  });
}

/**
 * Attempts to detect if a server is using stdio transport
 * 
 * @param server The MCP server to check
 * @returns True if the server appears to be using stdio transport
 */
export function isUsingStdioTransport(server: McpServer): boolean {
  // This is a best-effort detection - may need to be updated based on MCP SDK internals
  return (
    (server as any)._transport?.type === 'stdio' || 
    (server as any)._transportType === 'stdio' ||
    process.env.MCP_TRANSPORT === 'stdio'
  );
}

/**
 * Custom memory transport for Winston that captures logs in memory
 * Useful for testing to verify log messages
 */
export class MemoryTransport extends Transport {
  logs: Record<string, any>[] = [];
  name: string;
  
  constructor(opts?: any) {
    super(opts);
    this.name = 'memory';
  }
  
  /**
   * Winston transport method to handle log messages
   */
  log(info: Record<string, any>, callback: () => void): void {
    this.logs.push(info);
    
    // Emit logged event to signal completion
    this.emit('logged', info);
    
    callback();
  }
  
  /**
   * Clears all stored logs
   */
  clear(): void {
    this.logs = [];
  }
  
  /**
   * Checks if logs contain a specific substring
   * 
   * @param substring The substring to search for
   * @returns True if the substring is found in any log
   */
  contains(substring: string): boolean {
    return this.logs.some(log => 
      JSON.stringify(log).includes(substring)
    );
  }
  
  /**
   * Gets logs filtered by level
   * 
   * @param level The log level to filter by
   * @returns Array of logs with the specified level
   */
  getLogsByLevel(level: string): Record<string, any>[] {
    return this.logs.filter(log => log.level === level);
  }
}

/**
 * Creates a memory transport for testing
 * 
 * @returns A memory transport that can be used for testing
 */
export function createMemoryTransport(): MemoryTransport {
  return new MemoryTransport({ level: 'debug' });
}

/**
 * Helper class for working with memory transport
 * Kept for backward compatibility
 */
export class MemoryTransportHelper {
  transport: MemoryTransport;
  
  constructor(transport: MemoryTransport) {
    this.transport = transport;
  }
  
  /**
   * Checks if the logs contain a substring
   * 
   * @param substring The substring to search for
   * @returns True if the logs contain the substring
   */
  contains(substring: string): boolean {
    return this.transport.contains(substring);
  }
  
  /**
   * Gets logs by level
   * 
   * @param level The log level to filter by
   * @returns An array of logs with the specified level
   */
  getLogsByLevel(level: string): any[] {
    return this.transport.getLogsByLevel(level);
  }
  
  /**
   * Clears all logs
   */
  clear(): void {
    this.transport.clear();
  }
} 