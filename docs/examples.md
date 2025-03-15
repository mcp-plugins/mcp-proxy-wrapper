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
  apiKey: 'YOUR_API_KEY'
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
  description: "An AI assistant with payment functionality"
});

// Define your tools
server.tool("get_weather", {
  location: z.string(),
  units: z.enum(["celsius", "fahrenheit"]).default("celsius")
}, async (args) => {
  // In a real implementation, you would call a weather API
  return {
    temperature: 22,
    units: args.units,
    conditions: "Sunny",
    location: args.location
  };
});

server.tool("search_web", {
  query: z.string(),
  max_results: z.number().default(5)
}, async (args) => {
  // In a real implementation, you would call a search API
  return {
    results: [
      { title: "Example Result 1", url: "https://example.com/1" },
      { title: "Example Result 2", url: "https://example.com/2" }
    ],
    query: args.query
  };
});

// Wrap with payment functionality
const paymentServer = wrapWithPayments(server, { 
  apiKey: 'YOUR_API_KEY',
  debugMode: true
});

// Create a transport
const transport = new StdioServerTransport();

// Start the server
paymentServer.listen(transport);
```

## Authentication Flow Example

This example demonstrates a complete authentication flow:

```typescript
import { McpClient } from '@modelcontextprotocol/sdk/client/mcp.js';

// Create an MCP client
const client = new McpClient({
  serverUrl: 'https://your-mcp-server.com'
});

// Step 1: Initiate authentication
async function startAuthentication() {
  const authResult = await client.callTool("payment_authenticate", {
    return_url: "https://your-app.com/auth-callback"
  });
  
  const sessionId = authResult._meta.session_id;
  const authUrl = authResult.content[1].text;
  
  console.log(`Please authenticate at: ${authUrl}`);
  
  // Store the session ID for later use
  localStorage.setItem('auth_session_id', sessionId);
  
  // Open the auth URL in a new window or redirect the user
  window.open(authUrl, '_blank');
  
  // Start polling for auth status
  pollAuthStatus(sessionId);
}

// Step 2: Poll for authentication status
async function pollAuthStatus(sessionId) {
  const pollInterval = setInterval(async () => {
    try {
      const statusResult = await client.callTool("payment_check_auth_status", {
        session_id: sessionId
      });
      
      if (statusResult.status === "complete") {
        clearInterval(pollInterval);
        
        // Store the user token
        localStorage.setItem('user_token', statusResult.user_token);
        
        // Create a new authenticated client
        createAuthenticatedClient(statusResult.user_token);
        
        console.log("Authentication successful!");
      } else if (statusResult.status === "failed") {
        clearInterval(pollInterval);
        console.log("Authentication failed:", statusResult.error);
      }
    } catch (error) {
      clearInterval(pollInterval);
      console.error("Error checking auth status:", error);
    }
  }, 3000); // Check every 3 seconds
}

// Step 3: Create an authenticated client
function createAuthenticatedClient(userToken) {
  const authenticatedClient = new McpClient({
    serverUrl: 'https://your-mcp-server.com',
    headers: {
      'Authorization': `Bearer ${userToken}`
    }
  });
  
  // Now you can make authenticated requests
  checkBalance(authenticatedClient);
}

// Step 4: Check user balance
async function checkBalance(authenticatedClient) {
  try {
    const balanceResult = await authenticatedClient.callTool("payment_get_balance", {});
    console.log(`Current balance: ${balanceResult.balance} ${balanceResult.currency}`);
  } catch (error) {
    console.error("Error checking balance:", error);
  }
}

// Start the authentication process
startAuthentication();
```

## Error Handling Example

This example shows how to handle different error scenarios:

```typescript
import { McpClient } from '@modelcontextprotocol/sdk/client/mcp.js';

// Create an MCP client
const client = new McpClient({
  serverUrl: 'https://your-mcp-server.com'
});

