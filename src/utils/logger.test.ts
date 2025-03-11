/**
 * @file Tests for Logger Module
 * @version 1.0.0
 * 
 * These tests verify the functionality of the logger module.
 */

import { createLogger, isUsingStdioTransport, createMemoryTransport, MemoryTransportHelper } from './logger.js';
import winston from 'winston';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

describe('Logger Module', () => {
  describe('createLogger', () => {
    test('creates a logger with default options', () => {
      const logger = createLogger();
      expect(logger).toBeInstanceOf(winston.Logger);
    });
    
    test('creates a logger with custom level', () => {
      const logger = createLogger({ level: 'debug' });
      expect(logger.level).toBe('debug');
    });
    
    test('creates a logger with file transport in stdio mode', () => {
      const logger = createLogger({ stdioMode: true });
      // Check that the logger has a file transport
      const hasFileTransport = logger.transports.some(
        transport => transport instanceof winston.transports.File
      );
      expect(hasFileTransport).toBe(true);
      
      // Check that the logger does not have a console transport
      const hasConsoleTransport = logger.transports.some(
        transport => transport instanceof winston.transports.Console
      );
      expect(hasConsoleTransport).toBe(false);
    });
    
    test('creates a logger with console transport in non-stdio mode', () => {
      const logger = createLogger({ stdioMode: false });
      // Check that the logger has a console transport
      const hasConsoleTransport = logger.transports.some(
        transport => transport instanceof winston.transports.Console
      );
      expect(hasConsoleTransport).toBe(true);
    });
    
    test('uses custom logger if provided', () => {
      const customLogger = winston.createLogger();
      const logger = createLogger({ customLogger });
      expect(logger).toBe(customLogger);
    });
  });
  
  describe('isUsingStdioTransport', () => {
    test('returns false for server without stdio transport', () => {
      const server = new McpServer({
        name: 'Test Server',
        version: '1.0.0',
        description: 'Test server'
      });
      expect(isUsingStdioTransport(server)).toBe(false);
    });
    
    test('returns true for server with _transport.type = stdio', () => {
      const server = new McpServer({
        name: 'Test Server',
        version: '1.0.0',
        description: 'Test server'
      });
      // Mock the transport property
      (server as any)._transport = { type: 'stdio' };
      expect(isUsingStdioTransport(server)).toBe(true);
    });
    
    test('returns true for server with _transportType = stdio', () => {
      const server = new McpServer({
        name: 'Test Server',
        version: '1.0.0',
        description: 'Test server'
      });
      // Mock the transportType property
      (server as any)._transportType = 'stdio';
      expect(isUsingStdioTransport(server)).toBe(true);
    });
    
    test('returns true when MCP_TRANSPORT env var is stdio', () => {
      const originalEnv = process.env.MCP_TRANSPORT;
      process.env.MCP_TRANSPORT = 'stdio';
      
      const server = new McpServer({
        name: 'Test Server',
        version: '1.0.0',
        description: 'Test server'
      });
      expect(isUsingStdioTransport(server)).toBe(true);
      
      // Restore the original env var
      process.env.MCP_TRANSPORT = originalEnv;
    });
  });
  
  describe('Memory Transport', () => {
    let memoryTransport: any;
    let helper: MemoryTransportHelper;
    let logger: winston.Logger;
    
    beforeEach(() => {
      memoryTransport = createMemoryTransport();
      helper = new MemoryTransportHelper(memoryTransport);
      logger = winston.createLogger({
        transports: [memoryTransport]
      });
    });
    
    test('captures log messages', () => {
      logger.info('Test message');
      expect(helper.contains('Test message')).toBe(true);
    });
    
    test('clears logs', () => {
      logger.info('Test message');
      helper.clear();
      expect(helper.contains('Test message')).toBe(false);
    });
    
    test('checks if logs contain a substring', () => {
      logger.info('Test message with special content');
      expect(helper.contains('special content')).toBe(true);
      expect(helper.contains('not in the message')).toBe(false);
    });
    
    test('filters logs by level', () => {
      logger.info('Info message');
      logger.error('Error message');
      logger.warn('Warning message');
      
      const infoLogs = helper.getLogsByLevel('info');
      expect(infoLogs.length).toBe(1);
      expect(infoLogs[0].message).toBe('Info message');
      
      const errorLogs = helper.getLogsByLevel('error');
      expect(errorLogs.length).toBe(1);
      expect(errorLogs[0].message).toBe('Error message');
    });
  });
}); 