# MCP Payment Wrapper

This project includes a payment wrapper for MCP servers that adds payment functionality. The wrapper uses a proxy-based approach to intercept calls to the underlying MCP server and add payment verification.

### Features

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
   - Logs errors or important events to the console for debugging.

### Usage Example

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { wrapWithPayments } from './payment-wrapper.js';

// Create or get your MCP server instance
const demoServer = new McpServer({ 
  name: "Demo Server",
  version: "1.0.0",
  description: "Demo server description"
});

// Register tools, resources, and prompts on the server
demoServer.tool("example_tool", { /* schema */ }, async (args, extra) => {
  // Tool implementation
});

// Wrap it with payment functionality
const paymentsEnabledServer = wrapWithPayments(demoServer, { 
  apiKey: 'YOUR_API_KEY', 
  userToken: 'USER_JWT_TOKEN' 
});

// Use the wrapped server as you would a normal MCP server
// All calls will now go through payment verification
```

### Installation and Setup

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

### Implementation Details

The payment wrapper uses a proxy-based approach to intercept calls to the MCP server's methods:

- **Proxy Pattern:** Uses JavaScript's Proxy object to intercept method calls to the original server.
- **Method Interception:** Intercepts calls to `tool`, `resource`, and `prompt` methods to add payment verification.
- **Transparent Wrapping:** The proxy preserves the original server's interface and behavior, only adding payment functionality.

Each intercepted method:
1. Verifies the user's billing status
2. If sufficient funds, forwards the call to the original method
3. Processes a charge after a successful operation
4. Returns the result to the caller

### Testing Approach

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

The test suite uses Jest and includes mocking of the console methods to capture and verify output for debugging purposes.

### Future Enhancements

- Integration with actual payment processors (e.g., Stripe)
- More sophisticated billing models (subscription, tiered pricing, etc.)
- Caching and rate limiting
- Usage reporting and analytics

## Overview

The MCP Payment Wrapper extends the functionality of the Model Context Protocol (MCP) Server by adding payment processing capabilities. This wrapper allows developers to integrate payment functionality into their MCP-based applications without modifying the core MCP Server implementation.

## Features

- Transparent wrapping of an existing McpServer instance
- Payment processing tools:
  - Process payments
  - Check payment status
  - Process refunds
  - List available payment methods
- Payment resources:
  - Payment history
  - Payment receipts
- Support for multiple payment providers:
  - Stripe
  - PayPal
  - Custom providers
- Secure payment processing with encryption
- Comprehensive logging and monitoring

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm

### Installation

1. Clone the repository
```bash
git clone https://github.com/yourusername/mcp-payment-wrapper.git
cd mcp-payment-wrapper
```

2. Install dependencies
```bash
npm install
```

3. Build the project
```bash
npm run build
```

### Basic Usage

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { PaymentWrapper } from 'mcp-payment-wrapper';
import { StripeProvider } from 'mcp-payment-wrapper/providers';
import { MemoryStorage } from 'mcp-payment-wrapper/storage';

// Create the base MCP server
const server = new McpServer({
  name: "My MCP Server",
  version: "1.0.0",
  description: "An MCP server with payment capabilities"
});

// Create a payment provider (Stripe in this example)
const paymentProvider = new StripeProvider({
  apiKey: process.env.STRIPE_API_KEY
});

// Create a storage provider
const storageProvider = new MemoryStorage();

// Create the payment wrapper
const paymentWrapper = new PaymentWrapper(
  server,
  paymentProvider,
  storageProvider,
  {
    // Configuration options
    encryptionKey: process.env.ENCRYPTION_KEY,
    logLevel: 'info'
  }
);

// Register your own tools, resources, and prompts
paymentWrapper.tool("my_tool", { /* schema */ }, async (args, extra) => {
  // Tool implementation
});

// Set up the transport
const transport = new StdioServerTransport();

// Connect the wrapped server to the transport
await paymentWrapper.connect(transport);
```

## Documentation

For detailed documentation, see the following:

- [API Reference](./docs/api/README.md)
- [User Guides](./docs/guides/README.md)
- [Examples](./docs/examples/README.md)

## Project Structure

- `src/wrapper/`: Payment wrapper implementation
- `src/tools/`: Payment tool implementations
- `src/resources/`: Payment resource implementations
- `src/providers/`: Payment provider implementations
- `src/storage/`: Storage provider implementations
- `src/types/`: TypeScript type definitions
- `src/utils/`: Utility functions
- `src/config/`: Configuration handling

## Development

This project is currently in the "Wrapper" branch, which is being developed to provide payment processing functionality through the MCP protocol.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT 