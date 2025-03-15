---
layout: default
title: Quick Start Guide
---

# Quick Start Guide

Getting started with MCP Payment Wrapper is straightforward. Follow these simple steps to integrate payment functionality into your MCP server.

## Installation

Install the package using npm:

```bash
npm install @modelcontextprotocol/payment-wrapper
```

## Basic Usage

Here's a minimal example to get you up and running quickly:

```typescript
import { wrapWithPayments } from '@modelcontextprotocol/payment-wrapper';
import { YourMCPServer } from './your-mcp-server';

// Create your MCP server instance
const mcpServer = new YourMCPServer();

// Wrap it with payment functionality
const wrappedServer = wrapWithPayments(mcpServer, {
  // Your developer API key
  developerApiKey: 'your-api-key',
  
  // Optional: Configure billing settings
  billing: {
    enabled: true,
    defaultRate: 0.01, // Cost per call in your currency
  }
});

// Use the wrapped server exactly as you would use the original
// All calls will now include payment verification
const result = await wrappedServer.yourMethod({
  // Your method parameters
  input: 'Your input',
  
  // Include user authentication token
  userToken: 'user-jwt-token'
});
```

## Key Concepts

1. **Wrapping the Server**: The wrapper uses a JavaScript Proxy to intercept all method calls without modifying your original server.

2. **Authentication**: Each request requires either:
   - A user JWT token (`userToken` parameter)
   - A developer API key (for testing or non-user-specific operations)

3. **Billing**: Before executing the original method, the wrapper verifies the user has sufficient funds.

4. **Seamless Integration**: Your server's original functionality remains unchanged; the wrapper simply adds the payment layer.

## Next Steps

- See the [API Reference](/api/reference) for detailed documentation
- Learn about [Advanced Configuration](./advanced-configuration) options
- Check the [Examples](./examples) for common integration patterns
