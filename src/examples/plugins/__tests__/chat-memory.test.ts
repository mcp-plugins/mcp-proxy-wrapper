/**
 * @file Chat Memory Plugin Tests
 * @description Comprehensive tests for the chat memory plugin
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ChatMemoryPlugin, ConversationEntry, ChatSession } from '../chat-memory.js';
import { PluginContext } from '../../../interfaces/plugin.js';
import { ToolCallResult } from '../../../interfaces/proxy-hooks.js';

describe('ChatMemoryPlugin', () => {
  let plugin: ChatMemoryPlugin;
  let mockContext: PluginContext;
  let mockResult: ToolCallResult;
  
  beforeEach(async () => {
    plugin = new ChatMemoryPlugin();
    
    await plugin.initialize({
      wrapperVersion: '1.0.0',
      loadedPlugins: [],
      globalConfig: {},
      logger: {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
      }
    });
    
    mockContext = {
      toolName: 'research-data',
      args: { 
        query: 'AI trends', 
        userId: 'user123',
        sessionId: 'session456'
      },
      pluginData: new Map(),
      requestId: 'test-request-123',
      startTime: Date.now(),
      metadata: {}
    };
    
    mockResult = {
      result: {
        content: [{
          type: 'text',
          text: 'Comprehensive research data about AI trends including machine learning adoption, market growth, and technological innovations. This response contains detailed analysis spanning multiple domains and use cases.'
        }]
      }
    };
  });
  
  afterEach(async () => {
    await plugin.destroy();
  });
  
  describe('Plugin Initialization', () => {
    it('should initialize with mock provider by default', async () => {
      const newPlugin = new ChatMemoryPlugin();
      await newPlugin.initialize({
        wrapperVersion: '1.0.0',
        loadedPlugins: [],
        globalConfig: {},
        logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() }
      });
      
      expect(newPlugin.name).toBe('chat-memory-plugin');
      expect(newPlugin.version).toBe('1.0.0');
      expect(newPlugin.config?.options?.provider).toBe('mock');
    });
    
    it('should have correct metadata', () => {
      expect(plugin.metadata?.description).toContain('chat interface');
      expect(plugin.metadata?.tags).toContain('memory');
      expect(plugin.metadata?.tags).toContain('chat');
      expect(plugin.metadata?.tags).toContain('ai');
    });
    
    it('should have default configuration', () => {
      expect(plugin.config?.enabled).toBe(true);
      expect(plugin.config?.priority).toBe(20);
      expect(plugin.config?.options?.saveResponses).toBe(true);
      expect(plugin.config?.options?.enableChat).toBe(true);
    });
  });
  
  describe('Memory Storage', () => {
    it('should save tool responses to memory', async () => {
      const result = await plugin.afterToolCall(mockContext, mockResult);
      
      // Should add memory metadata
      expect(result.result._meta?.savedToMemory).toBe(true);
      expect(result.result._meta?.memoryId).toBeDefined();
      expect(result.result._meta?.chatAvailable).toBe(true);
      
      // Should preserve original content
      expect(result.result.content).toEqual(mockResult.result.content);
      
      // Check if entry was saved
      const memoryId = result.result._meta?.memoryId as string;
      const entry = plugin.getConversationEntry(memoryId);
      
      expect(entry).toBeDefined();
      expect(entry?.toolName).toBe('research-data');
      expect(entry?.context.userId).toBe('user123');
      expect(entry?.context.sessionId).toBe('session456');
    });
    
    it('should not save responses when disabled', async () => {
      plugin.config!.options!.saveResponses = false;
      
      const result = await plugin.afterToolCall(mockContext, mockResult);
      
      expect(result.result._meta?.savedToMemory).toBeUndefined();
      expect(result.result.content).toEqual(mockResult.result.content);
    });
    
    it('should not save error responses', async () => {
      const errorResult: ToolCallResult = {
        result: {
          content: [{ type: 'text', text: 'Error occurred' }],
          isError: true
        }
      };
      
      const result = await plugin.afterToolCall(mockContext, errorResult);
      
      expect(result.result._meta?.savedToMemory).toBeUndefined();
      expect(result.result.isError).toBe(true);
    });
    
    it('should respect tool exclusions', async () => {
      plugin.config!.options!.excludeTools = ['research-data'];
      
      const result = await plugin.afterToolCall(mockContext, mockResult);
      
      expect(result.result._meta?.savedToMemory).toBeUndefined();
    });
    
    it('should respect tool inclusions', async () => {
      plugin.config!.options!.saveTools = ['analyze-data'];
      
      const result = await plugin.afterToolCall(mockContext, mockResult);
      
      // Should not save because 'research-data' is not in saveTools list
      expect(result.result._meta?.savedToMemory).toBeUndefined();
      
      // Test with included tool
      const includedContext = { ...mockContext, toolName: 'analyze-data' };
      const result2 = await plugin.afterToolCall(includedContext, mockResult);
      
      expect(result2.result._meta?.savedToMemory).toBe(true);
    });
  });
  
  describe('Conversation History', () => {
    beforeEach(async () => {
      // Save some test entries
      await plugin.afterToolCall(mockContext, mockResult);
      
      // Add small delay to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 2));
      
      const context2 = {
        ...mockContext,
        toolName: 'analyze-data',
        requestId: 'test-request-456',
        startTime: Date.now(), // This ensures a later timestamp
        args: { 
          query: 'user data analysis', 
          userId: 'user123',
          sessionId: 'session456'
        }
      };
      await plugin.afterToolCall(context2, {
        result: {
          content: [{ type: 'text', text: 'Analysis results for user data' }]
        }
      });
    });
    
    it('should retrieve conversation history', () => {
      const history = plugin.getConversationHistory('user123');
      
      expect(history).toHaveLength(2);
      expect(history[0].toolName).toBe('analyze-data'); // Most recent first
      expect(history[1].toolName).toBe('research-data');
    });
    
    it('should filter conversation history by user', () => {
      const history = plugin.getConversationHistory('different-user');
      expect(history).toHaveLength(0);
      
      const userHistory = plugin.getConversationHistory('user123');
      expect(userHistory).toHaveLength(2);
    });
    
    it('should limit conversation history results', () => {
      const history = plugin.getConversationHistory('user123', 1);
      expect(history).toHaveLength(1);
      expect(history[0].toolName).toBe('analyze-data');
    });
    
    it('should search conversations by content', () => {
      const results = plugin.searchConversations('AI trends', 'user123');
      expect(results).toHaveLength(1);
      expect(results[0].toolName).toBe('research-data');
      
      const noResults = plugin.searchConversations('nonexistent query', 'user123');
      expect(noResults).toHaveLength(0);
    });
    
    it('should get specific conversation entry', async () => {
      const result = await plugin.afterToolCall(mockContext, mockResult);
      const memoryId = result.result._meta?.memoryId as string;
      
      const entry = plugin.getConversationEntry(memoryId);
      
      expect(entry).toBeDefined();
      expect(entry?.id).toBe(memoryId);
      expect(entry?.toolName).toBe('research-data');
      expect(entry?.request.args.query).toBe('AI trends');
    });
  });
  
  describe('Chat Sessions', () => {
    it('should start a new chat session', async () => {
      const sessionId = await plugin.startChatSession('user123');
      
      expect(sessionId).toBeDefined();
      expect(sessionId).toMatch(/^session_/);
      
      const session = plugin.getChatSession(sessionId);
      expect(session).toBeDefined();
      expect(session?.userId).toBe('user123');
      expect(session?.messages).toHaveLength(0);
    });
    
    it('should continue existing chat session', async () => {
      const sessionId = await plugin.startChatSession('user123');
      const sessionId2 = await plugin.startChatSession('user123', sessionId);
      
      expect(sessionId).toBe(sessionId2);
    });
    
    it('should handle chat messages', async () => {
      // Save some conversation data first
      const saveResult = await plugin.afterToolCall(mockContext, mockResult);
      expect(saveResult.result._meta?.savedToMemory).toBe(true);
      
      // Verify the entry was actually saved
      const allEntries = plugin.getConversationHistory();
      expect(allEntries).toHaveLength(1);
      expect(allEntries[0].context.userId).toBe('user123');
      
      const sessionId = await plugin.startChatSession('user123');
      const response = await plugin.chatWithMemory(
        sessionId,
        'What AI trends data do you have?',
        'user123'
      );
      
      expect(response).toBeDefined();
      expect(response).toContain('1'); // Should mention 1 saved conversation
      
      const session = plugin.getChatSession(sessionId);
      expect(session?.messages).toHaveLength(2); // User + assistant
      expect(session?.messages[0].type).toBe('user');
      expect(session?.messages[1].type).toBe('assistant');
    });
    
    it('should provide context-aware chat responses', async () => {
      // Save conversation data
      const saveResult = await plugin.afterToolCall(mockContext, mockResult);
      expect(saveResult.result._meta?.savedToMemory).toBe(true);
      
      const sessionId = await plugin.startChatSession('user123');
      
      // Test different types of queries
      const summaryResponse = await plugin.chatWithMemory(
        sessionId,
        'analyze what you know about my data',
        'user123'
      );
      expect(summaryResponse).toContain('analyzed');
      
      const searchResponse = await plugin.chatWithMemory(
        sessionId,
        'search for machine learning information',
        'user123'
      );
      expect(searchResponse).toContain('Found');
    });
    
    it('should throw error for non-existent session', async () => {
      await expect(
        plugin.chatWithMemory('non-existent-session', 'test message')
      ).rejects.toThrow('Chat session non-existent-session not found');
    });
  });
  
  describe('Memory Management', () => {
    it('should clear user memory', async () => {
      // Save data for multiple users
      await plugin.afterToolCall(mockContext, mockResult);
      
      const otherUserContext = { ...mockContext, args: { ...mockContext.args, userId: 'user456' } };
      await plugin.afterToolCall(otherUserContext, mockResult);
      
      const initialHistory = plugin.getConversationHistory();
      expect(initialHistory).toHaveLength(2);
      
      // Clear memory for one user
      const cleared = plugin.clearUserMemory('user123');
      expect(cleared).toBe(1);
      
      // Verify only that user's data was cleared
      const user123History = plugin.getConversationHistory('user123');
      const user456History = plugin.getConversationHistory('user456');
      
      expect(user123History).toHaveLength(0);
      expect(user456History).toHaveLength(1);
    });
    
    it('should handle memory limits', async () => {
      plugin.config!.options!.maxEntries = 2;
      
      // Save more entries than the limit
      for (let i = 0; i < 5; i++) {
        const context = {
          ...mockContext,
          requestId: `request-${i}`,
          args: { ...mockContext.args, query: `Query ${i}` }
        };
        await plugin.afterToolCall(context, mockResult);
      }
      
      const history = plugin.getConversationHistory();
      expect(history.length).toBeLessThanOrEqual(2);
    });
  });
  
  describe('Statistics and Monitoring', () => {
    it('should track statistics', async () => {
      await plugin.afterToolCall(mockContext, mockResult);
      
      const sessionId = await plugin.startChatSession('user123');
      await plugin.chatWithMemory(sessionId, 'test message', 'user123');
      
      const stats = await plugin.getStats();
      
      expect(stats.customMetrics?.totalEntries).toBe(1);
      expect(stats.customMetrics?.totalSessions).toBe(1);
      expect(stats.customMetrics?.totalChatMessages).toBe(2);
      expect(stats.customMetrics?.storageSize).toBeGreaterThan(0);
      expect(stats.customMetrics?.provider).toBe('mock');
    });
    
    it('should calculate memory usage metrics', async () => {
      await plugin.afterToolCall(mockContext, mockResult);
      
      const stats = await plugin.getStats();
      
      expect(stats.customMetrics?.memoryUsageKB).toBeGreaterThanOrEqual(0);
      expect(stats.customMetrics?.averageEntrySize).toBeGreaterThan(0);
    });
  });
  
  describe('Error Handling', () => {
    it('should handle empty content gracefully', async () => {
      const emptyResult: ToolCallResult = {
        result: { content: [] }
      };
      
      const result = await plugin.afterToolCall(mockContext, emptyResult);
      
      expect(result.result._meta?.savedToMemory).toBeUndefined();
      expect(result.result.content).toEqual([]);
    });
    
    it('should handle missing content fields', async () => {
      const invalidResult: ToolCallResult = {
        result: {}
      };
      
      const result = await plugin.afterToolCall(mockContext, invalidResult);
      
      expect(result.result._meta?.savedToMemory).toBeUndefined();
    });
    
    it('should fallback gracefully on chat errors', async () => {
      // Mock the chat provider to throw an error
      (plugin as any).chatProvider = {
        generateResponse: async () => {
          throw new Error('Chat provider error');
        }
      };
      
      const sessionId = await plugin.startChatSession('user123');
      
      await expect(
        plugin.chatWithMemory(sessionId, 'test message', 'user123')
      ).rejects.toThrow('Chat provider error');
      
      // Session should still exist
      const session = plugin.getChatSession(sessionId);
      expect(session).toBeDefined();
      expect(session?.messages).toHaveLength(1); // Only user message added
    });
  });
  
  describe('Configuration Updates', () => {
    it('should allow runtime configuration updates', () => {
      const newConfig = {
        options: {
          maxEntries: 500,
          enableChat: false,
          provider: 'openai'
        }
      };
      
      plugin.updateConfig(newConfig);
      
      expect(plugin.config?.options?.maxEntries).toBe(500);
      expect(plugin.config?.options?.enableChat).toBe(false);
      expect(plugin.config?.options?.provider).toBe('openai');
    });
  });
  
  describe('Integration Scenarios', () => {
    it('should work with realistic tool responses', async () => {
      const realisticResult: ToolCallResult = {
        result: {
          content: [{
            type: 'text',
            text: `
            Market Analysis Report Q3 2024
            
            Executive Summary:
            The AI market continues to show strong growth with enterprise adoption accelerating across multiple verticals. Key findings include 40% year-over-year growth in AI infrastructure spending and increasing focus on responsible AI deployment.
            
            Key Metrics:
            - Market size: $184B (up 35% from Q2)
            - Enterprise adoption: 67% of Fortune 500 companies
            - Investment flow: $23B in venture funding this quarter
            
            Sector Analysis:
            Healthcare AI leads adoption with 89% of major healthcare systems implementing AI solutions. Financial services follows at 78%, with particular strength in fraud detection and algorithmic trading.
            
            Technology Trends:
            Large Language Models continue to dominate conversations, with increased focus on specialized models and efficiency improvements. Edge AI deployment is accelerating, particularly in autonomous systems.
            
            Challenges and Opportunities:
            Regulatory compliance remains a key concern, with 73% of executives citing it as a major barrier. However, this is creating opportunities for AI governance and explainability solutions.
            `
          }]
        }
      };
      
      const context = {
        ...mockContext,
        toolName: 'market-analysis',
        args: { sector: 'AI', quarter: 'Q3-2024', userId: 'analyst123' }
      };
      
      const result = await plugin.afterToolCall(context, realisticResult);
      
      expect(result.result._meta?.savedToMemory).toBe(true);
      
      // Test chat interaction
      const sessionId = await plugin.startChatSession('analyst123');
      const chatResponse = await plugin.chatWithMemory(
        sessionId,
        'What are the key findings from my market analysis?',
        'analyst123'
      );
      
      expect(chatResponse).toBeDefined();
      expect(chatResponse.length).toBeGreaterThan(50);
      
      // Search for specific information
      const searchResults = plugin.searchConversations('healthcare', 'analyst123');
      expect(searchResults).toHaveLength(1);
      expect(searchResults[0].response.content).toContain('Healthcare');
    });
    
    it('should handle multiple concurrent chat sessions', async () => {
      // Save data for different users
      const user1Context = { ...mockContext, args: { ...mockContext.args, userId: 'user1' } };
      const user2Context = { ...mockContext, args: { ...mockContext.args, userId: 'user2' } };
      
      await plugin.afterToolCall(user1Context, mockResult);
      await plugin.afterToolCall(user2Context, {
        result: {
          content: [{ type: 'text', text: 'Different data for user 2' }]
        }
      });
      
      // Start separate sessions
      const session1 = await plugin.startChatSession('user1');
      const session2 = await plugin.startChatSession('user2');
      
      const response1 = await plugin.chatWithMemory(session1, 'What data do you have?', 'user1');
      const response2 = await plugin.chatWithMemory(session2, 'What data do you have?', 'user2');
      
      // Responses should be different based on user data
      expect(response1).not.toBe(response2);
      expect(response1).toContain('1'); // User1 has 1 entry
      expect(response2).toContain('1'); // User2 has 1 entry
      
      // Sessions should be independent
      const sessionObj1 = plugin.getChatSession(session1);
      const sessionObj2 = plugin.getChatSession(session2);
      
      expect(sessionObj1?.userId).toBe('user1');
      expect(sessionObj2?.userId).toBe('user2');
      expect(sessionObj1?.messages).toHaveLength(2);
      expect(sessionObj2?.messages).toHaveLength(2);
    });
  });
});