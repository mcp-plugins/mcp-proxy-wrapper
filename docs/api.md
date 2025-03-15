---
layout: default
title: API Reference
---

# API Reference

This page provides detailed documentation for the MCP Payment Wrapper API.

## Core Functions

### wrapWithPayments

The main function that wraps an existing MCP server with payment functionality.

```typescript
function wrapWithPayments(server: McpServer, options: PaymentWrapperOptions): McpServer
```

#### Parameters

- `server`: The existing McpServer instance to wrap
- `options`: Configuration options for the payment wrapper

#### Returns

A proxy McpServer instance with payment functionality that maintains the same interface as the original server.

#### Example

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { wrapWithPayments } from '@modelcontextprotocol/payment-wrapper';

const server = new McpServer({ 
  name: "My MCP Server",
  version: "1.0.0"
});

const paymentServer = wrapWithPayments(server, { 
  apiKey: 'YOUR_API_KEY',
  baseAuthUrl: 'https://auth.yourservice.com'
});
```

## Interfaces

### PaymentWrapperOptions

Configuration options for the payment wrapper.

```typescript
interface PaymentWrapperOptions {
  /**
   * Developer API key used for authentication
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
  
  /**
   * Optional override for the funds check result (for testing)
   * @default undefined
   */
  _testOverrideFundsCheck?: boolean;
}
```

### AuthRequiredResponse

Error response returned when authentication is required.

```typescript
interface AuthRequiredResponse {
  error: string;
  message: string;
  authUrl: string;
}
```

### IAuthService

Interface for authentication services used by the payment wrapper.

```typescript
interface IAuthService {
  /**
   * Verify a user token for a specific resource
   */
  verifyToken(token: string, resourceType: string, resourceId: string): Promise<TokenVerificationResult>;
  
  /**
   * Generate an authentication URL
   */
  generateAuthUrl(): string;
  
  /**
   * Create an authentication session
   */
  createSession?(sessionId: string, options: SessionOptions): Promise<void>;
  
  /**
   * Check the status of an authentication session
   */
  checkSessionStatus?(sessionId: string): Promise<SessionStatus>;
  
  /**
   * Validate a JWT token and extract user data
   */
  validateJWT?(token: string): Promise<UserData | null>;
}
```

### SessionOptions

Options for creating an authentication session.

```typescript
interface SessionOptions {
  /**
   * URL to redirect to after authentication
   */
  return_url?: string;
  
  /**
   * Optional user hint (e.g., email) to pre-fill in the auth form
   */
  user_hint?: string;
  
  /**
   * ISO timestamp when the session was created
   */
  created_at: string;
  
  /**
   * ISO timestamp when the session expires
   */
  expires_at: string;
}
```

### SessionStatus

Status of an authentication session.

```typescript
interface SessionStatus {
  /**
   * Status of the session: "pending", "complete", or "failed"
   */
  status: "pending" | "complete" | "failed";
  
  /**
   * User JWT token if authentication is complete
   */
  token?: string;
  
  /**
   * Error message if authentication failed
   */
  error?: string;
  
  /**
   * ISO timestamp when the session expires
   */
  expires_at: string;
}
```

### UserData

User data extracted from a JWT token.

```typescript
interface UserData {
  /**
   * Unique identifier for the user
   */
  id: string;
  
  /**
   * User's email address
   */
  email?: string;
  
  /**
   * User's display name
   */
  name?: string;
  
  /**
   * User's account balance
   */
  balance?: {
    /**
     * Amount of funds available
     */
    amount: number;
    
    /**
     * Currency of the balance
     */
    currency: string;
  };
}
```

## Payment Tools

The wrapper adds the following payment-related tools to the MCP server:

### payment_authenticate

Initiates the authentication process for a user.

#### Parameters

```typescript
{
  return_url: z.string().url().optional(), 
  user_hint: z.string().optional() 
}
```

#### Returns

```typescript
{
  content: [
    { 
      type: "text", 
      text: "Authentication initiated. Please use the following link to authenticate:" 
    },
    {
      type: "text",
      text: "https://auth.example.com/auth?session=session-id&hint=user@example.com&return_url=https://app.example.com/callback"
    }
  ],
  _meta: {
    session_id: "session-id",
    expires_in: 1800, // 30 minutes in seconds
    status: "pending"
  }
}
```

### payment_check_auth_status

Checks the status of an authentication session.

#### Parameters

```typescript
{
  session_id: z.string()
}
```

#### Returns

For pending authentication:
```typescript
{
  status: "pending",
  expires_in: 1500 // Remaining seconds until expiration
}
```

For completed authentication:
```typescript
{
  status: "complete",
  user_token: "jwt-token-for-authenticated-user"
}
```

For failed authentication:
```typescript
{
  status: "failed",
  error: "Authentication failed or expired"
}
```

### payment_get_balance

Gets the user's current balance.

#### Parameters

None

#### Returns

```typescript
{
  balance: 100.50,
  currency: "USD",
  last_updated: "2024-03-14T12:34:56Z"
}
```

## Error Handling

The payment wrapper returns standardized error responses for various scenarios:

### Authentication Required

```typescript
{
  error: "authentication_required",
  message: "Authentication required to access this resource",
  authUrl: "https://auth.example.com/auth?session=session-id"
}
```

### Insufficient Permissions

```typescript
{
  error: "insufficient_permissions",
  message: "Insufficient permissions to access this resource",
  authUrl: ""  // No auth URL needed for insufficient permissions
}
```

### Insufficient Funds

```typescript
{
  error: "insufficient_funds",
  message: "Insufficient funds to execute this operation"
}
```

### Authentication Error

```typescript
{
  error: "authentication_error",
  message: "Error verifying authentication token",
  authUrl: "https://auth.example.com/auth?session=session-id"
}
```

## Utility Functions

### createLogger

Creates a Winston-based logger for the payment wrapper.

```typescript
function createLogger(options: LoggerOptions): winston.Logger
```

#### Parameters

- `options`: Configuration options for the logger

#### Returns

A configured Winston logger instance.
