# MCP Payment Wrapper

A payment wrapper for Model Context Protocol (MCP) servers that adds payment verification and billing functionality.

## Installation

```bash
npm install @modelcontextprotocol/payment-wrapper
```

## Features

1. **Instance Wrapping:**  
   - ✅ Accepts an instance of an existing MCP server.
   - ✅ Uses JavaScript Proxy to intercept method calls without modifying the original server.
  
2. **Developer API Key Verification:**  
   - ✅ Validates that a valid developer API key is provided as part of the options.
   - ✅ Supports custom authentication providers through the hook system.

3. **User JWT Verification:**  
   - ✅ Accepts user JWT tokens for authentication.
   - ✅ Supports custom authentication providers through the hook system.
   - 🔄 Default implementation uses a mock service that simulates JWT verification.

4. **Billing Check:**  
   - ✅ Before forwarding the MCP call, performs a billing check.
   - ✅ Supports custom payment providers through the hook system.
   - ✅ Supports custom pricing strategies through the hook system.
   - 🔄 Default implementation uses a mock service that simulates billing checks.

5. **Call Forwarding:**  
   - ✅ If the billing check passes, forwards the call to the underlying MCP server.
  
6. **Billing Transaction:**  
   - ✅ After the MCP call succeeds, logs a billing transaction.
   - ⚠️ Currently simulates processing a transaction without actual payment processing.
   - 🔄 Real implementation would require integration with payment providers.
  
7. **Error Handling and Logging:**  
   - ✅ If any step fails, returns an appropriate error response.
   - ✅ Logs errors and important events using the native MCP logging system.

8. **Payment Authentication Tools:**  
   - ✅ Provides tools for user authentication and balance management.
   - ✅ Supports a user-friendly authentication flow.
   - ⚠️ Currently uses a mock authentication service for testing.
   - 🔄 Real implementation would connect to an authentication server.

Legend:
- ✅ Fully implemented
- ⚠️ Simulated/mock implementation
- 🔄 Planned for future implementation

## System Architecture

The MCP Payment Wrapper uses a proxy-based architecture to intercept calls to the MCP server and add payment verification functionality without modifying the original server code.

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                                                                                                 │
│                                       MCP Payment Wrapper Architecture                                          │
│                                                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘

