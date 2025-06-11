/**
 * @file MCP Protocol Compliance Tests
 * 
 * Tests that ensure the proxy wrapper maintains full MCP protocol compliance
 * and behaves identically to an unwrapped MCP server from the client perspective.
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { McpClientServerTest, createTestEnvironment, createTestWithProxy } from '../test-utils/mcp-client-server-test.js';

describe('MCP Protocol Compliance Tests', () => {
  let testEnv: McpClientServerTest;
  let referenceEnv: McpClientServerTest;
  
  afterEach(async () => {
    if (testEnv) await testEnv.disconnect();
    if (referenceEnv) await referenceEnv.disconnect();
  });
  
  describe('Protocol Equivalence', () => {
    it('should behave identically to unwrapped server for tool calls', async () => {
      // Create both wrapped and unwrapped versions
      testEnv = createTestWithProxy({});
      referenceEnv = createTestEnvironment();
      
      // Register identical tools on both
      const toolHandler = async (args: any) => ({
        content: [{ type: 'text', text: `Echo: ${args.message}` }]
      });
      
      testEnv.registerTool('echo', toolHandler);
      referenceEnv.registerTool('echo', toolHandler);
      
      // Connect both
      await testEnv.connect();
      await referenceEnv.connect();
      
      // Call the same tool with same args
      const wrappedResult = await testEnv.callTool('echo', { message: 'test' });
      const unwrappedResult = await referenceEnv.callTool('echo', { message: 'test' });
      
      // Results should be identical (excluding internal metadata)
      expect(wrappedResult.content).toEqual(unwrappedResult.content);
      expect(wrappedResult.isError).toEqual(unwrappedResult.isError);
    });
    
    it('should provide identical tool listings', async () => {
      testEnv = createTestWithProxy({});
      referenceEnv = createTestEnvironment();
      
      // Register multiple tools on both
      const tools = [
        { name: 'tool1' },
        { name: 'tool2' },
        { name: 'tool3' }
      ];
      
      tools.forEach(tool => {
        const handler = async () => ({ content: [{ type: 'text', text: tool.name }] });
        testEnv.registerTool(tool.name, handler);
        referenceEnv.registerTool(tool.name, handler);
      });
      
      await testEnv.connect();
      await referenceEnv.connect();
      
      const wrappedTools = await testEnv.listTools();
      const unwrappedTools = await referenceEnv.listTools();
      
      expect(wrappedTools.tools.length).toBe(unwrappedTools.tools.length);
      
      // Tool names should be identical
      const wrappedNames = wrappedTools.tools.map((t: any) => t.name).sort();
      const unwrappedNames = unwrappedTools.tools.map((t: any) => t.name).sort();
      expect(wrappedNames).toEqual(unwrappedNames);
    });
  });
  
  describe('MCP Request Handling', () => {
    beforeEach(() => {
      testEnv = createTestEnvironment();
    });
    
    it('should handle initialize request correctly', async () => {
      await testEnv.connect();
      
      // Connection implies successful initialization
      expect(testEnv.isConnected()).toBe(true);
    });
    
    it('should handle tools/list request', async () => {
      testEnv.registerTool('test-tool', async () => ({
        content: [{ type: 'text', text: 'test' }]
      }));
      
      await testEnv.connect();
      
      const result = await testEnv.sendToolsListRequest();
      expect(result.tools).toBeDefined();
      expect(Array.isArray(result.tools)).toBe(true);
    });
    
    it('should handle tools/call request', async () => {
      testEnv.registerTool('test-tool', async (args) => ({
        content: [{ type: 'text', text: `Hello ${args.name}` }]
      }));
      
      await testEnv.connect();
      
      const result = await testEnv.callTool('test-tool', { name: 'World' });
      
      expect(result.content).toBeDefined();
      expect(result.content[0].text).toBe('Hello World');
    });
  });
  
  describe('Error Response Compliance', () => {
    beforeEach(() => {
      testEnv = createTestWithProxy({});
    });
    
    it('should return proper error format for tool execution errors', async () => {
      testEnv.registerTool('error-tool', async () => {
        throw new Error('Test error message');
      });
      
      await testEnv.connect();
      const result = await testEnv.callTool('error-tool', {});
      
      expect(result.isError).toBe(true);
      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('Test error message');
    });
    
    it('should handle non-existent tool calls appropriately', async () => {
      await testEnv.connect();
      
      try {
        await testEnv.callTool('non-existent-tool', {});
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeDefined();
        expect(error instanceof Error).toBe(true);
      }
    });
  });
  
  describe('Content Type Handling', () => {
    beforeEach(() => {
      testEnv = createTestEnvironment();
    });
    
    it('should handle text content correctly', async () => {
      testEnv.registerTool('text-tool', async () => ({
        content: [{ 
          type: 'text', 
          text: 'This is text content with special chars: áéíóú 🚀' 
        }]
      }));
      
      await testEnv.connect();
      const result = await testEnv.callTool('text-tool', {});
      
      expect(result.content[0].type).toBe('text');
      expect(result.content[0].text).toContain('special chars');
    });
    
    it('should handle resource content correctly', async () => {
      testEnv.registerTool('resource-tool', async () => ({
        content: [{
          type: 'resource',
          resource: {
            text: 'Resource content',
            uri: 'test://example/resource',
            mimeType: 'text/plain'
          }
        }]
      }));
      
      await testEnv.connect();
      const result = await testEnv.callTool('resource-tool', {});
      
      expect(result.content[0].type).toBe('resource');
      expect((result.content[0] as any).resource).toBeDefined();
      expect((result.content[0] as any).resource.uri).toBe('test://example/resource');
    });
    
    it('should handle mixed content types', async () => {
      testEnv.registerTool('mixed-tool', async () => ({
        content: [
          { type: 'text', text: 'Text part' },
          { 
            type: 'resource',
            resource: {
              text: 'Resource part',
              uri: 'test://resource',
              mimeType: 'text/plain'
            }
          }
        ]
      }));
      
      await testEnv.connect();
      const result = await testEnv.callTool('mixed-tool', {});
      
      expect(result.content).toHaveLength(2);
      expect(result.content[0].type).toBe('text');
      expect(result.content[1].type).toBe('resource');
    });
  });
  
  describe('Metadata Preservation', () => {
    beforeEach(() => {
      testEnv = createTestEnvironment();
    });
    
    it('should preserve tool result metadata', async () => {
      testEnv.registerTool('meta-tool', async () => ({
        content: [{ type: 'text', text: 'Test' }],
        _meta: {
          timestamp: '2024-01-01T00:00:00Z',
          custom: 'metadata'
        }
      }));
      
      await testEnv.connect();
      const result = await testEnv.callTool('meta-tool', {});
      
      expect(result._meta).toBeDefined();
      expect(result._meta.timestamp).toBe('2024-01-01T00:00:00Z');
      expect(result._meta.custom).toBe('metadata');
    });
    
    it('should handle empty metadata gracefully', async () => {
      testEnv.registerTool('no-meta-tool', async () => ({
        content: [{ type: 'text', text: 'No metadata' }]
      }));
      
      await testEnv.connect();
      const result = await testEnv.callTool('no-meta-tool', {});
      
      expect(result.content[0].text).toBe('No metadata');
      // _meta may or may not be present, but should not cause errors
    });
  });
  
  describe('Connection Lifecycle', () => {
    it('should handle connection and disconnection properly', async () => {
      testEnv = createTestEnvironment();
      
      expect(testEnv.isConnected()).toBe(false);
      
      await testEnv.connect();
      expect(testEnv.isConnected()).toBe(true);
      
      await testEnv.disconnect();
      expect(testEnv.isConnected()).toBe(false);
    });
    
    it('should handle multiple connection attempts gracefully', async () => {
      testEnv = createTestEnvironment();
      
      await testEnv.connect();
      expect(testEnv.isConnected()).toBe(true);
      
      // Second connect should not throw
      await testEnv.connect();
      expect(testEnv.isConnected()).toBe(true);
    });
    
    it('should handle disconnection when not connected', async () => {
      testEnv = createTestEnvironment();
      
      // Should not throw when disconnecting while not connected
      await testEnv.disconnect();
      expect(testEnv.isConnected()).toBe(false);
    });
  });
});