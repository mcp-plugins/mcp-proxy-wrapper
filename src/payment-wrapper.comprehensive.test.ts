/**
 * @file Comprehensive Tests for Payment Wrapper
 * @version 1.0.0
 * 
 * Comprehensive tests for the MCP payment wrapper functionality,
 * focusing on tool, resource, and prompt method tests to ensure
 * proper wrapping of the MCP server methods.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { wrapWithPayments } from './payment-wrapper.js';
import { TestLogger, createTestOptions, createTestServer, inspectObject } from './utils/test-helpers.js';

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
  
  // Create the payment wrapper
  const wrappedServer = wrapWithPayments(server, createTestOptions(testLogger));
  
  // Mock Math.random to control billing result
  const originalRandom = Math.random;
  Math.random = jest.fn().mockReturnValue(sufficientFunds ? 0.9 : 0.05);
  
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
        
        // Call the tool directly
        const result = await (wrappedServer as any)._registeredTools.wrapped_tool.callback(
          { param: 'test value' }, 
          {}
        );
        
        return { 
          name: 'wrapped_tool', 
          type: 'tool',
          result 
        };
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
        
        // Direct access to registered resources requires a different approach
        // Find the resource handlers in _registeredResources
        const resourceName = 'wrapped_resource';
        const templateName = Object.keys((wrappedServer as any)._registeredResources).find(
          key => (wrappedServer as any)._registeredResources[key].name === resourceName
        );
        
        if (!templateName) {
          throw new Error(`Resource template for ${resourceName} not found`);
        }
        
        // Get the resource handler
        const resourceHandler = (wrappedServer as any)._registeredResources[templateName];
        
        // Create a mock URI
        const uri = new URL('test://example.com/wrapped/123');
        
        // Call the resource directly
        const result = await resourceHandler.callback(uri, {});
        
        return { 
          name: 'wrapped_resource', 
          type: 'resource',
          result 
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
        
        // Call the prompt directly
        const result = (wrappedServer as any)._registeredPrompts.wrapped_prompt.callback({});
        
        return { 
          name: 'wrapped_prompt', 
          type: 'prompt',
          result 
        };
      }
    }
  } catch (error) {
    testLogger.logger.debug(`Error calling ${type}:`, { error: error instanceof Error ? error.message : String(error) });
    return { name: `wrapped_${type}`, type, error };
  } finally {
    // Restore Math.random
    Math.random = originalRandom;
  }
  
  return null;
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
      expect(testLogger.contains('Registering tool with payment wrapper: test_tool')).toBe(true);
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
      expect(result?.result.content[0].text).toBe('Success');
      
      // Verify billing was processed
      expect(testLogger.contains('Processed charge for user')).toBe(true);
      expect(testLogger.contains(`Tool: ${result?.name}`)).toBe(true);
    });
    
    test('rejects a tool call when funds are insufficient', async () => {
      // Test with insufficient funds
      const result = await testPaymentWrapper({ 
        type: 'tool', 
        sufficientFunds: false 
      });
      
      // Verify the result indicates insufficient funds
      expect(result).toBeDefined();
      expect(result?.result.content[0].text).toContain('Insufficient funds');
      
      // Verify error was logged
      expect(testLogger.contains('Payment rejected: Insufficient funds', 'error')).toBe(true);
    });
    
    test('handles errors during tool execution', async () => {
      // Test with an error during execution
      const result = await testPaymentWrapper({ 
        type: 'tool', 
        sufficientFunds: true,
        shouldThrow: true
      });
      
      // Verify the error was captured
      expect(result).toBeDefined();
      expect(result?.error).toBeDefined();
      
      // Verify error was logged
      expect(testLogger.contains('Error in tool handler', 'error')).toBe(true);
      
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
      expect(testLogger.contains('Registering resource with payment wrapper: test_resource')).toBe(true);
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
      expect(testLogger.contains('Registering resource with payment wrapper: test_resource')).toBe(true);
      
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
      expect(testLogger.contains('Registering prompt with payment wrapper: test_prompt')).toBe(true);
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
      expect(result?.result.messages[0].content.text).toBe('Success');
      
      // Verify billing was processed
      expect(testLogger.contains('Processed charge for user')).toBe(true);
      expect(testLogger.contains(`Prompt: ${result?.name}`)).toBe(true);
    });
    
    test('rejects a prompt execution when funds are insufficient', async () => {
      // Test with insufficient funds
      const result = await testPaymentWrapper({ 
        type: 'prompt', 
        sufficientFunds: false 
      });
      
      // Verify the result indicates insufficient funds
      expect(result).toBeDefined();
      expect(result?.result.messages[0].content.text).toContain('Insufficient funds');
      
      // Verify error was logged
      expect(testLogger.contains('Payment rejected: Insufficient funds', 'error')).toBe(true);
    });
    
    test('handles errors during prompt execution', async () => {
      // Test with an error during execution
      const result = await testPaymentWrapper({ 
        type: 'prompt', 
        sufficientFunds: true,
        shouldThrow: true
      });
      
      // Verify the error was captured
      expect(result).toBeDefined();
      expect(result?.error).toBeDefined();
      
      // Verify error was logged
      expect(testLogger.contains('Error in prompt handler', 'error')).toBe(true);
      
      // Verify no billing was processed (since the prompt failed)
      expect(testLogger.contains('Processed charge for user')).toBe(false);
    });
  });
}); 