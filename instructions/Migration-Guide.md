# Migration Guide: From Payment Wrapper to Proxy Wrapper

This guide will help you migrate from the MCP Payment Wrapper to the new MCP Proxy Wrapper.

## Overview

The MCP Proxy Wrapper is a simplified, unopinionated version of the MCP Payment Wrapper that focuses solely on providing a hook system for intercepting and modifying tool calls. It removes payment-specific functionality, API key requirements, and authentication mechanisms, allowing for a more flexible and lightweight implementation.

## Key Differences

| Feature | Payment Wrapper | Proxy Wrapper |
|---------|----------------|---------------|
| API Key | Required | Not required |
| Authentication | Built-in JWT verification | Not included (can be implemented via hooks) |
| Payment Processing | Built-in | Not included (can be implemented via hooks) |
| Pricing Strategy | Built-in | Not included (can be implemented via hooks) |
| Backend Requirements | Yes | No |
| Hook System | Limited | Comprehensive |
| Configuration | Complex | Simple |

## Migration Steps

### 1. Update Dependencies

Update your package.json to use the new proxy wrapper:

```diff
 "dependencies": {
-  "@modelcontextprotocol/payment-wrapper": "^1.0.0",
+  "@modelcontextprotocol/proxy-wrapper": "^1.0.0",
   "@modelcontextprotocol/sdk": "^1.6.0",
   // other dependencies...
 }
```

Then run:

```bash
npm install
```

### 2. Update Imports

Change your imports from the payment wrapper to the proxy wrapper:

```diff
- import { wrapWithPayments } from '@modelcontextprotocol/payment-wrapper';
+ import { wrapWithProxy } from '@modelcontextprotocol/proxy-wrapper';
```

### 3. Update Wrapper Usage

Replace the payment wrapper with the proxy wrapper:

```diff
 const server = new McpServer({ 
   name: "My MCP Server",
   version: "1.0.0"
 });

- const paymentServer = wrapWithPayments(server, { 
-   apiKey: 'YOUR_API_KEY',
-   userToken: 'USER_JWT_TOKEN',
-   baseAuthUrl: 'https://auth.yourservice.com',
-   authProvider: customAuthProvider,
-   paymentProvider: customPaymentProvider,
-   pricingStrategy: customPricingStrategy
- });
+ const proxiedServer = wrapWithProxy(server, {
+   hooks: {
+     beforeToolCall: async (context) => {
+       // Your custom pre-call logic here
+     },
+     afterToolCall: async (context, result) => {
+       // Your custom post-call logic here
+       return result;
+     }
+   },
+   debug: true
+ });
```

### 4. Implement Custom Authentication (if needed)

If you were using the authentication features of the payment wrapper, you'll need to implement them yourself using hooks:

```typescript
const proxiedServer = wrapWithProxy(server, {
  hooks: {
    beforeToolCall: async (context) => {
      // Extract token from metadata or context
      const token = context.metadata?.token;
      
      // Verify token
      if (!token || !isValidToken(token)) {
        return {
          result: {
            isError: true,
            content: [{ 
              type: "text", 
              text: "Authentication required" 
            }]
          }
        };
      }
      
      // Add user info to context for later use
      context.metadata.userId = getUserIdFromToken(token);
    }
  }
});
```

### 5. Implement Custom Payment Processing (if needed)

If you were using the payment features of the payment wrapper, you'll need to implement them yourself using hooks:

```typescript
const proxiedServer = wrapWithProxy(server, {
  hooks: {
    beforeToolCall: async (context) => {
      // Get user ID from context
      const userId = context.metadata?.userId;
      
      if (!userId) {
        return {
          result: {
            isError: true,
            content: [{ 
              type: "text", 
              text: "Authentication required" 
            }]
          }
        };
      }
      
      // Calculate price for the operation
      const price = calculatePrice(context.toolName, context.args);
      
      // Verify funds
      const hasFunds = await verifyFunds(userId, price);
      
      if (!hasFunds) {
        return {
          result: {
            isError: true,
            content: [{ 
              type: "text", 
              text: "Insufficient funds" 
            }]
          }
        };
      }
      
      // Store price in metadata for later use
      context.metadata.price = price;
    },
    
    afterToolCall: async (context, result) => {
      // Get user ID and price from context
      const userId = context.metadata?.userId;
      const price = context.metadata?.price;
      
      if (userId && price && !result.result.isError) {
        // Process payment
        await processCharge(userId, price, {
          resourceType: 'tool',
          resourceId: context.toolName,
          operationType: 'call'
        });
      }
      
      return result;
    }
  }
});
```