async function callProtectedTool() {
  try {
    const result = await client.callTool("premium_tool", {
      param: "value"
    });
    
    // If successful, process the result
    console.log("Tool call successful:", result);
    return result;
  } catch (error) {
    // Handle different error types
    if (error.error === "authentication_required") {
      console.log("Authentication required");
      console.log("Auth URL:", error.authUrl);
      
      // Start the authentication flow
      startAuthFlow(error.authUrl);
    } 
    else if (error.error === "insufficient_funds") {
      console.log("Insufficient funds");
      
      // Redirect to payment page
      redirectToPaymentPage();
    }
    else if (error.error === "insufficient_permissions") {
      console.log("Insufficient permissions:", error.message);
      
      // Show upgrade options
      showUpgradeOptions();
    }
    else {
      console.error("Unknown error:", error);
    }
  }
}

function startAuthFlow(authUrl) {
  // Implementation of authentication flow
  window.open(authUrl, '_blank');
}

function redirectToPaymentPage() {
  // Implementation of payment page redirect
  window.location.href = '/add-funds';
}

function showUpgradeOptions() {
  // Implementation of upgrade options UI
  document.getElementById('upgrade-modal').style.display = 'block';
}

// Call the protected tool
callProtectedTool();
```

## Testing Example

This example shows how to test code that uses the MCP Payment Wrapper:

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { wrapWithPayments } from '@modelcontextprotocol/payment-wrapper';
import { McpClient } from '@modelcontextprotocol/sdk/client/mcp.js';
import { HttpClientTransport } from '@modelcontextprotocol/sdk/client/http.js';
import { HttpServerTransport } from '@modelcontextprotocol/sdk/server/http.js';

// Test function
async function testPaymentWrapper() {
  // Create a basic MCP server
  const server = new McpServer({ 
    name: "Test Server",
    version: "1.0.0"
  });
  
  // Add a test tool
  server.tool("test_tool", { param: "string" }, async (args) => {
    return { result: `Processed ${args.param}` };
  });
  
  // Wrap with payment functionality and override funds check to always succeed
  const paymentServer = wrapWithPayments(server, { 
    apiKey: 'test-api-key',
    _testOverrideFundsCheck: true
  });
  
  // Create an HTTP transport for the server
  const serverTransport = new HttpServerTransport({
    port: 3000
  });
  
  // Start the server
  paymentServer.listen(serverTransport);
  
  // Create a client to test with
  const client = new McpClient({
    transport: new HttpClientTransport({
      baseUrl: 'http://localhost:3000'
    })
  });
  
  // Test calling the tool
  try {
    const result = await client.callTool("test_tool", { param: "test" });
    console.log("Test successful:", result);
  } catch (error) {
    console.error("Test failed:", error);
  }
  
  // Stop the server
  serverTransport.close();
}

// Run the test
testPaymentWrapper();
```

## Production Configuration Example

This example shows a production-ready configuration:

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { HttpServerTransport } from '@modelcontextprotocol/sdk/server/http.js';
import { wrapWithPayments } from '@modelcontextprotocol/payment-wrapper';
import * as winston from 'winston';

// Create your MCP server
const server = new McpServer({ 
  name: "Production API",
  version: "1.0.0"
});

// Define your tools, prompts, and resources
// ...

// Configure advanced logging
const loggerOptions = {
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          return `${timestamp} ${level}: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
        })
      )
    }),
    new winston.transports.File({ 
      filename: 'logs/payment-wrapper.log',
      maxsize: 10485760, // 10MB
      maxFiles: 5,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json()
      )
    })
  ]
};

// Wrap with payment functionality
const paymentServer = wrapWithPayments(server, { 
  apiKey: process.env.MCP_API_KEY,
  baseAuthUrl: process.env.AUTH_SERVICE_URL,
  loggerOptions
});

// Create an HTTP transport
const transport = new HttpServerTransport({
  port: process.env.PORT || 3000,
  host: '0.0.0.0'
});

// Start the server
paymentServer.listen(transport);

console.log(`Server running on port ${process.env.PORT || 3000}`);
```

These examples should help you get started with the MCP Payment Wrapper in various scenarios. For more detailed information, check out the [API Reference](api) section.
