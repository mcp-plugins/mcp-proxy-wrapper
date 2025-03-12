/**
 * @file Tests for Payment Wrapper
 * @version 1.0.0
 * 
 * Tests for the MCP payment wrapper functionality.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { wrapWithPayments } from './payment-wrapper.js';
import { TestLogger, createTestOptions, createTestServer } from './utils/test-helpers.js';

// Setup test logger for capturing logs
let testLogger: TestLogger;

beforeEach(() => {
  // Create a fresh logger instance for each test
  testLogger = new TestLogger();
});

afterEach(() => {
  // Clear logs between tests
  testLogger.clear();
});

describe('wrapWithPayments', () => {
  test('wraps an McpServer instance correctly', () => {
    const server = createTestServer();
    const wrappedServer = wrapWithPayments(server, createTestOptions(testLogger));
    
    // Verify the wrapped server is an McpServer instance
    expect(wrappedServer).toBeInstanceOf(McpServer);
    
    // Verify debug information was logged
    expect(testLogger.contains('Creating payment-enabled wrapper')).toBe(true);
  });
  
  test('throws an error when API key is missing', () => {
    const server = createTestServer();
    
    // Remove the API key from options
    const options = createTestOptions(testLogger, { apiKey: '' });
    
    // Verify that wrapping throws an error
    expect(() => {
      wrapWithPayments(server, options);
    }).toThrow('Invalid developer API key: API key is required');
    
    // Verify error was logged
    expect(testLogger.contains('Invalid developer API key', 'error')).toBe(true);
  });
  
  test('throws an error when user token is missing', () => {
    const server = createTestServer();
    
    // Remove the user token from options
    const options = createTestOptions(testLogger, { userToken: '' });
    
    // Verify that wrapping throws an error
    expect(() => {
      wrapWithPayments(server, options);
    }).toThrow('Invalid user token: User token is required');
    
    // Verify error was logged
    expect(testLogger.contains('Invalid user token', 'error')).toBe(true);
  });
  
  test('throws an error when user JWT token is invalid', () => {
    const server = createTestServer();
    
    // Use an invalid JWT format (missing the signature part)
    const invalidJWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTEyMyIsIm5hbWUiOiJKb2huIERvZSIsImlhdCI6MTUxNjIzOTAyMn0';
    const options = createTestOptions(testLogger, { userToken: invalidJWT });
    
    // Verify that wrapping throws an error
    expect(() => {
      wrapWithPayments(server, options);
    }).toThrow('Invalid user JWT token: Authentication failed');
    
    // Verify error was logged
    expect(testLogger.contains('JWT token validation failed', 'warn')).toBe(true);
  });
  
  test('registers a tool and proxies its methods', () => {
    const server = createTestServer();
    const wrappedServer = wrapWithPayments(server, createTestOptions(testLogger));
    
    // Define a schema and handler for testing
    const schema = { value: z.string() };
    const handler = async (args: any, extra: any) => {
      return {
        content: [{ type: 'text' as const, text: `Result: ${args.value}` }]
      };
    };
    
    // Register a tool
    wrappedServer.tool('new_tool', schema, handler);
    
    // Verify debug log shows registration
    expect(testLogger.contains('Registering tool with payment wrapper: new_tool')).toBe(true);
  });

  test('calls a registered tool successfully', async () => {
    // Create a server and wrapped server
    const server = createTestServer();
    const wrappedServer = wrapWithPayments(server, createTestOptions(testLogger));
    
    // Mock Math.random to ensure sufficient funds
    const originalRandom = Math.random;
    Math.random = jest.fn().mockReturnValue(0.9);
    
    // Define a schema and handler for testing
    const schema = { value: z.string() };
    const testHandler = async (args: any, extra: any) => {
      return {
        content: [{ type: 'text' as const, text: `Result: ${args.value}` }]
      };
    };
    
    // Register a tool
    wrappedServer.tool('test_tool', schema, testHandler);
    
    // Get the tool callback handler
    const toolCallback = (wrappedServer as any)._registeredTools?.test_tool?.callback;
    
    if (toolCallback) {
      // Call the tool handler
      const result = await toolCallback({ value: 'test' }, {});
      
      // Verify the result
      expect(result).toBeDefined();
      expect(result.content[0].text).toBe('Result: test');
      
      // Verify logs show the payment checks and processing
      expect(testLogger.contains('Payment wrapper: Handling tool call')).toBe(true);
      expect(testLogger.contains('Billing check for user')).toBe(true);
      expect(testLogger.contains('Processed charge for user')).toBe(true);
    } else {
      fail('Tool callback not found');
    }
    
    // Restore Math.random
    Math.random = originalRandom;
  });
  
  test('rejects tool calls when funds are insufficient', async () => {
    // Create a server and wrapped server
    const server = createTestServer();
    const wrappedServer = wrapWithPayments(server, createTestOptions(testLogger));
    
    // Mock Math.random to ensure insufficient funds
    const originalRandom = Math.random;
    Math.random = jest.fn().mockReturnValue(0.05);
    
    // Define a schema and handler for testing
    const schema = { value: z.string() };
    const testHandler = async (args: any, extra: any) => {
      return {
        content: [{ type: 'text' as const, text: `Result: ${args.value}` }]
      };
    };
    
    // Register a tool
    wrappedServer.tool('test_tool', schema, testHandler);
    
    // Get the tool callback handler
    const toolCallback = (wrappedServer as any)._registeredTools?.test_tool?.callback;
    
    if (toolCallback) {
      // Call the tool handler
      const result = await toolCallback({ value: 'test' }, {});
      
      // Verify the result contains an error message
      expect(result).toBeDefined();
      expect(result.content[0].text).toContain('Insufficient funds');
      
      // Verify error was logged
      expect(testLogger.contains('Payment rejected: Insufficient funds', 'error')).toBe(true);
    } else {
      fail('Tool callback not found');
    }
    
    // Restore Math.random
    Math.random = originalRandom;
  });
  
  test('registers a resource and proxies its methods', () => {
    const server = createTestServer();
    const wrappedServer = wrapWithPayments(server, createTestOptions(testLogger));
    
    // Define a template and handler for testing
    const template = 'test/:id';
    const handler = async (uri: URL, extra: any) => {
      return {
        contents: [{
          uri: uri.href,
          text: `Resource content for ${uri.pathname}`
        }]
      };
    };
    
    // Register a resource
    wrappedServer.resource('new_resource', template, handler);
    
    // Verify debug log shows registration
    expect(testLogger.contains('Registering resource with payment wrapper: new_resource')).toBe(true);
  });
  
  test('registers a prompt and proxies its methods', () => {
    const server = createTestServer();
    const wrappedServer = wrapWithPayments(server, createTestOptions(testLogger));
    
    // Define a handler for testing
    const handler = (extra: any) => {
      return {
        messages: [{
          role: 'assistant' as const,
          content: { type: 'text' as const, text: 'Prompt response' }
        }]
      };
    };
    
    // Register a prompt
    wrappedServer.prompt('new_prompt', handler);
    
    // Verify debug log shows registration
    expect(testLogger.contains('Registering prompt with payment wrapper: new_prompt')).toBe(true);
  });
}); 