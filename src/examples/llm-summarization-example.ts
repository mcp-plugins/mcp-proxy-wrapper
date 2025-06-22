/**
 * @file LLM Summarization Plugin Usage Example
 * @description Demonstrates how to use the LLM summarization plugin with real MCP tools
 * 
 * PURPOSE: This example shows how to:
 * - Set up a complete MCP server with LLM summarization capabilities
 * - Configure the plugin for different environments (development vs production)
 * - Use mock providers for development and OpenAI for production
 * - Handle tool responses that get automatically summarized when they're too long
 * 
 * TO RUN:
 * 1. npm run build
 * 2. node dist/examples/llm-summarization-example.js
 * 3. Use MCP Inspector or connect via STDIO transport
 * 
 * ENVIRONMENT VARIABLES:
 * - OPENAI_API_KEY: Required for production OpenAI integration
 * - NODE_ENV: Set to 'production' to use real OpenAI API
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { wrapWithProxy } from '../proxy-wrapper.js';
import { LLMSummarizationPlugin } from './plugins/llm-summarization.js';
import { z } from 'zod';

/**
 * Example usage of LLM Summarization Plugin
 */
async function createSummarizationEnabledServer() {
  // Create base MCP server
  const server = new McpServer({
    name: 'Research Assistant with AI Summarization',
    version: '1.0.0'
  });
  
  // Create and configure the summarization plugin
  const summarizationPlugin = new LLMSummarizationPlugin();
  
  // Configure for production use
  summarizationPlugin.config = {
    ...summarizationPlugin.config!,
    options: {
      // Use OpenAI for production (requires OPENAI_API_KEY env var)
      provider: process.env.NODE_ENV === 'production' ? 'openai' : 'mock',
      openaiApiKey: process.env.OPENAI_API_KEY,
      model: 'gpt-4o-mini', // Cost-effective model
      maxTokens: 200,
      temperature: 0.2, // Lower temperature for more focused summaries
      
      // Only summarize specific tools
      summarizeTools: [
        'research-paper',
        'market-analysis', 
        'data-report',
        'comprehensive-search',
        'document-analysis'
      ],
      
      // Only summarize content longer than 500 characters
      minContentLength: 500,
      
      // Save original results for later retrieval
      saveOriginal: true,
      
      // Custom prompt for better summaries
      summarizationPrompt: `Provide a professional executive summary of the following content. 
      Focus on: key findings, actionable insights, and important metrics. 
      Format as bullet points when appropriate. Keep under 200 words:`
    }
  };
  
  // Wrap server with plugins
  const proxiedServer = await wrapWithProxy(server, {
    plugins: [summarizationPlugin],
    pluginConfig: {
      defaultTimeout: 15000, // Longer timeout for LLM calls
      enableHealthChecks: true
    }
  });
  
  // Register research tools that return long content
  
  proxiedServer.tool('research-paper', {
    topic: z.string().describe('Research topic'),
    depth: z.enum(['overview', 'detailed', 'comprehensive']).default('detailed'),
    returnOriginal: z.boolean().optional().describe('Return full content instead of summary')
  }, async (args) => {
    // Simulate research paper retrieval
    const content = await simulateResearchPaper(args.topic, args.depth);
    
    return {
      content: [{
        type: 'text',
        text: content
      }],
      _metadata: {
        source: 'academic-database',
        timestamp: new Date().toISOString(),
        topic: args.topic,
        depth: args.depth
      }
    };
  });
  
  proxiedServer.tool('market-analysis', {
    industry: z.string().describe('Industry to analyze'),
    region: z.string().default('global').describe('Geographic region'),
    timeframe: z.string().default('current').describe('Analysis timeframe')
  }, async (args) => {
    const analysis = await simulateMarketAnalysis(args.industry, args.region, args.timeframe);
    
    return {
      content: [{
        type: 'text',
        text: analysis
      }],
      _metadata: {
        source: 'market-data-provider',
        industry: args.industry,
        region: args.region,
        generatedAt: new Date().toISOString()
      }
    };
  });
  
  proxiedServer.tool('data-report', {
    dataset: z.string().describe('Dataset identifier'),
    analysisType: z.enum(['statistical', 'predictive', 'exploratory']).default('statistical'),
    format: z.enum(['summary', 'detailed', 'technical']).default('summary')
  }, async (args) => {
    const report = await simulateDataReport(args.dataset, args.analysisType, args.format);
    
    return {
      content: [{
        type: 'text',
        text: report
      }],
      _metadata: {
        dataset: args.dataset,
        analysisType: args.analysisType,
        format: args.format,
        processedAt: new Date().toISOString()
      }
    };
  });
  
  // Register a utility tool to retrieve original content
  proxiedServer.tool('get-original-content', {
    storageKey: z.string().describe('Storage key from summarized result metadata')
  }, async (args) => {
    const originalData = await summarizationPlugin.getOriginalResult(args.storageKey);
    
    if (!originalData) {
      return {
        content: [{
          type: 'text',
          text: 'Original content not found. The storage key may be invalid or the content may have expired.'
        }],
        isError: true
      };
    }
    
    return {
      content: [{
        type: 'text',
        text: `Original Content Retrieved:\n\n${originalData.originalResult.result.content[0].text}`
      }],
      _metadata: {
        originalToolName: originalData.toolName,
        originalRequestId: originalData.requestId,
        originalTimestamp: new Date(originalData.timestamp).toISOString(),
        retrievedAt: new Date().toISOString()
      }
    };
  });
  
  // Register a tool to get summarization statistics
  proxiedServer.tool('summarization-stats', {}, async () => {
    const stats = await summarizationPlugin.getStats();
    
    return {
      content: [{
        type: 'text',
        text: `Summarization Statistics:
        
• Total Summarizations: ${stats.customMetrics?.totalSummarizations || 0}
• Characters Saved: ${stats.customMetrics?.totalCharactersSaved || 0}
• Average Compression: ${(stats.customMetrics?.averageCompressionRatio || 0) * 100}%
• Stored Results: ${stats.customMetrics?.storedResults || 0}
• Error Count: ${stats.customMetrics?.errorCount || 0}
• Provider: ${stats.customMetrics?.provider || 'unknown'}

The summarization plugin has processed ${stats.customMetrics?.totalSummarizations || 0} documents,
saving an average of ${((1 - (stats.customMetrics?.averageCompressionRatio || 1)) * 100).toFixed(1)}% in content length.`
      }]
    };
  });
  
  return proxiedServer;
}

