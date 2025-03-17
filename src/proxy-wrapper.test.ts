/**
 * @file Proxy Wrapper Tests
 * @version 1.0.0
 * 
 * Unit tests for the MCP Proxy Wrapper.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { wrapWithProxy } from './proxy-wrapper.js';
import { z } from 'zod';

// Mock McpServer
jest.mock('@modelcontextprotocol/sdk/server/mcp.js', () => {
  return {
    McpServer: jest.fn().mockImplementation(() => {
      const tools = new Map();
      
      return {
        tool: jest.fn((name, schema, handler) => {
          tools.set(name, { schema, handler });
          return { name, schema };
        }),
        _tools: tools,
        connect: jest.fn()
      };
    })
  };
});

describe('MCP Proxy Wrapper', () => {
  let server: McpServer;
  
  beforeEach(() => {
    jest.clearAllMocks();
    server = new McpServer({
      name: 'Test Server',
      version: '1.0.0'
    });
  });
  
  test('should wrap an MCP server without modifying its interface', () => {
    const proxiedServer = wrapWithProxy(server);
    
    expect(proxiedServer).toBe(server);
    expect(proxiedServer.tool).toBeDefined();
    expect(proxiedServer.connect).toBeDefined();
  });
  
  test('should register tools with the original server', () => {
    const proxiedServer = wrapWithProxy(server);
    
    proxiedServer.tool('test', { value: z.string() }, async () => ({
      content: [{ type: 'text', text: 'Test' }]
    }));
    
    expect(server.tool).toHaveBeenCalledTimes(1);
    expect(server.tool).toHaveBeenCalledWith('test', { value: z.string() }, expect.any(Function));
  });
  
  test('should execute beforeToolCall hook', async () => {
    const beforeToolCall = jest.fn();
    const proxiedServer = wrapWithProxy(server, {
      hooks: { beforeToolCall }
    });
    
    const handler = jest.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'Test' }]
    });
    
    proxiedServer.tool('test', { value: z.string() }, handler);
    
    // Get the wrapped handler
    const wrappedHandler = server._tools.get('test').handler;
    
    // Call the wrapped handler
    await wrappedHandler({ value: 'test' }, {});
    
    expect(beforeToolCall).toHaveBeenCalledTimes(1);
    expect(beforeToolCall).toHaveBeenCalledWith(expect.objectContaining({
      toolName: 'test',
      args: { value: 'test' },
      metadata: expect.any(Object)
    }));
  });
  
  test('should execute afterToolCall hook', async () => {
    const afterToolCall = jest.fn().mockImplementation((context, result) => result);
    const proxiedServer = wrapWithProxy(server, {
      hooks: { afterToolCall }
    });
    
    const handler = jest.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'Test' }]
    });
    
    proxiedServer.tool('test', { value: z.string() }, handler);
    
    // Get the wrapped handler
    const wrappedHandler = server._tools.get('test').handler;
    
    // Call the wrapped handler
    await wrappedHandler({ value: 'test' }, {});
    
    expect(afterToolCall).toHaveBeenCalledTimes(1);
    expect(afterToolCall).toHaveBeenCalledWith(
      expect.objectContaining({
        toolName: 'test',
        args: { value: 'test' },
        metadata: expect.any(Object)
      }),
      expect.objectContaining({
        result: {
          content: [{ type: 'text', text: 'Test' }]
        },
        metadata: expect.any(Object)
      })
    );
  });
  
  test('should allow beforeToolCall to short-circuit the tool call', async () => {
    const customResult = {
      content: [{ type: 'text', text: 'Custom Result' }]
    };
    
    const beforeToolCall = jest.fn().mockResolvedValue({
      result: customResult
    });
    
    const handler = jest.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'Original Result' }]
    });
    
    const proxiedServer = wrapWithProxy(server, {
      hooks: { beforeToolCall }
    });
    
    proxiedServer.tool('test', { value: z.string() }, handler);
    
    // Get the wrapped handler
    const wrappedHandler = server._tools.get('test').handler;
    
    // Call the wrapped handler
    const result = await wrappedHandler({ value: 'test' }, {});
    
    expect(beforeToolCall).toHaveBeenCalledTimes(1);
    expect(handler).not.toHaveBeenCalled();
    expect(result).toBe(customResult);
  });
  
  test('should allow afterToolCall to modify the result', async () => {
    const originalResult = {
      content: [{ type: 'text', text: 'Original Result' }]
    };
    
    const modifiedResult = {
      content: [{ type: 'text', text: 'Modified Result' }]
    };
    
    const afterToolCall = jest.fn().mockResolvedValue({
      result: modifiedResult
    });
    
    const handler = jest.fn().mockResolvedValue(originalResult);
    
    const proxiedServer = wrapWithProxy(server, {
      hooks: { afterToolCall }
    });
    
    proxiedServer.tool('test', { value: z.string() }, handler);
    
    // Get the wrapped handler
    const wrappedHandler = server._tools.get('test').handler;
    
    // Call the wrapped handler
    const result = await wrappedHandler({ value: 'test' }, {});
    
    expect(afterToolCall).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(result).toBe(modifiedResult);
  });
  
  test('should handle errors in the tool handler', async () => {
    const error = new Error('Test error');
    const handler = jest.fn().mockRejectedValue(error);
    
    const proxiedServer = wrapWithProxy(server);
    
    proxiedServer.tool('test', { value: z.string() }, handler);
    
    // Get the wrapped handler
    const wrappedHandler = server._tools.get('test').handler;
    
    // Call the wrapped handler
    const result = await wrappedHandler({ value: 'test' }, {});
    
    expect(handler).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      isError: true,
      content: [{ type: 'text', text: 'Error: Test error' }]
    });
  });
  
  test('should handle errors in beforeToolCall hook', async () => {
    const error = new Error('Hook error');
    const beforeToolCall = jest.fn().mockRejectedValue(error);
    
    const handler = jest.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'Original Result' }]
    });
    
    const proxiedServer = wrapWithProxy(server, {
      hooks: { beforeToolCall }
    });
    
    proxiedServer.tool('test', { value: z.string() }, handler);
    
    // Get the wrapped handler
    const wrappedHandler = server._tools.get('test').handler;
    
    // Call the wrapped handler
    const result = await wrappedHandler({ value: 'test' }, {});
    
    expect(beforeToolCall).toHaveBeenCalledTimes(1);
    expect(handler).not.toHaveBeenCalled();
    expect(result).toEqual({
      isError: true,
      content: [{ type: 'text', text: 'Error: Hook error: Hook error' }]
    });
  });
  
  test('should handle errors in afterToolCall hook', async () => {
    const error = new Error('Hook error');
    const afterToolCall = jest.fn().mockRejectedValue(error);
    
    const handler = jest.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'Original Result' }]
    });
    
    const proxiedServer = wrapWithProxy(server, {
      hooks: { afterToolCall }
    });
    
    proxiedServer.tool('test', { value: z.string() }, handler);
    
    // Get the wrapped handler
    const wrappedHandler = server._tools.get('test').handler;
    
    // Call the wrapped handler
    const result = await wrappedHandler({ value: 'test' }, {});
    
    expect(afterToolCall).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      isError: true,
      content: [{ type: 'text', text: 'Error: Hook error: Hook error' }]
    });
  });
}); 