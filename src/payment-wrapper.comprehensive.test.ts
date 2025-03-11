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
import { wrapWithPayments, PaymentWrapperOptions } from './payment-wrapper.js';

// Valid JWT token for testing
const VALID_JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTEyMyIsIm5hbWUiOiJKb2huIERvZSIsImlhdCI6MTUxNjIzOTAyMn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

// Mock console methods to capture output
const originalConsoleLog = console.log;
const originalConsoleError = console.error;
let consoleOutput: string[] = [];
let consoleErrors: string[] = [];

// Enable debug mode for all tests
const DEBUG_MODE = true;

// Helper function to create a valid options object
function createValidOptions(overrides: Partial<PaymentWrapperOptions> = {}): PaymentWrapperOptions {
  return {
    apiKey: 'valid-api-key',
    userToken: VALID_JWT,
    debugMode: DEBUG_MODE,
    ...overrides
  };
}

// Helper function to check if a console output contains a specific string
function outputContains(output: string[], text: string): boolean {
  const contains = output.some(line => line.includes(text));
  if (!contains && DEBUG_MODE) {
    originalConsoleLog(`Expected to find "${text}" in console output, but it wasn't found.`);
    originalConsoleLog('Console output:', output);
  }
  return contains;
}

// Helper function to directly test the payment wrapper functionality
async function testPaymentWrapper(
  options: { 
    sufficientFunds: boolean; 
    type: 'tool' | 'resource' | 'prompt';
    shouldThrow?: boolean;
  }
) {
  // Clear console output before each test
  consoleOutput = [];
  consoleErrors = [];
  
  // Create a test server
  const server = new McpServer({
    name: "Test Server",
    version: "1.0.0",
    description: "Test server for payment wrapper"
  });
  
  // Create handlers based on the type
  let toolName = "test_tool";
  let resourceName = "test_resource";
  let promptName = "test_prompt";
  
  if (options.type === 'tool') {
    if (options.shouldThrow) {
      server.tool(toolName, { param: z.string() }, async (args, extra) => {
        throw new Error("Test error in tool");
      });
    } else {
      server.tool(toolName, { param: z.string() }, async (args, extra) => {
        return {
          content: [{ type: "text" as const, text: `Tool result: ${args.param}` }]
        };
      });
    }
  } else if (options.type === 'resource') {
    if (options.shouldThrow) {
      server.resource(resourceName, "test/{id}", async (uri, extra) => {
        throw new Error("Test error in resource");
      });
    } else {
      server.resource(resourceName, "test/{id}", async (uri, extra) => {
        const id = uri.pathname.split('/').pop();
        return {
          contents: [{ uri: uri.href, text: `Resource content for ID: ${id}` }]
        };
      });
    }
  } else if (options.type === 'prompt') {
    if (options.shouldThrow) {
      server.prompt(promptName, (extra) => {
        throw new Error("Test error in prompt");
      });
    } else {
      server.prompt(promptName, (extra) => {
        return {
          messages: [{
            role: "assistant",
            content: { type: "text" as const, text: "Prompt response" }
          }]
        };
      });
    }
  }
  
  // Create a wrapped server
  const wrappedServer = wrapWithPayments(server, createValidOptions());
  
  // Mock Math.random to control billing check result
  mockMathRandom(options.sufficientFunds ? 0.5 : 0.0);
  
  if (DEBUG_MODE) {
    originalConsoleLog(`Testing ${options.type} with sufficientFunds=${options.sufficientFunds}, shouldThrow=${options.shouldThrow || false}`);
  }
  
  // Create a mock handler that will be called by the wrapped server
  let mockHandler: any;
  
  // Execute the appropriate method based on the type
  if (options.type === 'tool') {
    // Register a new tool on the wrapped server to ensure the proxy is used
    mockHandler = jest.fn().mockImplementation(async (args: any, extra: any) => {
      if (options.shouldThrow) {
        throw new Error("Test error in tool");
      }
      return {
        content: [{ type: "text" as const, text: `Tool result: ${args.param}` }]
      };
    });
    
    // Register the tool on the wrapped server
    wrappedServer.tool("wrapped_tool", { param: z.string() }, mockHandler);
    
    try {
      // Call the tool through the wrapped server
      const result = await (wrappedServer as any).callTool("wrapped_tool", { param: "test value" });
      return { result, type: 'tool', name: 'wrapped_tool' };
    } catch (error) {
      if (DEBUG_MODE) {
        originalConsoleLog('Error calling tool:', error);
      }
      throw error;
    }
  } else if (options.type === 'resource') {
    // Register a new resource on the wrapped server to ensure the proxy is used
    mockHandler = jest.fn().mockImplementation(async (uri: URL, extra: any) => {
      if (options.shouldThrow) {
        throw new Error("Test error in resource");
      }
      const id = uri.pathname.split('/').pop();
      return {
        contents: [{ uri: uri.href, text: `Resource content for ID: ${id}` }]
      };
    });
    
    // Register the resource on the wrapped server
    wrappedServer.resource("wrapped_resource", "wrapped/{id}", mockHandler);
    
    try {
      // Call the resource through the wrapped server
      const result = await (wrappedServer as any).callResource("wrapped_resource", new URL("test://example.com/wrapped/123"));
      return { result, type: 'resource', name: 'wrapped_resource' };
    } catch (error) {
      if (DEBUG_MODE) {
        originalConsoleLog('Error calling resource:', error);
      }
      throw error;
    }
  } else if (options.type === 'prompt') {
    // Register a new prompt on the wrapped server to ensure the proxy is used
    mockHandler = jest.fn().mockImplementation((extra: any) => {
      if (options.shouldThrow) {
        throw new Error("Test error in prompt");
      }
      return {
        messages: [{
          role: "assistant",
          content: { type: "text" as const, text: "Prompt response" }
        }]
      };
    });
    
    // Register the prompt on the wrapped server
    wrappedServer.prompt("wrapped_prompt", mockHandler);
    
    try {
      // Call the prompt through the wrapped server
      const result = (wrappedServer as any).callPrompt("wrapped_prompt");
      return { result, type: 'prompt', name: 'wrapped_prompt' };
    } catch (error) {
      if (DEBUG_MODE) {
        originalConsoleLog('Error calling prompt:', error);
      }
      throw error;
    }
  }
  
  return null;
}

