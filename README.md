# MCP Payment Wrapper

A payment wrapper for Model Context Protocol (MCP) servers that adds payment verification and billing functionality.

## Installation

```bash
npm install @modelcontextprotocol/payment-wrapper
```

## Features

1. **Instance Wrapping:**  
   - Accepts an instance of an existing MCP server.
   - Uses JavaScript Proxy to intercept method calls without modifying the original server.
  
2. **Developer API Key Verification:**  
   - Validates that a valid developer API key is provided as part of the options.

3. **User JWT Verification:**  
   - Validates the user's JWT token.

4. **Simulated Billing Check:**  
   - Before forwarding the MCP call, simulates a billing check.
   - Returns an object with a boolean property `sufficientFunds` and a numerical `callCost`.

5. **Call Forwarding:**  
   - If the billing check passes, forwards the call to the underlying MCP server.
  
6. **Simulated Billing Transaction:**  
   - After the MCP call succeeds, simulates processing a billing transaction.
  
7. **Error Handling and Logging:**  
   - If any step fails (e.g., missing API key, invalid token, insufficient funds, or billing error), throws an error with an appropriate message.
   - Logs errors or important events using a Winston-based logger for robust logging capabilities.

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

The payment wrapper includes a comprehensive testing suite with 7 test files containing 70 tests. Here's a breakdown of the test coverage:

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

### 6. Logger Tests (13 tests)
- `src/utils/logger.test.ts`
- Tests logger creation with various options
- Tests stdio transport detection
- Tests memory transport for log capture
- Tests log filtering by level
- Tests log content verification

### 7. Integration Tests (6 tests)
- `src/integration-tests/payment-wrapper.integration.test.ts`
- Tests the payment wrapper's interaction with a mock backend server
- Verifies API key validation with the backend
- Tests user token verification
- Tests funds checking and balance verification
- Tests charge processing
- Tests the complete integration flow with tool execution
- Tests handling of insufficient funds scenarios

### Test Utilities

The test suite includes several utilities to facilitate effective testing:

- **TestLogger**: A specialized logger that captures logs in memory
- **MockAuthService**: A mock authentication service for testing JWT operations
- **createTestServer**: Creates a simple MCP server for testing
- **createExtendedTestServer**: Creates a more complex server with custom properties for proxy testing
- **testPaymentWrapper**: A helper function to test payment wrapper functionality with various configurations

### Testing Approach Highlights

- **Deterministic Tests**: Uses `_testOverrideFundsCheck` option to ensure deterministic testing of funds checking
- **Comprehensive Coverage**: Tests all aspects of the payment wrapper, from basic functionality to edge cases
- **Proxy Behavior Testing**: Ensures the proxy correctly preserves the original server's behavior
- **Error Handling**: Validates appropriate error responses in various scenarios
- **Integration Testing**: Tests the interaction between components (auth, billing, logging)
- **JWT Token Authentication**: Uses proper JWT tokens for authentication in integration tests

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

## Logging

The payment wrapper uses Winston for robust, configurable logging:

- **Environment-Aware Logging:** Automatically detects if the MCP server is using stdio transport and adjusts logging behavior to avoid corrupting the protocol.
- **Configurable Log Levels:** Supports different log levels (debug, info, warn, error) configurable via options.
- **File and Console Logging:** Logs can be directed to the console, file, or both depending on the environment.
- **Structured Logging:** Logs include timestamps, levels, and formatted messages for easy parsing and analysis.
- **Memory Transport for Testing:** Uses Winston's memory transport for capturing and verifying logs in tests, with a `TestLogger` helper class to simplify working with logs in tests.
- **Debug Mode:** Extended logging can be enabled with the `debugMode` option for troubleshooting.

Example of configuring a logger:

```typescript
import { wrapWithPayments } from '@modelcontextprotocol/payment-wrapper';

const paymentsEnabledServer = wrapWithPayments(server, { 
  apiKey: 'YOUR_API_KEY', 
  userToken: 'USER_JWT_TOKEN',
  debugMode: true,  // Enable detailed logging
  loggerOptions: {
    level: 'debug',  // Set log level
    logFilePath: './my-logs/payments.log'  // Custom log file path
  }
});
```

