# MCP Proxy Wrapper - Implementation Plan

This document outlines the detailed implementation plan for transforming the current MCP Payment Wrapper into a simplified MCP Proxy Wrapper with a generic hook system.

## Project Overview

The goal is to refactor the existing payment-focused wrapper into a lightweight, unopinionated proxy that allows intercepting and modifying tool calls without requiring backend infrastructure or payment-specific functionality.

## Timeline

| Phase | Description | Duration |
|-------|-------------|----------|
| 1 | Preparation and Cleanup | 1 week |
| 2 | Core Implementation | 1 week |
| 3 | Testing and Documentation | 1 week |
| 4 | Finalization | 1 week |

## Detailed Implementation Steps

### Phase 1: Preparation and Cleanup

#### Week 1

1. **Create a new branch for the refactoring**
   - Create a branch named `feature/proxy-wrapper-refactor`
   - Push the branch to remote repository

2. **Review existing codebase**
   - Identify all payment-specific components
   - Document the core proxy functionality to preserve
   - Create a dependency graph of the current implementation

3. **Create a backup**
   - Tag the current version before refactoring
   - Document the current API surface

4. **Update package information**
   - Update package.json with new name (`@modelcontextprotocol/proxy-wrapper`)
   - Update description to reflect the new focus
   - Review dependencies and remove unnecessary ones

5. **Plan the new directory structure**
   - Design a simplified directory structure
   - Create placeholder files for the new implementation

### Phase 2: Core Implementation

#### Week 2

1. **Create new interfaces**
   - Create `src/interfaces/proxy-hooks.ts` with the following interfaces:
     - `ToolCallContext`
     - `ToolCallResult`
     - `ProxyHooks`
     - `ProxyWrapperOptions`

2. **Implement the proxy wrapper**
   - Create `src/proxy-wrapper.ts` with the `wrapWithProxy` function
   - Implement the proxy mechanism for intercepting tool calls
   - Preserve the core functionality from the original wrapper

3. **Implement hook execution**
   - Implement the logic for executing pre-call hooks
   - Implement the logic for executing post-call hooks
   - Add support for modifying arguments and results

4. **Create logging and error handling**
   - Implement a simple logging system
   - Add comprehensive error handling
   - Add debug mode for detailed logging

5. **Create utility functions**
   - Implement helper functions for common operations
   - Create type guards and validation functions

### Phase 3: Testing and Documentation

#### Week 3

1. **Create unit tests**
   - Create tests for the proxy wrapper
   - Create tests for hook execution
   - Create tests for error handling

2. **Create integration tests**
   - Create tests with example MCP servers
   - Test with various hook configurations
   - Test edge cases and error scenarios

3. **Write documentation**
   - Update README with new usage instructions
   - Create API documentation
   - Document the hook system
   - Create usage examples

4. **Create migration guide**
   - Document the changes from the payment wrapper
   - Provide examples of migrating existing code
   - Create a FAQ section for common questions

### Phase 4: Finalization

#### Week 4

1. **Perform final code review**
   - Review all code for quality and consistency
   - Ensure all tests pass
   - Check for any remaining payment-specific code

2. **Update exports**
   - Update `index.ts` with the new exports
   - Ensure backward compatibility where possible
   - Remove deprecated exports

3. **Create example implementations**
   - Create a basic example
   - Create an example with custom hooks
   - Create an example that shows migration from the payment wrapper

4. **Prepare for release**
   - Update version number
   - Create release notes
   - Create a pull request for review

## Code Removal Details

### Files to Remove

- `src/hooks/interfaces/payment-provider.ts`
- `src/hooks/interfaces/pricing-strategy.ts`
- `src/hooks/interfaces/auth-provider.ts`
- `src/hooks/providers/default-payment-provider.ts`
- `src/hooks/providers/default-pricing-strategy.ts`
- `src/hooks/providers/default-auth-provider.ts`
- `src/services/mock-auth-service.ts`
- `src/interfaces/auth-service.ts`
- `src/mock-backend/` (entire directory)

### Files to Modify

- `src/payment-wrapper.ts` → Rename to `src/proxy-wrapper.ts` and simplify
- `src/index.ts` → Update exports
- `package.json` → Update name, description, and dependencies
- `README.md` → Update documentation

### Tests to Remove

- `src/payment-wrapper.auth.test.ts`
- `src/payment-tools.test.ts`
- Any test files specifically for payment, pricing, or authentication

### Tests to Create

