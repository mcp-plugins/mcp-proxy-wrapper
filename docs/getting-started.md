---
layout: default
title: Getting Started
---

# Getting Started with MCP Proxy Wrapper

This guide will help you get started with integrating the MCP Proxy Wrapper into your project.

## Installation

Install the package using npm:

```bash
npm install mcp-proxy-wrapper
```

Or using yarn:

```bash
yarn add @modelcontextprotocol/payment-wrapper
```

## Basic Usage

Here's a simple example of how to wrap an existing MCP server with payment functionality:

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { wrapWithPayments } from '@modelcontextprotocol/payment-wrapper';

// Create your MCP server
const server = new McpServer({ 
  name: "My MCP Server",
  version: "1.0.0"
});

// Define your tools, prompts, and resources as usual
server.tool("my_tool", { param: "string" }, async (args) => {
  return { result: `Processed ${args.param}` };
});

// Wrap with payment functionality
const paymentServer = wrapWithPayments(server, { 
  apiKey: 'YOUR_API_KEY',
  baseAuthUrl: 'https://auth.yourservice.com'
});

// Use the wrapped server as normal
// It now has payment tools and verification
```

## Configuration Options

The `wrapWithPayments` function accepts the following options:

```typescript
interface PaymentWrapperOptions {
  /**
   * Developer API key used for authentication (required)
   */
  apiKey: string;
  
  /**
   * User JWT token for identifying and authenticating the end user
   * If not provided, the wrapper will return authentication-required responses
   */
  userToken?: string;
  
  /**
   * Optional flag to enable additional debug logging
   */
  debugMode?: boolean;

  /**
   * Optional configuration for the logger
   */
  loggerOptions?: LoggerOptions;

  /**
   * Optional base URL for the authentication service
   * @default "https://auth.mcp-api.com"
   */
  baseAuthUrl?: string;
}
```

## Payment Tools

The wrapper adds the following payment-related tools to your MCP server:

### 1. payment_authenticate

Initiates the authentication process for a user.

```typescript
// Example client-side call
const authResult = await mcpClient.callTool("payment_authenticate", {
  return_url: "https://your-app.com/auth-callback",
  user_hint: "user@example.com" // Optional
});

// The result contains an authentication URL and session information
console.log(authResult._meta.session_id);
console.log(authResult.content[1].text); // Auth URL
```

### 2. payment_check_auth_status

Checks the status of an authentication session.

```typescript
// Example client-side call
const statusResult = await mcpClient.callTool("payment_check_auth_status", {
  session_id: "session-id-from-authenticate-call"
});

// The result contains the authentication status
console.log(statusResult.status); // "pending", "complete", or "failed"
if (statusResult.status === "complete") {
  console.log(statusResult.user_token); // JWT token for authenticated user
}
```

### 3. payment_get_balance

Gets the user's current balance.

```typescript
// Example client-side call (requires authenticated user token)
const balanceResult = await mcpClient.callTool("payment_get_balance", {});

// The result contains the user's balance information
console.log(balanceResult.balance);
console.log(balanceResult.currency);
```

## Complete Authentication Flow

Here's a complete example of how to implement the authentication flow:

```typescript
// Step 1: Initiate authentication
const authResult = await mcpClient.callTool("payment_authenticate", {
  return_url: "https://your-app.com/auth-callback"
});

// Store the session ID
const sessionId = authResult._meta.session_id;

// Direct the user to the authentication URL
const authUrl = authResult.content[1].text;
console.log(`Please authenticate at: ${authUrl}`);

// Step 2: Check authentication status (polling)
let isAuthenticated = false;
let userToken = null;

while (!isAuthenticated) {
  // Wait a few seconds between checks
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  const statusResult = await mcpClient.callTool("payment_check_auth_status", {
    session_id: sessionId
  });
  
  if (statusResult.status === "complete") {
    isAuthenticated = true;
    userToken = statusResult.user_token;
    console.log("Authentication successful!");
  } else if (statusResult.status === "failed") {
    console.log("Authentication failed:", statusResult.error);
    break;
  } else {
    console.log("Waiting for authentication...");
  }
}

// Step 3: Use the user token for subsequent requests
if (userToken) {
  // Create a new client with the user token
  const authenticatedClient = new McpClient({
    // ... other options
    userToken: userToken
  });
  
  // Now you can make authenticated requests
  const balanceResult = await authenticatedClient.callTool("payment_get_balance", {});
  console.log(`Current balance: ${balanceResult.balance} ${balanceResult.currency}`);
}
```

## Next Steps

- Check out the [API Reference](api) for detailed documentation of all available methods and options.
- See the [Examples](examples) section for more usage scenarios.
- Explore the [GitHub repository](https://github.com/crazyrabbitltc/mcp-payment-wrapper) for the latest updates and source code.
