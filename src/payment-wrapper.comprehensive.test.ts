/**
 * @file Comprehensive Tests for Payment Wrapper
 * @version 1.1.0
 * 
 * Comprehensive tests for the MCP payment wrapper functionality,
 * focusing on tool, resource, and prompt method tests to ensure
 * proper wrapping of the MCP server methods.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { wrapWithPayments } from './payment-wrapper.js';
import { TestLogger, createTestServer, inspectObject } from './utils/test-helpers.js';
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
      customLogger: logger.logger
    },
    ...overrides
  };
}

beforeEach(() => {
  // Create a fresh logger instance for each test
  testLogger = new TestLogger();
});

afterEach(() => {
  // Clear logs between tests
  testLogger.clear();
});

// Helper function to directly test the payment wrapper functionality
async function testPaymentWrapper(
  options: { 
    sufficientFunds: boolean; 
    type: 'tool' | 'resource' | 'prompt';
    shouldThrow?: boolean;
  }
) {
  const { sufficientFunds, type, shouldThrow = false } = options;
  
  // Create a server
  const server = createTestServer();
  
  // Create a valid token using the mock auth service
  const mockAuth = new MockAuthService({ apiKey: 'valid-api-key' });
  const validToken = mockAuth.generateToken('test-user');
  
  // Create the payment wrapper with the test override for funds check
  const wrappedServer = wrapWithPayments(server, {
    apiKey: 'valid-api-key',
    userToken: validToken,
    debugMode: true,
    loggerOptions: {
      customLogger: testLogger.logger
    },
    _testOverrideFundsCheck: sufficientFunds
  });
  
  testLogger.logger.debug(`Testing ${type} with sufficientFunds=${sufficientFunds}, shouldThrow=${shouldThrow}`);
  
  try {
    // Register and test different types of methods
    switch (type) {
      case 'tool': {
        // Register a tool
        wrappedServer.tool('wrapped_tool', { param: z.string() }, async (args, extra) => {
          if (shouldThrow) {
            throw new Error(`Test error in tool`);
          }
          
          return {
            content: [{ type: 'text' as const, text: 'Success' }]
          };
        });
        
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
        
        try {
          // Call the tool through the proxy
          const result = await (wrappedServer as any).callTool('wrapped_tool', { param: 'test value' });
          
          return { 
            name: 'wrapped_tool', 
            type: 'tool',
            result 
          };
        } catch (error) {
          return {
            name: 'wrapped_tool',
            type: 'tool',
            error
          };
        }
      }
        
      case 'resource': {
        // Register a resource
        wrappedServer.resource('wrapped_resource', 'wrapped/:id', async (uri, extra) => {
          if (shouldThrow) {
            throw new Error(`Test error in resource`);
          }
          
          return {
            contents: [{
              uri: uri.href,
              text: 'Success'
            }]
          };
        });
        
        return {
          name: 'wrapped_resource',
          type: 'resource'
        };
      }
        
      case 'prompt': {
        // Register a prompt
        wrappedServer.prompt('wrapped_prompt', (extra) => {
          if (shouldThrow) {
            throw new Error(`Test error in prompt`);
          }
          
          return {
            messages: [{
              role: 'assistant' as const,
              content: { type: 'text' as const, text: 'Success' }
            }]
          };
        });
        
        // Add the prototype method to call a prompt directly for tests
        if (!(McpServer.prototype as any).callPrompt) {
          (McpServer.prototype as any).callPrompt = async function(name: string) {
            const prompt = (this as any)._registeredPrompts[name];
            if (!prompt) {
              throw new Error(`Prompt not found: ${name}`);
            }
            return await prompt.callback({});
          };
        }
        
        try {
          // Call the prompt through the proxy
          const result = await (wrappedServer as any).callPrompt('wrapped_prompt');
          
          return { 
            name: 'wrapped_prompt', 
            type: 'prompt',
            result 
          };
        } catch (error) {
          return {
            name: 'wrapped_prompt',
            type: 'prompt',
            error
          };
        }
      }
    }
  } catch (error) {
    testLogger.logger.error(`Error in testPaymentWrapper: ${error}`);
    return { error, type };
  }
}

describe('Tool Method Tests', () => {
  describe('Tool Registration', () => {
    test('registers a tool with the proxy', () => {
      // Create a server
      const server = createTestServer();
      
      // Create the payment wrapper
      const wrappedServer = wrapWithPayments(server, createTestOptions(testLogger));
      
      // Define a schema and handler for testing
      const schema = { param: z.string() };
      const handler = async (args: any, extra: any) => {
        return {
          content: [{ type: 'text' as const, text: `Result: ${args.param}` }]
        };
      };
      
      // Register a tool
      wrappedServer.tool('test_tool', schema, handler);
      
      // Verify the tool was registered through the wrapper
      expect(testLogger.contains('Registering tool')).toBe(true);
      expect(testLogger.getAllLogs().some(log => 
        log.message === 'Registering tool' && 
        log.args === 'test_tool'
      )).toBe(true);
    });
  });
  
  describe('Tool Execution', () => {
    test('successfully executes a tool when funds are sufficient', async () => {
      // Test with sufficient funds and no error
      const result = await testPaymentWrapper({ 
        type: 'tool', 
        sufficientFunds: true,
        shouldThrow: false
      });
      
      // Verify the result
      expect(result).toBeDefined();
      expect(result?.result).toHaveProperty('content');
      expect(result?.result.content[0].text).toBe('Success');
      
      // Verify billing was processed
      expect(testLogger.contains('Processed charge for user')).toBe(true);
    });
    
    test('rejects a tool call when funds are insufficient', async () => {
      // Test with insufficient funds
      const result = await testPaymentWrapper({ 
        type: 'tool', 
        sufficientFunds: false 
      });
      
      // Verify the result indicates insufficient funds
      expect(result).toBeDefined();
      expect(result?.result).toHaveProperty('error', 'insufficient_funds');
      expect(result?.result).toHaveProperty('message', 'Insufficient funds to execute this operation');
      
      // Verify error was logged
      expect(testLogger.contains('Insufficient funds')).toBe(true);
    });
    
    test('handles errors during tool execution', async () => {
      // Test with an error during execution
      const result = await testPaymentWrapper({ 
        type: 'tool', 
        sufficientFunds: true,
        shouldThrow: true
      });
      
      // Verify the result indicates an error
      expect(result).toBeDefined();
      expect(result?.error).toBeDefined();
      
      // Verify error was logged - the exact message depends on the implementation
      expect(testLogger.contains('Error')).toBe(true);
      
      // Verify no billing was processed (since the tool failed)
      expect(testLogger.contains('Processed charge for user')).toBe(false);
    });
  });
});

describe('Resource Method Tests', () => {
  describe('Resource Registration', () => {
    test('registers a resource with the proxy', () => {
      // Create a server
      const server = createTestServer();
      
      // Create the payment wrapper
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
      wrappedServer.resource('test_resource', template, handler);
      
      // Verify the resource was registered through the wrapper
      expect(testLogger.contains('Registering resource')).toBe(true);
      expect(testLogger.getAllLogs().some(log => 
        log.message === 'Registering resource' && 
        log.args === 'test_resource'
      )).toBe(true);
    });
  });
  
  describe('Resource Execution', () => {
    // Since directly testing resource callbacks is difficult due to the McpServer structure,
    // we'll verify the wrapper functionality indirectly through logs
    
    test('resource handling is properly set up', () => {
      // Create a server
      const server = createTestServer();
      
      // Create the payment wrapper with different billing settings
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
      
      // Register resources
      wrappedServer.resource('test_resource', template, handler);
      
      // Verify the logs contain registration information
      expect(testLogger.contains('Registering resource')).toBe(true);
      expect(testLogger.getAllLogs().some(log => 
        log.message === 'Registering resource' && 
        log.args === 'test_resource'
      )).toBe(true);
      
      // This tests that the wrapper is correctly set up and should apply the payment wrapper,
      // though we can't directly test the execution via the same method as tools and prompts
    });
  });
});

describe('Prompt Method Tests', () => {
  describe('Prompt Registration', () => {
    test('registers a prompt with the proxy', () => {
      // Create a server
      const server = createTestServer();
      
      // Create the payment wrapper
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
      wrappedServer.prompt('test_prompt', handler);
      
      // Verify the prompt was registered through the wrapper
      expect(testLogger.contains('Registering prompt')).toBe(true);
      expect(testLogger.getAllLogs().some(log => 
        log.message === 'Registering prompt' && 
        log.args === 'test_prompt'
      )).toBe(true);
    });
  });
  
  describe('Prompt Execution', () => {
    test('successfully executes a prompt when funds are sufficient', async () => {
      // Test with sufficient funds and no error
      const result = await testPaymentWrapper({ 
        type: 'prompt', 
        sufficientFunds: true,
        shouldThrow: false
      });
      
      // Verify the result
      expect(result).toBeDefined();
      expect(result?.result).toHaveProperty('messages');
      expect(result?.result.messages[0].content.text).toBe('Success');
      
      // Verify billing was processed
      expect(testLogger.contains('Processed charge for user')).toBe(true);
    });
    
    test('rejects a prompt execution when funds are insufficient', async () => {
      // Test with insufficient funds
      const result = await testPaymentWrapper({ 
        type: 'prompt', 
        sufficientFunds: false 
      });
      
      // Verify the result indicates insufficient funds
      expect(result).toBeDefined();
      expect(result?.result).toHaveProperty('error', 'insufficient_funds');
      expect(result?.result).toHaveProperty('message', 'Insufficient funds to execute this operation');
      
      // Verify error was logged
      expect(testLogger.contains('Insufficient funds')).toBe(true);
    });
    
    test('handles errors during prompt execution', async () => {
      // Test with an error during execution
      const result = await testPaymentWrapper({ 
        type: 'prompt', 
        sufficientFunds: true,
        shouldThrow: true
      });
      
      // Verify the result indicates an error
      expect(result).toBeDefined();
      expect(result?.error).toBeDefined();
      
      // Verify error was logged - the exact message depends on the implementation
      expect(testLogger.contains('Error')).toBe(true);
      
      // Verify no billing was processed (since the prompt failed)
      expect(testLogger.contains('Processed charge for user')).toBe(false);
    });
  });
}); 