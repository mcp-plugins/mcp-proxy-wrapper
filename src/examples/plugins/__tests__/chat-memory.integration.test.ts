/**
 * @file Chat Memory Plugin Integration Tests
 * @description End-to-end tests with real MCP client-server communication
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { wrapWithProxy } from '../../../proxy-wrapper.js';
import { ChatMemoryPlugin } from '../chat-memory.js';
import { z } from 'zod';

describe('Chat Memory Plugin Integration', () => {
  let server: McpServer;
  let proxiedServer: McpServer;
  let serverTransport: InMemoryTransport;
  let clientTransport: InMemoryTransport;
  let client: Client;
  let chatMemoryPlugin: ChatMemoryPlugin;
  
  beforeEach(async () => {
    server = new McpServer({
      name: 'Test Server',
      version: '1.0.0'
    });
    
    // Create transports
    [serverTransport, clientTransport] = InMemoryTransport.createLinkedPair();
    
    // Create client
    client = new Client({
      name: 'Test Client',
      version: '1.0.0'
    }, {
      capabilities: {}
    });
    
    // Create and configure plugin
    chatMemoryPlugin = new ChatMemoryPlugin();
    chatMemoryPlugin.config = {
      ...chatMemoryPlugin.config!,
      options: {
        ...chatMemoryPlugin.config!.options,
        provider: 'mock',
        mockDelay: 10,
        saveResponses: true,
        enableChat: true,
        maxEntries: 100,
        excludeTools: ['chat-with-memory', 'get-memory-stats']
      }
    };
  });
  
  afterEach(async () => {
    await chatMemoryPlugin.destroy();
    try {
      await clientTransport.close();
      await serverTransport.close();
    } catch (error) {
      // Ignore cleanup errors
    }
  });
  
  describe('Memory Storage Integration', () => {
    it('should save tool responses and enable chat access', async () => {
      proxiedServer = await wrapWithProxy(server, {
        plugins: [chatMemoryPlugin]
      });
      
      // Register a research tool
      proxiedServer.tool('research', {
        topic: z.string(),
        userId: z.string().optional()
      }, async (args: any) => {
        return {
          content: [{
            type: 'text',
            text: `Research findings on ${args.topic}: This is comprehensive research data about ${args.topic} including market analysis, trends, and projections. The data shows significant growth in this area with multiple applications across industries.`
          }]
        };
      });
      
      // Connect server and client
      await proxiedServer.connect(serverTransport);
      await client.connect(clientTransport);
      
      // Make tool call
      const result = await client.callTool({
        name: 'research',
        arguments: { topic: 'AI automation', userId: 'user123' }
      });
      
      // Verify memory metadata is added
      expect((result as any)._metadata?.savedToMemory).toBe(true);
      expect((result as any)._metadata?.memoryId).toBeDefined();
      expect((result as any)._metadata?.chatAvailable).toBe(true);
      
      // Verify content is preserved
      expect(result.content[0].text).toContain('Research findings on AI automation');
      
      // Verify entry was saved to memory
      const memoryId = (result as any)._metadata?.memoryId as string;
      const entry = chatMemoryPlugin.getConversationEntry(memoryId);
      
      expect(entry).toBeDefined();
      expect(entry?.toolName).toBe('research');
      expect(entry?.context.userId).toBe('user123');
      expect(entry?.request.args.topic).toBe('AI automation');
    });
    
    it('should not save excluded tools', async () => {
      proxiedServer = await wrapWithProxy(server, {
        plugins: [chatMemoryPlugin]
      });
      
      // Register a chat tool that should be excluded
      proxiedServer.tool('chat-with-memory', {
        message: z.string(),
        sessionId: z.string()
      }, async (args: any) => {
        return {
          content: [{
            type: 'text',
            text: `Chat response: ${args.message}`
          }]
        };
      });
      
      await proxiedServer.connect(serverTransport);
      await client.connect(clientTransport);
      
      const result = await client.callTool({
        name: 'chat-with-memory',
        arguments: { message: 'Hello', sessionId: 'session123' }
      });
      
      // Should not be saved to memory
      expect((result as any)._metadata?.savedToMemory).toBeUndefined();
      expect(result.content[0].text).toBe('Chat response: Hello');
    });
  });
  
  describe('Chat Functionality Integration', () => {
    beforeEach(async () => {
      proxiedServer = await wrapWithProxy(server, {
        plugins: [chatMemoryPlugin]
      });
      
      // Register tools that will be saved to memory
      proxiedServer.tool('analyze-data', {
        dataset: z.string(),
        userId: z.string().optional()
      }, async (args: any) => {
        return {
          content: [{
            type: 'text',
            text: `Data analysis for ${args.dataset}: The analysis reveals significant patterns in user behavior, with 75% increase in engagement and strong correlation between features A and B. Key insights include seasonality effects and demographic preferences.`
          }]
        };
      });
      
      proxiedServer.tool('market-research', {
        industry: z.string(),
        userId: z.string().optional()
      }, async (args: any) => {
        return {
          content: [{
            type: 'text',
            text: `Market research for ${args.industry}: The industry shows 40% year-over-year growth with emerging opportunities in digital transformation. Major players are investing heavily in AI and automation technologies.`
          }]
        };
      });
      
      // Register chat interface tool
      proxiedServer.tool('chat-with-memory', {
        message: z.string(),
        userId: z.string().optional(),
        sessionId: z.string().optional()
      }, async (args: any) => {
        // Start or continue chat session
        const sessionId = args.sessionId || await chatMemoryPlugin.startChatSession(args.userId);
        
        // Generate chat response
        const response = await chatMemoryPlugin.chatWithMemory(
          sessionId,
          args.message,
          args.userId
        );
        
        return {
          content: [{
            type: 'text',
            text: response
          }],
          _metadata: {
            sessionId,
            chatResponse: true
          }
        };
      });
      
      await proxiedServer.connect(serverTransport);
      await client.connect(clientTransport);
    });
    
    it('should enable chat with saved memory data', async () => {
      // First, generate some data to be saved
      await client.callTool({
        name: 'analyze-data',
        arguments: { dataset: 'user_behavior_2024', userId: 'analyst1' }
      });
      
      await client.callTool({
        name: 'market-research',
        arguments: { industry: 'fintech', userId: 'analyst1' }
      });
      
      // Now chat with the memory
      const chatResult = await client.callTool({
        name: 'chat-with-memory',
        arguments: { 
          message: 'What data do you have about my analysis?',
          userId: 'analyst1'
        }
      });
      
      expect(chatResult.content[0].text).toContain('2'); // Should mention 2 saved conversations
      expect((chatResult as any)._metadata?.sessionId).toBeDefined();
      expect((chatResult as any)._metadata?.chatResponse).toBe(true);
    });
    
    it('should provide context-aware responses', async () => {
      // Save some specific data
      await client.callTool({
        name: 'analyze-data',
        arguments: { dataset: 'customer_analytics', userId: 'user1' }
      });
      
      // Chat about the data
      const searchResult = await client.callTool({
        name: 'chat-with-memory',
        arguments: {
          message: 'search for customer information',
          userId: 'user1'
        }
      });
      
      expect(searchResult.content[0].text).toContain('Found');
      expect(searchResult.content[0].text).toContain('analyze-data');
      
      // Ask for analysis
      const analysisResult = await client.callTool({
        name: 'chat-with-memory',
        arguments: {
          message: 'analyze my saved data',
          userId: 'user1'
        }
      });
      
      expect(analysisResult.content[0].text).toContain('analyzed');
    });
    
    it('should maintain separate user contexts', async () => {
      // Save data for user1
      await client.callTool({
        name: 'analyze-data',
        arguments: { dataset: 'user1_data', userId: 'user1' }
      });
      
      // Save data for user2
      await client.callTool({
        name: 'market-research',
        arguments: { industry: 'healthcare', userId: 'user2' }
      });
      
      // Chat as user1
      const user1Chat = await client.callTool({
        name: 'chat-with-memory',
        arguments: {
          message: 'What data do I have?',
          userId: 'user1'
        }
      });
      
      // Chat as user2
      const user2Chat = await client.callTool({
        name: 'chat-with-memory',
        arguments: {
          message: 'What data do I have?',
          userId: 'user2'
        }
      });
      
      // Both should see only their own data
      expect(user1Chat.content[0].text).toContain('1'); // User1 has 1 entry
      expect(user2Chat.content[0].text).toContain('1'); // User2 has 1 entry
      expect(user1Chat.content[0].text).not.toBe(user2Chat.content[0].text);
    });
  });
  
  describe('Memory Management Integration', () => {
    it('should handle memory retrieval tools', async () => {
      proxiedServer = await wrapWithProxy(server, {
        plugins: [chatMemoryPlugin]
      });
      
      // Register memory retrieval tools
      proxiedServer.tool('get-conversation-history', {
        userId: z.string(),
        limit: z.number().optional()
      }, async (args: any) => {
        const history = chatMemoryPlugin.getConversationHistory(args.userId, args.limit);
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(history.map(entry => ({
              id: entry.id,
              toolName: entry.toolName,
              timestamp: entry.response.timestamp,
              preview: entry.response.content.substring(0, 100) + '...'
            })), null, 2)
          }]
        };
      });
      
      proxiedServer.tool('search-memory', {
        query: z.string(),
        userId: z.string().optional()
      }, async (args: any) => {
        const results = chatMemoryPlugin.searchConversations(args.query, args.userId);
        
        return {
          content: [{
            type: 'text',
            text: `Found ${results.length} matching entries for "${args.query}"`
          }]
        };
      });
      
      proxiedServer.tool('generate-data', {
        type: z.string(),
        userId: z.string()
      }, async (args: any) => {
        return {
          content: [{
            type: 'text',
            text: `Generated ${args.type} data with detailed analysis and comprehensive insights for the user.`
          }]
        };
      });
      
      await proxiedServer.connect(serverTransport);
      await client.connect(clientTransport);
      
      // Generate some data
      await client.callTool({
        name: 'generate-data',
        arguments: { type: 'sales_report', userId: 'manager1' }
      });
      
      await client.callTool({
        name: 'generate-data',
        arguments: { type: 'analytics_dashboard', userId: 'manager1' }
      });
      
      // Retrieve conversation history
      const historyResult = await client.callTool({
        name: 'get-conversation-history',
        arguments: { userId: 'manager1', limit: 10 }
      });
      
      const historyData = JSON.parse(historyResult.content[0].text);
      expect(historyData).toHaveLength(2);
      expect(historyData[0].toolName).toBe('generate-data');
      
      // Search memory
      const searchResult = await client.callTool({
        name: 'search-memory',
        arguments: { query: 'sales', userId: 'manager1' }
      });
      
      expect(searchResult.content[0].text).toContain('Found 1 matching entries');
    });
    
    it('should handle statistics and monitoring', async () => {
      proxiedServer = await wrapWithProxy(server, {
        plugins: [chatMemoryPlugin]
      });
      
      proxiedServer.tool('get-memory-stats', {}, async () => {
        const stats = await chatMemoryPlugin.getStats();
        
        return {
          content: [{
            type: 'text',
            text: JSON.stringify(stats.customMetrics, null, 2)
          }]
        };
      });
      
      proxiedServer.tool('create-test-data', {
        userId: z.string()
      }, async (args: any) => {
        return {
          content: [{
            type: 'text',
            text: `Test data created for ${args.userId} with detailed information and analysis.`
          }]
        };
      });
      
      await proxiedServer.connect(serverTransport);
      await client.connect(clientTransport);
      
      // Create some test data
      await client.callTool({
        name: 'create-test-data',
        arguments: { userId: 'test_user' }
      });
      
      // Start a chat session and send a message
      const sessionId = await chatMemoryPlugin.startChatSession('test_user');
      await chatMemoryPlugin.chatWithMemory(sessionId, 'Hello', 'test_user');
      
      // Get statistics
      const statsResult = await client.callTool({
        name: 'get-memory-stats',
        arguments: {}
      });
      
      const stats = JSON.parse(statsResult.content[0].text);
      expect(stats.totalEntries).toBe(1);
      expect(stats.totalSessions).toBe(1);
      expect(stats.totalChatMessages).toBe(2);
      expect(stats.provider).toBe('mock');
    });
  });
  
  describe('Error Handling Integration', () => {
    it('should handle tool errors gracefully', async () => {
      proxiedServer = await wrapWithProxy(server, {
        plugins: [chatMemoryPlugin]
      });
      
      proxiedServer.tool('failing-tool', {
        shouldFail: z.boolean()
      }, async (args: any) => {
        if (args.shouldFail) {
          throw new Error('Tool execution failed');
        }
        return {
          content: [{ type: 'text', text: 'Success' }]
        };
      });
      
      await proxiedServer.connect(serverTransport);
      await client.connect(clientTransport);
      
      // Call tool that fails
      const result = await client.callTool({
        name: 'failing-tool',
        arguments: { shouldFail: true }
      });
      
      // Error should not be saved to memory
      expect(result.isError).toBe(true);
      expect((result as any)._metadata?.savedToMemory).toBeUndefined();
      
      // But plugin should still work for successful calls
      const successResult = await client.callTool({
        name: 'failing-tool',
        arguments: { shouldFail: false }
      });
      
      expect((successResult as any)._metadata?.savedToMemory).toBe(true);
    });
    
    it('should handle chat session errors', async () => {
      proxiedServer = await wrapWithProxy(server, {
        plugins: [chatMemoryPlugin]
      });
      
      proxiedServer.tool('invalid-chat', {
        sessionId: z.string(),
        message: z.string()
      }, async (args: any) => {
        try {
          // Try to chat with non-existent session
          const response = await chatMemoryPlugin.chatWithMemory(
            args.sessionId,
            args.message
          );
          
          return {
            content: [{ type: 'text', text: response }]
          };
        } catch (error) {
          return {
            content: [{ type: 'text', text: `Chat error: ${error instanceof Error ? error.message : String(error)}` }],
            isError: true
          };
        }
      });
      
      await proxiedServer.connect(serverTransport);
      await client.connect(clientTransport);
      
      const result = await client.callTool({
        name: 'invalid-chat',
        arguments: { sessionId: 'non-existent', message: 'hello' }
      });
      
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toContain('Chat session non-existent not found');
    });
  });
  
  describe('Real-world Scenarios', () => {
    it('should handle a complete research workflow', async () => {
      proxiedServer = await wrapWithProxy(server, {
        plugins: [chatMemoryPlugin]
      });
      
      // Register research tools
      proxiedServer.tool('literature-review', {
        topic: z.string(),
        userId: z.string()
      }, async (args: any) => ({
        content: [{
          type: 'text',
          text: `Literature Review: ${args.topic}\n\nThis comprehensive review covers 50+ papers on ${args.topic}, identifying key themes, methodologies, and gaps in current research. Major findings include emerging trends and future research directions.`
        }]
      }));
      
      proxiedServer.tool('data-analysis', {
        dataset: z.string(),
        method: z.string(),
        userId: z.string()
      }, async (args: any) => ({
        content: [{
          type: 'text',
          text: `Data Analysis Results\nDataset: ${args.dataset}\nMethod: ${args.method}\n\nStatistical analysis reveals significant patterns with p-value < 0.05. Key variables show strong correlations and predictive power for the target outcome.`
        }]
      }));
      
      proxiedServer.tool('research-chat', {
        message: z.string(),
        userId: z.string(),
        sessionId: z.string().optional()
      }, async (args: any) => {
        const sessionId = args.sessionId || await chatMemoryPlugin.startChatSession(args.userId);
        const response = await chatMemoryPlugin.chatWithMemory(sessionId, args.message, args.userId);
        
        return {
          content: [{ type: 'text', text: response }],
          _metadata: { sessionId }
        };
      });
      
      await proxiedServer.connect(serverTransport);
      await client.connect(clientTransport);
      
      // Complete research workflow
      const researcherId = 'researcher123';
      
      // Step 1: Literature review
      await client.callTool({
        name: 'literature-review',
        arguments: { topic: 'machine learning interpretability', userId: researcherId }
      });
      
      // Step 2: Data analysis
      await client.callTool({
        name: 'data-analysis',
        arguments: { 
          dataset: 'ml_model_explanations.csv',
          method: 'SHAP analysis',
          userId: researcherId
        }
      });
      
      // Step 3: Chat about findings
      const chatResult1 = await client.callTool({
        name: 'research-chat',
        arguments: {
          message: 'What are the key findings from my research so far?',
          userId: researcherId
        }
      });
      
      expect(chatResult1.content[0].text).toContain('2'); // Should reference 2 saved studies
      
      // Step 4: Ask specific questions
      const sessionId = (chatResult1 as any)._metadata?.sessionId;
      const chatResult2 = await client.callTool({
        name: 'research-chat',
        arguments: {
          message: 'search for information about interpretability methods',
          userId: researcherId,
          sessionId
        }
      });
      
      expect(chatResult2.content[0].text).toContain('Found');
      
      // Verify conversation history
      const history = chatMemoryPlugin.getConversationHistory(researcherId);
      expect(history).toHaveLength(2);
      expect(history.some(entry => entry.toolName === 'literature-review')).toBe(true);
      expect(history.some(entry => entry.toolName === 'data-analysis')).toBe(true);
    });
  });
});