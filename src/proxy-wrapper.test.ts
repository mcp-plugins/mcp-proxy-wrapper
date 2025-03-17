/**
 * @file MCP Proxy Wrapper Tests
 * @version 1.0.0
 * @description Tests for the MCP Proxy Wrapper functionality
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { wrapWithProxy } from './proxy-wrapper';
import { createToolResult } from './utils/test-helpers';

// Mock the McpServer class
jest.mock('@modelcontextprotocol/sdk/server/mcp.js', () => {
  return {
    McpServer: jest.fn().mockImplementation(() => {
      const registeredTools: Record<string, any> = {};
      
      return {
        tool: jest.fn().mockImplementation((name: string, handler: any) => {
          registeredTools[name] = handler;
          return { name };
        }),
        getRegisteredTools: () => registeredTools,
        callTool: async (name: string, args: any) => {
          if (registeredTools[name]) {
            try {
              return await registeredTools[name](args);
            } catch (error) {
              // Format error as expected by the proxy wrapper
              return {
                content: [
                  {
                    type: "text",
                    text: String(error)
                  }
                ],
                isError: true
              };
            }
          }
          throw new Error(`Tool ${name} not found`);
        }
      };
    })
  };
});

describe('MCP Proxy Wrapper', () => {
  let server: any;
  
  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
    
    // Create a new server instance for each test
    server = new McpServer({
      name: 'Test Server',
      version: '1.0.0'
    });
  });
  
  it('should register tools with the original server', async () => {
    // Create a proxy wrapper around the server
    const proxy = wrapWithProxy(server);
    
    // Register a tool with the proxy
    const toolHandler = jest.fn().mockResolvedValue({ result: 'Hello, World!' });
    proxy.tool('test', toolHandler);
    
    // Call the tool and verify the result
    const result = await server.callTool('test', { name: 'World' });
    expect(result).toEqual({ result: 'Hello, World!' });
    
    // Verify the tool handler was called
    expect(toolHandler).toHaveBeenCalled();
  });
  
  it('should execute beforeToolCall hook', async () => {
    // Create a hook that will be called before the tool
    const beforeToolCall = jest.fn().mockImplementation((context) => {
      // Modify the args
      context.args.modified = true;
      return undefined;
    });
    
    // Create a proxy wrapper with the beforeToolCall hook
    const proxy = wrapWithProxy(server, {
      hooks: {
        beforeToolCall
      }
    });
    
    // Register a tool with the proxy
    const toolHandler = jest.fn().mockImplementation((args) => {
      return createToolResult({ 
        greeting: `Hello, ${args.name}!`, 
        modified: args.modified 
      });
    });
    
    proxy.tool('greet', toolHandler);
    
    // Call the tool
    const result = await server.callTool('greet', { name: 'World' });
    
    // Verify that the beforeToolCall hook was called
    expect(beforeToolCall).toHaveBeenCalled();
    
    // Verify the result
    expect(result).toEqual({
      greeting: 'Hello, World!',
      modified: true
    });
  });
  
  it('should execute afterToolCall hook', async () => {
    // Create a hook that will be called after the tool
    const afterToolCall = jest.fn().mockImplementation((context, result) => {
      // Modify the result
      return { 
        result: { ...result.result, modified: true },
        metadata: result.metadata
      };
    });
    
    // Create a proxy wrapper with the afterToolCall hook
    const proxy = wrapWithProxy(server, {
      hooks: {
        afterToolCall
      }
    });
    
    // Register a tool with the proxy
    const toolHandler = jest.fn().mockImplementation((args) => {
      return createToolResult({ greeting: `Hello, ${args.name}!` });
    });
    
    proxy.tool('greet', toolHandler);
    
    // Call the tool
    const result = await server.callTool('greet', { name: 'World' });
    
    // Verify that the afterToolCall hook was called
    expect(afterToolCall).toHaveBeenCalled();
    
    // Verify the result was modified by the hook
    expect(result).toEqual({
      greeting: 'Hello, World!',
      modified: true
    });
  });
  
  it('should short-circuit tool call if beforeToolCall returns a result', async () => {
    // Create a hook that will return a result directly
    const beforeToolCall = jest.fn().mockImplementation(() => {
      return { result: { short: 'circuit' } };
    });
    
    // Create a proxy wrapper with the beforeToolCall hook
    const proxy = wrapWithProxy(server, {
      hooks: {
        beforeToolCall
      }
    });
    
    // Register a tool with the proxy
    const toolHandler = jest.fn();
    
    proxy.tool('greet', toolHandler);
    
    // Call the tool
    const result = await server.callTool('greet', { name: 'World' });
    
    // Verify that the beforeToolCall hook was called
    expect(beforeToolCall).toHaveBeenCalled();
    
    // Verify that the tool handler was not called
    expect(toolHandler).not.toHaveBeenCalled();
    
    // Verify the result came from the hook
    expect(result).toEqual({ short: 'circuit' });
  });
  
  it('should handle errors in tool handlers', async () => {
    // Create a proxy wrapper
    const proxy = wrapWithProxy(server);
    
    // Register a tool that throws an error
    const error = new Error('Test error');
    const toolHandler = jest.fn().mockRejectedValue(error);
    
    proxy.tool('error', toolHandler);
    
    // Call the tool and expect it to return an error result
    const result = await server.callTool('error', {});
    
    // Verify that the result indicates an error
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Test error');
    
    // Verify that the tool handler was called
    expect(toolHandler).toHaveBeenCalled();
  });
  
  it('should handle errors in beforeToolCall hook', async () => {
    // Create a hook that throws an error
    const error = new Error('Hook error');
    const beforeToolCall = jest.fn().mockRejectedValue(error);
    
    // Create a proxy wrapper with the beforeToolCall hook
    const proxy = wrapWithProxy(server, {
      hooks: {
        beforeToolCall
      }
    });
    
    // Register a tool with the proxy
    const toolHandler = jest.fn();
    
    proxy.tool('greet', toolHandler);
    
    // Call the tool and expect it to return an error result
    const result = await server.callTool('greet', { name: 'World' });
    
    // Verify that the result indicates an error
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Hook error');
    
    // Verify that the beforeToolCall hook was called
    expect(beforeToolCall).toHaveBeenCalled();
    
    // Verify that the tool handler was not called
    expect(toolHandler).not.toHaveBeenCalled();
  });
  
  it('should handle errors in afterToolCall hook', async () => {
    // Create a hook that throws an error
    const error = new Error('Hook error');
    const afterToolCall = jest.fn().mockRejectedValue(error);
    
    // Create a proxy wrapper with the afterToolCall hook
    const proxy = wrapWithProxy(server, {
      hooks: {
        afterToolCall
      }
    });
    
    // Register a tool with the proxy
    const toolHandler = jest.fn().mockImplementation((args) => {
      return createToolResult({ greeting: `Hello, ${args.name}!` });
    });
    
    proxy.tool('greet', toolHandler);
    
    // Call the tool and expect it to return an error result
    const result = await server.callTool('greet', { name: 'World' });
    
    // Verify that the result indicates an error
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Hook error');
    
    // Verify that the tool handler was called
    expect(toolHandler).toHaveBeenCalled();
    
    // Verify that the afterToolCall hook was called
    expect(afterToolCall).toHaveBeenCalled();
  });
}); 