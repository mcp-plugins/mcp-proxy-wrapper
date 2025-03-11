# MCP Payment Wrapper

A Model Context Protocol (MCP) wrapper for payment processing services.

## Overview

This project implements a calculator service using the Model Context Protocol (MCP). It provides various mathematical operations as tools that can be used by MCP clients.

## Features

- Basic arithmetic operations (addition, subtraction, multiplication, division)
- Advanced operations (power, square root, modulo)
- Memory operations (store, recall, clear)
- History tracking of calculations
- Documentation resources

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm

### Installation

1. Clone the repository
```bash
git clone <repository-url>
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

4. Run the server
```bash
node dist/server.js
```

## Project Structure

- `src/tools/`: Calculator operation tools
- `src/resources/`: Resource handlers for history, documentation, etc.
- `src/services/`: Service implementations
- `src/prompts/`: Prompt templates
- `src/types/`: TypeScript type definitions

## Development

This project is currently in the "Wrapper" branch, which is being developed to provide payment processing functionality through the MCP protocol.

## License

MIT 