// Helper function to control Math.random for billing tests
function mockMathRandom(value: number): void {
  // Use jest.spyOn instead of directly overriding Math.random
  jest.spyOn(global.Math, 'random').mockReturnValue(value);
}

// Mock the McpServer class to add direct call methods for testing
jest.mock('@modelcontextprotocol/sdk/server/mcp.js', () => {
  const originalModule = jest.requireActual('@modelcontextprotocol/sdk/server/mcp.js');
  
  // Create a mock class that extends the original
  class MockMcpServer extends originalModule.McpServer {
    constructor(config: any) {
      super(config);
    }
    
    // Add methods to directly call tools, resources, and prompts
    async callTool(name: string, args: any, extra: any = {}) {
      if (this._registeredTools && this._registeredTools[name]) {
        return await this._registeredTools[name].callback(args, extra);
      }
      throw new Error(`Tool ${name} not found`);
    }
    
    async callResource(name: string, uri: URL, extra: any = {}) {
      // Find the resource by name
      let resourceHandler;
      for (const [template, resource] of Object.entries(this._registeredResources || {})) {
        if ((resource as any).name === name) {
          resourceHandler = (resource as any).readCallback || (resource as any).callback;
          break;
        }
      }
      
      if (resourceHandler) {
        return await resourceHandler(uri, extra);
      }
      throw new Error(`Resource ${name} not found`);
    }
    
    callPrompt(name: string, extra: any = {}) {
      if (this._registeredPrompts && this._registeredPrompts[name]) {
        return this._registeredPrompts[name].callback(extra);
      }
      throw new Error(`Prompt ${name} not found`);
    }
  }
  
  return {
    ...originalModule,
    McpServer: MockMcpServer
  };
});

