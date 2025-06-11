# MCP Proxy Wrapper Refactoring Plan

## Overview

This document outlines the plan to refactor the MCP Proxy Wrapper to align with MCP design principles, make it future-proof against SDK changes, and ensure better compatibility with the MCP ecosystem. The plan focuses on removing non-standard implementations (like the custom `callTool` method) and adopting the client-server pattern for testing as recommended by the MCP protocol.

## Core Design Changes

Instead of adding a non-standard `callTool` method to the server, we'll:

1. Focus solely on wrapping the server's tool registration method (`server.tool()`)
2. Properly intercept and wrap the tool handlers
3. Remove the custom `callTool` method entirely
4. Design a testing approach that uses the standard client-server communication pattern

## Implementation Checklist

### Phase 1: Refactor the TypeScript Proxy Wrapper

- [ ] **1.1 Update the TypeScript wrapper implementation**
  - Remove any references to a `callTool` method
  - Ensure the `tool` method wrapping correctly intercepts registrations
  - Add clear documentation about proper usage patterns

- [ ] **1.2 Update the interfaces**
  - Revise hook interfaces to properly describe how interception works
  - Document that hooks operate at the handler level, not at a custom `callTool` level
  - Ensure all type definitions are compliant with the MCP SDK

### Phase 2: Make JavaScript Implementation Consistent

- [ ] **2.1 Update the JavaScript wrapper**
  - Remove the custom `callTool` implementation
  - Make functionality consistent with the TypeScript implementation
  - Add console warnings for deprecated usage patterns

- [ ] **2.2 Add migration helpers (if needed)**
  - Provide utility functions to help transition existing code

### Phase 3: Create Proper Testing Infrastructure

- [ ] **3.1 Develop client-server test utilities**
  - Create a `TestClientServer` class or utility functions
  - Implement memory transport for testing
  - Provide helper methods for easy test setup and teardown

- [ ] **3.2 Create an example test**
  - Build a reference implementation that shows correct usage
  - Include detailed comments explaining each step

- [ ] **3.3 Update existing test cases**
  - Convert simple tests first as proof of concept
  - Replace direct `server.callTool()` calls with proper client calls
  - Update assertions to work with the new pattern

### Phase 4: Documentation and Examples

- [ ] **4.1 Update README and API documentation**
  - Explain the design principles and why they matter
  - Provide clear usage examples
  - Document the hook system in detail

- [ ] **4.2 Create a migration guide**
  - Document step-by-step instructions for transitioning from the old approach
  - Include before/after code examples
  - List common issues and their solutions

- [ ] **4.3 Add inline code comments**
  - Ensure all key components have clear, descriptive comments
  - Document any non-obvious behavior or edge cases

## Tasks By Priority

1. **Highest Priority**
   - Update TypeScript implementation to remove `callTool`
   - Create client-server test utilities
   - Build a reference example test

2. **Medium Priority**
   - Update JavaScript implementation
   - Convert existing tests
   - Update documentation

3. **Lower Priority**
   - Add migration helpers
   - Polish and optimize implementations
   - Add additional examples

## Implementation Notes

- **Backward Compatibility Considerations**: The removal of `callTool` is a breaking change, but necessary for proper alignment with MCP standards.

- **Testing Strategy**: Focus on creating a testing approach that is both comprehensive and easy to understand, even if it requires more setup code.

- **Incremental Approach**: Implement changes incrementally, starting with the core TypeScript implementation, then extending to tests and JavaScript version.

## Expected Outcome

When this refactoring is complete, the MCP Proxy Wrapper will:

1. Properly align with MCP protocol design principles
2. Work seamlessly with the current and future versions of the MCP SDK
3. Provide a clean, type-safe API for intercepting tool calls
4. Include comprehensive tests that demonstrate correct usage
5. Be well-documented with clear migration guidance

This refactoring addresses the root cause of the current type errors and test failures while setting the foundation for a more maintainable and future-proof implementation. 