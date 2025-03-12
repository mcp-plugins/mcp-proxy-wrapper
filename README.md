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

## Testing Approach

The payment wrapper includes a comprehensive testing suite that validates its functionality:

- **Direct Method Testing:** Tests call methods directly on the wrapped server to ensure the proxy intercepts and processes them correctly.
- **Billing Verification:** Tests verify that billing checks are performed before executing operations.
- **Error Handling:** Tests confirm that appropriate errors are thrown when:
  - API keys are missing or invalid
  - User tokens are missing or invalid
  - Users have insufficient funds
  - Underlying operations throw errors
- **Successful Operations:** Tests validate that operations complete successfully when all conditions are met.
- **Charge Processing:** Tests ensure that charges are processed correctly after successful operations.
- **Proxy Behavior Testing:** Tests verify that the proxy correctly forwards method calls, preserves property access, and maintains the prototype chain.
- **Edge Case Testing:** Tests validate the system's behavior in exceptional situations:
  - Input validation edge cases (missing or invalid inputs)
  - Error propagation from the original server
  - Recovery scenarios after failures
  - Billing edge cases (zero balance, exact threshold)
  - Debug mode functionality
- **Logger Testing:** Validates the logger's functionality including:
  - Detection of stdio environments
  - Memory transport for capturing logs in tests
  - Log level filtering
  - Message logging and retrieval

## Future Enhancements

- Integration with actual payment processors (e.g., Stripe)
- More sophisticated billing models (subscription, tiered pricing, etc.)
- Caching and rate limiting
- Usage reporting and analytics
- Enhanced logging with remote log aggregation services
- Telemetry support for operational monitoring

## Project Structure

- `src/payment-wrapper.ts`: Core payment wrapper implementation
- `src/index.ts`: Public API exports
- `src/utils/`: Utility functions and logging implementation
- `src/types/`: TypeScript type definitions

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request to [GitHub repository](https://github.com/crazyrabbitltc/mcp-payment-wrapper).

## License

MIT 