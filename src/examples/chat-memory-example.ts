/**
 * @file Chat Memory Plugin Usage Example
 * @description Demonstrates how to use the chat memory plugin with a complete MCP server
 * 
 * PURPOSE: This example shows how to:
 * - Set up conversation memory that persists across tool calls
 * - Configure automatic summarization when memory gets full
 * - Use the memory system to provide context-aware responses
 * - Handle memory retrieval and management in tool implementations
 * 
 * TO RUN:
 * 1. npm run build
 * 2. node dist/examples/chat-memory-example.js
 * 3. Use MCP Inspector or connect via STDIO transport
 * 4. Try the 'chat' tool with conversations to see memory in action
 * 
 * FEATURES DEMONSTRATED:
 * - Persistent conversation memory across tool calls
 * - Automatic summarization when memory reaches capacity
 * - Context-aware responses using conversation history
 * - Memory retrieval and search capabilities
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { wrapWithProxy } from '../proxy-wrapper.js';
import { ChatMemoryPlugin } from './plugins/chat-memory.js';
import { z } from 'zod';

/**
 * Example usage of Chat Memory Plugin
 * Creates a research assistant server that saves all responses to memory
 * and allows users to chat with their saved data
 */
async function createChatMemoryEnabledServer() {
  // Create base MCP server
  const server = new McpServer({
    name: 'Research Assistant with Chat Memory',
    version: '1.0.0'
  });
  
  // Create and configure the chat memory plugin
  const chatMemoryPlugin = new ChatMemoryPlugin();
  
  // Configure for production use
  chatMemoryPlugin.config = {
    ...chatMemoryPlugin.config!,
    options: {
      // Use OpenAI for production (requires OPENAI_API_KEY env var)
      provider: process.env.NODE_ENV === 'production' ? 'openai' : 'mock',
      openaiApiKey: process.env.OPENAI_API_KEY,
      model: 'gpt-4o-mini',
      
      // Memory settings
      saveResponses: true,
      enableChat: true,
      maxEntries: 10000,
      maxSessions: 1000,
      sessionTimeout: 7 * 24 * 60 * 60 * 1000, // 7 days
      
      // Save all tools except chat and utility tools
      excludeTools: [
        'chat-with-memory',
        'get-conversation-history',
        'search-memory',
        'get-memory-stats',
        'clear-user-memory'
      ],
      
      mockDelay: 50 // Fast for demo
    }
  };
  
  // Wrap server with plugins
  const proxiedServer = await wrapWithProxy(server, {
    plugins: [chatMemoryPlugin],
    pluginConfig: {
      defaultTimeout: 30000,
      enableHealthChecks: true
    }
  });
  
  // Research and Analysis Tools (these will be saved to memory)
  
  proxiedServer.tool('research-paper', {
    topic: z.string().describe('Research topic'),
    depth: z.enum(['summary', 'detailed', 'comprehensive']).default('detailed'),
    userId: z.string().describe('User ID for memory tracking')
  }, async (args) => {
    const content = await simulateResearchPaper(args.topic, args.depth);
    
    return {
      content: [{
        type: 'text',
        text: content
      }],
      _metadata: {
        source: 'academic-database',
        topic: args.topic,
        depth: args.depth,
        timestamp: new Date().toISOString()
      }
    };
  });
  
  proxiedServer.tool('market-analysis', {
    industry: z.string().describe('Industry to analyze'),
    region: z.string().default('global').describe('Geographic region'),
    userId: z.string().describe('User ID for memory tracking')
  }, async (args) => {
    const analysis = await simulateMarketAnalysis(args.industry, args.region);
    
    return {
      content: [{
        type: 'text',
        text: analysis
      }],
      _metadata: {
        source: 'market-research-provider',
        industry: args.industry,
        region: args.region,
        timestamp: new Date().toISOString()
      }
    };
  });
  
  proxiedServer.tool('data-analysis', {
    dataset: z.string().describe('Dataset name or ID'),
    analysisType: z.enum(['statistical', 'predictive', 'exploratory']).default('statistical'),
    userId: z.string().describe('User ID for memory tracking')
  }, async (args) => {
    const analysis = await simulateDataAnalysis(args.dataset, args.analysisType);
    
    return {
      content: [{
        type: 'text',
        text: analysis
      }],
      _metadata: {
        dataset: args.dataset,
        analysisType: args.analysisType,
        timestamp: new Date().toISOString()
      }
    };
  });
  
  proxiedServer.tool('competitive-intelligence', {
    company: z.string().describe('Company to research'),
    scope: z.enum(['overview', 'financial', 'strategic']).default('overview'),
    userId: z.string().describe('User ID for memory tracking')
  }, async (args) => {
    const intelligence = await simulateCompetitiveIntelligence(args.company, args.scope);
    
    return {
      content: [{
        type: 'text',
        text: intelligence
      }],
      _metadata: {
        company: args.company,
        scope: args.scope,
        timestamp: new Date().toISOString()
      }
    };
  });
  
  // Chat and Memory Interface Tools (these will NOT be saved to memory)
  
  proxiedServer.tool('chat-with-memory', {
    message: z.string().describe('Your message or question'),
    userId: z.string().describe('User ID for accessing your saved data'),
    sessionId: z.string().optional().describe('Optional session ID to continue conversation')
  }, async (args) => {
    try {
      // Start or continue chat session
      const sessionId = args.sessionId || await chatMemoryPlugin.startChatSession(args.userId);
      
      // Generate chat response based on saved memory
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
          chatResponse: true,
          timestamp: new Date().toISOString()
        }
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Error: ${error instanceof Error ? error.message : String(error)}`
        }],
        isError: true
      };
    }
  });
  
  proxiedServer.tool('get-conversation-history', {
    userId: z.string().describe('User ID'),
    limit: z.number().default(20).describe('Maximum number of entries to return')
  }, async (args) => {
    const history = chatMemoryPlugin.getConversationHistory(args.userId, args.limit);
    
    if (history.length === 0) {
      return {
        content: [{
          type: 'text',
          text: 'No conversation history found for this user.'
        }]
      };
    }
    
    const formatted = history.map(entry => ({
      id: entry.id,
      tool: entry.toolName,
      timestamp: new Date(entry.response.timestamp).toISOString(),
      request: entry.request.args,
      preview: entry.response.content.substring(0, 200) + (entry.response.content.length > 200 ? '...' : '')
    }));
    
    return {
      content: [{
        type: 'text',
        text: `Conversation History (${history.length} entries):\n\n${JSON.stringify(formatted, null, 2)}`
      }]
    };
  });
  
  proxiedServer.tool('search-memory', {
    query: z.string().describe('Search query'),
    userId: z.string().describe('User ID'),
    limit: z.number().default(10).describe('Maximum number of results')
  }, async (args) => {
    const results = chatMemoryPlugin.searchConversations(args.query, args.userId);
    
    if (results.length === 0) {
      return {
        content: [{
          type: 'text',
          text: `No results found for "${args.query}".`
        }]
      };
    }
    
    const limitedResults = results.slice(0, args.limit);
    const formatted = limitedResults.map(entry => ({
      id: entry.id,
      tool: entry.toolName,
      relevance: 'high', // In a real implementation, this would be calculated
      timestamp: new Date(entry.response.timestamp).toISOString(),
      preview: entry.response.content.substring(0, 150) + '...'
    }));
    
    return {
      content: [{
        type: 'text',
        text: `Search Results for "${args.query}" (${results.length} total, showing ${limitedResults.length}):\n\n${JSON.stringify(formatted, null, 2)}`
      }]
    };
  });
  
  proxiedServer.tool('get-memory-stats', {
    userId: z.string().optional().describe('User ID for user-specific stats')
  }, async (args) => {
    const globalStats = await chatMemoryPlugin.getStats();
    
    let userStats = {};
    if (args.userId) {
      const userHistory = chatMemoryPlugin.getConversationHistory(args.userId);
      userStats = {
        userEntries: userHistory.length,
        userStorageSize: userHistory.reduce((size, entry) => size + entry.response.content.length, 0),
        oldestEntry: userHistory.length > 0 ? new Date(Math.min(...userHistory.map(e => e.response.timestamp))).toISOString() : null,
        newestEntry: userHistory.length > 0 ? new Date(Math.max(...userHistory.map(e => e.response.timestamp))).toISOString() : null
      };
    }
    
    return {
      content: [{
        type: 'text',
        text: `Memory Statistics:\n\nGlobal Stats:\n${JSON.stringify(globalStats.customMetrics, null, 2)}\n\n${args.userId ? `User Stats (${args.userId}):\n${JSON.stringify(userStats, null, 2)}` : ''}`
      }]
    };
  });
  
  proxiedServer.tool('clear-user-memory', {
    userId: z.string().describe('User ID'),
    confirm: z.boolean().describe('Confirmation flag (must be true)')
  }, async (args) => {
    if (!args.confirm) {
      return {
        content: [{
          type: 'text',
          text: 'Memory clearing cancelled. Set confirm=true to proceed with deletion.'
        }]
      };
    }
    
    const cleared = chatMemoryPlugin.clearUserMemory(args.userId);
    
    return {
      content: [{
        type: 'text',
        text: `Cleared ${cleared} conversation entries for user ${args.userId}.`
      }]
    };
  });
  
  return proxiedServer;
}

// Simulation functions for realistic data generation

async function simulateResearchPaper(topic: string, depth: string): Promise<string> {
  const baseContent = `
Research Paper: ${topic.charAt(0).toUpperCase() + topic.slice(1)}

Abstract:
This paper presents a comprehensive analysis of ${topic}, examining current state-of-the-art approaches, challenges, and future directions. Through systematic review and empirical analysis, we provide insights into practical applications and theoretical foundations.

Introduction:
The field of ${topic} has gained significant attention due to its potential impact on various domains. This research addresses key questions and provides evidence-based recommendations for practitioners and researchers.

Methodology:
We employed a mixed-methods approach combining literature review, experimental validation, and case study analysis. Data was collected from multiple sources and analyzed using established statistical methods.

Results:
Our analysis reveals several key findings regarding ${topic}. Performance metrics demonstrate significant improvements over baseline approaches, with statistical significance (p < 0.05) across all evaluated dimensions.

Discussion:
The results suggest that current approaches to ${topic} can be enhanced through targeted improvements in methodology and implementation. Implications for practice include better resource allocation and strategic planning.

Conclusion:
This research contributes to the understanding of ${topic} by providing empirical evidence and practical recommendations. Future work should focus on scalability and real-world deployment considerations.`;

  // Extend content based on depth
  if (depth === 'comprehensive') {
    return baseContent + `

Literature Review:
Extensive analysis of 200+ papers reveals emerging trends and research gaps. Key themes include theoretical foundations, practical applications, and technological innovations.

Detailed Analysis:
Comprehensive statistical analysis using multiple regression, factor analysis, and machine learning techniques. Effect sizes range from medium to large (Cohen's d > 0.5).

Case Studies:
Three detailed case studies demonstrate practical application in real-world scenarios. Success metrics include 40% improvement in efficiency and 60% reduction in costs.

Technical Implementation:
Detailed technical specifications and implementation guidelines for practitioners. Includes code examples, configuration parameters, and performance optimization strategies.

Future Research Directions:
Identified 15 specific areas for future investigation, including cross-domain applications, scalability challenges, and integration with emerging technologies.`;
  } else if (depth === 'detailed') {
    return baseContent + `

Key Findings:
1. Significant performance improvements across all metrics
2. Strong correlation between implementation quality and outcomes
3. Cost-benefit analysis shows positive ROI within 12 months

Practical Implications:
Organizations implementing these approaches report improved efficiency and user satisfaction. Best practices include phased deployment and continuous monitoring.`;
  }
  
  return baseContent;
}

async function simulateMarketAnalysis(industry: string, region: string): Promise<string> {
  return `
Market Analysis: ${industry.charAt(0).toUpperCase() + industry.slice(1)} Industry (${region})

Executive Summary:
The ${industry} market in ${region} demonstrates strong growth potential with emerging opportunities in digital transformation and technological innovation. Market dynamics favor companies with strong technological capabilities and customer-centric approaches.

Market Size and Growth:
Current market valuation: $45.2B (2024)
Projected CAGR: 12.3% (2024-2029)
${region} market share: 34% of global market
Key growth drivers: technological adoption, regulatory support, changing consumer preferences

Competitive Landscape:
- Market Leader A: 28% market share, strong in innovation
- Market Leader B: 22% market share, cost leadership strategy
- Emerging Players: 15% combined share, focus on niche markets
- Market concentration: Moderate (HHI: 1,850)

Technology Trends:
1. AI and automation adoption accelerating (67% of companies investing)
2. Cloud-first strategies driving operational efficiency
3. Data analytics becoming core competency
4. Sustainability initiatives creating new market segments

Customer Behavior Analysis:
- 73% of customers prioritize technology features
- Price sensitivity moderate in premium segments
- Brand loyalty increasing in B2B segments
- Digital channels capturing 45% of customer interactions

Investment and Funding:
Total venture capital investment: $8.2B (2024 YTD)
Average deal size: $12.5M
Key investment areas: AI/ML, sustainability, customer experience
Government funding: $2.1B in research grants and incentives

Regulatory Environment:
Supportive regulatory framework with clear guidelines
New regulations expected in Q3 2025 (data privacy focus)
Compliance costs estimated at 2-3% of revenue
International trade policies remain favorable

Risk Assessment:
Primary risks: technological disruption (high), economic volatility (medium), regulatory changes (low)
Mitigation strategies: diversification, strategic partnerships, continuous innovation
Market resilience: Strong fundamentals support continued growth

Opportunities:
1. Emerging market expansion (35% growth potential)
2. Technology integration services (new revenue streams)
3. Sustainability solutions (regulatory driver)
4. Strategic acquisitions (market consolidation)

Recommendations:
- Invest in AI and automation capabilities
- Expand customer experience initiatives
- Consider strategic partnerships in emerging markets
- Develop sustainability-focused products/services
- Strengthen data analytics capabilities`;
}

async function simulateDataAnalysis(dataset: string, analysisType: string): Promise<string> {
  return `
Data Analysis Report: ${dataset}
Analysis Type: ${analysisType.charAt(0).toUpperCase() + analysisType.slice(1)}

Dataset Overview:
Dataset: ${dataset}
Records: 125,000
Variables: 42
Time Period: January 2023 - December 2024
Data Quality: 96.8% complete, 0.3% outliers

Statistical Summary:
${analysisType === 'statistical' ? `
Descriptive Statistics:
- Mean response rate: 23.7% (±4.2%)
- Median conversion: 18.3%
- Standard deviation: 12.8%
- Distribution: Normal with slight right skew

Correlation Analysis:
- Strong positive correlation between engagement and conversion (r=0.78)
- Moderate correlation between demographics and preferences (r=0.54)
- Weak correlation between time factors and outcomes (r=0.23)

Hypothesis Testing:
H1: Treatment effect > Control (CONFIRMED, p<0.001)
H2: Seasonal variation exists (CONFIRMED, p<0.01)
H3: Geographic differences significant (PARTIALLY CONFIRMED, p<0.05)

Statistical Significance:
- Primary metric: 15.3% improvement (95% CI: 12.1%-18.5%)
- Secondary metrics: 8.7% improvement (95% CI: 5.2%-12.2%)
- Overall effect size: Large (Cohen's d = 0.84)` : ''}

${analysisType === 'predictive' ? `
Predictive Model Results:
Algorithm: Random Forest with XGBoost ensemble
Training Accuracy: 89.2%
Validation Accuracy: 86.7%
Test Accuracy: 85.9%

Feature Importance:
1. Customer_engagement_score: 32.1%
2. Historical_purchase_value: 18.7%
3. Geographic_region: 14.3%
4. Seasonal_factors: 12.9%
5. Demographic_profile: 11.2%

Predictions:
- Q1 2025: 12.8% growth in primary metric
- Q2 2025: 15.3% growth (seasonal peak)
- Q3 2025: 9.1% growth (seasonal adjustment)
- Annual projection: 25.4% cumulative growth

Model Performance:
- Precision: 87.3%
- Recall: 84.6%
- F1-Score: 85.9%
- AUC-ROC: 0.913` : ''}

${analysisType === 'exploratory' ? `
Exploratory Data Analysis:
Pattern Discovery:
- Identified 4 distinct customer segments with unique behaviors
- Seasonal patterns with 23% variance between peak and trough
- Geographic clusters showing similar response patterns
- Unexpected correlation between product categories

Anomaly Detection:
- 0.7% of records flagged as anomalous
- Most anomalies occur during holiday periods
- Geographic anomalies concentrated in 3 regions
- Temporal anomalies suggest data collection issues

Clustering Analysis:
Cluster 1 (35%): High-value, low-frequency customers
Cluster 2 (28%): Medium-value, high-frequency customers
Cluster 3 (22%): Low-value, medium-frequency customers
Cluster 4 (15%): High-value, high-frequency customers (premium segment)

Trend Analysis:
- Overall upward trend with 8.3% monthly growth
- Accelerating growth in digital channels (45% increase)
- Declining performance in traditional channels (-12% decrease)
- Mobile engagement growing 67% year-over-year` : ''}

Key Insights:
1. Customer engagement strongly predicts business outcomes
2. Geographic factors play significant role in performance
3. Seasonal adjustments needed for accurate forecasting
4. Digital transformation yielding measurable benefits

Recommendations:
1. Focus investment on high-engagement customer segments
2. Develop region-specific strategies for underperforming areas
3. Implement real-time analytics for immediate optimization
4. Expand digital capabilities to capture growing market share

Data Quality Notes:
- Missing data primarily in optional fields (3.2%)
- Outliers concentrated in holiday periods (expected pattern)
- No systematic biases detected in data collection
- Recommend enhanced validation for future data collection

Technical Details:
Analysis performed using Python (pandas, scikit-learn, statsmodels)
Computing environment: 32-core cluster with 256GB RAM
Processing time: 3.2 hours for complete analysis
All results validated through bootstrap sampling (n=1000)`;
}

async function simulateCompetitiveIntelligence(company: string, scope: string): Promise<string> {
  return `
Competitive Intelligence Report: ${company}
Scope: ${scope.charAt(0).toUpperCase() + scope.slice(1)} Analysis

Company Overview:
Target: ${company}
Industry Position: Major player with significant market influence
Founded: Established market presence for 15+ years
Geography: Global operations with strong regional presence

${scope === 'overview' ? `
Business Model:
- Primary revenue: Product sales (65%), Services (25%), Licensing (10%)
- Customer base: 2.3M active customers across B2B and B2C segments
- Distribution: Direct sales (40%), Partners (35%), Online (25%)
- Key differentiators: Technology innovation, customer service excellence

Market Position:
- Market rank: #3 in primary market segment
- Market share: 18.3% (growing from 15.7% in 2023)
- Geographic strength: North America (strong), Europe (moderate), Asia-Pacific (emerging)
- Brand recognition: 78% aided awareness in target segments

Strategic Focus:
- Innovation investment: 12% of revenue in R&D
- Market expansion: Targeting emerging markets and adjacent segments
- Technology leadership: AI and automation integration across products
- Sustainability: Carbon neutral by 2030 commitment` : ''}

${scope === 'financial' ? `
Financial Performance (2024):
Revenue: $3.8B (+12% YoY)
Gross Margin: 68.3% (industry average: 62.1%)
EBITDA: $890M (23.4% margin)
Net Income: $612M (+18% YoY)
Cash Position: $1.2B (strong liquidity)

Revenue Breakdown:
- Core Products: $2.47B (65%)
- Professional Services: $0.95B (25%)
- Licensing & Royalties: $0.38B (10%)

Profitability Analysis:
- High-margin products driving growth
- Services margin improving (18% → 22%)
- Cost optimization initiatives yielding results
- R&D efficiency improving (ROI up 23%)

Financial Health:
- Debt-to-Equity: 0.34 (conservative capital structure)
- Current Ratio: 2.1 (strong short-term liquidity)
- Return on Equity: 16.8% (above industry average)
- Free Cash Flow: $625M (strong cash generation)

Investment Activity:
- Capital expenditures: $180M (facility expansion, technology)
- Acquisitions: $250M (2 strategic acquisitions in 2024)
- Share repurchases: $150M (returning capital to shareholders)
- Dividend: $2.40/share (4.2% yield)` : ''}

${scope === 'strategic' ? `
Strategic Initiatives:
1. Digital Transformation: $200M investment in AI and automation
2. Market Expansion: Targeting 3 new geographic markets
3. Product Innovation: 5 major product launches planned for 2025
4. Sustainability: Green technology initiatives across product line

Competitive Advantages:
- Technology leadership in core areas
- Strong customer relationships and retention (94%)
- Efficient operations and supply chain
- Talented workforce with low turnover (8.3%)

Strategic Partnerships:
- Technology partnerships with 3 major cloud providers
- Distribution agreements in 12 new markets
- Research collaborations with 5 universities
- Joint ventures in emerging technology areas

Risk Factors:
- Technology disruption in core markets
- Increasing competitive pressure from new entrants
- Regulatory changes in key markets
- Supply chain dependencies

Competitive Response Patterns:
- Quick to respond to pricing pressures
- Heavy investment in technology advancement
- Focus on customer experience differentiation
- Strategic acquisitions to fill capability gaps

Growth Strategy:
- Organic growth through innovation (60% of growth)
- Market expansion (25% of growth)
- Strategic acquisitions (15% of growth)
- Target: 15-20% annual revenue growth` : ''}

SWOT Analysis:
Strengths: Technology leadership, strong financials, customer loyalty, operational efficiency
Weaknesses: Limited presence in emerging markets, dependency on core products, higher cost structure
Opportunities: AI integration, emerging markets, adjacent market expansion, strategic partnerships
Threats: New competitors, technology disruption, economic uncertainty, regulatory changes

Intelligence Sources:
- Public financial reports and SEC filings
- Industry analyst reports and market research
- Patent filings and technology publications
- Customer surveys and market feedback
- Executive interviews and conference presentations

Confidence Level: High (verified through multiple sources)
Last Updated: Current as of analysis date
Recommendation: Continue monitoring quarterly for strategic changes`;
}

// Main execution
async function main() {
  const server = await createChatMemoryEnabledServer();
  
  // Start server with stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  console.error('🧠 Research Assistant with Chat Memory started!');
  console.error('📋 Available tools:');
  console.error('');
  console.error('📊 Research & Analysis Tools (saved to memory):');
  console.error('  • research-paper - Get research papers on any topic');
  console.error('  • market-analysis - Get market analysis for industries');
  console.error('  • data-analysis - Analyze datasets with statistical methods');
  console.error('  • competitive-intelligence - Research competitors and markets');
  console.error('');
  console.error('💬 Chat & Memory Tools:');
  console.error('  • chat-with-memory - Chat with your saved research data');
  console.error('  • get-conversation-history - View your saved conversations');
  console.error('  • search-memory - Search through your saved data');
  console.error('  • get-memory-stats - View memory usage statistics');
  console.error('  • clear-user-memory - Clear all data for a user');
  console.error('');
  console.error('💡 Usage Tips:');
  console.error('  • Always include "userId" parameter to track your data');
  console.error('  • Use chat-with-memory to ask questions about your saved research');
  console.error('  • Search your memory using keywords from your research');
  console.error('  • Chat sessions persist - use sessionId to continue conversations');
}

// Run if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}

export { createChatMemoryEnabledServer };