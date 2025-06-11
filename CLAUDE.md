# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is the **MCP Proxy Wrapper** - a TypeScript library that provides a hook system for intercepting and modifying tool calls in Model Context Protocol (MCP) servers. The library wraps existing MCP server instances without requiring backend infrastructure changes.

## Core Architecture

### Main Components

- **`src/proxy-wrapper.ts`**: Core wrapper functionality that intercepts MCP server tool registrations
- **`src/interfaces/proxy-hooks.ts`**: TypeScript interfaces for hooks and configuration
- **`src/utils/logger.ts`**: Logging utility with configurable levels and colored output
- **`src/index.ts`**: Main entry point that exports all public APIs

### Hook System

The proxy wrapper implements a hook system with two main phases:
- **beforeToolCall**: Executes before tool calls, can modify arguments or short-circuit execution
- **afterToolCall**: Executes after tool calls, can modify results

The wrapper intercepts the `server.tool()` method to inject hook execution around the original tool handlers.

## Development Commands

### Build and Test
```bash
npm run build          # Compile TypeScript to dist/
npm test              # Run Jest test suite
npm run lint          # Run ESLint on TypeScript files
npm run format        # Format code with Prettier
```

### Running Individual Tests
```bash
npm test -- src/proxy-wrapper.test.ts              # Run specific test file
node src/proxy-wrapper.simple.test.js              # Run JavaScript test directly
```

### Development Workflow
```bash
npm run prepare       # Runs build automatically
npm run prepublishOnly # Runs tests and lint before publishing
```

## Key Technical Details

### Module System
- Uses ES modules (`"type": "module"` in package.json)
- TypeScript config targets ES2022 with NodeNext module resolution
- Jest configured for ESM with ts-jest transform

### Dependencies
- **Runtime**: `@modelcontextprotocol/sdk`, `zod`
- **Development**: TypeScript, Jest, ESLint, Prettier
- **Peer Dependencies**: `@modelcontextprotocol/sdk` (must be provided by consuming application)

### File Naming Conventions
- Test files use patterns: `*.test.ts`, `*.test.js`, `*.simple.test.js`
- Interface files in `src/interfaces/` directory
- Utility files in `src/utils/` directory

## Testing Strategy

The project has comprehensive test coverage including:
- **Unit tests**: Mock-based testing of core functionality
- **Integration tests**: Testing with real MCP Server/Client instances
- **Example tests**: Demonstrating usage patterns
- **Edge case tests**: Handling null/undefined values and error conditions
- **JavaScript tests**: Verifying JavaScript compatibility

## Important Implementation Notes

### Hook Execution
- Hooks are executed asynchronously with proper error handling
- Short-circuiting is supported by returning a result from `beforeToolCall`
- Context includes `toolName`, `args`, and `metadata` with request tracking

### Error Handling
- Hook errors are caught and re-thrown with descriptive messages
- Tool call errors return proper MCP error responses with `isError: true`
- Extensive logging for debugging hook execution

### TypeScript Considerations
- Uses `any` types strategically for MCP SDK compatibility
- Includes `@ts-expect-error` comments where runtime behavior differs from types
- Interfaces are stable and marked as such in documentation