// Simulation functions for demo purposes

async function simulateResearchPaper(topic: string, depth: string): Promise<string> {
  const papers = {
    'artificial intelligence': {
      overview: generateResearchContent(topic, 800),
      detailed: generateResearchContent(topic, 2000),
      comprehensive: generateResearchContent(topic, 4000)
    },
    'machine learning': {
      overview: generateResearchContent(topic, 700),
      detailed: generateResearchContent(topic, 1800),
      comprehensive: generateResearchContent(topic, 3500)
    }
  };
  
  return papers[topic as keyof typeof papers]?.[depth as keyof typeof papers['artificial intelligence']] || 
         generateResearchContent(topic, depth === 'comprehensive' ? 3000 : depth === 'detailed' ? 1500 : 800);
}

async function simulateMarketAnalysis(industry: string, region: string, timeframe: string): Promise<string> {
  return `
Market Analysis Report: ${industry} Industry (${region})

Executive Summary:
The ${industry} market in ${region} shows significant growth potential for ${timeframe}. Key market drivers include technological advancement, regulatory changes, and shifting consumer preferences.

Market Size and Growth:
Current market valuation stands at $X.X billion with projected CAGR of XX% through 2030. The ${region} region represents XX% of global market share.

Competitive Landscape:
Major players include Company A (XX% share), Company B (XX% share), and Company C (XX% share). Market consolidation is expected as smaller players struggle with scaling challenges.

Technology Trends:
Emerging technologies are reshaping the ${industry} landscape. Key trends include automation, AI integration, and sustainability initiatives driving innovation.

Regulatory Environment:
Recent regulatory changes in ${region} have created both opportunities and challenges. Compliance requirements are increasing, but supportive policies are driving investment.

Investment Analysis:
Venture capital funding in ${industry} reached $XX billion in 2023, with ${region} attracting XX% of total investment. Key investment areas include R&D and market expansion.

Risk Assessment:
Primary risks include regulatory uncertainty, technological disruption, and market saturation in mature segments. Economic volatility also poses challenges.

Opportunities:
Growth opportunities exist in emerging markets, new customer segments, and innovative product categories. Strategic partnerships and acquisitions present additional avenues.

Recommendations:
1. Focus on technology innovation and R&D investment
2. Expand into high-growth geographic markets
3. Develop strategic partnerships for market access
4. Invest in regulatory compliance and risk management
5. Consider M&A opportunities for rapid scaling

Market Forecasts:
Based on current trends and analysis, we project continued strong growth with potential for market expansion into adjacent sectors and geographic regions.
  `.trim();
}