Example of using the TestLogger for testing:

```typescript
import { TestLogger } from '@modelcontextprotocol/payment-wrapper';

// Create a test logger
const testLogger = new TestLogger();

// Test your code that uses the logger
myFunction(testLogger);

// Check if specific logs were generated
expect(testLogger.contains('Expected log message')).toBe(true);

// Filter logs by level
const errorLogs = testLogger.getLogs('error');
expect(errorLogs.length).toBe(1);

// Clear logs between tests
testLogger.clear();
```

## Mock Backend for Integration Testing

The project includes a well-structured proof-of-concept mock backend that facilitates integration testing and serves as a reference design for implementing a real backend service.

### Backend Architecture

1. **Clean, Modular Structure**
   - **Models**: Data storage and business logic in `/models` directory
     - `users.ts`: User model with balance management
     - `transactions.ts`: Transaction tracking and analytics
     - `developers.ts`: API key validation and developer profiles

   - **Controllers**: Request handling logic in `/controllers` directory
     - `auth.ts`: Authentication operations (token verification, generation)
     - `billing.ts`: Billing operations (fund checking, charge processing)

   - **Routes**: Simplified API routing in `/routes` directory
     - `auth.ts`: Authentication-related endpoints
     - `billing.ts`: Billing-related endpoints

   - **Server**: Core server setup with middleware and plugin registration

2. **Backend Practices**
   - Proper separation of concerns (models, controllers, routes)
   - Centralized error handling
   - Middleware for authentication
   - Clean environment startup/shutdown
   - Type safety with TypeScript

### Multiple Server Options

- **Original Server**: The fully-featured mock backend
- **Simple Server**: A single-file simplified version
- **Improved Server**: The well-structured modular version
- **CommonJS Server**: A CommonJS version for Jest integration tests

### JWT Token Authentication

The mock backend implements proper JWT token authentication:

- Generates JWT tokens with the same secret key used by the payment wrapper's `MockAuthService`
- Includes user ID and API key in the token payload
- Verifies tokens during authentication checks
- Ensures tokens are associated with the correct API key
- Provides proper error messages for invalid tokens

### Integration Testing Options

- `npm run test:integration`: Run tests (assuming server is running)
- `npm run test:integration:with-server`: Run with original server
- `npm run test:integration:simple`: Run with simple server
- `npm run test:integration:improved`: Run with improved modular server
- `npm test -- src/integration-tests/payment-wrapper.integration.test.ts`: Run integration tests with the CommonJS server

### Real Port Integration Testing

The integration tests can also be configured to use a real network port for testing, which provides several benefits:

1. **More Realistic Testing**: Tests the actual HTTP communication that would happen in production.
2. **Easier Debugging**: You can use tools like Postman or curl to interact with the server during tests.
3. **Simpler Integration**: Makes it easier to integrate with external tools that expect a real HTTP server.

The integration tests use port 3004 by default:

```typescript
// Define a port for the test server
const TEST_PORT = 3004;
const TEST_BASE_URL = `http://localhost:${TEST_PORT}`;

// In the test setup
await mockBackend.server.listen(TEST_PORT);
console.log(`Mock backend server created and listening on port ${TEST_PORT}`);

