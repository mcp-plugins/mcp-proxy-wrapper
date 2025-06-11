/**
 * @file Tests for MCP Logger
 * @version 1.0.0
 * 
 * Tests for the MCP native logger implementation.
 */

import { createLogger } from './mcp-logger.js';
import { describe, test, expect, jest } from '@jest/globals';

describe('MCP Logger', () => {
  test('creates a logger with default options', () => {
    // Mock server with loggingNotification method
    const mockServer = {
      loggingNotification: jest.fn()
    };
    
    // Create logger with mock server
    const logger = createLogger({ server: mockServer as any });
    
    // Verify logger has expected methods
    expect(logger).toHaveProperty('debug');
    expect(logger).toHaveProperty('info');
    expect(logger).toHaveProperty('warn');
    expect(logger).toHaveProperty('error');
  });
  
  test('logs messages with appropriate level', () => {
    // Mock server with loggingNotification method
    const mockServer = {
      loggingNotification: jest.fn()
    };
    
    // Create logger with mock server
    const logger = createLogger({ server: mockServer as any });
    
    // Log messages at different levels
    logger.debug('Debug message');
    logger.info('Info message');
    logger.warn('Warning message');
    logger.error('Error message');
    
    // Verify loggingNotification was called with appropriate levels
    expect(mockServer.loggingNotification).toHaveBeenCalledTimes(3); // debug is filtered by default
    expect(mockServer.loggingNotification).toHaveBeenCalledWith({
      level: 1,
      logger: 'mcp-payment-wrapper',
      data: 'Info message'
    });
    expect(mockServer.loggingNotification).toHaveBeenCalledWith({
      level: 3,
      logger: 'mcp-payment-wrapper',
      data: 'Warning message'
    });
    expect(mockServer.loggingNotification).toHaveBeenCalledWith({
      level: 4,
      logger: 'mcp-payment-wrapper',
      data: 'Error message'
    });
  });
  
  test('respects minimum log level', () => {
    // Mock server with loggingNotification method
    const mockServer = {
      loggingNotification: jest.fn()
    };
    
    // Create logger with info as minimum level
    const logger = createLogger({ 
      server: mockServer as any,
      level: 'info'
    });
    
    // Log messages at different levels
    logger.debug('Debug message'); // Should be filtered out
    logger.info('Info message');   // Should be logged
    logger.warn('Warning message'); // Should be logged
    logger.error('Error message');  // Should be logged
    
    // Verify loggingNotification was called only for info and above
    expect(mockServer.loggingNotification).toHaveBeenCalledTimes(3);
    expect(mockServer.loggingNotification).not.toHaveBeenCalledWith(expect.objectContaining({
      level: 0,
      data: 'Debug message'
    }));
  });
  
  test('handles metadata in log messages', () => {
    // Mock server with loggingNotification method
    const mockServer = {
      loggingNotification: jest.fn()
    };
    
    // Create logger with mock server
    const logger = createLogger({ server: mockServer as any });
    
    // Log message with metadata
    const metadata = { userId: '123', action: 'login' };
    logger.info('User action', metadata);
    
    // Verify loggingNotification was called with metadata
    expect(mockServer.loggingNotification).toHaveBeenCalledWith({
      level: 1,
      logger: 'mcp-payment-wrapper',
      data: `User action ${JSON.stringify(metadata)}`
    });
  });
  
  test('uses custom logger name', () => {
    // Mock server with loggingNotification method
    const mockServer = {
      loggingNotification: jest.fn()
    };
    
    // Create logger with custom name
    const logger = createLogger({ 
      server: mockServer as any,
      loggerName: 'custom-logger'
    });
    
    // Log a message
    logger.info('Test message');
    
    // Verify loggingNotification was called with custom logger name
    expect(mockServer.loggingNotification).toHaveBeenCalledWith({
      level: 1,
      logger: 'custom-logger',
      data: 'Test message'
    });
  });
  
  test('handles missing server gracefully', () => {
    // Create logger without server (should use console fallback)
    const logger = createLogger({});
    
    // Mock console methods
    const originalConsoleLog = console.log;
    const originalConsoleWarn = console.warn;
    const originalConsoleError = console.error;
    
    console.log = jest.fn();
    console.warn = jest.fn();
    console.error = jest.fn();
    
    try {
      // Log messages at different levels
      logger.debug('Debug message'); // Filtered by default
      logger.info('Info message');
      logger.warn('Warning message');
      logger.error('Error message');
      
      // Verify console methods were called
      expect(console.log).toHaveBeenCalledTimes(1); // Only info (debug is filtered)
      expect(console.warn).toHaveBeenCalledTimes(1);
      expect(console.error).toHaveBeenCalledTimes(1);
    } finally {
      // Restore console methods
      console.log = originalConsoleLog;
      console.warn = originalConsoleWarn;
      console.error = originalConsoleError;
    }
  });
  
  test('uses custom logger if provided', () => {
    // Create a custom logger
    const customLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn()
    };
    
    // Create logger with custom logger
    const logger = createLogger({ customLogger });
    
    // Log messages at different levels
    logger.debug('Debug message');
    logger.info('Info message');
    logger.warn('Warning message');
    logger.error('Error message');
    
    // Verify custom logger methods were called
    expect(customLogger.debug).toHaveBeenCalledTimes(1);
    expect(customLogger.info).toHaveBeenCalledTimes(1);
    expect(customLogger.warn).toHaveBeenCalledTimes(1);
    expect(customLogger.error).toHaveBeenCalledTimes(1);
  });
}); 