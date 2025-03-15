---
layout: default
title: Examples
---

# MCP Payment Wrapper Examples

This page provides practical examples of how to use the MCP Payment Wrapper in different scenarios.

## Basic Integration

This example shows how to wrap an existing MCP server with payment functionality:

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { wrapWithPayments } from '@modelcontextprotocol/payment-wrapper';

// Create your MCP server
const server = new McpServer({ 
  name: "My MCP Server",
  version: "1.0.0"
});

// Define your tools, prompts, and resources
server.tool("echo", { message: "string" }, async (args) => {
  return { result: args.message };
});

// Wrap with payment functionality
const paymentServer = wrapWithPayments(server, { 
  developerApiKey: 'YOUR_API_KEY'
});

// The wrapped server can be used exactly like the original
// but now includes payment verification and billing
```

## Complete Server Example

This example shows a complete MCP server with payment functionality:

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { wrapWithPayments } from '@modelcontextprotocol/payment-wrapper';
import { z } from 'zod';

// Create your MCP server
const server = new McpServer({ 
  name: "AI Assistant",
  version: "1.0.0",
});

// Define your tools
server.tool(
  "search",
  {
    query: z.string().describe("Search query"),
  },
  async (args) => {
    // Implement search functionality
    return { results: [`Result for ${args.query}`] };
  }
);

// Wrap with payment functionality
const paymentServer = wrapWithPayments(server, {
  developerApiKey: process.env.API_KEY,
  billing: {
    enabled: true,
    defaultRate: 0.01, // $0.01 per call
  },
  logging: {
    level: 'info'
  }
});

// Start the server with stdio transport
new StdioServerTransport(paymentServer).start();
```

## Authentication Integration

This example shows how to integrate user authentication:

```typescript
import { wrapWithPayments } from '@modelcontextprotocol/payment-wrapper';
import { MyMcpServer } from './my-server.js';

// Create your MCP server
const server = new MyMcpServer();

// Wrap with payment functionality
const paymentServer = wrapWithPayments(server, {
  developerApiKey: 'YOUR_API_KEY',
  auth: {
    // Configure authentication
    verifyUserToken: async (token) => {
      // Custom verification logic
      // Return user ID if valid, null otherwise
      if (token === 'valid-token') {
        return { userId: 'user123', valid: true };
      }
      return { userId: null, valid: false };
    }
  }
});

// Example of calling a method with user token
const result = await paymentServer.yourMethod({
  // Your regular parameters
  param1: 'value1',
  
  // Add user token for authentication
  userToken: 'valid-token'
});
```

## Custom Pricing Strategy

This example shows how to implement a custom pricing strategy:

```typescript
import { wrapWithPayments } from '@modelcontextprotocol/payment-wrapper';
import { MyMcpServer } from './my-server.js';

// Define custom pricing strategy
const customPricingStrategy = {
  calculatePrice: (resourceType, resourceId, options) => {
    // Different pricing for different resource types
    switch (resourceType) {
      case 'completion':
        return { amount: 0.02, currency: 'USD' };
      case 'embedding':
        return { amount: 0.0001, currency: 'USD' };
      default:
        return { amount: 0.01, currency: 'USD' };
    }
  }
};

// Create and wrap your MCP server
const server = new MyMcpServer();
const paymentServer = wrapWithPayments(server, {
  developerApiKey: 'YOUR_API_KEY',
  billing: {
    enabled: true,
    pricingStrategy: customPricingStrategy
  }
});
```

## Error Handling

This example shows how to handle payment-related errors:

```typescript
import { wrapWithPayments } from '@modelcontextprotocol/payment-wrapper';
import { MyMcpServer } from './my-server.js';

// Create and wrap your MCP server
const server = new MyMcpServer();
const paymentServer = wrapWithPayments(server, {
  developerApiKey: 'YOUR_API_KEY'
});

// Example of handling payment errors
try {
  const result = await paymentServer.yourMethod({
    param1: 'value1',
    userToken: 'user-token'
  });
  console.log('Success:', result);
} catch (error) {
  if (error.code === 'PAYMENT_REQUIRED') {
    console.error('Payment required:', error.message);
    // Prompt user to add funds
  } else if (error.code === 'UNAUTHORIZED') {
    console.error('Authentication failed:', error.message);
    // Prompt user to log in again
  } else {
    console.error('Other error:', error);
  }
}
