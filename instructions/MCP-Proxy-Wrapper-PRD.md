# MCP Proxy Wrapper - Product Requirements Document

## Overview

The MCP Proxy Wrapper is a lightweight, unopinionated library that wraps a Model Context Protocol (MCP) server and provides a simple hook system for intercepting and modifying tool calls. It acts as a transparent proxy between clients and the MCP server, allowing developers to execute custom code before and after tool calls without requiring any backend infrastructure.

## Goals

1. Simplify the current implementation by removing payment-specific functionality
2. Create a generic hook system that allows intercepting tool calls
3. Eliminate the requirement for API keys and authentication
4. Provide a transparent proxy that requires minimal configuration
5. Allow developers to execute custom code before and after tool calls

## Non-Goals

1. Implementing payment processing logic
2. Providing authentication mechanisms
3. Enforcing specific pricing strategies
4. Requiring backend infrastructure

## Core Functionality

### Proxy Mechanism

The wrapper will act as a transparent proxy between clients and the MCP server:

1. Intercept all tool calls to the wrapped MCP server
2. Execute pre-call hooks
3. Forward the call to the underlying MCP server
4. Execute post-call hooks
5. Return the result to the client

### Hook System

The hook system will be simple and flexible:

1. **Pre-call hooks**: Execute before a tool call is forwarded to the MCP server
   - Can modify the tool call arguments
   - Can prevent the tool call from being forwarded
   - Can return a custom response instead

2. **Post-call hooks**: Execute after a tool call is processed by the MCP server
   - Can modify the response before it's returned to the client
   - Can perform side effects (logging, analytics, etc.)

### Hook Interface

```typescript
interface ToolCallContext {
  toolName: string;
  args: Record<string, any>;
  metadata?: Record<string, any>;
}

interface ToolCallResult {
  result: any;
  metadata?: Record<string, any>;
}

interface ProxyHooks {
  // Pre-call hook
  beforeToolCall?: (context: ToolCallContext) => Promise<void | ToolCallResult>;
  
  // Post-call hook
  afterToolCall?: (context: ToolCallContext, result: ToolCallResult) => Promise<ToolCallResult>;
}
```

## Implementation Details

### Wrapper Function

```typescript
function wrapWithProxy(server: McpServer, hooks?: ProxyHooks): McpServer
```

This function will:
1. Create a Proxy around the MCP server
2. Intercept tool calls
3. Execute hooks at appropriate times
4. Return a new McpServer instance that behaves like the original but with hooks

### Configuration Options

```typescript
interface ProxyWrapperOptions {
  // Optional metadata to include with every tool call
  metadata?: Record<string, any>;
  
  // Optional hooks
  hooks?: ProxyHooks;
  
  // Optional debug mode
  debug?: boolean;
}
```

## Usage Examples

### Basic Usage

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { wrapWithProxy } from '@modelcontextprotocol/proxy-wrapper';

// Create your MCP server
const server = new McpServer({ 
  name: "My MCP Server",
  version: "1.0.0"
});

// Register tools
server.tool("greet", { name: z.string() }, async (args) => {
  return {
    content: [{ type: "text", text: `Hello, ${args.name}!` }]
  };
});

// Wrap with proxy
const proxiedServer = wrapWithProxy(server);

// Use the proxied server as normal
```

### With Custom Hooks

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { wrapWithProxy } from '@modelcontextprotocol/proxy-wrapper';

// Create your MCP server
const server = new McpServer({ 
  name: "My MCP Server",
  version: "1.0.0"
});

// Register tools
server.tool("greet", { name: z.string() }, async (args) => {
  return {
    content: [{ type: "text", text: `Hello, ${args.name}!` }]
  };
});

// Wrap with proxy and custom hooks
const proxiedServer = wrapWithProxy(server, {
  beforeToolCall: async (context) => {
    console.log(`Tool call: ${context.toolName} with args:`, context.args);
    
    // You can modify args
    if (context.toolName === 'greet') {
      context.args.name = `${context.args.name} (modified)`;
    }
    
    // Or prevent the call and return a custom response
    if (context.args.name === 'blocked') {
      return {
        result: {
          content: [{ type: "text", text: "This name is blocked." }]
        }
      };
    }
  },
  
  afterToolCall: async (context, result) => {
    console.log(`Tool result:`, result);
    
    // You can modify the result
    if (context.toolName === 'greet') {
      result.result.content[0].text += " Thanks for using our service!";
    }
    
    return result;
  }
});

// Use the proxied server as normal
```

## Migration Path

For users of the current payment wrapper:

1. Replace `wrapWithPayments` with `wrapWithProxy`
2. Remove API key and authentication configuration
3. Implement custom hooks for any payment or authentication logic needed
4. Use the metadata field for any additional context needed by hooks

## Success Metrics

1. Reduced configuration complexity
2. Elimination of backend dependencies
3. Simplified hook system
4. Transparent proxy behavior
5. Minimal performance overhead

## Implementation Plan

### Phase 1: Preparation and Cleanup (Week 1)

1. Create a new branch for the refactoring
2. Review existing codebase to identify components to remove
3. Document the core proxy functionality that needs to be preserved
4. Create a backup of the current implementation
5. Update package.json with new name and description

### Phase 2: Core Implementation (Week 2)

1. Create new interfaces for the hook system
2. Implement the basic proxy wrapper function
3. Implement the hook execution mechanism
4. Create basic logging and error handling

### Phase 3: Testing and Documentation (Week 3)

1. Create unit tests for the proxy wrapper
2. Create integration tests with example MCP servers
3. Write documentation and usage examples
4. Create migration guide for existing users

### Phase 4: Finalization (Week 4)

1. Perform final code review
2. Update README and other documentation
3. Create example implementations
4. Prepare for release

## Implementation Checklist

- [x] Core proxy wrapper implementation
- [x] Hook system implementation
- [x] Error handling
- [x] Unit tests
- [x] Integration tests
- [x] Edge case tests
- [x] Documentation
- [x] Example usage
- [x] Migration guide
- [x] Final code review
- [x] Cleanup of payment-related code 