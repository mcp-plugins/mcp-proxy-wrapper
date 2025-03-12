/**
 * @file Edge Case Tests for Payment Wrapper
 * @version 1.1.0
 * @status STABLE - DO NOT MODIFY WITHOUT TESTS
 * @lastModified 2024-08-19
 * 
 * These tests focus on edge cases and error handling for the payment wrapper,
 * including invalid inputs, error propagation, and recovery scenarios.
 */

import { z } from 'zod';
import { wrapWithPayments } from './payment-wrapper.js';
import { MemoryTransport } from './utils/logger.js';
import winston from 'winston';
import { createTestServer } from './utils/test-helpers.js';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { MockAuthService } from './services/mock-auth-service.js';

// Valid API key for testing
const TEST_API_KEY = 'valid-api-key';

// Setup memory transport and logger for tests
let memoryTransport: MemoryTransport;
let testLogger: winston.Logger;
let mockAuthService: MockAuthService;

// Helper function to create a valid options object
function createValidOptions(overrides: Record<string, any> = {}) {
  // Generate a valid token with the mock auth service
  const validToken = mockAuthService.generateToken('test-user');
  
  return {
    apiKey: TEST_API_KEY,
    userToken: validToken,
    debugMode: false,
    loggerOptions: {
      customLogger: testLogger
    },
    ...overrides
  };
}

beforeEach(() => {
  // Set up memory transport and logger
  memoryTransport = new MemoryTransport();
  testLogger = winston.createLogger({
    level: 'debug',
    transports: [memoryTransport]
  });
  
  // Create mock auth service with the same API key that we'll use in tests
  mockAuthService = new MockAuthService({
    apiKey: TEST_API_KEY,
    baseAuthUrl: 'https://auth.mcp-api.com'
  });
});

describe('Input Validation Edge Cases', () => {
  test('throws error when apiKey is missing', () => {
    const server = createTestServer();
    
    // Create options without apiKey
    const validToken = mockAuthService.generateToken('test-user');
    const options = { userToken: validToken, debugMode: false };
    
    // Verify that wrapping throws an error
    expect(() => {
      wrapWithPayments(server, options as any);
    }).toThrow('Developer API key is required');
  });
  
  test('throws error when apiKey is empty', () => {
    const server = createTestServer();
    
    // Create options with empty apiKey
    const options = createValidOptions({ apiKey: '' });
    
    // Verify that wrapping throws an error
    expect(() => {
      wrapWithPayments(server, options);
    }).toThrow('Developer API key is required');
  });
  
  // Note: User token validation is now handled by authentication flow
  // and tested in payment-wrapper.auth.test.ts
  
  // Add server validation tests after adding validation to the wrapper
  test('should handle null server gracefully', () => {
    // First check if the server is null before trying to create a proxy
    expect(() => {
      // @ts-expect-error - Testing invalid input
      wrapWithPayments(null, createValidOptions());
    }).toThrow();
  });
  
  test('should handle undefined server gracefully', () => {
    // First check if the server is undefined before trying to create a proxy
    expect(() => {
      // @ts-expect-error - Testing invalid input
      wrapWithPayments(undefined, createValidOptions());
    }).toThrow();
  });
});

describe('Error Propagation', () => {
  test('propagates errors from original server methods', () => {
    const server = createTestServer();
    
    // Override a method to throw an error
    const originalTool = server.tool;
    server.tool = function() {
      throw new Error('Original server error');
    };
    
    const wrappedServer = wrapWithPayments(server, createValidOptions());
    
    // Verify that the error is propagated
    expect(() => {
      wrappedServer.tool('test_tool', { param: z.string() }, async () => {
        return {
          content: [{ type: 'text' as const, text: 'Success' }]
        };
      });
    }).toThrow('Original server error');
    
    // Restore the original method
    server.tool = originalTool;
  });
  
  test('handles errors during tool execution', async () => {
    const server = createTestServer();
    const wrappedServer = wrapWithPayments(server, createValidOptions({
      _testOverrideFundsCheck: true // Override funds check to always succeed
    }));
    
    // Register a tool that throws an error
    wrappedServer.tool('error_tool', { param: z.string() }, async () => {
      throw new Error('Tool execution error');
      return {
        content: [{ type: 'text' as const, text: 'Success' }]
      };
    });
    
    // Add the prototype method to call a tool directly for this test
    (McpServer.prototype as any).callTool = async function(name: string, args: any) {
      const tool = (this as any)._registeredTools[name];
      if (!tool) {
        throw new Error(`Tool not found: ${name}`);
      }
      return await tool.callback(args, {});
    };
    
    try {
      // Call the tool through the proxy
      await (wrappedServer as any).callTool('error_tool', { param: 'test' });
    } catch (error) {
      // Expected to throw
    }
    
    // Verify that the error was logged
    expect(memoryTransport.contains('Error in tool')).toBe(true);
  });
});

