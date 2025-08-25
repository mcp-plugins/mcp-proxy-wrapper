# OpenAI Integration Guide

The MCP Proxy Wrapper includes a powerful LLM Summarization Plugin that can use OpenAI's GPT models to automatically summarize long tool responses.

## Quick Start

### 1. Install Dependencies

The OpenAI SDK is included as a dependency:

```bash
npm install mcp-proxy-wrapper
# OpenAI SDK is automatically included
```

### 2. Set Up Your API Key

Set your OpenAI API key as an environment variable:

```bash
export OPENAI_API_KEY="sk-your-api-key-here"
```

### 3. Configure the Plugin

```typescript
import { wrapWithProxy, LLMSummarizationPlugin } from 'mcp-proxy-wrapper';

// Create and configure the plugin
const summarizationPlugin = new LLMSummarizationPlugin();
summarizationPlugin.updateConfig({
  enabled: true,
  options: {
    provider: 'openai',
    openaiApiKey: process.env.OPENAI_API_KEY,
    model: 'gpt-4o-mini', // Cost-effective model
    maxTokens: 200,
    temperature: 0.3,
    minContentLength: 500,
    summarizeTools: ['research', 'analyze', 'fetch-data'],
    saveOriginal: true
  }
});

// Wrap your server
const enhancedServer = await wrapWithProxy(server, {
  plugins: [summarizationPlugin]
});
```

## Configuration Options

### OpenAI Provider Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `provider` | `'openai' \| 'mock'` | `'mock'` | Use 'openai' for real API calls |
| `openaiApiKey` | `string` | `process.env.OPENAI_API_KEY` | Your OpenAI API key |
| `model` | `string` | `'gpt-4o-mini'` | OpenAI model to use |
| `maxTokens` | `number` | `150` | Maximum tokens in summary |
| `temperature` | `number` | `0.3` | Creativity level (0-1) |

### Plugin Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `minContentLength` | `number` | `500` | Minimum content length to summarize |
| `summarizeTools` | `string[]` | `['research', 'analyze', 'fetch-data']` | Tools to summarize |
| `saveOriginal` | `boolean` | `true` | Save original content for retrieval |
| `summarizationPrompt` | `string` | Default prompt | Custom prompt for summarization |

## Advanced Usage

### Custom Summarization Prompt

```typescript
summarizationPlugin.updateConfig({
  options: {
    summarizationPrompt: `Create a bullet-point executive summary focusing on:
    - Key findings and insights
    - Actionable recommendations
    - Important metrics and data points
    - Risk factors and considerations
    
    Content to summarize:`
  }
});
```

### Tool-Specific Configuration

```typescript
// Only summarize specific tools
summarizationPlugin.updateConfig({
  options: {
    summarizeTools: ['research', 'data-analysis'],
    minContentLength: 1000 // Higher threshold for these tools
  }
});
```

### Retrieving Original Content

```typescript
// After a tool call with summarization
const result = await client.callTool({
  name: 'research',
  arguments: { topic: 'AI trends' }
});

if (result._meta?.summarized) {
  console.log('Summary:', result.content[0].text);
  
  // Retrieve original content
  const originalKey = result._meta.originalStorageKey;
  const original = await summarizationPlugin.getOriginalResult(originalKey);
  console.log('Original:', original?.originalResult.result.content[0].text);
}
```

## Error Handling

The plugin includes robust error handling:

### Automatic Fallback

If the OpenAI API is unavailable, the plugin automatically falls back to returning the original content:

```typescript
// Plugin will log the error and return original content
console.log('OpenAI API error: Rate limit exceeded');
console.log('Returning original content...');
```

### API Key Validation

```typescript
try {
  const plugin = new LLMSummarizationPlugin();
  plugin.updateConfig({
    options: {
      provider: 'openai',
      openaiApiKey: undefined // This will cause an error
    }
  });
} catch (error) {
  console.error('OpenAI API key not provided');
}
```

## Cost Optimization

### Model Selection

Choose the right model for your needs:

- `gpt-4o-mini`: Most cost-effective, good for basic summaries
- `gpt-4o`: Higher quality, more expensive
- `gpt-3.5-turbo`: Good balance of cost and quality

### Token Management

```typescript
summarizationPlugin.updateConfig({
  options: {
    maxTokens: 100, // Shorter summaries = lower cost
    minContentLength: 1000, // Only summarize longer content
    summarizeTools: ['research'] // Limit to specific tools
  }
});
```

### Monitoring Usage

```typescript
// Check plugin statistics
const stats = await summarizationPlugin.getStats();
console.log('Total summarizations:', stats.customMetrics?.totalSummarizations);
console.log('Characters saved:', stats.customMetrics?.totalSavings);
console.log('Average compression:', stats.customMetrics?.averageCompressionRatio);
```

## Production Deployment

### Environment Variables

```bash
# .env file
OPENAI_API_KEY=sk-your-api-key-here
OPENAI_MODEL=gpt-4o-mini
OPENAI_MAX_TOKENS=200
```

### Configuration

```typescript
const summarizationPlugin = new LLMSummarizationPlugin();
summarizationPlugin.updateConfig({
  enabled: process.env.NODE_ENV === 'production',
  options: {
    provider: 'openai',
    openaiApiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    maxTokens: parseInt(process.env.OPENAI_MAX_TOKENS || '150'),
    // Enable health checks in production
    enableHealthChecks: true
  }
});
```

### Monitoring and Logging

```typescript
const enhancedServer = await wrapWithProxy(server, {
  plugins: [summarizationPlugin],
  hooks: {
    afterToolCall: async (context, result) => {
      if (result.result._meta?.summarized) {
        // Log summarization metrics
        console.log({
          tool: context.toolName,
          originalLength: result.result._meta.originalLength,
          summaryLength: result.result._meta.summaryLength,
          compressionRatio: result.result._meta.compressionRatio,
          processingTime: result.result._meta.processingTimeMs
        });
      }
      return result;
    }
  }
});
```

## Troubleshooting

### Common Issues

1. **"OpenAI API key not provided"**
   - Set the `OPENAI_API_KEY` environment variable
   - Verify the API key is valid and active

2. **"OpenAI package not available"**
   - Run `npm install openai`
   - Ensure the package is in your dependencies

3. **Rate limit errors**
   - Check your OpenAI usage limits
   - Implement exponential backoff (automatic in the plugin)

4. **Large token usage**
   - Reduce `maxTokens` setting
   - Increase `minContentLength` to summarize less content
   - Use a more cost-effective model

### Debug Mode

Enable debug logging to troubleshoot issues:

```typescript
const enhancedServer = await wrapWithProxy(server, {
  plugins: [summarizationPlugin],
  debug: true // Enable detailed logging
});
```

### Testing Without API Calls

For testing, use the mock provider:

```typescript
summarizationPlugin.updateConfig({
  options: {
    provider: 'mock', // No API calls, fast mock responses
    mockDelay: 10 // Simulate API delay
  }
});
```

## Example Projects

See the complete working example:
- [`examples/openai-integration-example.ts`](../examples/openai-integration-example.ts)

## Support

For issues or questions:
- Check the [troubleshooting section](#troubleshooting)
- Review [OpenAI API documentation](https://platform.openai.com/docs)
- File an issue on [GitHub](https://github.com/mcp-plugins/mcp-proxy-wrapper/issues)