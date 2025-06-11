# LLM Summarization Plugin Example

## Overview

This plugin demonstrates how to intercept tool results, save them for analysis, and return AI-generated summaries instead of raw results. Perfect for:

- **Long document processing**: Summarize large research results
- **Data analysis**: Convert complex data into digestible insights  
- **User experience**: Provide concise answers instead of overwhelming details
- **Cost optimization**: Return summaries for expensive API calls while caching full results

## Implementation

```typescript
import OpenAI from 'openai';
import { BasePlugin, PluginContext } from '../interfaces/plugin.js';
import { ToolCallResult } from '../interfaces/proxy-hooks.js';

class LLMSummarizationPlugin extends BasePlugin {
  name = 'llm-summarization-plugin';
  version = '1.0.0';
  
  metadata = {
    description: 'Intercepts tool results and returns AI-generated summaries',
    author: 'MCP Team',
    tags: ['ai', 'summarization', 'llm']
  };
  
  config = {
    enabled: true,
    priority: 10, // Run after other plugins
    options: {
      openaiApiKey: process.env.OPENAI_API_KEY,
      model: 'gpt-4o-mini', // Cost-effective for summarization
      maxTokens: 150,
      temperature: 0.3,
      summarizeTools: ['search', 'research', 'analyze', 'fetch-data'],
      minContentLength: 500, // Only summarize long content
      saveOriginal: true, // Save full results for later access
      summarizationPrompt: `Please provide a concise summary of the following content. 
Focus on the key insights, main findings, and actionable information. 
Keep it under 150 words and make it easy to understand:`
    }
  };
  
  private openai: OpenAI;
  private storage: Map<string, StoredResult> = new Map();
  
  async initialize(context: any): Promise<void> {
    await super.initialize(context);
    
    this.openai = new OpenAI({
      apiKey: this.config.options?.openaiApiKey
    });
    
    this.logger?.info('LLM Summarization plugin initialized');
  }
  
  async afterToolCall(context: PluginContext, result: ToolCallResult): Promise<ToolCallResult> {
    // Check if this tool should be summarized
    if (!this.shouldSummarize(context, result)) {
      return result;
    }
    
    try {
      const originalContent = this.extractContent(result);
      
      // Save original result with metadata
      const storageKey = this.generateStorageKey(context);
      if (this.config.options?.saveOriginal) {
        await this.saveOriginalResult(storageKey, {
          originalResult: result,
          context: context,
          timestamp: Date.now(),
          toolName: context.toolName,
          requestId: context.requestId
        });
      }
      
      // Generate summary using LLM
      const summary = await this.generateSummary(originalContent, context);
      
      // Create summarized result
      const summarizedResult: ToolCallResult = {
        result: {
          content: [{
            type: 'text',
            text: summary
          }],
          _metadata: {
            ...result.result._metadata,
            summarized: true,
            originalLength: originalContent.length,
            summaryLength: summary.length,
            compressionRatio: (summary.length / originalContent.length).toFixed(2),
            originalStorageKey: storageKey,
            summarizedAt: new Date().toISOString(),
            model: this.config.options?.model
          }
        }
      };
      
      this.logger?.info(`Summarized ${context.toolName} result`, {
        originalLength: originalContent.length,
        summaryLength: summary.length,
        compressionRatio: summary.length / originalContent.length
      });
      
      return summarizedResult;
      
    } catch (error) {
      this.logger?.error(`Failed to summarize result for ${context.toolName}:`, error);
      
      // Return original result if summarization fails
      return {
        ...result,
        result: {
          ...result.result,
          _metadata: {
            ...result.result._metadata,
            summarizationError: error.message,
            fallbackToOriginal: true
          }
        }
      };
    }
  }
  
  private shouldSummarize(context: PluginContext, result: ToolCallResult): boolean {
    // Don't summarize errors
    if (result.result.isError) {
      return false;
    }
    
    // Check if tool is in summarization list
    const summarizeTools = this.config.options?.summarizeTools || [];
    if (summarizeTools.length > 0 && !summarizeTools.includes(context.toolName)) {
      return false;
    }
    
    // Check content length threshold
    const content = this.extractContent(result);
    const minLength = this.config.options?.minContentLength || 500;
    if (content.length < minLength) {
      return false;
    }
    
    // Check if user requested original (bypass summarization)
    if (context.args.returnOriginal || context.args.noSummary) {
      return false;
    }
    
    return true;
  }
  
  private extractContent(result: ToolCallResult): string {
    if (!result.result.content) return '';
    
    return result.result.content
      .filter(item => item.type === 'text')
      .map(item => item.text)
      .join('\n');
  }
  
  private async generateSummary(content: string, context: PluginContext): Promise<string> {
    const prompt = this.config.options?.summarizationPrompt || 'Summarize the following content:';
    
    // Customize prompt based on tool type
    const contextualPrompt = this.getContextualPrompt(context.toolName, prompt);
    
    const response = await this.openai.chat.completions.create({
      model: this.config.options?.model || 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: contextualPrompt
        },
        {
          role: 'user',
          content: content
        }
      ],
      max_tokens: this.config.options?.maxTokens || 150,
      temperature: this.config.options?.temperature || 0.3
    });
    
    return response.choices[0]?.message?.content || 'Summary generation failed';
  }
  
  private getContextualPrompt(toolName: string, basePrompt: string): string {
    const toolPrompts = {
      'search': 'Summarize these search results, highlighting the most relevant findings and key insights:',
      'research': 'Provide a research summary focusing on methodology, key findings, and implications:',
      'analyze': 'Summarize this analysis, emphasizing conclusions and actionable recommendations:',
      'fetch-data': 'Summarize this data, highlighting trends, patterns, and notable points:'
    };
    
    return toolPrompts[toolName] || basePrompt;
  }
  
  private generateStorageKey(context: PluginContext): string {
    return `${context.toolName}_${context.requestId}_${Date.now()}`;
  }
  
  private async saveOriginalResult(key: string, data: StoredResult): Promise<void> {
    // In production, this could be Redis, MongoDB, S3, etc.
    this.storage.set(key, data);
    
    // Optional: Implement cleanup for old results
    this.cleanupOldResults();
  }
  
  private cleanupOldResults(): void {
    const maxAge = 24 * 60 * 60 * 1000; // 24 hours
    const now = Date.now();
    
    for (const [key, data] of this.storage.entries()) {
      if (now - data.timestamp > maxAge) {
        this.storage.delete(key);
      }
    }
  }
  
  // Public method to retrieve original results
  async getOriginalResult(storageKey: string): Promise<StoredResult | null> {
    return this.storage.get(storageKey) || null;
  }
  
  async getStats() {
    const baseStats = await super.getStats();
    
    return {
      ...baseStats,
      customMetrics: {
        totalSummarizations: this.storage.size,
        averageCompressionRatio: this.calculateAverageCompression(),
        storedResults: this.storage.size,
        oldestStoredResult: this.getOldestResultAge()
      }
    };
  }
  
  private calculateAverageCompression(): number {
    const results = Array.from(this.storage.values());
    if (results.length === 0) return 0;
    
    // This would need to be calculated during summarization
    // For demo purposes, returning estimated value
    return 0.15; // 15% of original size on average
  }
  
  private getOldestResultAge(): number {
    const timestamps = Array.from(this.storage.values()).map(r => r.timestamp);
    if (timestamps.length === 0) return 0;
    
    const oldest = Math.min(...timestamps);
    return Date.now() - oldest;
  }
}

interface StoredResult {
  originalResult: ToolCallResult;
  context: PluginContext;
  timestamp: number;
  toolName: string;
  requestId: string;
}

export { LLMSummarizationPlugin };
```

