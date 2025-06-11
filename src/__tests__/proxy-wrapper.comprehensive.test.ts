/**
 * @file Comprehensive MCP Proxy Wrapper Tests
 * 
 * Tests the proxy wrapper using real MCP Client-Server communication
 * to ensure it behaves correctly as part of the MCP protocol.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { McpClientServerTest, createTestEnvironment, createTestWithProxy } from '../test-utils/mcp-client-server-test.js';
import { ToolCallContext, ToolCallResult } from '../interfaces/proxy-hooks.js';

describe('MCP Proxy Wrapper - Comprehensive Tests', () => {
  let testEnv: McpClientServerTest;
  
  afterEach(async () => {
    if (testEnv) {
      await testEnv.disconnect();
    }
  });
  
  describe('Basic Proxy Functionality', () => {
    beforeEach(() => {
      testEnv = createTestEnvironment();
    });
    
    it('should allow normal tool registration and calls', async () => {
      // Register a simple tool
      testEnv.registerTool('greet', async (args) => {
        return {
          content: [{ type: 'text', text: `Hello, ${args.name}!` }]
        };
      });
      
      // Connect and call the tool
      await testEnv.connect();
      const result = await testEnv.callTool('greet', { name: 'World' });
      
      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toBe('Hello, World!');
    });
    
    it('should list registered tools correctly', async () => {
      // Register multiple tools
      testEnv.registerTool('tool1', async () => ({
        content: [{ type: 'text', text: 'Tool 1' }]
      }));
      
      testEnv.registerTool('tool2', async () => ({
        content: [{ type: 'text', text: 'Tool 2' }]
      }));
      
      await testEnv.connect();
      const tools = await testEnv.listTools();
      
      expect(tools.tools).toBeDefined();
      expect(tools.tools.length).toBe(2);
      
      const toolNames = tools.tools.map((tool: any) => tool.name);
      expect(toolNames).toContain('tool1');
      expect(toolNames).toContain('tool2');
    });
    
    it('should handle tool errors gracefully', async () => {
      // Register a tool that throws an error
      testEnv.registerTool('error-tool', async () => {
        throw new Error('Tool execution failed');
      });
      
      await testEnv.connect();
      
      // Tool call should not throw, but should return error in result
      const result = await testEnv.callTool('error-tool', {});
      
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Tool execution failed');
    });
  });
  
  describe('Before Hook Functionality', () => {
    it('should execute beforeToolCall hook', async () => {
      const hookCalls: string[] = [];
      
      testEnv = createTestWithProxy({
        hooks: {
          beforeToolCall: async (context: ToolCallContext) => {
            hookCalls.push(`before:${context.toolName}`);
          }
        }
      });
      
      testEnv.registerTool('test', async () => ({
        content: [{ type: 'text', text: 'Test result' }]
      }));
      
      await testEnv.connect();
      await testEnv.callTool('test', {});
      
      expect(hookCalls).toContain('before:test');
    });
    
    it('should allow argument modification in beforeToolCall', async () => {
      testEnv = createTestWithProxy({
        hooks: {
          beforeToolCall: async (context: ToolCallContext) => {
            // Modify the name argument
            if (context.args.name) {
              context.args.name = `Modified ${context.args.name}`;
            }
          }
        }
      });
      
      testEnv.registerTool('greet', async (args) => {
        return {
          content: [{ type: 'text', text: `Hello, ${args.name}!` }]
        };
      });
      
      await testEnv.connect();
      const result = await testEnv.callTool('greet', { name: 'World' });
      
      expect(result.content[0].text).toBe('Hello, Modified World!');
    });
    
    it('should support short-circuiting with beforeToolCall', async () => {
      testEnv = createTestWithProxy({
        hooks: {
          beforeToolCall: async (context: ToolCallContext) => {
            if (context.toolName === 'blocked') {
              return {
                result: {
                  content: [{ type: 'text', text: 'Tool call blocked by hook' }]
                }
              };
            }
          }
        }
      });
      
      testEnv.registerTool('blocked', async () => {
        // This should never be called
        return {
          content: [{ type: 'text', text: 'Original tool result' }]
        };
      });
      
      await testEnv.connect();
      const result = await testEnv.callTool('blocked', {});
      
      expect(result.content[0].text).toBe('Tool call blocked by hook');
    });
  });
  
  describe('After Hook Functionality', () => {
    it('should execute afterToolCall hook', async () => {
      const hookCalls: string[] = [];
      
      testEnv = createTestWithProxy({
        hooks: {
          afterToolCall: async (context: ToolCallContext, result: ToolCallResult) => {
            hookCalls.push(`after:${context.toolName}`);
            return result;
          }
        }
      });
      
      testEnv.registerTool('test', async () => ({
        content: [{ type: 'text', text: 'Test result' }]
      }));
      
      await testEnv.connect();
      await testEnv.callTool('test', {});
      
      expect(hookCalls).toContain('after:test');
    });
    
    it('should allow result modification in afterToolCall', async () => {
      testEnv = createTestWithProxy({
        hooks: {
          afterToolCall: async (context: ToolCallContext, result: ToolCallResult) => {
            // Modify the result
            if (result.result.content && result.result.content[0]) {
              result.result.content[0].text += ' [Modified by hook]';
            }
            return result;
          }
        }
      });
      
      testEnv.registerTool('greet', async () => ({
        content: [{ type: 'text', text: 'Hello, World!' }]
      }));
      
      await testEnv.connect();
      const result = await testEnv.callTool('greet', {});
      
      expect(result.content[0].text).toBe('Hello, World! [Modified by hook]');
    });
  });
  
  describe('Combined Hook Functionality', () => {
    it('should execute both before and after hooks', async () => {
      const hookCalls: string[] = [];
      
      testEnv = createTestWithProxy({
        hooks: {
          beforeToolCall: async (context: ToolCallContext) => {
            hookCalls.push(`before:${context.toolName}`);
            context.args.modified = true;
          },
          afterToolCall: async (context: ToolCallContext, result: ToolCallResult) => {
            hookCalls.push(`after:${context.toolName}`);
            return result;
          }
        }
      });
      
      testEnv.registerTool('test', async (args) => ({
        content: [{ 
          type: 'text', 
          text: `Args modified: ${args.modified || false}` 
        }]
      }));
      
      await testEnv.connect();
      const result = await testEnv.callTool('test', {});
      
      expect(hookCalls).toEqual(['before:test', 'after:test']);
      expect(result.content[0].text).toBe('Args modified: true');
    });
  });
  
  describe('Error Handling', () => {
    it('should handle hook errors gracefully', async () => {
      testEnv = createTestWithProxy({
        hooks: {
          beforeToolCall: async () => {
            throw new Error('Hook error');
          }
        }
      });
      
      testEnv.registerTool('test', async () => ({
        content: [{ type: 'text', text: 'Should not reach here' }]
      }));
      
      await testEnv.connect();
      const result = await testEnv.callTool('test', {});
      
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Hook error');
    });
    
    it('should handle afterToolCall hook errors', async () => {
      testEnv = createTestWithProxy({
        hooks: {
          afterToolCall: async () => {
            throw new Error('After hook error');
          }
        }
      });
      
      testEnv.registerTool('test', async () => ({
        content: [{ type: 'text', text: 'Original result' }]
      }));
      
      await testEnv.connect();
      const result = await testEnv.callTool('test', {});
      
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('After hook error');
    });
  });
  
  describe('Metadata and Context', () => {
    it('should include metadata in hook context', async () => {
      let capturedContext: ToolCallContext | null = null;
      
      testEnv = createTestWithProxy({
        metadata: { testFlag: true, environment: 'test' },
        hooks: {
          beforeToolCall: async (context: ToolCallContext) => {
            capturedContext = context;
          }
        }
      });
      
      testEnv.registerTool('test', async () => ({
        content: [{ type: 'text', text: 'Test' }]
      }));
      
      await testEnv.connect();
      await testEnv.callTool('test', { param: 'value' });
      
      expect(capturedContext).toBeTruthy();
      expect(capturedContext!.toolName).toBe('test');
      expect(capturedContext!.args.param).toBe('value');
      expect(capturedContext!.metadata?.testFlag).toBe(true);
      expect(capturedContext!.metadata?.environment).toBe('test');
      expect(capturedContext!.metadata?.requestId).toBeDefined();
      expect(capturedContext!.metadata?.timestamp).toBeDefined();
    });
  });
  
  describe('Complex Tool Interactions', () => {
    it('should handle multiple concurrent tool calls', async () => {
      const callCounts: Record<string, number> = {};
      
      testEnv = createTestWithProxy({
        hooks: {
          beforeToolCall: async (context: ToolCallContext) => {
            callCounts[context.toolName] = (callCounts[context.toolName] || 0) + 1;
          }
        }
      });
      
      testEnv.registerTool('tool1', async () => ({
        content: [{ type: 'text', text: 'Tool 1 result' }]
      }));
      
      testEnv.registerTool('tool2', async () => ({
        content: [{ type: 'text', text: 'Tool 2 result' }]
      }));
      
      await testEnv.connect();
      
      // Make multiple calls in parallel
      const promises = [
        testEnv.callTool('tool1', {}),
        testEnv.callTool('tool2', {}),
        testEnv.callTool('tool1', {}),
        testEnv.callTool('tool2', {})
      ];
      
      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(4);
      expect(callCounts.tool1).toBe(2);
      expect(callCounts.tool2).toBe(2);
    });
    
    it('should handle tools with complex return types', async () => {
      testEnv = createTestEnvironment();
      
      testEnv.registerTool('complex-tool', async () => ({
        content: [
          { type: 'text', text: 'Text content' },
          { 
            type: 'resource', 
            resource: { 
              text: 'Resource content', 
              uri: 'test://example',
              mimeType: 'text/plain'
            }
          }
        ],
        _meta: { 
          customData: 'test',
          timestamp: new Date().toISOString()
        }
      }));
      
      await testEnv.connect();
      const result = await testEnv.callTool('complex-tool', {});
      
      expect(result.content).toHaveLength(2);
      expect(result.content[0].type).toBe('text');
      expect(result.content[1].type).toBe('resource');
      expect(result._meta?.customData).toBe('test');
    });
  });
});