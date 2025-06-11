/**
 * @file LLM Summarization Plugin Integration Tests
 * @description End-to-end tests with real MCP client-server communication
 */

import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { wrapWithProxy } from '../../../proxy-wrapper.js';
import { LLMSummarizationPlugin } from '../llm-summarization.js';
import { z } from 'zod';

describe('LLM Summarization Plugin Integration', () => {
  let server: McpServer;
  let proxiedServer: McpServer;
  let serverTransport: InMemoryTransport;
  let clientTransport: InMemoryTransport;
  let client: Client;
  let summarizationPlugin: LLMSummarizationPlugin;
  
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
    summarizationPlugin = new LLMSummarizationPlugin();
    summarizationPlugin.config = {
      ...summarizationPlugin.config!,
      options: {
        ...summarizationPlugin.config!.options,
        provider: 'mock',
        mockDelay: 10, // Fast for tests
        minContentLength: 50, // Lower threshold for tests
        summarizeTools: ['research', 'analyze-data', 'fetch-report'],
        saveOriginal: true
      }
    };
  });
  
  afterEach(async () => {
    summarizationPlugin.clearStorage();
    try {
      await clientTransport.close();
      await serverTransport.close();
    } catch (error) {
      // Ignore cleanup errors
    }
  });
  
  describe('Real Tool Call Summarization', () => {
    it('should summarize long research tool responses', async () => {
      proxiedServer = await wrapWithProxy(server, {
        plugins: [summarizationPlugin]
      });
      
      // Register a research tool that returns long content
      proxiedServer.tool('research', {
        topic: z.string(),
        depth: z.string().optional()
      }, async (args: any) => {
        return {
          content: [{
            type: 'text',
            text: `
            Comprehensive Research Report on ${args.topic}
            
            Introduction:
            This detailed research report provides an in-depth analysis of ${args.topic}, covering historical context, current trends, and future projections. The research was conducted using multiple methodologies including literature review, expert interviews, and data analysis.
            
            Historical Context:
            The field of ${args.topic} has evolved significantly over the past decades. Early developments were characterized by limited understanding and basic implementations. However, recent advances have transformed the landscape completely.
            
            Current Market Analysis:
            Today's market shows strong growth indicators with increasing adoption rates across multiple sectors. Key players are investing heavily in research and development, leading to rapid innovation cycles.
            
            Methodology:
            Our research methodology included:
            - Systematic literature review of 150+ academic papers
            - Interviews with 25 industry experts
            - Analysis of market data from 10 major regions
            - Survey of 500+ professionals in the field
            
            Key Findings:
            1. Market size has grown 300% in the last 5 years
            2. Adoption rate is accelerating in enterprise segments
            3. Regulatory frameworks are evolving to support growth
            4. Investment in the sector reached $50B in 2023
            5. Talent shortage remains a significant challenge
            
            Regional Analysis:
            North America leads with 45% market share, followed by Europe (30%) and Asia-Pacific (25%). Emerging markets show significant potential for future growth.
            
            Technology Trends:
            Current technology trends include increased automation, cloud-first approaches, and AI integration. These trends are driving efficiency improvements and new use cases.
            
            Competitive Landscape:
            The competitive landscape is fragmented with both established players and innovative startups. Consolidation is expected as the market matures.
            
            Future Projections:
            Based on our analysis, we project continued strong growth with an estimated CAGR of 25% through 2030. Key growth drivers include technological advancement and expanding use cases.
            
            Recommendations:
            1. Companies should invest in talent acquisition and training
            2. Focus on regulatory compliance and standards adoption
            3. Develop strategic partnerships for market expansion
            4. Invest in R&D to maintain competitive advantage
            5. Consider geographic expansion to high-growth regions
            
            Conclusion:
            The ${args.topic} sector presents significant opportunities for growth and innovation. Organizations that act strategically and invest appropriately will be well-positioned to capitalize on market trends.
            `
          }]
        };
      });
      
      // Connect server and client
      await proxiedServer.connect(serverTransport);
      await client.connect(clientTransport);
      
      // Make tool call
      const result = await client.callTool({
        name: 'research',
        arguments: { topic: 'artificial intelligence', depth: 'comprehensive' }
      });
      
      // Verify summarization occurred
      expect((result as any)._meta?.summarized).toBe(true);
      expect((result as any)._meta?.originalLength).toBeGreaterThan(1000);
      expect((result as any)._meta?.summaryLength).toBeLessThan(350);
      expect((result as any)._meta?.compressionRatio).toBeLessThan(0.5);
      expect((result as any)._meta?.originalStorageKey).toBeDefined();
      expect((result as any)._meta?.provider).toBe('mock');
      
      // Verify summary content
      expect((result as any).content[0].text).toContain('Summary:');
      expect((result as any).content[0].text).toContain('artificial intelligence');
      
      // Verify original can be retrieved
      const storageKey = (result as any)._meta?.originalStorageKey as string;
      const originalData = await summarizationPlugin.getOriginalResult(storageKey);
      
      expect(originalData).toBeDefined();
      expect(originalData?.toolName).toBe('research');
      expect(originalData?.originalResult.result.content[0].text).toContain('Comprehensive Research Report');
    });
    
    it('should not summarize short responses', async () => {
      proxiedServer = await wrapWithProxy(server, {
        plugins: [summarizationPlugin]
      });
      
      // Register a tool that returns short content
      proxiedServer.tool('quick-search', {
        query: z.string()
      }, async (args: any) => {
        return {
          content: [{
            type: 'text',
            text: `Found 3 results for "${args.query}".`
          }]
        };
      });
      
      await proxiedServer.connect(serverTransport);
      await client.connect(clientTransport);
      
      const result = await client.callTool({
        name: 'quick-search',
        arguments: { query: 'test' }
      });
      
      // Should not be summarized due to short length
      expect((result as any)._meta?.summarized).toBeUndefined();
      expect((result as any).content[0].text).toBe('Found 3 results for "test".');
    });
    
    it('should not summarize tools not in the filter list', async () => {
      proxiedServer = await wrapWithProxy(server, {
        plugins: [summarizationPlugin]
      });
      
      // Register a tool not in the summarization list
      proxiedServer.tool('calculate', {
        a: z.number(),
        b: z.number()
      }, async (args: any) => {
        return {
          content: [{
            type: 'text',
            text: `This is a long calculation result that explains the mathematical process in detail. The calculation of ${args.a} plus ${args.b} involves understanding number theory and arithmetic operations. The result is ${args.a + args.b} but there are many mathematical principles that underlie this simple operation including the commutative property of addition.`
          }]
        };
      });
      
      await proxiedServer.connect(serverTransport);
      await client.connect(clientTransport);
      
      const result = await client.callTool({
        name: 'calculate',
        arguments: { a: 5, b: 3 }
      });
      
      // Should not be summarized because 'calculate' is not in summarizeTools list
      expect((result as any)._meta?.summarized).toBeUndefined();
      expect((result as any).content[0].text).toContain('The result is 8');
    });
    
    it('should respect user preference for original content', async () => {
      proxiedServer = await wrapWithProxy(server, {
        plugins: [summarizationPlugin]
      });
      
      proxiedServer.tool('analyze-data', {
        data: z.string(),
        returnOriginal: z.boolean().optional()
      }, async (args: any) => {
        return {
          content: [{
            type: 'text',
            text: `
            Data Analysis Report for ${args.data}
            
            This comprehensive analysis examines the provided data using advanced statistical methods and machine learning algorithms. The analysis reveals several key patterns and insights that are crucial for decision-making.
            
            Statistical Summary:
            - Mean: 45.7
            - Median: 43.2
            - Standard Deviation: 12.8
            - Sample Size: 1,000 observations
            
            Key Insights:
            1. Strong positive correlation between variables A and B (r=0.85)
            2. Seasonal patterns evident in the time series data
            3. Outliers detected in approximately 3% of observations
            4. Normal distribution confirmed via Shapiro-Wilk test
            
            Recommendations:
            Based on the analysis, we recommend implementing a predictive model and establishing monitoring systems for ongoing data quality assessment.
            `
          }]
        };
      });
      
      await proxiedServer.connect(serverTransport);
      await client.connect(clientTransport);
      
      // Request original content
      const result = await client.callTool({
        name: 'analyze-data',
        arguments: { data: 'sales_data.csv', returnOriginal: true }
      });
      
      // Should not be summarized due to user preference
      expect((result as any)._meta?.summarized).toBeUndefined();
      expect((result as any).content[0].text).toContain('Data Analysis Report');
      expect((result as any).content[0].text).toContain('Statistical Summary');
    });
  });
  
  describe('Error Handling in Real Scenarios', () => {
    it('should handle tool execution errors gracefully', async () => {
      proxiedServer = await wrapWithProxy(server, {
        plugins: [summarizationPlugin]
      });
      
      proxiedServer.tool('failing-research', {
        topic: z.string()
      }, async (args: any) => {
        throw new Error('Research API is temporarily unavailable');
      });
      
      await proxiedServer.connect(serverTransport);
      await client.connect(clientTransport);
      
      const result = await client.callTool({
        name: 'failing-research',
        arguments: { topic: 'AI' }
      });
      
      // Should receive error without summarization attempt
      expect(result.isError).toBe(true);
      expect((result as any)._meta?.summarized).toBeUndefined();
      expect((result as any).content[0].text).toContain('Research API is temporarily unavailable');
    });
    
    it('should fallback to original content when LLM fails', async () => {
      // Configure plugin with a failing LLM provider
      const failingPlugin = new LLMSummarizationPlugin();
      failingPlugin.config = {
        ...failingPlugin.config!,
        options: {
          ...failingPlugin.config!.options,
          provider: 'mock',
          summarizeTools: ['research'],
          minContentLength: 50
        }
      };
      
      await failingPlugin.initialize({
        wrapperVersion: '1.0.0',
        loadedPlugins: [],
        globalConfig: {},
        logger: { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} }
      });
      
      // Mock the LLM provider to fail  
      const originalGenerateSummary = (failingPlugin as any).generateSummary;
      (failingPlugin as any).generateSummary = async () => {
        throw new Error('LLM service unavailable');
      };
      
      proxiedServer = await wrapWithProxy(server, {
        plugins: [failingPlugin]
      });
      
      proxiedServer.tool('research', {
        topic: z.string()
      }, async (args: any) => {
        return {
          content: [{
            type: 'text',
            text: `Long research content about ${args.topic} that would normally be summarized but the LLM service is failing so this should be returned as-is with error metadata.`
          }]
        };
      });
      
      await proxiedServer.connect(serverTransport);
      await client.connect(clientTransport);
      
      const result = await client.callTool({
        name: 'research',
        arguments: { topic: 'quantum computing' }
      });
      
      // Should fallback to original content
      expect((result as any)._meta?.summarizationError).toBe('LLM service unavailable');
      expect((result as any)._meta?.fallbackToOriginal).toBe(true);
      expect((result as any).content[0].text).toContain('Long research content about quantum computing');
    });
  });
  
  describe('Multiple Tool Scenarios', () => {
    it('should handle multiple tool calls with summarization', async () => {
      proxiedServer = await wrapWithProxy(server, {
        plugins: [summarizationPlugin]
      });
      
      // Register multiple tools
      proxiedServer.tool('research', {
        topic: z.string()
      }, async (args: any) => {
        return {
          content: [{
            type: 'text',
            text: `Detailed research on ${args.topic}. This is comprehensive analysis with multiple sections including methodology, findings, recommendations, and conclusions. The research covers all aspects thoroughly.`
          }]
        };
      });
      
      proxiedServer.tool('analyze-data', {
        dataset: z.string()
      }, async (args: any) => {
        return {
          content: [{
            type: 'text',
            text: `Comprehensive data analysis of ${args.dataset}. The analysis includes statistical summaries, trend analysis, correlation studies, and predictive modeling. Key insights and recommendations are provided.`
          }]
        };
      });
      
      await proxiedServer.connect(serverTransport);
      await client.connect(clientTransport);
      
      // Make multiple tool calls
      const result1 = await client.callTool({
        name: 'research',
        arguments: { topic: 'machine learning' }
      });
      
      const result2 = await client.callTool({
        name: 'analyze-data',
        arguments: { dataset: 'customer_behavior.csv' }
      });
      
      // Both should be summarized
      expect((result1 as any)._meta?.summarized).toBe(true);
      expect((result2 as any)._meta?.summarized).toBe(true);
      
      // Check plugin statistics
      const stats = await summarizationPlugin.getStats();
      expect(stats.customMetrics?.totalSummarizations).toBe(2);
      expect(stats.customMetrics?.storedResults).toBe(2);
    });
  });
  
  describe('Storage and Retrieval', () => {
    it('should enable retrieval of original data after summarization', async () => {
      proxiedServer = await wrapWithProxy(server, {
        plugins: [summarizationPlugin]
      });
      
      proxiedServer.tool('fetch-report', {
        reportId: z.string()
      }, async (args: any) => {
        return {
          content: [{
            type: 'text',
            text: `
            Full Financial Report ${args.reportId}
            
            Executive Summary: This quarterly financial report provides a comprehensive overview of company performance.
            
            Revenue Analysis: Total revenue for Q3 was $125M, representing a 15% increase year-over-year.
            
            Expense Breakdown: Operating expenses totaled $95M, with the largest categories being personnel (45%) and technology (25%).
            
            Profitability: Net income reached $30M, exceeding analyst expectations by 12%.
            
            Cash Flow: Operating cash flow was positive at $35M, providing strong liquidity position.
            
            Balance Sheet: Total assets increased to $500M, with debt-to-equity ratio improving to 0.3.
            
            Forward Guidance: Based on current trends, we project continued growth in Q4 with revenue expected to reach $140M.
            `
          }]
        };
      });
      
      await proxiedServer.connect(serverTransport);
      await client.connect(clientTransport);
      
      const result = await client.callTool({
        name: 'fetch-report',
        arguments: { reportId: 'Q3-2024-001' }
      });
      
      // Verify summarization
      expect((result as any)._meta?.summarized).toBe(true);
      expect((result as any).content[0].text).toContain('Summary:');
      
      // Retrieve original data
      const storageKey = (result as any)._meta?.originalStorageKey as string;
      const originalData = await summarizationPlugin.getOriginalResult(storageKey);
      
      expect(originalData).toBeDefined();
      expect(originalData?.originalResult.result.content[0].text).toContain('Full Financial Report Q3-2024-001');
      expect(originalData?.originalResult.result.content[0].text).toContain('Revenue Analysis');
      expect(originalData?.originalResult.result.content[0].text).toContain('Forward Guidance');
      expect(originalData?.originalResult.result.content[0].text.length).toBeGreaterThan(500);
    });
  });
});