- `src/proxy-wrapper.test.ts`
- `src/proxy-wrapper.integration.test.ts`
- `src/proxy-wrapper.edge-cases.test.ts`

## New File Structure

```
src/
├── interfaces/
│   └── proxy-hooks.ts
├── utils/
│   └── logger.ts
├── proxy-wrapper.ts
├── index.ts
└── tests/
    ├── proxy-wrapper.test.ts
    ├── proxy-wrapper.integration.test.ts
    └── proxy-wrapper.edge-cases.test.ts
```

## Implementation Details

### proxy-hooks.ts

```typescript
/**
 * @file Proxy Hooks Interfaces
 * @version 1.0.0
 * 
 * Defines the interfaces for the proxy hook system.
 */

/**
 * Context for a tool call
 */
export interface ToolCallContext {
  /** Name of the tool being called */
  toolName: string;
  
  /** Arguments passed to the tool */
  args: Record<string, any>;
  
  /** Additional metadata */
  metadata?: Record<string, any>;
}

/**
 * Result of a tool call
 */
export interface ToolCallResult {
  /** Result returned by the tool */
  result: any;
  
  /** Additional metadata */
  metadata?: Record<string, any>;
}

/**
 * Hooks for the proxy wrapper
 */
export interface ProxyHooks {
  /**
   * Hook that runs before a tool call
   * @param context Context for the tool call
   * @returns Void or a custom result to short-circuit the tool call
   */
  beforeToolCall?: (context: ToolCallContext) => Promise<void | ToolCallResult>;
  
  /**
   * Hook that runs after a tool call
   * @param context Context for the tool call
   * @param result Result of the tool call
   * @returns Modified result
   */
  afterToolCall?: (context: ToolCallContext, result: ToolCallResult) => Promise<ToolCallResult>;
}

/**
 * Options for the proxy wrapper
 */
export interface ProxyWrapperOptions {
  /** Additional metadata to include with every tool call */
  metadata?: Record<string, any>;
  
  /** Hooks for the proxy */
  hooks?: ProxyHooks;
  
  /** Enable debug mode */
  debug?: boolean;
}
```

### proxy-wrapper.ts

```typescript
/**
 * @file Proxy Wrapper for MCP Server
 * @version 1.0.0
 * 
 * This module provides a lightweight wrapper for an MCP Server that
 * allows intercepting and modifying tool calls.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createLogger } from './utils/logger.js';
import { ProxyHooks, ProxyWrapperOptions, ToolCallContext, ToolCallResult } from './interfaces/proxy-hooks.js';

/**
 * Wraps an MCP server with a proxy that allows intercepting tool calls
 * @param server The MCP server to wrap
 * @param options Options for the proxy wrapper
 * @returns A new MCP server with the proxy functionality
 */
export function wrapWithProxy(
  server: McpServer,
  options?: ProxyWrapperOptions
): McpServer {
  const logger = createLogger(options?.debug ? 'debug' : 'info');
  const hooks = options?.hooks || {};
  const metadata = options?.metadata || {};

  // Create a proxy around the server
  // Implementation details...

  return proxiedServer;
}
```

## Migration Examples

### Before (Payment Wrapper)

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { wrapWithPayments } from '@modelcontextprotocol/payment-wrapper';

const server = new McpServer({ 
  name: "My MCP Server",
  version: "1.0.0"
});

const paymentServer = wrapWithPayments(server, { 
  apiKey: 'YOUR_API_KEY',
  userToken: 'USER_JWT_TOKEN',
  baseAuthUrl: 'https://auth.yourservice.com'
});
```

### After (Proxy Wrapper)

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { wrapWithProxy } from '@modelcontextprotocol/proxy-wrapper';

const server = new McpServer({ 
  name: "My MCP Server",
  version: "1.0.0"
});

const proxiedServer = wrapWithProxy(server, {
  hooks: {
    beforeToolCall: async (context) => {
      console.log(`Tool call: ${context.toolName}`);
      // Custom authentication or payment logic can go here
    },
    afterToolCall: async (context, result) => {
      console.log(`Tool result:`, result);
      return result;
    }
  },
  debug: true
});
```

## Conclusion

This implementation plan provides a detailed roadmap for transforming the current MCP Payment Wrapper into a simplified MCP Proxy Wrapper. By following this plan, we can create a lightweight, unopinionated library that provides a generic hook system for intercepting and modifying tool calls without requiring backend infrastructure or payment-specific functionality. 