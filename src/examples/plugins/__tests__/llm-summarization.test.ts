/**
 * @file LLM Summarization Plugin Tests
 * @description Comprehensive tests for the LLM summarization plugin
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { LLMSummarizationPlugin, MockLLMProvider, StoredResult } from '../llm-summarization.js';
import { PluginContext } from '../../../interfaces/plugin.js';
import { ToolCallResult } from '../../../interfaces/proxy-hooks.js';

describe('LLMSummarizationPlugin', () => {
  let plugin: LLMSummarizationPlugin;
  let mockContext: PluginContext;
  let mockResult: ToolCallResult;
  
  beforeEach(async () => {
    plugin = new LLMSummarizationPlugin();
    
    // Initialize with mock provider
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
      toolName: 'research',
      args: { topic: 'AI trends' },
      pluginData: new Map(),
      requestId: 'test-request-123',
      startTime: Date.now(),
      metadata: {}
    };
    
    mockResult = {
      result: {
        content: [{
          type: 'text',
          text: 'This is a long research document about AI trends. It contains detailed analysis of machine learning, natural language processing, and computer vision. The document spans multiple paragraphs with comprehensive insights and data points.'
        }]
      }
    };
  });
  
  afterEach(() => {
    plugin.clearStorage();
  });
  
  describe('Plugin Initialization', () => {
    it('should initialize with mock provider by default', async () => {
      const newPlugin = new LLMSummarizationPlugin();
      await newPlugin.initialize({
        wrapperVersion: '1.0.0',
        loadedPlugins: [],
        globalConfig: {},
        logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() }
      });
      
      expect(newPlugin.name).toBe('llm-summarization-plugin');
      expect(newPlugin.version).toBe('1.0.0');
    });
    
    it('should have correct metadata', () => {
      expect(plugin.metadata?.description).toContain('AI-generated summaries');
      expect(plugin.metadata?.tags).toContain('ai');
      expect(plugin.metadata?.tags).toContain('llm');
    });
    
    it('should have default configuration', () => {
      expect(plugin.config?.enabled).toBe(true);
      expect(plugin.config?.priority).toBe(10);
      expect(plugin.config?.options?.provider).toBe('mock');
    });
  });
  
  describe('Content Extraction', () => {
    it('should extract text content from tool results', async () => {
      const result = await plugin.afterToolCall(mockContext, mockResult);
      
      // Should be summarized since it meets criteria
      expect(result.result._meta?.summarized).toBe(true);
      expect(result.result.content).toHaveLength(1);
      expect(result.result.content[0].type).toBe('text');
    });
    
    it('should handle multiple text content items', async () => {
      const multiContentResult: ToolCallResult = {
        result: {
          content: [
            { type: 'text', text: 'First part of the content with extensive details about the research findings and methodology used. ' },
            { type: 'text', text: 'Second part with more comprehensive analysis and detailed explanations of the results. ' },
            { type: 'text', text: 'Third part with thorough conclusions and recommendations for future work.' }
          ]
        }
      };
      
      const result = await plugin.afterToolCall(mockContext, multiContentResult);
      
      expect(result.result._meta?.summarized).toBe(true);
      expect(result.result.content[0].text).toContain('Summary:');
    });
    
    it('should ignore non-text content', async () => {
      const mixedContentResult: ToolCallResult = {
        result: {
          content: [
            { type: 'text', text: 'This is text content that should be extracted for summarization. It contains enough content to meet the minimum length requirement.' },
            { type: 'image', data: 'base64data', mimeType: 'image/png' } as any
          ]
        }
      };
      
      const result = await plugin.afterToolCall(mockContext, mixedContentResult);
      
      expect(result.result._meta?.summarized).toBe(true);
      // Should only process the text content
      expect(result.result._meta?.originalLength).toBeLessThan(200);
    });
  });
  
  describe('Summarization Logic', () => {
    it('should summarize content that meets criteria', async () => {
      const result = await plugin.afterToolCall(mockContext, mockResult);
      
      expect(result.result._meta?.summarized).toBe(true);
      expect(result.result._meta?.originalLength).toBeGreaterThan(0);
      expect(result.result._meta?.summaryLength).toBeGreaterThan(0);
      expect(result.result._meta?.compressionRatio).toBeLessThan(1);
      expect(result.result.content[0].text).toContain('Summary:');
    });
    
    it('should not summarize short content', async () => {
      const shortResult: ToolCallResult = {
        result: {
          content: [{ type: 'text', text: 'Short text.' }]
        }
      };
      
      const result = await plugin.afterToolCall(mockContext, shortResult);
      
      expect(result.result._meta?.summarized).toBeUndefined();
      expect(result.result.content[0].text).toBe('Short text.');
    });
    
    it('should not summarize errors', async () => {
      const errorResult: ToolCallResult = {
        result: {
          content: [{ type: 'text', text: 'This is a long error message that would normally be summarized but should not be because it is an error response.' }],
          isError: true
        }
      };
      
      const result = await plugin.afterToolCall(mockContext, errorResult);
      
      expect(result.result._meta?.summarized).toBeUndefined();
      expect(result.result.isError).toBe(true);
    });
    
    it('should respect tool filtering', async () => {
      // Configure to only summarize specific tools
      plugin.config!.options!.summarizeTools = ['analyze'];
      
      const result = await plugin.afterToolCall(mockContext, mockResult);
      
      // Should not summarize 'research' tool since it's not in the list
      expect(result.result._meta?.summarized).toBeUndefined();
    });
    
    it('should respect user preferences for original content', async () => {
      const contextWithOriginal: PluginContext = {
        ...mockContext,
        args: { ...mockContext.args, returnOriginal: true }
      };
      
      const result = await plugin.afterToolCall(contextWithOriginal, mockResult);
      
      expect(result.result._meta?.summarized).toBeUndefined();
    });
  });
  
  describe('Storage Management', () => {
    it('should save original results when enabled', async () => {
      plugin.config!.options!.saveOriginal = true;
      
      const result = await plugin.afterToolCall(mockContext, mockResult);
      
      expect(result.result._meta?.originalStorageKey).toBeDefined();
      
      const storageKey = result.result._meta?.originalStorageKey as string;
      const stored = await plugin.getOriginalResult(storageKey);
      
      expect(stored).toBeDefined();
      expect(stored?.originalResult).toEqual(mockResult);
      expect(stored?.toolName).toBe('research');
      expect(stored?.requestId).toBe('test-request-123');
    });
    
    it('should not save original results when disabled', async () => {
      plugin.config!.options!.saveOriginal = false;
      
      await plugin.afterToolCall(mockContext, mockResult);
      
      const storedResults = plugin.getStoredResults();
      expect(storedResults.size).toBe(0);
    });
    
    it('should retrieve stored results by key', async () => {
      const result = await plugin.afterToolCall(mockContext, mockResult);
      const storageKey = result.result._meta?.originalStorageKey as string;
      
      const stored = await plugin.getOriginalResult(storageKey);
      
      expect(stored).toBeDefined();
      expect(stored?.originalResult.result.content).toEqual(mockResult.result.content);
    });
    
    it('should return null for non-existent keys', async () => {
      const stored = await plugin.getOriginalResult('non-existent-key');
      expect(stored).toBeNull();
    });
    
    it('should clear storage when requested', async () => {
      await plugin.afterToolCall(mockContext, mockResult);
      
      let storedResults = plugin.getStoredResults();
      expect(storedResults.size).toBe(1);
      
      plugin.clearStorage();
      
      storedResults = plugin.getStoredResults();
      expect(storedResults.size).toBe(0);
    });
  });
  
  describe('Statistics Tracking', () => {
    it('should track summarization statistics', async () => {
      // Perform multiple summarizations
      await plugin.afterToolCall(mockContext, mockResult);
      
      const context2: PluginContext = {
        ...mockContext,
        requestId: 'test-request-456',
        toolName: 'analyze'
      };
      
      await plugin.afterToolCall(context2, mockResult);
      
      const stats = await plugin.getStats();
      
      expect(stats.customMetrics?.totalSummarizations).toBe(2);
      expect(stats.customMetrics?.totalCharactersSaved).toBeGreaterThan(0);
      expect(stats.customMetrics?.averageCompressionRatio).toBeGreaterThan(0);
      expect(stats.customMetrics?.storedResults).toBe(2);
    });
    
    it('should track compression ratios correctly', async () => {
      const result = await plugin.afterToolCall(mockContext, mockResult);
      
      const originalLength = result.result._meta?.originalLength as number;
      const summaryLength = result.result._meta?.summaryLength as number;
      const compressionRatio = result.result._meta?.compressionRatio as number;
      
      expect(compressionRatio).toBeCloseTo(summaryLength / originalLength, 3);
      expect(compressionRatio).toBeLessThan(1);
    });
  });
  
  describe('Error Handling', () => {
    it('should handle LLM provider errors gracefully', async () => {
      // Create a mock provider that throws an error
      const errorProvider = {
        generateSummary: async () => { throw new Error('LLM API error'); }
      };
      
      (plugin as any).llmProvider = errorProvider;
      
      const result = await plugin.afterToolCall(mockContext, mockResult);
      
      // Should fallback to original result
      expect(result.result._meta?.summarizationError).toBe('LLM API error');
      expect(result.result._meta?.fallbackToOriginal).toBe(true);
      expect(result.result.content).toEqual(mockResult.result.content);
    });
    
    it('should track error count in statistics', async () => {
      // Force an error
      const errorProvider = {
        generateSummary: async () => { throw new Error('Test error'); }
      };
      
      (plugin as any).llmProvider = errorProvider;
      
      await plugin.afterToolCall(mockContext, mockResult);
      
      const stats = await plugin.getStats();
      expect(stats.customMetrics?.errorCount).toBe(1);
    });
  });
  
  describe('Configuration Management', () => {
    it('should allow runtime configuration updates', () => {
      const newConfig = {
        options: {
          minContentLength: 200,
          summarizeTools: ['custom-tool']
        }
      };
      
      plugin.updateConfig(newConfig);
      
      expect(plugin.config?.options?.minContentLength).toBe(200);
      expect(plugin.config?.options?.summarizeTools).toEqual(['custom-tool']);
    });
    
    it('should use contextual prompts for different tools', async () => {
      const searchContext: PluginContext = {
        ...mockContext,
        toolName: 'search'
      };
      
      const result = await plugin.afterToolCall(searchContext, mockResult);
      
      expect(result.result._meta?.summarized).toBe(true);
      // The mock provider includes the tool name in the summary
      expect(result.result.content[0].text).toContain('Summary:');
    });
  });
  
  describe('MockLLMProvider', () => {
    it('should simulate API delay', async () => {
      const provider = new MockLLMProvider(50);
      const startTime = Date.now();
      
      await provider.generateSummary('Test content', 'Test prompt');
      
      const elapsed = Date.now() - startTime;
      expect(elapsed).toBeGreaterThanOrEqual(40); // Allow some variance
    });
    
    it('should generate predictable summaries', async () => {
      const provider = new MockLLMProvider(0);
      const content = 'This is a test sentence. This is another sentence.';
      
      const summary = await provider.generateSummary(content, 'Summarize this');
      
      expect(summary).toContain('Summary: This is a test sentence.');
      expect(summary).toContain('9 words'); // Word count
    });
  });
  
  describe('Integration Scenarios', () => {
    it('should work with realistic research tool output', async () => {
      const researchResult: ToolCallResult = {
        result: {
          content: [{
            type: 'text',
            text: `
            Research Report: Artificial Intelligence Market Analysis
            
            Executive Summary:
            The global AI market is experiencing unprecedented growth, with a compound annual growth rate (CAGR) of 37.3% projected through 2030. Key drivers include increased automation adoption, cloud computing proliferation, and advancing machine learning capabilities.
            
            Market Segmentation:
            - Machine Learning: 45% market share
            - Natural Language Processing: 23% market share  
            - Computer Vision: 18% market share
            - Robotics: 14% market share
            
            Regional Analysis:
            North America leads with 40% market share, followed by Asia-Pacific at 35%, and Europe at 25%. Emerging markets show significant potential for growth.
            
            Competitive Landscape:
            Major players include Google, Microsoft, Amazon, IBM, and NVIDIA. Startups are focusing on specialized AI applications and vertical solutions.
            
            Challenges and Opportunities:
            Key challenges include data privacy concerns, talent shortage, and regulatory uncertainty. Opportunities exist in healthcare AI, autonomous vehicles, and edge computing.
            
            Recommendations:
            Companies should invest in AI talent acquisition, establish data governance frameworks, and focus on explainable AI solutions to build customer trust.
            `
          }]
        }
      };
      
      const result = await plugin.afterToolCall(mockContext, researchResult);
      
      expect(result.result._meta?.summarized).toBe(true);
      expect(result.result._meta?.originalLength).toBeGreaterThan(1000);
      expect(result.result._meta?.summaryLength).toBeLessThan(300);
      expect(result.result._meta?.compressionRatio).toBeLessThan(0.4);
    });
    
    it('should handle empty or malformed content gracefully', async () => {
      const emptyResult: ToolCallResult = {
        result: {
          content: []
        }
      };
      
      const result = await plugin.afterToolCall(mockContext, emptyResult);
      
      expect(result.result._meta?.summarized).toBeUndefined();
      expect(result.result.content).toEqual([]);
    });
    
    it('should preserve metadata from original results', async () => {
      const resultWithMetadata: ToolCallResult = {
        result: {
          content: [{ type: 'text', text: mockResult.result.content[0].text }],
          _meta: {
            originalSource: 'test-api',
            timestamp: '2024-01-01T00:00:00Z',
            version: '1.0'
          }
        }
      };
      
      const result = await plugin.afterToolCall(mockContext, resultWithMetadata);
      
      expect(result.result._meta?.originalSource).toBe('test-api');
      expect(result.result._meta?.timestamp).toBe('2024-01-01T00:00:00Z');
      expect(result.result._meta?.version).toBe('1.0');
      expect(result.result._meta?.summarized).toBe(true);
    });
  });
  
  describe('Cleanup and Lifecycle', () => {
    it('should cleanup old results based on age', async () => {
      // Mock old timestamp
      const oldTimestamp = Date.now() - (25 * 60 * 60 * 1000); // 25 hours ago
      
      const oldResult: StoredResult = {
        originalResult: mockResult,
        context: mockContext,
        timestamp: oldTimestamp,
        toolName: 'old-tool',
        requestId: 'old-request'
      };
      
      // Manually add old result to storage
      (plugin as any).storage.set('old-key', oldResult);
      
      // Trigger cleanup by adding a new result
      await plugin.afterToolCall(mockContext, mockResult);
      
      // Old result should be cleaned up
      const retrieved = await plugin.getOriginalResult('old-key');
      expect(retrieved).toBeNull();
    });
    
    it('should log final statistics on destruction', async () => {
      const mockLogger = {
        debug: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn()
      };
      
      (plugin as any).logger = mockLogger;
      
      await plugin.afterToolCall(mockContext, mockResult);
      await plugin.destroy();
      
      expect(mockLogger.info).toHaveBeenCalledWith('LLM Summarization plugin shutting down');
      expect(mockLogger.info).toHaveBeenCalledWith('Final plugin statistics:', expect.any(Object));
    });
  });
});