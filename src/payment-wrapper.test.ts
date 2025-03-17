/**
 * @file Tests for Payment Wrapper
 * @version 1.1.0
 * 
 * Tests for the MCP payment wrapper functionality.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { wrapWithPayments } from './payment-wrapper.js';
import { TestLogger, createTestServer } from './utils/test-helpers.js';
import { MockAuthService } from './services/mock-auth-service.js';

// Setup test logger for capturing logs
let testLogger: TestLogger;
let mockAuthService: MockAuthService;

// API key for testing
const TEST_API_KEY = 'valid-api-key';

// Create test options with a valid token
function createTestOptions(logger: TestLogger, overrides = {}) {
  // Create auth service with the test API key
  mockAuthService = new MockAuthService({
    apiKey: TEST_API_KEY,
    baseAuthUrl: 'https://auth.mcp-api.com'
  });
  
  // Generate a valid token
  const validToken = mockAuthService.generateToken('test-user');
  
  return {
    apiKey: TEST_API_KEY,
    userToken: validToken,
    debugMode: true,
    loggerOptions: {
      level: 'debug',
      customLogger: logger.logger
    },
    ...overrides
  };
}

beforeEach(() => {
  // Create a fresh logger instance for each test
  testLogger = new TestLogger();
  
  // Add the prototype method to call a tool directly for tests
  if (!(McpServer.prototype as any).callTool) {
    (McpServer.prototype as any).callTool = async function(name: string, args: any) {
      const tool = (this as any)._registeredTools[name];
      if (!tool) {
        throw new Error(`Tool not found: ${name}`);
      }
      return await tool.callback(args, {});
    };
  }
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
    expect(testLogger.getAllLogs().some(log => 
      log.data && log.data.includes('Creating payment-enabled wrapper')
    )).toBe(true);
  });
  
  test('throws an error when API key is missing', () => {
    const server = createTestServer();
    
    // Remove the API key from options
    const options = createTestOptions(testLogger, { apiKey: '' });
    
    // Verify that wrapping throws an error
    expect(() => {
      wrapWithPayments(server, options);
    }).toThrow('Developer API key is required');
  });
  
  // Test for authentication flow is now handled in payment-wrapper.auth.test.ts
  
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
    
    // Dump all logs for debugging
    console.log('All logs:', JSON.stringify(testLogger.getAllLogs(), null, 2));
    
    // Verify debug log shows registration - check for the exact format
    const hasRegistrationLog = testLogger.getAllLogs().some(log => 
      log.data && log.data.includes('Registering tool') && 
      log.data.includes('new_tool')
    );
    
    expect(hasRegistrationLog).toBe(true);
  });

  test('calls a registered tool successfully', async () => {
    // Create a server and wrapped server
    const server = createTestServer();
    
    // Use the new test override option instead of mocking Math.random
    const options = createTestOptions(testLogger, { _testOverrideFundsCheck: true });
    const wrappedServer = wrapWithPayments(server, options);
    
    // Define a schema and handler for testing
    const schema = { value: z.string() };
    const testHandler = async (args: any, extra: any) => {
      return {
        content: [{ type: 'text' as const, text: `Result: ${args.value}` }]
      };
    };
    
    // Register a tool
    wrappedServer.tool('test_tool', schema, testHandler);
    
    // Call the tool through the proxy
    const result = await (wrappedServer as any).callTool('test_tool', { value: 'test' });
    
    // Verify the result
    expect(result).toBeDefined();
    expect(result.content[0].text).toBe('Result: test');
    
    // Verify logs show the payment checks and processing
    expect(testLogger.getAllLogs().some(log => 
      log.data && log.data.includes('Executing tool')
    )).toBe(true);
    
    expect(testLogger.getAllLogs().some(log => 
      log.data && log.data.includes('Authentication successful')
    )).toBe(true);
  });
  
  test('rejects tool calls when funds are insufficient', async () => {
    // Create a server and wrapped server
    const server = createTestServer();
    
    // Use the new test override option instead of mocking Math.random
    const options = createTestOptions(testLogger, { _testOverrideFundsCheck: false });
    const wrappedServer = wrapWithPayments(server, options);
    
    // Define a schema and handler for testing
    const schema = { value: z.string() };
    const testHandler = async (args: any, extra: any) => {
      return {
        content: [{ type: 'text' as const, text: `Result: ${args.value}` }]
      };
    };
    
    // Register a tool
    wrappedServer.tool('test_tool', schema, testHandler);
    
    // Call the tool through the proxy
    const result = await (wrappedServer as any).callTool('test_tool', { value: 'test' });
    
    // Verify the result contains an error message
    expect(result).toBeDefined();
    expect(result).toHaveProperty('error', 'insufficient_funds');
    expect(result).toHaveProperty('message', 'Insufficient funds to execute this operation');
    
    // Verify error was logged
    expect(testLogger.getAllLogs().some(log => 
      log.data && log.data.includes('Insufficient funds')
    )).toBe(true);
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
    
    // Verify debug log shows registration - check for the exact format
    const hasRegistrationLog = testLogger.getAllLogs().some(log => 
      log.data && log.data.includes('Registering resource') && 
      log.data.includes('new_resource')
    );
    
    expect(hasRegistrationLog).toBe(true);
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
    
    // Verify debug log shows registration - check for the exact format
    const hasRegistrationLog = testLogger.getAllLogs().some(log => 
      log.data && log.data.includes('Registering prompt') && 
      log.data.includes('new_prompt')
    );
    
    expect(hasRegistrationLog).toBe(true);
  });
}); 