┌─────────────────┐     ┌───────────────────────────────────────────────────────────────────────────────────────────┐
│                 │     │                                                                                           │
│                 │     │                              Wrapped MCP Server                                           │
│                 │     │                                                                                           │
│                 │     │  ┌─────────────────────────────────────────────────────────────────────────────────────┐  │
│                 │     │  │                                                                                     │  │
│                 │     │  │                               JavaScript Proxy                                      │  │
│     Client      │     │  │                                                                                     │  │
│     (LLM)       │─────┼─▶│  ┌─────────────────────────────────────────────────────────────────────────────────┐  │
│                 │     │  │  │                                                                                 │  │
│                 │     │  │  │                           Method Interception                                   │  │
│                 │     │  │  │                                                                                 │  │
│                 │     │  │  │  ┌─────────────────┐    ┌────────────────┐    ┌────────────────────────────┐   │  │
└─────────────────┘     │  │  │  │                 │    │                │    │                            │   │  │
                        │  │  │  │  Authentication ├───▶│  Funds Check   ├───▶│ Original Method Execution  │   │  │
                        │  │  │  │                 │    │                │    │                            │   │  │
                        │  │  │  │                 │    │                │    │                            │   │  │
                        │  │  │           │                      │                          │                  │  │
                        │  │  │           │                      │                          │                  │  │
                        │  │  │           ▼                      ▼                          ▼                  │  │
                        │  │  │  ┌─────────────────┐    ┌────────────────┐    ┌────────────────────────────┐   │  │
                        │  │  │  │                 │    │                │    │                            │   │  │
                        │  │  │  │  Error Handling │    │ Billing Process│    │      Result Handling       │   │  │
                        │  │  │  │                 │    │                │    │                            │   │  │
                        │  │  │  └─────────────────┘    └────────────────┘    └────────────────────────────┘   │  │
                        │  │  │                                                                                 │  │
                        │  │  └─────────────────────────────────────────────────────────────────────────────────┘  │
                        │  │                                                                                     │  │
                        │  └─────────────────────────────────────────────────────────────────────────────────────┘  │
                        │                                                                                           │
                        │  ┌─────────────────────────────────────────────────────────────────────────────────────┐  │
                        │  │                                                                                     │  │
                        │  │                             Payment Tools                                           │  │
                        │  │                                                                                     │  │
                        │  │  ┌─────────────────┐    ┌────────────────┐    ┌────────────────────────────┐       │  │
                        │  │  │                 │    │                │    │                            │       │  │
                        │  │  │ payment_        │    │ payment_check_ │    │ payment_get_balance        │       │  │
                        │  │  │ authenticate    │    │ auth_status    │    │                            │       │  │
                        │  │  │                 │    │                │    │                            │       │  │
                        │  │  └─────────────────┘    └────────────────┘    └────────────────────────────┘       │  │
                        │  │                                                                                     │  │
                        │  └─────────────────────────────────────────────────────────────────────────────────────┘  │
                        │                                                                                           │
                        │  ┌─────────────────────────────────────────────────────────────────────────────────────┐  │
                        │  │                                                                                     │  │
                        │  │                           Original MCP Server                                       │  │
                        │  │                                                                                     │  │
                        │  │  ┌─────────────────┐    ┌────────────────┐    ┌────────────────────────────┐       │  │
                        │  │  │                 │    │                │    │                            │       │  │
                        │  │  │     Tools       │    │    Prompts     │    │        Resources           │       │  │
                        │  │  │                 │    │                │    │                            │       │  │
                        │  │  └─────────────────┘    └────────────────┘    └────────────────────────────┘       │  │
                        │  │                                                                                     │  │
                        │  └─────────────────────────────────────────────────────────────────────────────────────┘  │
                        │                                                                                           │
                        └───────────────────────────────────────────────────────────────────────────────────────────┘
                                                          │
                                                          │
                                                          ▼
                        ┌───────────────────────────────────────────────────────────────────────────────────────────┐
                        │                                                                                           │
                        │                                 External Services                                         │
                        │                                                                                           │
                        │  ┌─────────────────────────────┐            ┌─────────────────────────────────────────┐  │
                        │  │                             │            │                                         │  │
                        │  │     Authentication Service  │            │           Billing Service               │  │
                        │  │                             │            │                                         │  │
                        │  │  ┌─────────────────────┐   │            │  ┌─────────────────┐ ┌───────────────┐  │  │
                        │  │  │                     │   │            │  │                 │ │               │  │  │
                        │  │  │  JWT Verification   │   │            │  │  Funds Check    │ │ Process Charge│  │  │
                        │  │  │                     │   │            │  │                 │ │               │  │  │
                        │  │  └─────────────────────┘   │            │  └─────────────────┘ └───────────────┘  │  │
                        │  │                             │            │                                         │  │
                        │  │  ┌─────────────────────┐   │            │  ┌─────────────────┐ ┌───────────────┐  │  │
                        │  │  │                     │   │            │  │                 │ │               │  │  │
                        │  │  │  Session Management │   │            │  │  User Balance   │ │ Transaction   │  │  │
                        │  │  │                     │   │            │  │                 │ │ History       │  │  │
                        │  │  └─────────────────────┘   │            │  └─────────────────┘ └───────────────┘  │  │
                        │  │                             │            │                                         │  │
                        │  └─────────────────────────────┘            └─────────────────────────────────────────┘  │
                        │                                                                                           │
                        └───────────────────────────────────────────────────────────────────────────────────────────┘
