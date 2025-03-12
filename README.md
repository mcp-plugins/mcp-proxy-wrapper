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

The payment wrapper includes a comprehensive testing suite with 6 test files containing 64 tests. Here's a breakdown of the test coverage:

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