### 6. Remove Payment-specific Tools

If you were using the payment-specific tools provided by the payment wrapper (`payment_authenticate`, `payment_check_auth_status`, `payment_get_balance`), you'll need to implement them yourself as regular MCP tools:

```typescript
// Authentication tool
server.tool("authenticate", { 
  redirectUrl: z.string().optional() 
}, async (args) => {
  const authUrl = generateAuthUrl(args.redirectUrl);
  
  return {
    content: [{ 
      type: "text", 
      text: `Please authenticate at: ${authUrl}` 
    }]
  };
});

// Check authentication status
server.tool("check_auth_status", { 
  sessionId: z.string() 
}, async (args) => {
  const status = await checkSessionStatus(args.sessionId);
  
  return {
    content: [{ 
      type: "text", 
      text: `Authentication status: ${status.status}` 
    }]
  };
});

// Get balance
server.tool("get_balance", {}, async (args, extra) => {
  // Get user ID from context
  const userId = extra.metadata?.userId;
  
  if (!userId) {
    return {
      isError: true,
      content: [{ 
        type: "text", 
        text: "Authentication required" 
      }]
    };
  }
  
  const balance = await getBalance(userId);
  
  return {
    content: [{ 
      type: "text", 
      text: `Your balance: ${balance.available} ${balance.currency}` 
    }]
  };
});
```

## Example: Complete Migration

Here's a complete example of migrating from the payment wrapper to the proxy wrapper:

### Before (Payment Wrapper)

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { wrapWithPayments } from '@modelcontextprotocol/payment-wrapper';

const server = new McpServer({ 
  name: "My MCP Server",
  version: "1.0.0"
});

// Register tools
server.tool("greet", { name: z.string() }, async (args) => {
  return {
    content: [{ type: "text", text: `Hello, ${args.name}!` }]
  };
});

// Wrap with payment functionality
const paymentServer = wrapWithPayments(server, { 
  apiKey: 'YOUR_API_KEY',
  userToken: 'USER_JWT_TOKEN',
  baseAuthUrl: 'https://auth.yourservice.com'
});

// Connect to transport
await paymentServer.connect(transport);
```

### After (Proxy Wrapper)

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { wrapWithProxy } from '@modelcontextprotocol/proxy-wrapper';

const server = new McpServer({ 
  name: "My MCP Server",
  version: "1.0.0"
});

// Register tools
server.tool("greet", { name: z.string() }, async (args) => {
  return {
    content: [{ type: "text", text: `Hello, ${args.name}!` }]
  };
});

// Custom authentication and payment functions
const verifyToken = async (token) => { /* ... */ };
const calculatePrice = (toolName, args) => { /* ... */ };
const verifyFunds = async (userId, price) => { /* ... */ };
const processCharge = async (userId, price, metadata) => { /* ... */ };

// Wrap with proxy functionality
const proxiedServer = wrapWithProxy(server, {
  hooks: {
    beforeToolCall: async (context) => {
      // Authentication
      const token = context.metadata?.token;
      if (!token || !await verifyToken(token)) {
        return {
          result: {
            isError: true,
            content: [{ type: "text", text: "Authentication required" }]
          }
        };
      }
      
      // Get user ID
      const userId = getUserIdFromToken(token);
      context.metadata.userId = userId;
      
      // Payment verification
      const price = calculatePrice(context.toolName, context.args);
      const hasFunds = await verifyFunds(userId, price);
      
      if (!hasFunds) {
        return {
          result: {
            isError: true,
            content: [{ type: "text", text: "Insufficient funds" }]
          }
        };
      }
      
      context.metadata.price = price;
    },
    
    afterToolCall: async (context, result) => {
      // Process payment if successful
      const userId = context.metadata?.userId;
      const price = context.metadata?.price;
      
      if (userId && price && !result.result.isError) {
        await processCharge(userId, price, {
          resourceType: 'tool',
          resourceId: context.toolName,
          operationType: 'call'
        });
      }
      
      return result;
    }
  }
});

// Connect to transport
await proxiedServer.connect(transport);
```

## Need Help?

If you encounter any issues during migration, please:

1. Check the [documentation](https://github.com/crazyrabbitltc/mcp-proxy-wrapper)
2. Open an issue on the [GitHub repository](https://github.com/crazyrabbitltc/mcp-proxy-wrapper/issues)
3. Reach out to the maintainers 