/**
 * @file MCP Native Logger Adapter
 * @version 1.0.0
 * @status STABLE - DO NOT MODIFY WITHOUT TESTS
 * @lastModified 2024-03-12
 * 
 * This module provides logging functionality using MCP's native logging capabilities.
 * It replaces the Winston logger with a simpler implementation that uses the MCP server's
 * built-in logging notification system.
 * 
 * IMPORTANT:
 * - This logger automatically handles stdio transport concerns
 * - Log messages are sent directly to the MCP client
 * 
 * Functionality:
 * - Logger creation with appropriate log levels
 * - Standard logging methods (debug, info, warn, error)
 * - Structured logging with metadata
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

// Map Winston log levels to MCP log levels
const LEVEL_MAP: Record<string, number> = {
  'debug': 0,  // DEBUG
  'info': 1,   // INFO
  'warn': 3,   // WARNING
  'error': 4   // ERROR
};

export interface LoggerOptions {
  /**
   * Log level (debug, info, warn, error)
   */
  level?: string;
  
  /**
   * MCP Server instance to use for logging
   * Optional for testing purposes
   */
  server?: McpServer;
  
  /**
   * Logger name for categorization
   */
  loggerName?: string;
  
  /**
   * For backward compatibility with tests
   */
  customLogger?: any;
}

/**
 * Logger interface matching the Winston logger API
 */
export interface Logger {
  debug(message: string, meta?: any): void;
  info(message: string, meta?: any): void;
  warn(message: string, meta?: any): void;
  error(message: string, meta?: any): void;
}

/**
 * Creates a logger that uses MCP's native logging capabilities
 * 
 * @param options Configuration options for the logger
 * @returns A logger object with standard logging methods
 */
export function createLogger(options: LoggerOptions): Logger {
  // If a custom logger is provided (for tests), use it
  if (options.customLogger) {
    return options.customLogger;
  }
  
  const server = options.server;
  const minLevel = LEVEL_MAP[options.level || 'info'] || LEVEL_MAP['info'];
  const loggerName = options.loggerName || 'mcp-payment-wrapper';

  // Function to send log to MCP server if available
  const sendLog = (level: number, message: string, meta?: any) => {
    if (server && typeof (server as any).loggingNotification === 'function') {
      (server as any).loggingNotification({
        level,
        logger: loggerName,
        data: meta ? `${message} ${JSON.stringify(meta)}` : message
      });
    } else if (!server) {
      // Fallback to console for testing or when server is not available
      const consoleMethod = level <= 1 ? 'log' : (level <= 3 ? 'warn' : 'error');
      console[consoleMethod](`[${loggerName}] ${message}`, meta || '');
    }
  };

  return {
    debug: (message: string, meta?: any) => {
      if (LEVEL_MAP['debug'] >= minLevel) {
        sendLog(LEVEL_MAP['debug'], message, meta);
      }
    },
    info: (message: string, meta?: any) => {
      if (LEVEL_MAP['info'] >= minLevel) {
        sendLog(LEVEL_MAP['info'], message, meta);
      }
    },
    warn: (message: string, meta?: any) => {
      if (LEVEL_MAP['warn'] >= minLevel) {
        sendLog(LEVEL_MAP['warn'], message, meta);
      }
    },
    error: (message: string, meta?: any) => {
      if (LEVEL_MAP['error'] >= minLevel) {
        sendLog(LEVEL_MAP['error'], message, meta);
      }
    }
  };
} 