```

### How the System Works

#### 1. Client Request Flow

1. **Client (LLM) Initiates Request**:
   - The LLM calls a method on the wrapped MCP server (e.g., `callTool`, `getResource`, `callPrompt`)
   - Example: `mcpServer.callTool("generate_image", { prompt: "sunset over mountains" })`

2. **JavaScript Proxy Intercepts**:
   - The proxy intercepts the method call before it reaches the original MCP server
   - It identifies which method is being called and prepares for authentication and billing checks

#### 2. Authentication Process

3. **Authentication Check**:
   - The proxy extracts the user token from the options
   - It calls the Auth Service to verify the token
   - If authentication fails, it returns an error response with an auth URL
   - If successful, it extracts the user ID for billing

4. **Funds Verification**:
   - The proxy checks if the user has sufficient funds
   - It may call the Billing Service to verify balance
   - If funds are insufficient, it returns an "insufficient_funds" error

#### 3. Tool Execution

5. **Original Method Execution**:
   - If authentication and funds checks pass, the proxy calls the original method on the MCP server
   - The original server processes the request (e.g., executes the tool)
   - The result is captured by the proxy

6. **Billing Processing**:
   - After successful execution, the proxy processes a billing transaction
   - It records the charge for the operation
   - The user's balance is updated

7. **Response Delivery**:
   - The proxy returns the result to the client
   - Or, if any step failed, it returns an appropriate error response

#### 4. External Services

- **Auth Service**: Handles JWT token verification and generation
- **Billing Service**: Manages user balances, funds checking, and transaction processing
- Both services are accessed via HTTP endpoints (e.g., `/auth/verify-token`, `/billing/check-funds`)

## Payment Tools

The wrapper adds the following payment-related tools:

### 1. `payment_authenticate`

Initiates the authentication process and returns a URL for the user to complete authentication.

**Parameters:**
- `return_url` (optional): URL to redirect after authentication
- `user_hint` (optional): Email or username to pre-fill in the auth form

**Returns:**
- `session_id`: Unique identifier for this authentication session
- `auth_url`: URL for the user to complete authentication
- `expires_in`: Seconds until this authentication session expires
- `status`: Current status of the authentication session

**Example:**
```typescript
const authResult = await mcpServer.callTool('payment_authenticate', {
  return_url: 'https://example.com/return'
});

// Provide the auth URL to the user
console.log('Please authenticate:', authResult.content[1].json.auth_url);
```

### 2. `payment_check_auth_status`

Checks the status of an ongoing authentication session.

**Parameters:**
- `session_id`: The session ID from the payment_authenticate call

**Returns:**
- `status`: "pending", "authenticated", or "error"
- `user_info`: User information if authenticated
- `jwt`: JWT token if authenticated
- `authenticated_at`: Timestamp of authentication

**Example:**
```typescript
const statusResult = await mcpServer.callTool('payment_check_auth_status', {
  session_id: 'session-id-from-authenticate'
});

if (statusResult.content[1].json.status === 'authenticated') {
  // Save the JWT token for future API calls
  const jwt = statusResult.content[1].json.jwt;
}
```

### 3. `payment_get_balance`

Gets the current balance for an authenticated user.

**Parameters:**
- `jwt`: JWT token from the authentication process

**Returns:**
- `user_id`: User identifier
- `balance`: Current balance amount
- `currency`: Currency code (e.g., USD)
- `available_credit`: Available credit (if applicable)
- `jwt`: Updated JWT token (only if token was refreshed)

**Example:**
```typescript
const balanceResult = await mcpServer.callTool('payment_get_balance', {
  jwt: 'jwt-token-from-authentication'
});

