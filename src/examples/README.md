# MCP Proxy Wrapper Plugin Examples

This directory contains working examples of plugins for the MCP Proxy Wrapper system, demonstrating real-world use cases and implementation patterns.

## 🧠 LLM Summarization Plugin

A comprehensive plugin that intercepts tool results and returns AI-generated summaries, perfect for handling long documents and research outputs.

### Features

- **Smart Summarization**: Automatically summarizes long tool responses using LLM
- **Original Data Storage**: Saves full content for later retrieval
- **Configurable Filtering**: Only summarizes specific tools or content above threshold
- **Multiple Providers**: Supports OpenAI and mock providers for testing
- **Statistics Tracking**: Monitors compression ratios and performance
- **Error Handling**: Graceful fallback to original content on failures

### Files

- `plugins/llm-summarization.ts` - Main plugin implementation
- `plugins/__tests__/llm-summarization.test.ts` - Unit tests
- `plugins/__tests__/llm-summarization.integration.test.ts` - Integration tests
- `llm-summarization-example.ts` - Complete usage example

### Quick Start

```typescript
import { wrapWithProxy } from '../proxy-wrapper.js';
import { LLMSummarizationPlugin } from './plugins/llm-summarization.js';

const plugin = new LLMSummarizationPlugin();
plugin.config.options = {
  provider: 'openai', // or 'mock' for testing
  openaiApiKey: process.env.OPENAI_API_KEY,
  summarizeTools: ['research', 'analyze-data'],
  minContentLength: 500
};

const proxiedServer = await wrapWithProxy(server, {
  plugins: [plugin]
});
```

### Example Tool Call

**Input (Long Research Document):**
```
Research Report: AI Market Analysis
[3000 words of detailed analysis...]
```

**Output (AI Summary):**
```
Summary: AI market shows 37% CAGR through 2030 driven by automation and cloud adoption. 
Key opportunities in healthcare AI and autonomous vehicles. 
Recommend focusing on regulatory compliance and strategic partnerships.

Metadata:
- Original length: 15,420 characters
- Summary length: 287 characters  
- Compression ratio: 0.02
- Storage key: research_abc123_1703123456789
```

### Configuration Options

```typescript
{
  provider: 'openai' | 'mock',
  openaiApiKey: string,
  model: 'gpt-4o-mini',
  maxTokens: 150,
  temperature: 0.3,
  summarizeTools: ['research', 'analyze'],
  minContentLength: 500,
  saveOriginal: true,
  summarizationPrompt: 'Custom prompt...'
}
```

### Use Cases

1. **Research Assistants**: Summarize academic papers and reports
2. **Data Analysis**: Convert complex analysis into executive summaries  
3. **Content Management**: Provide digestible summaries of long documents
4. **Cost Optimization**: Reduce token usage in downstream LLM processing
5. **User Experience**: Give users concise insights instead of overwhelming details

### Testing

```bash
# Run unit tests
npm test -- --testPathPattern="llm-summarization.test"

# Run integration tests  
npm test -- --testPathPattern="llm-summarization.integration"

# Run all plugin tests
npm test -- --testPathPattern="examples/plugins"
```

### Example Server

Run the complete example server:

```bash
# Set up environment
export OPENAI_API_KEY="your-api-key"
export NODE_ENV="production"

# Run the example
npm run build
node dist/examples/llm-summarization-example.js
```

The example server provides several tools that demonstrate summarization:

- `research-paper` - Returns research papers (auto-summarized)
- `market-analysis` - Returns market analysis (auto-summarized)  
- `data-report` - Returns data reports (auto-summarized)
- `get-original-content` - Retrieves full original content by storage key
- `summarization-stats` - Shows plugin performance statistics

### Client Usage

```bash
# Get a research paper (will be summarized)
echo '{"method":"tools/call","params":{"name":"research-paper","arguments":{"topic":"artificial intelligence","depth":"comprehensive"}}}' | node dist/examples/llm-summarization-example.js

# Get original content using storage key from summary metadata
echo '{"method":"tools/call","params":{"name":"get-original-content","arguments":{"storageKey":"research_abc123_1703123456789"}}}' | node dist/examples/llm-summarization-example.js

# Bypass summarization
echo '{"method":"tools/call","params":{"name":"research-paper","arguments":{"topic":"AI","returnOriginal":true}}}' | node dist/examples/llm-summarization-example.js
```

## Adding More Examples

To add new plugin examples:

1. Create plugin in `plugins/` directory
2. Add comprehensive tests in `plugins/__tests__/`
3. Create usage example in this directory
4. Update this README with documentation
5. Follow the established patterns for configuration and error handling

## Testing Framework

All examples use the same testing approach:

- **Unit Tests**: Test plugin logic in isolation
- **Integration Tests**: Test with real MCP client-server communication
- **Mock Providers**: Enable testing without external dependencies
- **Error Scenarios**: Test failure modes and recovery

This ensures robust, production-ready plugins that work reliably in real-world scenarios.