async function simulateDataReport(dataset: string, analysisType: string, format: string): Promise<string> {
  return `
Data Analysis Report: ${dataset}
Analysis Type: ${analysisType.charAt(0).toUpperCase() + analysisType.slice(1)}
Report Format: ${format.charAt(0).toUpperCase() + format.slice(1)}

Dataset Overview:
The ${dataset} dataset contains comprehensive information spanning multiple dimensions and time periods. Data quality assessment indicates 95% completeness with minimal outliers.

Statistical Summary:
• Total Records: 10,000+
• Variables: 25 key metrics
• Time Range: 2020-2024
• Data Quality Score: 95%

Key Findings:
1. Strong correlation identified between variables A and B (r=0.87)
2. Seasonal patterns evident with 15% variance across quarters
3. Growth trend of 23% year-over-year in primary metrics
4. Geographic distribution shows concentration in urban areas (75%)

${analysisType === 'predictive' ? `
Predictive Modeling Results:
Machine learning models achieved 89% accuracy in forecasting future trends. Random Forest performed best with following predictions:
• Next quarter growth: 8-12%
• Annual projection: 25-30% increase
• Key drivers: market expansion and product adoption
` : ''}

${analysisType === 'exploratory' ? `
Exploratory Data Analysis:
Data exploration revealed several interesting patterns and anomalies:
• Bimodal distribution in customer segments
• Unexpected correlation between geographic and demographic factors
• Seasonal anomalies in Q2 data requiring further investigation
` : ''}

Statistical Tests:
Hypothesis testing confirmed significant relationships (p < 0.05) between key variables. ANOVA results indicate substantial group differences across categories.

Recommendations:
1. Implement monitoring for identified key performance indicators
2. Develop targeted strategies for high-potential segments
3. Investigate and address data quality issues in specific areas
4. Establish regular reporting cadence for ongoing analysis

Data Quality Notes:
Minor data quality issues identified in 5% of records. Recommend data cleaning procedures and validation checks for future data collection.

Technical Details:
Analysis performed using advanced statistical methods and machine learning algorithms. All results validated through cross-validation and bootstrap sampling.
  `.trim();
}

function generateResearchContent(topic: string, targetLength: number): string {
  const sections = [
    `Research Paper: ${topic.charAt(0).toUpperCase() + topic.slice(1)}`,
    `
Abstract:
This paper provides a comprehensive analysis of ${topic}, examining current developments, challenges, and future directions. Through systematic review and analysis, we present key findings and recommendations for researchers and practitioners.`,
    `
Introduction:
The field of ${topic} has experienced rapid evolution in recent years. This research addresses critical gaps in understanding and provides new insights through rigorous methodology and analysis.`,
    `
Literature Review:
Extensive review of 100+ peer-reviewed publications reveals significant progress in ${topic} research. Key themes include methodological advances, practical applications, and theoretical frameworks.`,
    `
Methodology:
Our research employs mixed-methods approach combining quantitative analysis, qualitative interviews, and case studies. Data collection spanned 12 months with diverse participant groups.`,
    `
Results:
Analysis reveals significant findings across multiple dimensions. Statistical analysis indicates strong relationships between key variables with practical implications for field practitioners.`,
    `
Discussion:
Results demonstrate the complexity of ${topic} while highlighting actionable insights. Findings contribute to theoretical understanding and practical implementation strategies.`,
    `
Limitations:
This study acknowledges several limitations including sample size constraints, temporal boundaries, and geographic scope. Future research should address these areas.`,
    `
Conclusions:
Research findings advance understanding of ${topic} and provide foundation for future investigations. Practical implications suggest immediate applications in relevant domains.`,
    `
Future Research:
Recommended research directions include longitudinal studies, expanded geographic scope, and investigation of emerging trends and technologies in ${topic}.`
  ];
  
  let content = sections.join('\n');
  
  // Pad or trim to target length
  while (content.length < targetLength) {
    content += `\n\nAdditional detailed analysis and discussion of ${topic} concepts, methodologies, and implications for future research and practical applications.`;
  }
  
  return content.substring(0, targetLength);
}

// Main execution
async function main() {
  const server = await createSummarizationEnabledServer();
  
  // Start server with stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  console.error('🤖 Research Assistant with AI Summarization started!');
  console.error('📋 Available tools:');
  console.error('  • research-paper - Get research papers (automatically summarized)');
  console.error('  • market-analysis - Get market analysis (automatically summarized)');
  console.error('  • data-report - Get data analysis reports (automatically summarized)');
  console.error('  • get-original-content - Retrieve full original content');
  console.error('  • summarization-stats - View summarization statistics');
  console.error('');
  console.error('💡 Tips:');
  console.error('  • Add "returnOriginal": true to get full content instead of summary');
  console.error('  • Use storage keys from summary metadata to retrieve original content');
  console.error('  • Check summarization-stats to see plugin performance');
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { createSummarizationEnabledServer };