## Usage Examples

### **Basic Setup**
```typescript
import { wrapWithProxy } from 'mcp-proxy-wrapper';
import { LLMSummarizationPlugin } from './plugins/llm-summarization';

const summarizationPlugin = new LLMSummarizationPlugin();

const proxiedServer = await wrapWithProxy(server, {
  plugins: [summarizationPlugin],
  pluginConfig: {
    defaultTimeout: 15000 // LLM calls can take longer
  }
});

// Register a research tool
proxiedServer.tool('research', { topic: z.string() }, async (args) => {
  // This would return a long research document
  const research = await conductResearch(args.topic);
  return {
    content: [{ 
      type: 'text', 
      text: research // Long content that will be summarized
    }]
  };
});
```

### **Advanced Configuration**
```typescript
const summarizationPlugin = new LLMSummarizationPlugin();
summarizationPlugin.config = {
  ...summarizationPlugin.config,
  options: {
    openaiApiKey: process.env.OPENAI_API_KEY,
    model: 'gpt-4o-mini',
    maxTokens: 200,
    temperature: 0.2,
    summarizeTools: ['research', 'analyze-data', 'fetch-report'],
    minContentLength: 1000,
    saveOriginal: true,
    summarizationPrompt: `Create a professional executive summary of the following content. 
    Include: key findings, recommendations, and next steps. Format as bullet points when appropriate:`
  }
};
```

## Example Tool Call Flow

**1. Original Tool Response (Long)**
```json
{
  "content": [{
    "type": "text",
    "text": "Market Research Report: The fintech industry has shown remarkable growth... [3000 words of detailed analysis]"
  }]
}
```

**2. Summarized Response**
```json
{
  "content": [{
    "type": "text",
    "text": "Executive Summary: The fintech industry shows 23% YoY growth driven by digital payments and blockchain adoption. Key opportunities include SMB lending and crypto infrastructure. Recommend focusing on regulatory compliance and strategic partnerships for market entry."
  }],
  "_metadata": {
    "summarized": true,
    "originalLength": 15420,
    "summaryLength": 287,
    "compressionRatio": "0.02",
    "originalStorageKey": "research_abc123_1703123456789",
    "model": "gpt-4o-mini"
  }
}
```

## Advanced Features

### **Conditional Summarization**
```typescript
// User can request original data
await client.callTool({
  name: 'research',
  arguments: { 
    topic: 'AI trends',
    returnOriginal: true  // Bypass summarization
  }
});
```

### **Multiple Summary Types**
```typescript
class MultiModeSummarizationPlugin extends LLMSummarizationPlugin {
  async generateSummary(content: string, context: PluginContext): Promise<string> {
    const summaryType = context.args.summaryType || 'executive';
    
    const prompts = {
      'executive': 'Create an executive summary for leadership',
      'technical': 'Create a technical summary for engineers',
      'bullet': 'Create a bullet-point summary',
      'tweet': 'Summarize in tweet format (280 chars)'
    };
    
    // Use appropriate prompt
    return super.generateSummary(content, { 
      ...context, 
      customPrompt: prompts[summaryType] 
    });
  }
}
```

### **Original Data Retrieval**
```typescript
// Plugin exposes method to get original data
const originalData = await summarizationPlugin.getOriginalResult(storageKey);
```

## Benefits

- **🎯 Better UX**: Users get concise, actionable information
- **💰 Cost Savings**: Reduce token usage in downstream processing  
- **⚡ Performance**: Faster response times with smaller payloads
- **🧠 Intelligence**: AI-powered insights instead of raw data
- **📚 Knowledge Management**: Store and retrieve full results when needed
- **🔍 Searchability**: Summaries are easier to search and index

This plugin transforms any verbose tool into an intelligent, AI-powered interface that provides exactly the right level of detail for each use case!