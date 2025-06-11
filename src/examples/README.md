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

## 🧠 Chat Memory Plugin

A sophisticated plugin that saves tool responses to an in-memory database and allows the calling LLM to chat with saved results through an interpreter LLM.

### Features

- **Persistent Memory**: Automatically saves tool responses to in-memory database
- **AI Chat Interface**: Chat with your saved data using LLM-powered interpretation
- **User Isolation**: Separate memory spaces for different users
- **Session Management**: Persistent chat sessions with message history
- **Smart Search**: Find relevant data based on natural language queries
- **Memory Management**: Automatic cleanup with configurable limits
- **Multiple LLM Providers**: OpenAI and mock providers for testing
- **Statistics Tracking**: Monitor memory usage and chat activity

### Files

- `plugins/chat-memory.ts` - Main plugin implementation
- `plugins/__tests__/chat-memory.test.ts` - Unit tests
- `plugins/__tests__/chat-memory.integration.test.ts` - Integration tests
- `chat-memory-example.ts` - Complete usage example

### Quick Start

```typescript
import { wrapWithProxy } from '../proxy-wrapper.js';
import { ChatMemoryPlugin } from './plugins/chat-memory.js';

const plugin = new ChatMemoryPlugin();
plugin.config.options = {
  provider: 'openai', // or 'mock' for testing
  openaiApiKey: process.env.OPENAI_API_KEY,
  saveResponses: true,
  enableChat: true,
  maxEntries: 10000
};

const proxiedServer = await wrapWithProxy(server, {
  plugins: [plugin]
});
```

### Example Workflow

**Step 1: Generate Research Data**
```bash
# Research gets automatically saved to memory
echo '{"method":"tools/call","params":{"name":"research-paper","arguments":{"topic":"AI trends","userId":"researcher1"}}}' | node dist/examples/chat-memory-example.js
```

**Step 2: Chat with Your Data**
```bash
# Ask questions about your saved research
echo '{"method":"tools/call","params":{"name":"chat-with-memory","arguments":{"message":"What AI trends data do you have?","userId":"researcher1"}}}' | node dist/examples/chat-memory-example.js
```

**Step 3: Search and Analyze**
```bash
# Search through your saved data
echo '{"method":"tools/call","params":{"name":"search-memory","arguments":{"query":"machine learning","userId":"researcher1"}}}' | node dist/examples/chat-memory-example.js
```

### Configuration Options

```typescript
{
  provider: 'openai' | 'mock',
  openaiApiKey: string,
  model: 'gpt-4o-mini',
  saveResponses: true,
  enableChat: true,
  maxEntries: 10000,
  maxSessions: 1000,
  sessionTimeout: 7 * 24 * 60 * 60 * 1000, // 7 days
  excludeTools: ['chat-with-memory'], // Don't save these
  saveTools: [], // Empty = save all (except excluded)
}
```

### Available Tools

The example server provides these tools:

**Research Tools (saved to memory):**
- `research-paper` - Generate research papers on topics
- `market-analysis` - Industry and market analysis
- `data-analysis` - Statistical analysis of datasets  
- `competitive-intelligence` - Competitor research

**Chat Tools (not saved):**
- `chat-with-memory` - Chat with your saved data
- `get-conversation-history` - View saved conversations
- `search-memory` - Search through saved data
- `get-memory-stats` - Memory usage statistics
- `clear-user-memory` - Clear user's saved data

### Use Cases

1. **Research Assistant**: Save research papers, analyses, and reports, then chat to find insights
2. **Business Intelligence**: Store market analyses and competitive intelligence for strategic discussions
3. **Data Science**: Save analysis results and chat to explore patterns and findings
4. **Knowledge Management**: Build a personal knowledge base with AI-powered retrieval
5. **Project Memory**: Keep track of project data and findings across multiple sessions

### Testing

```bash
# Run unit tests
npm test -- --testPathPattern="chat-memory.test"

# Run integration tests  
npm test -- --testPathPattern="chat-memory.integration"

# Run all chat memory tests
npm test -- --testPathPattern="chat-memory"
```

### Architecture

The plugin creates two main data structures:

1. **Conversation Database**: Stores tool responses with metadata
   - Tool name, arguments, and results
   - User and session context
   - Timestamps and searchable content

2. **Chat Sessions**: Manages ongoing conversations
   - User messages and AI responses
   - Session persistence across calls
   - Context-aware response generation

The AI interpreter analyzes saved data to provide contextual responses to user questions, enabling natural language interaction with structured data.

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