// When creating the payment wrapper
const wrappedServer = wrapWithPayments(testMcpServer, { 
  apiKey: clientApiKey, 
  userToken: userToken,
  debugMode: true,
  baseAuthUrl: TEST_BASE_URL,
  _testOverrideFundsCheck: true // Force sufficient funds for testing
});
```

You can also run the minimal server directly for manual testing:

```bash
node src/mock-backend/minimal-server.js
```

### Design for Real Backend Development

The mock backend structure provides a solid foundation that can be adapted for real backend implementation:
- Models can be replaced with actual database models
- Controllers can be extended with additional business logic
- Routes can be enhanced with more comprehensive validation
- Server setup can be expanded for production needs
- JWT token handling can be extended with more sophisticated authentication mechanisms

## Future Enhancements

- Integration with actual payment processors (e.g., Stripe)
- More sophisticated billing models (subscription, tiered pricing, etc.)
- Caching and rate limiting
- Usage reporting and analytics
- Enhanced logging with remote log aggregation services
- Telemetry support for operational monitoring

## Project Structure

- `src/payment-wrapper.ts`: Core payment wrapper implementation
- `src/payment-wrapper.auth.ts`: Authentication service integration
- `src/index.ts`: Public API exports
- `src/utils/`: Utility functions and logging implementation
- `src/services/`: Service implementations (e.g., MockAuthService)
- `src/types/`: TypeScript type definitions
- `test/`: Test fixtures and helpers

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request to [GitHub repository](https://github.com/crazyrabbitltc/mcp-payment-wrapper).

## License

MIT 

## System Architecture

The MCP Payment Wrapper uses a proxy-based architecture to intercept calls to the MCP server and add payment verification functionality without modifying the original server code.

```
┌─────────────────────────────────────────────────────────────────────────┐
│                                                                         │
│                        MCP Payment Wrapper System                       │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘

┌─────────────────┐     ┌───────────────────────────────────────────────────┐
│                 │     │                                                   │
│                 │     │            Wrapped MCP Server                     │
│                 │     │  ┌─────────────────────────────────────────────┐  │
│                 │     │  │                                             │  │
│     Client      │     │  │           JavaScript Proxy                  │  │
│     (LLM)       │─────┼─▶│                                             │  │
│                 │     │  │  ┌─────────────────┐    ┌────────────────┐  │  │
│                 │     │  │  │ Authentication  │───▶│  Funds Check   │  │  │
│                 │     │  │  └─────────────────┘    └────────────────┘  │  │
│                 │     │  │            │                    │           │  │
└─────────────────┘     │  │            │                    │           │  │
                        │  │            ▼                    ▼           │  │
                        │  │  ┌─────────────────────────────────────────┐  │  ┌────────────────────┐
                        │  │  │                                         │  │  │                    │
                        │  │  │            Original MCP Server          │◀─┼──┼─▶  Auth Service    │
                        │  │  │                                         │  │  │                    │
                        │  │  │  ┌───────────┐  ┌────────┐  ┌────────┐  │  │  └────────────────────┘
                        │  │  │  │   Tools   │  │Prompts │  │Resources│  │  │
                        │  │  │  └───────────┘  └────────┘  └────────┘  │  │  ┌────────────────────┐
                        │  │  │                                         │  │  │                    │
                        │  │  └─────────────────────────────────────────┘  │  │  Billing Service   │
                        │  │                      │                        │  │                    │
                        │  └──────────────────────┼────────────────────────┘  └────────────────────┘
                        │                         │                            
                        └─────────────────────────┼────────────────────────────
                                                  │
                                                  ▼
                                        ┌─────────────────────┐
                                        │                     │
                                        │     Result or       │
                                        │   Error Response    │
                                        │                     │
                                        └─────────────────────┘
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

### Key Components

1. **JavaScript Proxy**: The core mechanism that intercepts method calls without modifying the original server
2. **Authentication Logic**: Verifies user identity through JWT tokens
3. **Funds Checking**: Ensures users have sufficient funds before executing operations
4. **Billing Processing**: Handles the financial transaction after successful operations
5. **Error Handling**: Returns appropriate error responses for various failure scenarios

### Future Enhancements

In future versions, we plan to add payment-specific tools that would allow the LLM to directly query and manage payment information, such as:

- `query_balance`: Get the current user's balance
- `view_transaction_history`: View recent transactions
- `estimate_cost`: Estimate the cost of an operation before running it
- `add_funds`: Generate a URL for adding funds to the account
- `set_spending_limit`: Set a maximum spending limit for the session 