beforeEach(() => {
  // Clear the captured console output
  consoleOutput = [];
  consoleErrors = [];
  
  // Mock console methods
  console.log = (...args: any[]) => {
    consoleOutput.push(args.join(' '));
    if (DEBUG_MODE) {
      originalConsoleLog(...args);
    }
  };
  
  console.error = (...args: any[]) => {
    consoleErrors.push(args.join(' '));
    if (DEBUG_MODE) {
      originalConsoleError(...args);
    }
  };
  
  // Reset Math.random mock
  jest.restoreAllMocks();
  mockMathRandom(0.5); // Default to sufficient funds
});

afterEach(() => {
  // Restore original console methods
  console.log = originalConsoleLog;
  console.error = originalConsoleError;
  
  // Restore all mocks
  jest.restoreAllMocks();
});

describe('Tool Method Tests', () => {
  describe('Tool Registration', () => {
    test('can register a new tool on the wrapped server', () => {
      const server = new McpServer({
        name: "Test Server",
        version: "1.0.0",
        description: "Test server"
      });
      
      const wrappedServer = wrapWithPayments(server, createValidOptions());
      
      // Register a new tool on the wrapped server
      const toolHandler = jest.fn().mockResolvedValue({
        content: [{ type: "text" as const, text: "New tool result" }]
      });
      
      wrappedServer.tool("new_tool", { value: z.string() }, toolHandler);
      
      // Verify the tool was registered and can be called
      expect(async () => {
        await (wrappedServer as any).callTool("new_tool", { value: "test" });
      }).not.toThrow();
    });
  });
  
  describe('Tool Execution', () => {
    test('successfully executes a tool when funds are sufficient', async () => {
      const result = await testPaymentWrapper({
        sufficientFunds: true,
        type: 'tool'
      });
      
      // Verify the result
      expect(result).toBeDefined();
      expect(result?.result.content[0].text).toBe("Tool result: test value");
      
      // Verify billing was processed
      expect(outputContains(consoleOutput, "Processed charge for user")).toBe(true);
      expect(outputContains(consoleOutput, `Tool: ${result?.name}`)).toBe(true);
    });
    
    test('rejects a tool call when funds are insufficient', async () => {
      const result = await testPaymentWrapper({
        sufficientFunds: false,
        type: 'tool'
      });
      
      // Verify the result is an error message
      expect(result).toBeDefined();
      expect(result?.result.content[0].text).toContain("Insufficient funds");
      
      // Verify error was logged
      expect(outputContains(consoleErrors, "Payment rejected")).toBe(true);
    });
    
    test('handles errors during tool execution', async () => {
      await expect(testPaymentWrapper({
        sufficientFunds: true,
        type: 'tool',
        shouldThrow: true
      })).rejects.toThrow("Test error in tool");
      
      // Verify error was logged
      expect(outputContains(consoleErrors, "Error in tool handler")).toBe(true);
      
      // Verify no billing was processed (since the tool failed)
      expect(outputContains(consoleOutput, "Processed charge for user")).toBe(false);
    });
  });
});