console.log(`Balance: ${balanceResult.content[1].json.balance} ${balanceResult.content[1].json.currency}`);
```

## Authentication Flow

The payment wrapper implements a user-friendly authentication flow:

1. **Initiate Authentication**:
   - LLM calls `payment_authenticate`
   - Returns a session ID and authentication URL
   - User clicks the URL to authenticate in the browser

2. **Check Authentication Status**:
   - LLM periodically calls `payment_check_auth_status`
   - Once authenticated, returns a JWT token
   - No need for the user to copy/paste anything

3. **Use the JWT Token**:
   - JWT is used for subsequent API calls
   - Token is refreshed automatically when needed

This flow provides a seamless experience for end users while maintaining security.

## Usage Example

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { wrapWithPayments } from '@modelcontextprotocol/payment-wrapper';
import { z } from 'zod';

// Create your MCP server instance
const server = new McpServer({ 
  name: "My MCP Server",
  version: "1.0.0",
  description: "MCP server with payment functionality"
});

// Register tools, resources, and prompts on the server
server.tool("example_tool", { 
  param: z.string() 
}, async (args, extra) => {
  return {
    content: [{ 
      type: "text" as const, 
      text: `Processed: ${args.param}` 
    }]
  };
});

// Wrap the server with payment functionality
const paymentsEnabledServer = wrapWithPayments(server, { 
  apiKey: process.env.API_KEY || 'YOUR_API_KEY', 
  userToken: process.env.USER_JWT || 'USER_JWT_TOKEN',
  debugMode: true // optional
});

// Use the wrapped server as you would a normal MCP server
// All calls will now go through payment verification

// Connect to a transport
const transport = new StdioServerTransport();
await paymentsEnabledServer.connect(transport);
```

## Development Setup

1. Install dependencies:
   ```bash
   npm install
   ```

2. Build the project:
   ```bash
   npm run build
   ```

3. Run the example:
   ```bash
   npm run example
   ```

4. Run tests:
   ```bash
   npm test
   ```

## Operational Flow

The payment wrapper follows this operational flow when handling MCP server methods:

1. **Initialization:**
   - The wrapper is initialized with an MCP server instance and options.
   - Options are validated, ensuring a valid API key is provided.
   - A logger is created based on the provided options.

2. **Method Registration Interception:**
   - When methods like `tool`, `resource`, or `prompt` are registered on the wrapped server, the wrapper:
     - Logs the registration attempt
     - Passes the registration to the original server
     - Wraps the callback function with payment verification logic

3. **Method Execution Flow:**
   - **Authentication Phase:**
     - Extract the user ID from the JWT token
     - Verify the token's validity with the authentication service
     - Reject the request if authentication fails

   - **Billing Verification Phase:**
     - Check if the user has sufficient funds
     - Calculate the cost of the operation
     - Reject the request if funds are insufficient

   - **Execution Phase:**
     - Forward the call to the original method on the MCP server
     - Capture the result or any errors

   - **Billing Processing Phase:**
     - Process the charge for the operation
     - Log the successful billing transaction

   - **Response Phase:**
     - Return the result to the caller
     - Or, if any step failed, return an appropriate error

4. **Error Handling:**
   - Each phase includes comprehensive error handling
   - Errors are logged with appropriate context
   - Error responses maintain the MCP protocol expectations

## Testing Framework

The payment wrapper includes a comprehensive testing suite with 8 test files containing 80 tests. Here's a breakdown of the test coverage:

### 1. Core Payment Wrapper Tests (7 tests)
- `src/payment-wrapper.test.ts`
- Tests the basic functionality of the payment wrapper
- Verifies proper wrapping of an MCP server instance
- Tests API key validation
- Tests tool, resource, and prompt registration and execution
- Verifies funds checking for tool calls

### 2. Comprehensive Method Tests (10 tests)
- `src/payment-wrapper.comprehensive.test.ts`
- In-depth testing of tool, resource, and prompt methods
- Verifies method registration through the proxy
- Tests successful execution with sufficient funds
- Tests rejection with insufficient funds
- Tests error handling during execution

### 3. Edge Case Tests (12 tests)
- `src/payment-wrapper.edge-cases.test.ts`
- Tests input validation edge cases (missing/empty API key)
- Tests handling of null/undefined server
- Tests error propagation from original server methods
- Tests recovery scenarios after failed operations
- Tests billing edge cases
- Tests debug mode functionality

