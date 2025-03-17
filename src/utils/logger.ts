/**
 * @file Logger Utility
 * @version 1.0.0
 * @status STABLE - DO NOT MODIFY WITHOUT TESTS
 * @lastModified 2024-03-17
 * 
 * Simple logging utility for the MCP Proxy Wrapper.
 * 
 * IMPORTANT:
 * - All changes must be accompanied by tests
 * - Do not modify the interface without updating documentation
 * 
 * Functionality:
 * - Configurable log levels
 * - Colorized output
 * - Timestamp formatting
 */

import colors from 'colors';

/**
 * Log levels
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'none';

/**
 * Logger options
 */
export interface LoggerOptions {
  /** Minimum log level to display */
  level?: LogLevel;
  
  /** Whether to include timestamps */
  timestamps?: boolean;
  
  /** Whether to use colors */
  colors?: boolean;
  
  /** Custom prefix for log messages */
  prefix?: string;
}

/**
 * Logger interface
 */
export interface Logger {
  debug(message: string, ...args: any[]): void;
  info(message: string, ...args: any[]): void;
  warn(message: string, ...args: any[]): void;
  error(message: string, ...args: any[]): void;
}

/**
 * Log level priorities
 */
const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  none: 4
};

/**
 * Creates a logger with the specified options
 * @param levelOrOptions Log level or logger options
 * @returns Logger instance
 */
export function createLogger(levelOrOptions?: LogLevel | LoggerOptions): Logger {
  const options: LoggerOptions = typeof levelOrOptions === 'string'
    ? { level: levelOrOptions }
    : levelOrOptions || {};
  
  const level = options.level || 'info';
  const useTimestamps = options.timestamps !== false;
  const useColors = options.colors !== false;
  const prefix = options.prefix || 'MCP-PROXY';
  
  const getTimestamp = () => {
    if (!useTimestamps) return '';
    const now = new Date();
    return `[${now.toISOString()}] `;
  };
  
  const getPrefix = () => {
    return `[${prefix}] `;
  };
  
  const shouldLog = (messageLevel: LogLevel): boolean => {
    return LOG_LEVELS[messageLevel] >= LOG_LEVELS[level];
  };
  
  return {
    debug(message: string, ...args: any[]): void {
      if (!shouldLog('debug')) return;
      const formattedMessage = `${getTimestamp()}${getPrefix()}${message}`;
      console.debug(useColors ? colors.gray(formattedMessage) : formattedMessage, ...args);
    },
    
    info(message: string, ...args: any[]): void {
      if (!shouldLog('info')) return;
      const formattedMessage = `${getTimestamp()}${getPrefix()}${message}`;
      console.info(useColors ? colors.green(formattedMessage) : formattedMessage, ...args);
    },
    
    warn(message: string, ...args: any[]): void {
      if (!shouldLog('warn')) return;
      const formattedMessage = `${getTimestamp()}${getPrefix()}${message}`;
      console.warn(useColors ? colors.yellow(formattedMessage) : formattedMessage, ...args);
    },
    
    error(message: string, ...args: any[]): void {
      if (!shouldLog('error')) return;
      const formattedMessage = `${getTimestamp()}${getPrefix()}${message}`;
      console.error(useColors ? colors.red(formattedMessage) : formattedMessage, ...args);
    }
  };
} 