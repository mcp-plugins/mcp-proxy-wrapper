/**
 * @file Proxy Wrapper Edge Cases Tests
 * @version 1.0.0
 * 
 * Edge case tests for the MCP Proxy Wrapper.
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

describe('MCP Proxy Wrapper Edge Cases', () => {
  let server: McpServer;
  
  beforeEach(() => {
    jest.clearAllMocks();
    server = new McpServer({
      name: 'Test Server',
      version: '1.0.0'
    });
  });
  
  test('should handle undefined hooks', async () => {
    const proxiedServer = wrapWithProxy(server, {
      hooks: undefined
    });
    
    proxiedServer.tool('test', { value: z.string() }, async (args) => ({
      content: [{ type: 'text', text: 'Test' }]
    }));
    
    const wrappedHandler = server._tools.get('test').handler;
    const result = await wrappedHandler({ value: 'test' }, {});
    
    expect(result).toEqual({
      content: [{ type: 'text', text: 'Test' }]
    });
  });
  
  test('should handle empty hooks object', async () => {
    const proxiedServer = wrapWithProxy(server, {
      hooks: {}
    });
    
    proxiedServer.tool('test', { value: z.string() }, async (args) => ({
      content: [{ type: 'text', text: 'Test' }]
    }));
    
    const wrappedHandler = server._tools.get('test').handler;
    const result = await wrappedHandler({ value: 'test' }, {});
    
    expect(result).toEqual({
      content: [{ type: 'text', text: 'Test' }]
    });
  });
  
  test('should handle null arguments', async () => {
    const beforeToolCall = jest.fn();
    const proxiedServer = wrapWithProxy(server, {
      hooks: { beforeToolCall }
    });
    
    proxiedServer.tool('test', { value: z.string().nullable() }, async (args) => ({
      content: [{ type: 'text', text: `Value: ${args.value === null ? 'null' : args.value}` }]
    }));
    
    const wrappedHandler = server._tools.get('test').handler;
    const result = await wrappedHandler({ value: null }, {});
    
    expect(beforeToolCall).toHaveBeenCalledWith(expect.objectContaining({
      toolName: 'test',
      args: { value: null }
    }));
    
    expect(result).toEqual({
      content: [{ type: 'text', text: 'Value: null' }]
    });
  });
  
  test('should handle undefined arguments', async () => {
    const beforeToolCall = jest.fn();
    const proxiedServer = wrapWithProxy(server, {
      hooks: { beforeToolCall }
    });
    
    proxiedServer.tool('test', { value: z.string().optional() }, async (args) => ({
      content: [{ type: 'text', text: `Value: ${args.value === undefined ? 'undefined' : args.value}` }]
    }));
    
    const wrappedHandler = server._tools.get('test').handler;
    const result = await wrappedHandler({ }, {});
    
    expect(beforeToolCall).toHaveBeenCalledWith(expect.objectContaining({
      toolName: 'test',
      args: { }
    }));
    
    expect(result).toEqual({
      content: [{ type: 'text', text: 'Value: undefined' }]
    });
  });
  
  test('should handle complex nested arguments', async () => {
    const beforeToolCall = jest.fn();
    const proxiedServer = wrapWithProxy(server, {
      hooks: { beforeToolCall }
    });
    
    const complexSchema = {
      user: z.object({
        name: z.string(),
        age: z.number(),
        address: z.object({
          street: z.string(),
          city: z.string(),
          country: z.string()
        })
      }),
      items: z.array(z.object({
        id: z.number(),
        name: z.string(),
        price: z.number()
      }))
    };
    
    proxiedServer.tool('complex', complexSchema, async (args) => ({
      content: [{ type: 'text', text: `User: ${args.user.name}, Items: ${args.items.length}` }]
    }));
    
    const wrappedHandler = server._tools.get('complex').handler;
    
    const complexArgs = {
      user: {
        name: 'John',
        age: 30,
        address: {
          street: '123 Main St',
          city: 'New York',
          country: 'USA'
        }
      },
      items: [
        { id: 1, name: 'Item 1', price: 10 },
        { id: 2, name: 'Item 2', price: 20 }
      ]
    };
    
    const result = await wrappedHandler(complexArgs, {});
    
    expect(beforeToolCall).toHaveBeenCalledWith(expect.objectContaining({
      toolName: 'complex',
      args: complexArgs
    }));
    
    expect(result).toEqual({
      content: [{ type: 'text', text: 'User: John, Items: 2' }]
    });
  });
  
  test('should handle async hooks that return promises', async () => {
    const beforeToolCall = jest.fn().mockImplementation(async (context) => {
      // Simulate async operation
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Modify args
      context.args.value = `${context.args.value} (async modified)`;
    });
    
    const afterToolCall = jest.fn().mockImplementation(async (context, result) => {
      // Simulate async operation
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Modify result
      result.result.content[0].text += ' (async modified)';
      
      return result;
    });
    
    const proxiedServer = wrapWithProxy(server, {
      hooks: { beforeToolCall, afterToolCall }
    });
    
    proxiedServer.tool('test', { value: z.string() }, async (args) => ({
      content: [{ type: 'text', text: `Value: ${args.value}` }]
    }));
    
    const wrappedHandler = server._tools.get('test').handler;
    const result = await wrappedHandler({ value: 'test' }, {});
    
    expect(beforeToolCall).toHaveBeenCalled();
    expect(afterToolCall).toHaveBeenCalled();
    
    expect(result).toEqual({
      content: [{ type: 'text', text: 'Value: test (async modified) (async modified)' }]
    });
  });
  
  test('should handle non-object results', async () => {
    const afterToolCall = jest.fn().mockImplementation((context, result) => {
      return result;
    });
    
    const proxiedServer = wrapWithProxy(server, {
      hooks: { afterToolCall }
    });
    
    // A tool that returns a non-standard result
    proxiedServer.tool('nonstandard', { }, async () => {
      return 'This is not a standard result object';
    });
    
    const wrappedHandler = server._tools.get('nonstandard').handler;
    const result = await wrappedHandler({}, {});
    
    expect(afterToolCall).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        result: 'This is not a standard result object'
      })
    );
    
    expect(result).toBe('This is not a standard result object');
  });
  
  test('should handle circular references in arguments', async () => {
    const beforeToolCall = jest.fn();
    const proxiedServer = wrapWithProxy(server, {
      hooks: { beforeToolCall }
    });
    
    proxiedServer.tool('circular', { obj: z.any() }, async (args) => ({
      content: [{ type: 'text', text: 'Processed circular reference' }]
    }));
    
    const wrappedHandler = server._tools.get('circular').handler;
    
    // Create an object with circular reference
    const circularObj: any = { name: 'Circular' };
    circularObj.self = circularObj;
    
    // This should not throw
    const result = await wrappedHandler({ obj: circularObj }, {});
    
    expect(beforeToolCall).toHaveBeenCalled();
    expect(result).toEqual({
      content: [{ type: 'text', text: 'Processed circular reference' }]
    });
  });
  
  test('should handle very large payloads', async () => {
    const beforeToolCall = jest.fn();
    const proxiedServer = wrapWithProxy(server, {
      hooks: { beforeToolCall }
    });
    
    proxiedServer.tool('large', { data: z.string() }, async (args) => ({
      content: [{ type: 'text', text: `Processed ${args.data.length} bytes` }]
    }));
    
    const wrappedHandler = server._tools.get('large').handler;
    
    // Create a large string (1MB)
    const largeString = 'a'.repeat(1024 * 1024);
    
    // This should not throw or timeout
    const result = await wrappedHandler({ data: largeString }, {});
    
    expect(beforeToolCall).toHaveBeenCalled();
    expect(result).toEqual({
      content: [{ type: 'text', text: 'Processed 1048576 bytes' }]
    });
  });
}); 