describe('Recovery Scenarios', () => {
  test('can register tools after a failed registration', () => {
    const server = createTestServer();
    const wrappedServer = wrapWithPayments(server, createValidOptions());
    
    // Try to register a tool with invalid schema (this will fail)
    try {
      (wrappedServer as any).tool('invalid_tool', null, async () => {});
    } catch (error) {
      // Expected to throw
    }
    
    // Verify that we can still register a valid tool
    expect(() => {
      wrappedServer.tool('valid_tool', { param: z.string() }, async () => {
        return {
          content: [{ type: 'text' as const, text: 'Success' }]
        };
      });
    }).not.toThrow();
  });
  
  test('can use server after a failed tool call', async () => {
    const server = createTestServer();
    const wrappedServer = wrapWithPayments(server, createValidOptions({
      _testOverrideFundsCheck: true // Override funds check to always succeed
    }));
    
    // Register a tool that throws an error
    wrappedServer.tool('error_tool', { param: z.string() }, async () => {
      throw new Error('Tool execution error');
      return {
        content: [{ type: 'text' as const, text: 'Error' }]
      };
    });
    
    // Register a tool that works correctly
    wrappedServer.tool('working_tool', { param: z.string() }, async () => {
      return { content: [{ type: 'text' as const, text: 'Success' }] };
    });
    
    // Add the prototype method to call a tool directly
    if (!(McpServer.prototype as any).callTool) {
      (McpServer.prototype as any).callTool = async function(name: string, args: any) {
        const tool = (this as any)._registeredTools[name];
        if (!tool) {
          throw new Error(`Tool not found: ${name}`);
        }
        return await tool.callback(args, {});
      };
    }
    
    try {
      // Call the error tool through the proxy
      await (wrappedServer as any).callTool('error_tool', { param: 'test' });
    } catch (error) {
      // Expected to throw
    }
    
    try {
      // Call the working tool through the proxy
      const result = await (wrappedServer as any).callTool('working_tool', { param: 'test' });
      
      // Verify that the working tool returns the expected result
      expect(result.content[0].text).toBe('Success');
    } catch (error) {
      // This should not throw
      fail('Working tool should not throw');
    }
  });
});

describe('Billing Edge Cases', () => {
  test('handles insufficient funds correctly', async () => {
    const server = createTestServer();
    const wrappedServer = wrapWithPayments(server, createValidOptions({
      _testOverrideFundsCheck: false // Override funds check to always fail
    }));
    
    // Register a tool
    wrappedServer.tool('zero_balance_tool', { param: z.string() }, async () => {
      return { content: [{ type: 'text' as const, text: 'Success' }] };
    });
    
    // Add the prototype method to call a tool directly for this test
    (McpServer.prototype as any).callTool = async function(name: string, args: any) {
      const tool = (this as any)._registeredTools[name];
      if (!tool) {
        throw new Error(`Tool not found: ${name}`);
      }
      return await tool.callback(args, {});
    };
    
    // Call the tool through the proxy
    const result = await (wrappedServer as any).callTool('zero_balance_tool', { param: 'test' });
    
    // Verify that the result indicates insufficient funds
    expect(result).toHaveProperty('error', 'insufficient_funds');
    expect(result).toHaveProperty('message', 'Insufficient funds to execute this operation');
    
    // Verify that the error was logged
    expect(memoryTransport.contains('Insufficient funds')).toBe(true);
  });
  
  test('handles sufficient funds correctly', async () => {
    const server = createTestServer();
    const wrappedServer = wrapWithPayments(server, createValidOptions({
      _testOverrideFundsCheck: true // Override funds check to always succeed
    }));
    
    // Register a tool
    wrappedServer.tool('sufficient_funds_tool', { param: z.string() }, async () => {
      return { content: [{ type: 'text' as const, text: 'Success' }] };
    });
    
    // Add the prototype method if it's not already there
    if (!(McpServer.prototype as any).callTool) {
      (McpServer.prototype as any).callTool = async function(name: string, args: any) {
        const tool = (this as any)._registeredTools[name];
        if (!tool) {
          throw new Error(`Tool not found: ${name}`);
        }
        return await tool.callback(args, {});
      };
    }
    
    // Call the tool through the proxy
    const result = await (wrappedServer as any).callTool('sufficient_funds_tool', { param: 'test' });
    
    // Verify that the tool is called and returns the expected result
    expect(result).toEqual({
      content: [{ type: 'text', text: 'Success' }]
    });
  });
});

describe('Debug Mode', () => {
  test('logs debug information when debugMode is true', () => {
    const server = createTestServer();
    const wrappedServer = wrapWithPayments(server, createValidOptions({ debugMode: true }));
    
    // Register a tool
    wrappedServer.tool('debug_tool', { param: z.string() }, async () => {
      return { content: [{ type: 'text' as const, text: 'Success' }] };
    });
    
    // Verify that debug information was logged
    expect(memoryTransport.contains('Creating payment-enabled wrapper')).toBe(true);
  });
  
  test('does not log debug information when debugMode is false', () => {
    // Clear the memory transport
    memoryTransport.clear();
    
    const server = createTestServer();
    // Override debugMode just to be sure
    const wrappedServer = wrapWithPayments(server, createValidOptions({ 
      debugMode: false,
      loggerOptions: {
        level: 'info'  // Increase log level to avoid debug logs
      }
    }));
    
    // Register a tool
    wrappedServer.tool('no_debug_tool', { param: z.string() }, async () => {
      return { content: [{ type: 'text' as const, text: 'Success' }] };
    });
    
    // Verify that no debug information was logged at debug level
    const debugLogs = memoryTransport.logs.filter(log => 
      log.level === 'debug' && log.message.includes('payment-enabled wrapper')
    );
    expect(debugLogs.length).toBe(0);
  });
}); 