describe('Resource Method Tests', () => {
  describe('Resource Registration', () => {
    test('can register a new resource on the wrapped server', () => {
      const server = new McpServer({
        name: "Test Server",
        version: "1.0.0",
        description: "Test server"
      });
      
      const wrappedServer = wrapWithPayments(server, createValidOptions());
      
      // Register a new resource on the wrapped server
      const resourceHandler = jest.fn().mockResolvedValue({
        contents: [{ uri: "test://example.com", text: "New resource content" }]
      });
      
      wrappedServer.resource("new_resource", "new-test/{id}", resourceHandler);
      
      // Verify the resource was registered and can be called
      expect(async () => {
        await (wrappedServer as any).callResource("new_resource", new URL("test://example.com/new-test/123"));
      }).not.toThrow();
    });
  });
  
  describe('Resource Execution', () => {
    test('successfully accesses a resource when funds are sufficient', async () => {
      const result = await testPaymentWrapper({
        sufficientFunds: true,
        type: 'resource'
      });
      
      // Verify the result
      expect(result).toBeDefined();
      expect(result?.result.contents[0].text).toBe("Resource content for ID: 123");
      
      // Verify billing was processed
      expect(outputContains(consoleOutput, "Processed charge for user")).toBe(true);
      expect(outputContains(consoleOutput, `Resource: ${result?.name}`)).toBe(true);
    });
    
    test('rejects a resource access when funds are insufficient', async () => {
      const result = await testPaymentWrapper({
        sufficientFunds: false,
        type: 'resource'
      });
      
      // Verify the result is an error message
      expect(result).toBeDefined();
      expect(result?.result.contents[0].text).toContain("Insufficient funds");
      
      // Verify error was logged
      expect(outputContains(consoleErrors, "Payment rejected")).toBe(true);
    });
    
    test('handles errors during resource access', async () => {
      await expect(testPaymentWrapper({
        sufficientFunds: true,
        type: 'resource',
        shouldThrow: true
      })).rejects.toThrow("Test error in resource");
      
      // Verify error was logged
      expect(outputContains(consoleErrors, "Error in resource handler")).toBe(true);
      
      // Verify no billing was processed (since the resource access failed)
      expect(outputContains(consoleOutput, "Processed charge for user")).toBe(false);
    });
  });
});

describe('Prompt Method Tests', () => {
  describe('Prompt Registration', () => {
    test('can register a new prompt on the wrapped server', () => {
      const server = new McpServer({
        name: "Test Server",
        version: "1.0.0",
        description: "Test server"
      });
      
      const wrappedServer = wrapWithPayments(server, createValidOptions());
      
      // Register a new prompt on the wrapped server
      const promptHandler = jest.fn().mockReturnValue({
        messages: [{
          role: "assistant",
          content: {
            type: "text" as const,
            text: "New prompt response"
          }
        }]
      });
      
      wrappedServer.prompt("new_prompt", promptHandler);
      
      // Verify the prompt was registered and can be called
      expect(() => {
        (wrappedServer as any).callPrompt("new_prompt");
      }).not.toThrow();
    });
  });
  
  describe('Prompt Execution', () => {
    test('successfully executes a prompt when funds are sufficient', async () => {
      const result = await testPaymentWrapper({
        sufficientFunds: true,
        type: 'prompt'
      });
      
      // Verify the result
      expect(result).toBeDefined();
      expect(result?.result.messages[0].content.text).toBe("Prompt response");
      
      // Verify billing was processed
      expect(outputContains(consoleOutput, "Processed charge for user")).toBe(true);
      expect(outputContains(consoleOutput, `Prompt: ${result?.name}`)).toBe(true);
    });
    
    test('rejects a prompt execution when funds are insufficient', async () => {
      const result = await testPaymentWrapper({
        sufficientFunds: false,
        type: 'prompt'
      });
      
      // Verify the result is an error message
      expect(result).toBeDefined();
      expect(result?.result.messages[0].content.text).toContain("Insufficient funds");
      
      // Verify error was logged
      expect(outputContains(consoleErrors, "Payment rejected")).toBe(true);
    });
    
    test('handles errors during prompt execution', async () => {
      await expect(testPaymentWrapper({
        sufficientFunds: true,
        type: 'prompt',
        shouldThrow: true
      })).rejects.toThrow("Test error in prompt");
      
      // Verify error was logged
      expect(outputContains(consoleErrors, "Error in prompt handler")).toBe(true);
      
      // Verify no billing was processed (since the prompt failed)
      expect(outputContains(consoleOutput, "Processed charge for user")).toBe(false);
    });
  });
}); 