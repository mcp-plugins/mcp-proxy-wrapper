/**
 * @file Proxy Wrapper Edge Cases Tests
 * @version 1.0.0
 * 
 * Edge case tests for the MCP Proxy Wrapper.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { wrapWithProxy } from './proxy-wrapper.js';
import { z } from 'zod';
import { describe, test, expect, beforeEach } from '@jest/globals';

describe('MCP Proxy Wrapper Edge Cases', () => {
  let server: McpServer;
  
  beforeEach(() => {
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
    
    const result = await server.callTool('test', { value: 'test' });
    
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
    
    const result = await server.callTool('test', { value: 'test' });
    
    expect(result).toEqual({
      content: [{ type: 'text', text: 'Test' }]
    });
  });
  
  test('should handle null arguments', async () => {
    let beforeToolCallCalled = false;
    let nullValuePassed = false;
    
    const proxiedServer = wrapWithProxy(server, {
      hooks: { 
        beforeToolCall: async (context) => {
          beforeToolCallCalled = true;
          nullValuePassed = context.args.value === null;
        }
      }
    });
    
    proxiedServer.tool('test', { value: z.string().nullable() }, async (args) => ({
      content: [{ type: 'text', text: `Value: ${args.value === null ? 'null' : args.value}` }]
    }));
    
    const result = await server.callTool('test', { value: null });
    
    expect(beforeToolCallCalled).toBe(true);
    expect(nullValuePassed).toBe(true);
    
    expect(result).toEqual({
      content: [{ type: 'text', text: 'Value: null' }]
    });
  });
  
  test('should handle undefined arguments', async () => {
    let beforeToolCallCalled = false;
    let emptyArgsPassed = false;
    
    const proxiedServer = wrapWithProxy(server, {
      hooks: { 
        beforeToolCall: async (context) => {
          beforeToolCallCalled = true;
          emptyArgsPassed = Object.keys(context.args).length === 0;
        }
      }
    });
    
    proxiedServer.tool('test', { value: z.string().optional() }, async (args) => ({
      content: [{ type: 'text', text: `Value: ${args.value === undefined ? 'undefined' : args.value}` }]
    }));
    
    const result = await server.callTool('test', { });
    
    expect(beforeToolCallCalled).toBe(true);
    expect(emptyArgsPassed).toBe(true);
    
    expect(result).toEqual({
      content: [{ type: 'text', text: 'Value: undefined' }]
    });
  });
  
  test('should handle complex nested arguments', async () => {
    let beforeToolCallCalled = false;
    let complexArgsReceived = false;
    
    const proxiedServer = wrapWithProxy(server, {
      hooks: { 
        beforeToolCall: async (context) => {
          beforeToolCallCalled = true;
          complexArgsReceived = 
            context.args.user?.name === 'John' && 
            context.args.items?.length === 2;
        }
      }
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
    
    const result = await server.callTool('complex', complexArgs);
    
    expect(beforeToolCallCalled).toBe(true);
    expect(complexArgsReceived).toBe(true);
    
    expect(result).toEqual({
      content: [{ type: 'text', text: 'User: John, Items: 2' }]
    });
  });
  
  test('should handle async hooks that return promises', async () => {
    let beforeHookCalled = false;
    let afterHookCalled = false;
    
    const beforeToolCall = async (context) => {
      // Simulate async operation
      await new Promise(resolve => setTimeout(resolve, 10));
      beforeHookCalled = true;
      
      // Modify args
      context.args.value = `${context.args.value} (async modified)`;
    };
    
    const afterToolCall = async (context, result) => {
      // Simulate async operation
      await new Promise(resolve => setTimeout(resolve, 10));
      afterHookCalled = true;
      
      // Modify result
      result.result.content[0].text += ' (async modified)';
      
      return result;
    };
    
    const proxiedServer = wrapWithProxy(server, {
      hooks: { beforeToolCall, afterToolCall }
    });
    
    proxiedServer.tool('test', { value: z.string() }, async (args) => ({
      content: [{ type: 'text', text: `Value: ${args.value}` }]
    }));
    
    const result = await server.callTool('test', { value: 'test' });
    
    expect(beforeHookCalled).toBe(true);
    expect(afterHookCalled).toBe(true);
    
    expect(result).toEqual({
      content: [{ type: 'text', text: 'Value: test (async modified) (async modified)' }]
    });
  });
  
  test('should handle non-object results', async () => {
    let afterHookCalled = false;
    let nonStandardResultReceived = false;
    
    const afterToolCall = async (context, result) => {
      afterHookCalled = true;
      nonStandardResultReceived = typeof result.result === 'string';
      return result;
    };
    
    const proxiedServer = wrapWithProxy(server, {
      hooks: { afterToolCall }
    });
    
    // A tool that returns a non-standard result
    proxiedServer.tool('nonstandard', { }, async () => {
      return 'This is not a standard result object';
    });
    
    const result = await server.callTool('nonstandard', {});
    
    expect(afterHookCalled).toBe(true);
    expect(nonStandardResultReceived).toBe(true);
    expect(result).toBe('This is not a standard result object');
  });
  
  test('should handle circular references in arguments', async () => {
    let beforeHookCalled = false;
    
    const proxiedServer = wrapWithProxy(server, {
      hooks: { 
        beforeToolCall: async () => {
          beforeHookCalled = true;
        }
      }
    });
    
    proxiedServer.tool('circular', { obj: z.any() }, async (args) => ({
      content: [{ type: 'text', text: 'Processed circular reference' }]
    }));
    
    // Create an object with a circular reference
    const circularObj: any = { name: 'circular' };
    circularObj.self = circularObj;
    
    const result = await server.callTool('circular', { obj: circularObj });
    
    expect(beforeHookCalled).toBe(true);
    expect(result).toEqual({
      content: [{ type: 'text', text: 'Processed circular reference' }]
    });
  });
  
  test('should handle large objects', async () => {
    let beforeHookCalled = false;
    
    const proxiedServer = wrapWithProxy(server, {
      hooks: { 
        beforeToolCall: async () => {
          beforeHookCalled = true;
        }
      }
    });
    
    proxiedServer.tool('large', { data: z.any() }, async (args) => ({
      content: [{ type: 'text', text: `Processed ${args.data.items.length} items` }]
    }));
    
    // Create a large object
    const largeObj = {
      items: Array(1000).fill(0).map((_, i) => ({
        id: i,
        name: `Item ${i}`,
        description: `This is item ${i} with a long description to make the object larger.`
      }))
    };
    
    const result = await server.callTool('large', { data: largeObj });
    
    expect(beforeHookCalled).toBe(true);
    expect(result).toEqual({
      content: [{ type: 'text', text: 'Processed 1000 items' }]
    });
  });
}); 