### 4. Authentication Flow Tests (5 tests)
- `src/payment-wrapper.auth.test.ts`
- Tests authentication requirements
- Verifies behavior with missing/invalid/valid user tokens
- Tests custom authentication URL configuration
- Tests access denial due to insufficient funds

### 5. Proxy Method Tests (25 tests)
- `src/payment-wrapper.proxy.test.ts`
- Tests proxy method forwarding
- Tests context preservation
- Tests handling of various argument types
- Tests method chaining
- Tests property access, changes, getters/setters
- Tests prototype chain maintenance
- Tests handling of special cases (Symbol properties, enumeration, deletion)
- Tests method existence checks

### 6. Payment Tools Tests (12 tests)
- `src/payment-tools.test.ts`
- Tests the payment authentication tools
- Verifies authentication session creation
- Tests authentication status checking
- Tests balance retrieval
- Tests error handling in payment tools
- Tests the complete authentication flow

### 7. Logger Tests (13 tests)
- `src/utils/logger.test.ts`
- Tests logger creation with various options
- Tests stdio transport detection
- Tests memory transport for log capture
- Tests log filtering by level
- Tests log content verification

### 8. Integration Tests (6 tests)
- `src/integration-tests/payment-wrapper.integration.test.ts`
- Tests the payment wrapper's interaction with a mock backend server
- Verifies API key validation with the backend
- Tests user token verification
- Tests funds checking and balance verification
- Tests charge processing
- Tests the complete integration flow with tool execution
- Tests handling of insufficient funds scenarios

## Implementation Details

The payment wrapper uses a proxy-based approach to intercept calls to the MCP server's methods:

- **Proxy Pattern:** Uses JavaScript's Proxy object to intercept method calls to the original server.
- **Method Interception:** Intercepts calls to `tool`, `resource`, and `prompt` methods to add payment verification.
- **Transparent Wrapping:** The proxy preserves the original server's interface and behavior, only adding payment functionality.

Each intercepted method:
1. Verifies the user's billing status
2. If sufficient funds, forwards the call to the original method
3. Processes a charge after a successful operation
4. Returns the result to the caller

## Future Enhancements

The following enhancements are planned for future versions:

