/**
 * @file Tests for Payment Wrapper
 * @version 1.0.0
 * 
 * Tests for the MCP payment wrapper functionality.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { wrapWithPayments, PaymentWrapperOptions } from './payment-wrapper.js';

// Mock console methods to capture output
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
let consoleOutput: string[] = [];
let consoleErrors: string[] = [];

beforeEach(() => {
  // Clear the captured console output
  consoleOutput = [];
  consoleErrors = [];
  
  // Mock console methods
  console.log = (...args: any[]) => {
    consoleOutput.push(args.join(' '));
    // Uncomment for debugging
    // originalConsoleLog(...args);
  };
  
  console.error = (...args: any[]) => {
    consoleErrors.push(args.join(' '));
    // Uncomment for debugging
    // originalConsoleError(...args);
  };
});

afterEach(() => {
  // Restore original console methods
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
});

// Helper function to inspect object structure
function inspectObject(obj: any, depth = 0, maxDepth = 2): string {
  if (depth > maxDepth) return '...';
  if (obj === null) return 'null';
  if (obj === undefined) return 'undefined';
  if (typeof obj !== 'object') return String(obj);
  
  const indent = '  '.repeat(depth);
  const nextIndent = '  '.repeat(depth + 1);
  
  if (Array.isArray(obj)) {
    if (obj.length === 0) return '[]';
    let result = '[\n';
    for (let i = 0; i < Math.min(obj.length, 5); i++) {
      result += `${nextIndent}${inspectObject(obj[i], depth + 1, maxDepth)},\n`;
    }
    if (obj.length > 5) result += `${nextIndent}... ${obj.length - 5} more items\n`;
    result += `${indent}]`;
    return result;
  }
  
  const keys = Object.keys(obj);
  if (keys.length === 0) return '{}';
  
  let result = '{\n';
  for (const key of keys.slice(0, 10)) {
    try {
      result += `${nextIndent}${key}: ${inspectObject(obj[key], depth + 1, maxDepth)},\n`;
    } catch (e: any) {
      result += `${nextIndent}${key}: [Error: ${e.message || 'Unknown error'}],\n`;
    }
  }
  if (keys.length > 10) result += `${nextIndent}... ${keys.length - 10} more properties\n`;
  result += `${indent}}`;
  return result;
}

describe('wrapWithPayments', () => {
  // Create a simple MCP server for testing
  let demoServer: McpServer;
  
  beforeEach(() => {
    demoServer = new McpServer({
      name: "Test Server",
      version: "1.0.0",
      description: "Test server for payment wrapper tests"
    });
    
    // Register a simple tool
    demoServer.tool("test_tool", { value: z.string() }, async (args, extra) => {
      return {
        content: [{ 
          type: "text" as const, 
          text: `Processed: ${args.value}` 
        }]
      };
    });
    
    // Log the structure of the demo server
    originalConsoleLog('Demo server structure:');
    originalConsoleLog(inspectObject(demoServer));
    
    // Check if specific properties exist
    originalConsoleLog('Does demoServer have _config?', '_config' in demoServer);
    originalConsoleLog('Does demoServer have _tools?', '_tools' in demoServer);
    
    // Try to find where tools are stored
    for (const key of Object.keys(demoServer)) {
      try {
        const value = (demoServer as any)[key];
        if (value && typeof value === 'object') {
          if (value instanceof Map && value.has('test_tool')) {
            originalConsoleLog(`Found tools in property: ${key}`);
          } else if (typeof value === 'object' && !Array.isArray(value)) {
            for (const subKey of Object.keys(value)) {
              if (subKey === 'test_tool' || (value[subKey] && value[subKey].name === 'test_tool')) {
                originalConsoleLog(`Found tool reference in ${key}.${subKey}`);
              }
            }
          }
        }
      } catch (e: any) {
        originalConsoleLog(`Error inspecting property ${key}:`, e.message || 'Unknown error');
      }
    }
  });
  
  test('throws error when API key is missing', () => {
    const options: PaymentWrapperOptions = {
      apiKey: '',
      userToken: 'valid.token.123'
    };
    
    expect(() => wrapWithPayments(demoServer, options)).toThrow('Invalid developer API key');
  });
  
  test('throws error when user token is missing', () => {
    const options: PaymentWrapperOptions = {
      apiKey: 'valid-api-key',
      userToken: ''
    };
    
    expect(() => wrapWithPayments(demoServer, options)).toThrow('Invalid user token');
  });
  
  test('throws error when user token is invalid', () => {
    const options: PaymentWrapperOptions = {
      apiKey: 'valid-api-key',
      userToken: 'invalid-token'  // Not in JWT format
    };
    
    expect(() => wrapWithPayments(demoServer, options)).toThrow('Invalid user JWT token');
  });
  
  test('creates a valid wrapped server when options are valid', () => {
    const options: PaymentWrapperOptions = {
      apiKey: 'valid-api-key',
      userToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTEyMyIsIm5hbWUiOiJKb2huIERvZSIsImlhdCI6MTUxNjIzOTAyMn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
    };
    
    const wrappedServer = wrapWithPayments(demoServer, options);
    
    expect(wrappedServer).toBeDefined();
    
    // With the proxy approach, the wrapped server is not strictly equal to the original server
    // but it should be an instance of McpServer and have the same methods
    expect(wrappedServer).toBeInstanceOf(McpServer);
    
    // Verify that the tool method is still accessible
    expect(typeof wrappedServer.tool).toBe('function');
  });
  
  test('forwards tool calls and processes charges when funds are sufficient', async () => {
    // Create a test server with a mock tool
    const testServer = new McpServer({ name: "Test", version: "1.0", description: "Test" });
    
    // Define a test handler that we can call directly
    const testHandler = async (args: any, extra: any) => {
      return {
        content: [{ type: "text" as const, text: `Result: ${args.param}` }]
      };
    };
    
    // Register the tool on the server
    testServer.tool("test_tool", { param: z.string() }, testHandler);
    
    // Create a wrapped server
    const options: PaymentWrapperOptions = {
      apiKey: 'valid-api-key',
      userToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTEyMyIsIm5hbWUiOiJKb2huIERvZSIsImlhdCI6MTUxNjIzOTAyMn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
      debugMode: true
    };
    
    // Override the getUserBillingStatus function to always return sufficient funds
    global.Math.random = jest.fn(() => 0.5);  // Ensure sufficient funds
    
    const wrappedServer = wrapWithPayments(testServer, options);
    
    // Create a mock request to simulate a tool call
    const mockArgs = { param: 'test' };
    const mockExtra = {};
    
    // Register a new handler that will be wrapped with payment functionality
    let handlerCalled = false;
    wrappedServer.tool("payment_test_tool", { param: z.string() }, async (args, extra) => {
      handlerCalled = true;
      return {
        content: [{ type: "text" as const, text: `Result: ${args.param}` }]
      };
    });
    
    // Call the tool directly to simulate a request
    const result = await (wrappedServer as any)._registeredTools.payment_test_tool.callback(mockArgs, mockExtra);
    
    // Verify the handler was called
    expect(handlerCalled).toBe(true);
    
    // Verify the result
    expect(result).toBeDefined();
    expect(result.content[0].text).toBe('Result: test');
    
    // Verify billing was processed
    expect(consoleOutput.some(log => log.includes('Processed charge for user'))).toBe(true);
  });
  
  test('rejects tool calls when funds are insufficient', async () => {
    // Create a test server with a mock tool
    const testServer = new McpServer({ name: "Test", version: "1.0", description: "Test" });
    
    // Register the tool on the server
    testServer.tool("test_tool", { param: z.string() }, async (args, extra) => {
      return {
        content: [{ type: "text" as const, text: `Result: ${args.param}` }]
      };
    });
    
    // Create a wrapped server
    const options: PaymentWrapperOptions = {
      apiKey: 'valid-api-key',
      userToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTEyMyIsIm5hbWUiOiJKb2huIERvZSIsImlhdCI6MTUxNjIzOTAyMn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
      debugMode: true
    };
    
    // Override the getUserBillingStatus function to always return insufficient funds
    global.Math.random = jest.fn(() => 0.0);  // Ensure insufficient funds
    
    const wrappedServer = wrapWithPayments(testServer, options);
    
    // Create a mock request to simulate a tool call
    const mockArgs = { param: 'test' };
    const mockExtra = {};
    
    // Register a new handler that will be wrapped with payment functionality
    let handlerCalled = false;
    wrappedServer.tool("payment_test_tool", { param: z.string() }, async (args, extra) => {
      handlerCalled = true;
      return {
        content: [{ type: "text" as const, text: `Result: ${args.param}` }]
      };
    });
    
    // Call the tool directly to simulate a request
    const result = await (wrappedServer as any)._registeredTools.payment_test_tool.callback(mockArgs, mockExtra);
    
    // Verify the handler was not called due to insufficient funds
    expect(handlerCalled).toBe(false);
    
    // Verify the result is an error message
    expect(result).toBeDefined();
    expect(result.content[0].text).toContain('Insufficient funds');
    
    // Verify error was logged
    expect(consoleErrors.some(log => log.includes('Payment rejected'))).toBe(true);
  });
}); 