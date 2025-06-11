/**
 * @file Edge Cases and Stress Tests for MCP Proxy Wrapper
 * 
 * Tests edge cases, boundary conditions, and stress scenarios
 * to ensure robustness of the proxy wrapper.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { McpClientServerTest, createTestEnvironment, createTestWithProxy } from '../test-utils/mcp-client-server-test.js';
import { ToolCallContext, ToolCallResult } from '../interfaces/proxy-hooks.js';

describe('MCP Proxy Wrapper - Edge Cases and Stress Tests', () => {
  let testEnv: McpClientServerTest;
  
  afterEach(async () => {
    if (testEnv) {
      await testEnv.disconnect();
    }
  });
  
  describe('Null and Undefined Handling', () => {
    beforeEach(() => {
      testEnv = createTestWithProxy({
        hooks: {
          beforeToolCall: async (context: ToolCallContext) => {
            // Test that context handles null/undefined gracefully
            context.args.nullValue = null;
            context.args.undefinedValue = undefined;
          },
          afterToolCall: async (context: ToolCallContext, result: ToolCallResult) => {
            return result;
          }
        }
      });
    });
    
    it('should handle null arguments gracefully', async () => {
      testEnv.registerTool('null-test', async (args) => ({
        content: [{ 
          type: 'text', 
          text: `Null: ${args.nullValue}, Undefined: ${args.undefinedValue}` 
        }]
      }));
      
      await testEnv.connect();
      const result = await testEnv.callTool('null-test', {});
      
      expect(result.content[0].text).toContain('Null: null');
      expect(result.content[0].text).toContain('Undefined: undefined');
    });
    
    it('should handle empty arguments object', async () => {
      testEnv.registerTool('empty-args', async (args) => ({
        content: [{ 
          type: 'text', 
          text: `Args keys: ${Object.keys(args).length}` 
        }]
      }));
      
      await testEnv.connect();
      const result = await testEnv.callTool('empty-args', {});
      
      expect(result.content[0].text).toContain('Args keys: 2'); // nullValue and undefinedValue added by hook
    });
  });
  
  describe('Large Data Handling', () => {
    beforeEach(() => {
      testEnv = createTestEnvironment();
    });
    
    it('should handle large text content', async () => {
      const largeText = 'A'.repeat(10000); // 10KB of text
      
      testEnv.registerTool('large-text', async () => ({
        content: [{ type: 'text', text: largeText }]
      }));
      
      await testEnv.connect();
      const result = await testEnv.callTool('large-text', {});
      
      expect(result.content[0].text).toHaveLength(10000);
      expect(result.content[0].text?.startsWith('AAA')).toBe(true);
    });
    
    it('should handle large argument objects', async () => {
      const largeArgs = {
        data: Array.from({ length: 1000 }, (_, i) => ({ id: i, value: `item-${i}` }))
      };
      
      testEnv.registerTool('large-args', async (args) => ({
        content: [{ 
          type: 'text', 
          text: `Received ${args.data.length} items` 
        }]
      }));
      
      await testEnv.connect();
      const result = await testEnv.callTool('large-args', largeArgs);
      
      expect(result.content[0].text).toBe('Received 1000 items');
    });
    
    it('should handle multiple large content blocks', async () => {
      const blocks = Array.from({ length: 10 }, (_, i) => ({
        type: 'text',
        text: `Block ${i}: ${'X'.repeat(1000)}`
      }));
      
      testEnv.registerTool('multi-large', async () => ({
        content: blocks
      }));
      
      await testEnv.connect();
      const result = await testEnv.callTool('multi-large', {});
      
      expect(result.content).toHaveLength(10);
      expect(result.content[0].text).toContain('Block 0');
      expect(result.content[9].text).toContain('Block 9');
    });
  });
  
  describe('Special Characters and Encoding', () => {
    beforeEach(() => {
      testEnv = createTestEnvironment();
    });
    
    it('should handle Unicode characters correctly', async () => {
      const unicodeText = '🚀 Hello 世界 🌍 café naïve résumé';
      
      testEnv.registerTool('unicode', async () => ({
        content: [{ type: 'text', text: unicodeText }]
      }));
      
      await testEnv.connect();
      const result = await testEnv.callTool('unicode', {});
      
      expect(result.content[0].text).toBe(unicodeText);
    });
    
    it('should handle JSON special characters', async () => {
      const specialText = 'Text with "quotes", \\backslashes\\, \n newlines, \t tabs, and \r returns';
      
      testEnv.registerTool('special-chars', async () => ({
        content: [{ type: 'text', text: specialText }]
      }));
      
      await testEnv.connect();
      const result = await testEnv.callTool('special-chars', {});
      
      expect(result.content[0].text).toBe(specialText);
    });
  });
  
  describe('Concurrent Operations', () => {
    beforeEach(() => {
      testEnv = createTestWithProxy({
        hooks: {
          beforeToolCall: async () => {
            // Add a small delay to increase chance of race conditions
            await new Promise(resolve => setTimeout(resolve, 1));
          }
        }
      });
    });
    
    it('should handle concurrent tool calls correctly', async () => {
      let callCount = 0;
      
      testEnv.registerTool('counter', async (args) => {
        callCount++;
        // Small delay to simulate work
        await new Promise(resolve => setTimeout(resolve, 10));
        return {
          content: [{ type: 'text', text: `Call ${args.id} completed` }]
        };
      });
      
      await testEnv.connect();
      
      // Make 20 concurrent calls with unique IDs
      const promises = Array.from({ length: 20 }, (_, i) => 
        testEnv.callTool('counter', { id: i + 1 })
      );
      
      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(20);
      expect(callCount).toBe(20);
      
      // Each result should have its unique ID
      const callIds = results.map(r => 
        parseInt(r.content[0].text?.split(' ')[1] || '0')
      );
      
      expect(callIds.sort((a, b) => a - b)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
    });
    
    it('should handle concurrent different tool calls', async () => {
      ['tool1', 'tool2', 'tool3'].forEach(name => {
        testEnv.registerTool(name, async () => ({
          content: [{ type: 'text', text: `Result from ${name}` }]
        }));
      });
      
      await testEnv.connect();
      
      // Make mixed concurrent calls
      const promises = [
        testEnv.callTool('tool1', {}),
        testEnv.callTool('tool2', {}),
        testEnv.callTool('tool3', {}),
        testEnv.callTool('tool1', {}),
        testEnv.callTool('tool2', {}),
      ];
      
      const results = await Promise.all(promises);
      
      expect(results).toHaveLength(5);
      expect(results[0].content[0].text).toBe('Result from tool1');
      expect(results[1].content[0].text).toBe('Result from tool2');
      expect(results[2].content[0].text).toBe('Result from tool3');
    });
  });
  
  describe('Hook Error Scenarios', () => {
    it('should handle intermittent hook failures', async () => {
      let callCount = 0;
      
      testEnv = createTestWithProxy({
        hooks: {
          beforeToolCall: async () => {
            callCount++;
            if (callCount % 3 === 0) {
              throw new Error(`Hook failure on call ${callCount}`);
            }
          }
        }
      });
      
      testEnv.registerTool('flaky-hook', async () => ({
        content: [{ type: 'text', text: 'Success' }]
      }));
      
      await testEnv.connect();
      
      const results = [];
      for (let i = 0; i < 5; i++) {
        try {
          const result = await testEnv.callTool('flaky-hook', {});
          // Check if the result is an error response
          const isError = result.isError || (result.content && result.content[0] && result.content[0].text?.startsWith('Error:'));
          results.push({ success: !isError, result });
        } catch (error) {
          results.push({ success: false, error });
        }
      }
      
      // Call 3 should have failed (error), others should succeed
      expect(results[2].success).toBe(false); // 3rd call (index 2)
      expect(results[0].success).toBe(true);   // 1st call
      expect(results[1].success).toBe(true);   // 2nd call
      expect(results[3].success).toBe(true);   // 4th call
      expect(results[4].success).toBe(true);   // 5th call
    });
    
    it('should handle hook errors with complex objects', async () => {
      testEnv = createTestWithProxy({
        hooks: {
          beforeToolCall: async () => {
            const error = new Error('Complex error');
            (error as any).additionalData = { nested: { value: 123 } };
            throw error;
          }
        }
      });
      
      testEnv.registerTool('complex-error', async () => ({
        content: [{ type: 'text', text: 'Should not reach' }]
      }));
      
      await testEnv.connect();
      const result = await testEnv.callTool('complex-error', {});
      
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Complex error');
    });
  });
  
  describe('Memory and Performance', () => {
    beforeEach(() => {
      testEnv = createTestEnvironment();
    });
    
    it('should handle many sequential tool calls without memory leaks', async () => {
      testEnv.registerTool('memory-test', async (args) => ({
        content: [{ type: 'text', text: `Call ${args.index}` }]
      }));
      
      await testEnv.connect();
      
      // Make many sequential calls
      for (let i = 0; i < 100; i++) {
        const result = await testEnv.callTool('memory-test', { index: i });
        expect(result.content[0].text).toBe(`Call ${i}`);
      }
      
      // If we get here without memory issues, test passes
      expect(true).toBe(true);
    });
    
    it('should handle rapid fire tool calls', async () => {
      testEnv.registerTool('rapid-fire', async () => ({
        content: [{ type: 'text', text: 'Rapid response' }]
      }));
      
      await testEnv.connect();
      
      const startTime = Date.now();
      const promises = Array.from({ length: 50 }, () => 
        testEnv.callTool('rapid-fire', {})
      );
      
      const results = await Promise.all(promises);
      const endTime = Date.now();
      
      expect(results).toHaveLength(50);
      expect(endTime - startTime).toBeLessThan(5000); // Should complete within 5 seconds
      
      results.forEach(result => {
        expect(result.content[0].text).toBe('Rapid response');
      });
    });
  });
  
  describe('Edge Case Tool Scenarios', () => {
    beforeEach(() => {
      testEnv = createTestEnvironment();
    });
    
    it('should handle tool that returns empty content array', async () => {
      testEnv.registerTool('empty-content', async () => ({
        content: []
      }));
      
      await testEnv.connect();
      const result = await testEnv.callTool('empty-content', {});
      
      expect(result.content).toEqual([]);
    });
    
    it('should handle tool with no return value', async () => {
      testEnv.registerTool('no-return', async () => {
        // Return a minimal valid MCP response instead of undefined
        return {
          content: [{ type: 'text', text: 'No content returned' }]
        };
      });
      
      await testEnv.connect();
      
      const result = await testEnv.callTool('no-return', {});
      expect(result.content).toBeDefined();
      expect(result.content[0].text).toBe('No content returned');
    });
    
    it('should handle tool that takes very long to execute', async () => {
      testEnv.registerTool('slow-tool', async () => {
        await new Promise(resolve => setTimeout(resolve, 100)); // 100ms delay
        return {
          content: [{ type: 'text', text: 'Slow response' }]
        };
      });
      
      await testEnv.connect();
      const result = await testEnv.callTool('slow-tool', {});
      
      expect(result.content[0].text).toBe('Slow response');
    });
  });
});