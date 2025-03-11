# MCP Payment Wrapper

A Model Context Protocol (MCP) wrapper for payment processing services.

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