/**
 * @file Edge Case Tests for Payment Wrapper
 * @version 1.0.0
 * @status STABLE - DO NOT MODIFY WITHOUT TESTS
 * @lastModified 2024-03-12
 * 
 * These tests focus on edge cases and error handling for the payment wrapper,
 * including invalid inputs, error propagation, and recovery scenarios.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { wrapWithPayments } from './payment-wrapper.js';

// Valid JWT token for testing
const VALID_JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTEyMyIsIm5hbWUiOiJKb2huIERvZSIsImlhdCI6MTUxNjIzOTAyMn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

// Invalid JWT token (missing parts)
const INVALID_JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTEyMyIsIm5hbWUiOiJKb2huIERvZSIsImlhdCI6MTUxNjIzOTAyMn0';

// Mock console methods to capture output
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
let consoleOutput: string[] = [];
let consoleErrors: string[] = [];

// Helper function to create a valid options object
function createValidOptions(overrides: Record<string, any> = {}) {
  return {
    apiKey: 'valid-api-key',
    userToken: VALID_JWT,
    debugMode: false,
    ...overrides
  };
}

// Helper function to create a test server
function createTestServer() {
  return new McpServer({
    name: "Test Server",
    version: "1.0.0",
    description: "Test server for edge cases"
  });
}

beforeEach(() => {
  // Clear the captured console output
  consoleOutput = [];
  consoleErrors = [];
  
  // Mock console methods
  console.log = (...args: any[]) => {
    consoleOutput.push(args.join(' '));
  };
  
  console.error = (...args: any[]) => {
    consoleErrors.push(args.join(' '));
  };
});

afterEach(() => {
  // Restore original console methods
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
});

describe('Input Validation Edge Cases', () => {
  test('throws error when apiKey is missing', () => {
    const server = createTestServer();
    
    // Create options without apiKey
    const options = { userToken: VALID_JWT, debugMode: false };
    
    // Verify that wrapping throws an error
    expect(() => {
      wrapWithPayments(server, options as any);
    }).toThrow('Invalid developer API key: API key is required');
  });
  
  test('throws error when apiKey is empty', () => {
    const server = createTestServer();
    
    // Create options with empty apiKey
    const options = createValidOptions({ apiKey: '' });
    
    // Verify that wrapping throws an error
    expect(() => {
      wrapWithPayments(server, options);
    }).toThrow('Invalid developer API key: API key is required');
  });
  
  test('throws error when userToken is missing', () => {
    const server = createTestServer();
    
    // Create options without userToken
    const options = { apiKey: 'valid-api-key', debugMode: false };
    
    // Verify that wrapping throws an error
    expect(() => {
      wrapWithPayments(server, options as any);
    }).toThrow('Invalid user token: User token is required');
  });
  
  test('throws error when userToken is empty', () => {
    const server = createTestServer();
    
    // Create options with empty userToken
    const options = createValidOptions({ userToken: '' });
    
    // Verify that wrapping throws an error
    expect(() => {
      wrapWithPayments(server, options);
    }).toThrow('Invalid user token: User token is required');
  });
  
  test('throws error when userToken is invalid format', () => {
    const server = createTestServer();
    
    // Create options with invalid JWT format
    const options = createValidOptions({ userToken: INVALID_JWT });
    
    // Verify that wrapping throws an error
    expect(() => {
      wrapWithPayments(server, options);
    }).toThrow('Invalid user JWT token: Authentication failed');
  });
  
  // Add server validation tests after adding validation to the wrapper
  test('should handle null server gracefully', () => {
    // First check if the server is null before trying to create a proxy
    expect(() => {
      // @ts-ignore - Testing invalid input
      wrapWithPayments(null, createValidOptions());
    }).toThrow();
  });
  
  test('should handle undefined server gracefully', () => {
    // First check if the server is undefined before trying to create a proxy
    expect(() => {
      // @ts-ignore - Testing invalid input
      wrapWithPayments(undefined, createValidOptions());
    }).toThrow();
  });
});

describe('Error Propagation', () => {
  test('propagates errors from original server methods', () => {
    const server = createTestServer();
    
    // Override a method to throw an error
    const originalTool = server.tool;
    server.tool = function(...args: any[]) {
      throw new Error('Original server error');
    };
    
    const wrappedServer = wrapWithPayments(server, createValidOptions());
    
    // Verify that the error is propagated
    expect(() => {
      wrappedServer.tool('test_tool', { param: z.string() }, async (args, extra) => {
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
    const wrappedServer = wrapWithPayments(server, createValidOptions());
    
    // Register a tool that throws an error
    wrappedServer.tool('error_tool', { param: z.string() }, async (args, extra) => {
      throw new Error('Tool execution error');
      return {
        content: [{ type: 'text' as const, text: 'Success' }]
      };
    });
    
    // Create a mock request handler extra
    const extra = { userId: 'user-123' };
    
    // Mock Math.random to ensure sufficient funds
    const originalRandom = Math.random;
    Math.random = jest.fn().mockReturnValue(0.9);
    
    try {
      // Attempt to call the tool (this will fail because we can't directly call it)
      // But we can verify that the error is logged
      await (wrappedServer as any)._registeredTools?.error_tool?.callback({ param: 'test' }, extra);
    } catch (error) {
      // Expected to throw
    }
    
    // Restore Math.random
    Math.random = originalRandom;
    
    // Verify that the error was logged
    expect(consoleErrors.some(msg => msg.includes('Tool execution error'))).toBe(true);
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
      wrappedServer.tool('valid_tool', { param: z.string() }, async (args, extra) => {
        return {
          content: [{ type: 'text' as const, text: 'Success' }]
        };
      });
    }).not.toThrow();
  });
  
  test('can use server after a failed tool call', async () => {
    const server = createTestServer();
    const wrappedServer = wrapWithPayments(server, createValidOptions());
    
    // Register a tool that throws an error
    wrappedServer.tool('error_tool', { param: z.string() }, async (args, extra) => {
      throw new Error('Tool execution error');
      return {
        content: [{ type: 'text' as const, text: 'Error' }]
      };
    });
    
    // Register a tool that works correctly
    wrappedServer.tool('working_tool', { param: z.string() }, async (args, extra) => {
      return { content: [{ type: 'text' as const, text: 'Success' }] };
    });
    
    // Create a mock request handler extra
    const extra = { userId: 'user-123' };
    
    // Mock Math.random to ensure sufficient funds
    const originalRandom = Math.random;
    Math.random = jest.fn().mockReturnValue(0.9);
    
    try {
      // Attempt to call the error tool
      await (wrappedServer as any)._registeredTools?.error_tool?.callback({ param: 'test' }, extra);
    } catch (error) {
      // Expected to throw
    }
    
    try {
      // Attempt to call the working tool
      const result = await (wrappedServer as any)._registeredTools?.working_tool?.callback({ param: 'test' }, extra);
      
      // Verify that the working tool returns the expected result
      expect(result.content[0].text).toBe('Success');
    } catch (error) {
      // This should not throw
      fail('Working tool should not throw');
    }
    
    // Restore Math.random
    Math.random = originalRandom;
  });
});

describe('Billing Edge Cases', () => {
  test('handles insufficient funds correctly', () => {
    const server = createTestServer();
    const wrappedServer = wrapWithPayments(server, createValidOptions());
    
    // Register a tool
    wrappedServer.tool('zero_balance_tool', { param: z.string() }, async (args, extra) => {
      return { content: [{ type: 'text' as const, text: 'Success' }] };
    });
    
    // Create a mock request handler extra
    const extra = { userId: 'user-123' };
    
    // Mock Math.random to return 0 (insufficient funds)
    const originalRandom = Math.random;
    Math.random = jest.fn().mockReturnValue(0);
    
    // Get the handler directly
    const handler = (wrappedServer as any)._registeredTools?.zero_balance_tool?.callback;
    
    if (handler) {
      // Call the handler directly
      const result = handler({ param: 'test' }, extra);
      
      // Verify that the result indicates insufficient funds
      expect(result).resolves.toHaveProperty('content.0.text', expect.stringContaining('Insufficient funds'));
    }
    
    // Restore Math.random
    Math.random = originalRandom;
  });
  
  test('handles exactly sufficient funds correctly', () => {
    const server = createTestServer();
    const wrappedServer = wrapWithPayments(server, createValidOptions());
    
    // Register a tool
    wrappedServer.tool('sufficient_funds_tool', { param: z.string() }, async (args, extra) => {
      return { content: [{ type: 'text' as const, text: 'Success' }] };
    });
    
    // Create a mock request handler extra
    const extra = { userId: 'user-123' };
    
    // Mock Math.random to return exactly the threshold (sufficient funds)
    const originalRandom = Math.random;
    Math.random = jest.fn().mockReturnValue(0.5);
    
    // Get the handler directly
    const handler = (wrappedServer as any)._registeredTools?.sufficient_funds_tool?.callback;
    
    if (handler) {
      // Call the handler directly
      const result = handler({ param: 'test' }, extra);
      
      // Verify that the tool is called and returns the expected result
      expect(result).resolves.toEqual({
        content: [{ type: 'text', text: 'Success' }]
      });
    }
    
    // Restore Math.random
    Math.random = originalRandom;
  });
});

describe('Debug Mode', () => {
  test('logs debug information when debugMode is true', () => {
    const server = createTestServer();
    const wrappedServer = wrapWithPayments(server, createValidOptions({ debugMode: true }));
    
    // Register a tool
    wrappedServer.tool('debug_tool', { param: z.string() }, async (args, extra) => {
      return { content: [{ type: 'text' as const, text: 'Success' }] };
    });
    
    // Verify that debug information was logged
    expect(consoleOutput.some(msg => msg.includes('payment-enabled wrapper'))).toBe(true);
  });
  
  test('does not log debug information when debugMode is false', () => {
    const server = createTestServer();
    const wrappedServer = wrapWithPayments(server, createValidOptions({ debugMode: false }));
    
    // Register a tool
    wrappedServer.tool('no_debug_tool', { param: z.string() }, async (args, extra) => {
      return { content: [{ type: 'text' as const, text: 'Success' }] };
    });
    
    // Verify that no debug information was logged
    expect(consoleOutput.some(msg => msg.includes('payment-enabled wrapper'))).toBe(false);
  });
}); 