- **Real Authentication Integration**: Replace the mock authentication service with integration to a real authentication backend.
- **Payment Provider Integration**: Implement real payment provider integrations (e.g., Stripe, PayPal).
- **Payment-Specific Tools**: Add tools for balance queries, transaction history, and payment management.
- **Advanced Billing Models**: Support for subscription, tiered pricing, and usage-based billing.
- **Caching and Rate Limiting**: Optimize performance and control usage.
- **Usage Reporting and Analytics**: Track and analyze payment and usage patterns.
- **Enhanced Logging**: Integration with remote log aggregation services.
- **Telemetry Support**: Operational monitoring for production deployments.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request to [GitHub repository](https://github.com/crazyrabbitltc/mcp-payment-wrapper).

## License

MIT 

## Extensible Hook System

The MCP Payment Wrapper includes a flexible hook system that allows you to customize authentication, payment processing, and pricing without requiring an external API backend. This makes it easy to get started with a proof of concept or to integrate with your existing systems.

### Available Hooks

1. **Authentication Provider**
   - Handles user authentication and token verification
   - Interface: `IAuthProvider`
   - Default: `MockAuthService`

2. **Payment Provider**
   - Manages funds verification and transaction processing
   - Interface: `IPaymentProvider`
   - Default: `DefaultPaymentProvider`

3. **Pricing Strategy**
   - Determines the cost of operations based on resource type and usage
   - Interface: `IPricingStrategy`
   - Default: `DefaultPricingStrategy`

### Using Custom Hooks

To use custom hooks, simply pass your implementations to the `wrapWithPayments` function:

```typescript
import { wrapWithPayments } from '@modelcontextprotocol/payment-wrapper';
import { MyCustomAuthProvider } from './my-auth-provider';
import { MyCustomPaymentProvider } from './my-payment-provider';
import { MyCustomPricingStrategy } from './my-pricing-strategy';

// Create your custom hook implementations
const authProvider = new MyCustomAuthProvider({
  apiKey: 'your-api-key'
});

const paymentProvider = new MyCustomPaymentProvider({
  apiKey: 'your-api-key'
});

const pricingStrategy = new MyCustomPricingStrategy({
  defaultBasePrice: 50, // $0.50
  currency: 'USD'
});

// Wrap your MCP server with custom hooks
const wrappedServer = wrapWithPayments(mcpServer, {
  apiKey: 'your-api-key',
  userToken: 'user-jwt-token',
  // Use your custom hook implementations
  authProvider,
  paymentProvider,
  pricingStrategy
});
```

### Creating Custom Hook Implementations

#### Custom Authentication Provider

```typescript
import { IAuthProvider } from '@modelcontextprotocol/payment-wrapper';
import { VerifyResponse } from '@modelcontextprotocol/payment-wrapper';

class MyCustomAuthProvider implements IAuthProvider {
  constructor(options) {
    // Initialize your provider
  }
  
  generateAuthUrl(options?: Record<string, unknown>): string {
    // Return a URL for user authentication
    return 'https://your-auth-service.com/auth';
  }
  
  async verifyToken(token: string, resourceType: 'tool' | 'prompt' | 'resource', resourceId: string): Promise<VerifyResponse> {
    // Verify the token and return a response
    // This could integrate with your existing auth system
    return {
      valid: true,
      userId: 'user-123',
      permissions: {
        canAccess: true
      }
    };
  }
  
  generateToken(userId?: string): string {
    // Generate a token for testing
    return 'test-token';
  }
}
```

#### Custom Payment Provider

```typescript
import { 
  IPaymentProvider, 
  PaymentMetadata, 
  UserBalance 
} from '@modelcontextprotocol/payment-wrapper';

class MyCustomPaymentProvider implements IPaymentProvider {
  constructor(options) {
    // Initialize your provider
  }
  
  async verifyFunds(userId: string, amount: number, metadata?: PaymentMetadata): Promise<boolean> {
    // Check if the user has sufficient funds
    // This could integrate with your existing payment system
    return true;
  }
  
  async processCharge(userId: string, amount: number, metadata: PaymentMetadata): Promise<string> {
    // Process a charge and return a transaction ID
    return 'txn-123';
  }
  
  async getBalance(userId: string): Promise<UserBalance> {
    // Get the user's balance
    return {
      available: 10000, // $100.00
      pending: 0,
      currency: 'USD',
      lastUpdated: new Date().toISOString()
    };
  }
  
  async verifyApiKey(apiKey: string): Promise<boolean> {
    // Verify the API key
    return true;
  }
}
```

#### Custom Pricing Strategy

```typescript
import { 
  IPricingStrategy, 
  PricingOptions, 
  PricingResult, 
  ResourcePricing 
} from '@modelcontextprotocol/payment-wrapper';

class MyCustomPricingStrategy implements IPricingStrategy {
  constructor(options) {
    // Initialize your strategy
  }
  
  async calculatePrice(options: PricingOptions): Promise<PricingResult> {
    // Calculate the price for an operation
    return {
      amount: 50, // $0.50
      currency: 'USD'
    };
  }
  
  async getPricingInfo(resourceId: string, resourceType: 'tool' | 'prompt' | 'resource'): Promise<ResourcePricing> {
    // Get pricing information for a resource
    return {
      basePrice: 50, // $0.50
      currency: 'USD',
      pricingModel: 'flat'
    };
  }
  
  async isApplicable(resourceId: string, resourceType: 'tool' | 'prompt' | 'resource'): Promise<boolean> {
    // Check if this pricing strategy applies to the resource
    return true;
  }
}
```

### Example with In-Memory Implementations

For a complete example of using custom hooks with in-memory implementations (no external API required), see the `example-custom-hooks-usage.ts` file in the source code.
