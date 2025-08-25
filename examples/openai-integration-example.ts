/**
 * @file OpenAI Integration Example
 * @description Example showing how to use the LLM Summarization plugin with real OpenAI API
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { wrapWithProxy, LLMSummarizationPlugin } from '../src/index.js';

async function main() {
  // Create a demo MCP server
  const server = new McpServer({
    name: "AI Enhanced Server",
    version: "1.0.0"
  });

  // Register a research tool that returns long content
  server.tool("research", { 
    topic: z.string(),
    depth: z.enum(["basic", "comprehensive"]).optional()
  }, async (args) => {
    // Simulate a research tool that returns long content
    return {
      content: [{
        type: "text" as const,
        text: `
        Research Report: ${args.topic}

        Executive Summary:
        This comprehensive research report examines ${args.topic} from multiple perspectives. 
        Our analysis indicates significant trends and developments in this field that warrant attention.

        Background and Context:
        The field of ${args.topic} has evolved rapidly over recent years. Historical data shows 
        consistent growth patterns, with emerging technologies playing a crucial role in shaping 
        current market dynamics.

        Key Findings:
        1. Market adoption has increased by 300% over the past 24 months
        2. Technology infrastructure improvements have reduced barriers to entry
        3. Regulatory frameworks are adapting to support innovation
        4. Consumer demand continues to outpace supply in key segments
        5. Investment levels have reached historic highs across all categories

        Methodology:
        This research employed a mixed-methods approach including:
        - Literature review of 200+ academic and industry publications
        - Interviews with 50+ subject matter experts
        - Survey data from 1,000+ professionals in the field
        - Analysis of public market data and financial reports

        Regional Analysis:
        North American markets lead in adoption (45% share), followed by European markets (30%) 
        and Asia-Pacific regions (25%). Emerging markets show promise for future expansion.

        Technology Trends:
        Current technological developments include advanced automation, cloud-native architectures, 
        artificial intelligence integration, and improved user experience design patterns.

        Competitive Landscape:
        The market features both established incumbents and innovative startups. Consolidation 
        activity has increased, with several major acquisitions occurring in the past year.

        Risk Assessment:
        Primary risks include regulatory uncertainty, technology obsolescence, market saturation, 
        and potential economic downturns affecting investment flows.

        Future Projections:
        Based on current trends, we project continued strong growth with an estimated compound 
        annual growth rate of 25-30% through 2030. Key growth drivers include technological 
        advancement, expanding use cases, and increasing market maturity.

        Recommendations:
        1. Organizations should invest in talent development and training programs
        2. Focus on regulatory compliance and industry standards adoption
        3. Develop strategic partnerships for market expansion and technology sharing
        4. Maintain strong R&D investment to preserve competitive advantages
        5. Consider geographic expansion to high-growth emerging markets

        Conclusion:
        The ${args.topic} sector presents significant opportunities for growth and innovation. 
        Organizations that develop comprehensive strategies and execute them effectively will be 
        well-positioned to capitalize on emerging market trends and technological developments.
        `
      }]
    };
  });

  // Create and configure the LLM Summarization plugin with OpenAI
  const summarizationPlugin = new LLMSummarizationPlugin();
  
  // Configure the plugin to use OpenAI (requires OPENAI_API_KEY environment variable)
  summarizationPlugin.updateConfig({
    enabled: true,
    priority: 10,
    options: {
      provider: 'openai',
      openaiApiKey: process.env.OPENAI_API_KEY, // Set this environment variable
      model: 'gpt-4o-mini', // Cost-effective model for summaries
      maxTokens: 200, // Longer summaries for comprehensive content
      temperature: 0.3, // Lower temperature for more focused summaries
      minContentLength: 500, // Only summarize longer content
      summarizeTools: ['research'], // Only summarize research tool results
      saveOriginal: true, // Save original content for retrieval
      summarizationPrompt: 'Please provide a concise executive summary of the following research report. Focus on key findings, main insights, and actionable recommendations:'
    }
  });

  // Wrap the server with the proxy and plugin
  const enhancedServer = await wrapWithProxy(server, {
    plugins: [summarizationPlugin],
    hooks: {
      beforeToolCall: async (context) => {
        console.log(`🔬 Research request: ${context.toolName} - ${context.args.topic}`);
      },
      afterToolCall: async (context, result) => {
        if (result.result._meta?.summarized) {
          console.log(`✨ Content summarized: ${result.result._meta.originalLength} → ${result.result._meta.summaryLength} chars`);
          console.log(`📊 Compression ratio: ${(result.result._meta.compressionRatio * 100).toFixed(1)}%`);
        }
        return result;
      }
    },
    debug: true
  });

  // Connect to stdio transport
  const transport = new StdioServerTransport();
  await enhancedServer.connect(transport);

  console.log('🚀 AI-Enhanced MCP Server ready!');
  console.log('💡 Try calling the "research" tool with a topic');
  console.log('🤖 Long responses will be automatically summarized using OpenAI');
  
  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down...');
    await transport.close();
    process.exit(0);
  });
}

// Run the example
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error('❌ Error starting server:', error);
    process.exit(1);
  });
}

export { main };