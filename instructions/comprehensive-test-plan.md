# Plan for More Comprehensive Tests for the MCP Payment Wrapper

This document outlines a comprehensive testing plan to thoroughly verify the functionality of our payment wrapper. This will ensure that all aspects of the wrapper are working correctly and that it can handle various edge cases and scenarios.

## Current Test Coverage Analysis

Currently, our tests in `payment-wrapper.test.ts` cover:
- Basic validation (API key, user token)
- Creation of a wrapped server
- Tool call forwarding with sufficient funds
- Tool call rejection with insufficient funds

However, we're missing tests for:
- Resource handling
- Prompt handling
- Error handling during tool/resource/prompt execution
- JWT token validation edge cases
- Billing transaction details verification
- Debug mode functionality

## Comprehensive Test Plan

### 1. Authentication and Validation Tests

- **API Key Validation**
  - Test with empty, null, undefined, and invalid format API keys
  - Test with valid API keys of different formats

- **JWT Token Validation**
  - Test with empty, null, undefined tokens
  - Test with malformed tokens (not 3 parts)
  - Test with invalid base64 encoding
  - Test with expired tokens
  - Test with tokens missing required claims
  - Test with valid tokens containing different user IDs

### 2. Server Wrapping Tests

- **Server Instance Tests**
  - Verify that the wrapped server maintains all properties of the original server
  - Test that non-intercepted methods work identically to the original server
  - Verify that the wrapped server can be used with different transports

- **Configuration Tests**
  - Test with debug mode enabled/disabled
  - Test with different combinations of options

### 3. Tool Method Tests

- **Registration Tests**
  - Verify that tools can be registered on the wrapped server
  - Test registering tools with various schemas
  - Test that tools registered on the original server are accessible through the wrapper

- **Execution Tests**
  - Test successful execution with sufficient funds
  - Test rejection with insufficient funds
  - Test with various argument types and structures
  - Test error handling during tool execution
  - Verify that billing transactions are processed correctly after successful execution

### 4. Resource Method Tests

- **Registration Tests**
  - Verify that resources can be registered on the wrapped server
  - Test registering resources with various templates
  - Test that resources registered on the original server are accessible through the wrapper

- **Execution Tests**
  - Test successful resource access with sufficient funds
  - Test rejection with insufficient funds
  - Test with various URI formats
  - Test error handling during resource access
  - Verify that billing transactions are processed correctly after successful access

### 5. Prompt Method Tests

- **Registration Tests**
  - Verify that prompts can be registered on the wrapped server
  - Test that prompts registered on the original server are accessible through the wrapper

- **Execution Tests**
  - Test successful prompt execution with sufficient funds
  - Test rejection with insufficient funds
  - Test error handling during prompt execution
  - Verify that billing transactions are processed correctly after successful execution

### 6. Billing Tests

- **Billing Status Tests**
  - Test billing status checks for different user IDs
  - Test billing status for different tool/resource/prompt names
  - Verify that expensive tools are correctly identified and priced

- **Transaction Processing Tests**
  - Verify that transactions include correct user ID, cost, and timestamp
  - Test that tool/resource/prompt names are correctly included in transactions
  - Test transaction processing for different types of operations

### 7. Error Handling Tests

- **General Error Tests**
  - Test handling of errors thrown during tool/resource/prompt execution
  - Verify that errors are properly logged
  - Test that errors don't prevent future operations

- **Edge Case Tests**
  - Test with very large arguments
  - Test with concurrent operations
  - Test with repeated operations

### 8. Integration Tests

- **End-to-End Tests**
  - Test the complete flow from server creation to tool execution
  - Verify that the wrapper works correctly with the MCP server transport
  - Test integration with a simple client

## Implementation Plan

We'll create a new test file called `payment-wrapper.comprehensive.test.ts` that will include all these additional tests. Here's how we'll structure the implementation:

1. **Setup and Mocking**
   - Create more sophisticated mocks for JWT verification
   - Create mocks for billing status checks with configurable responses
   - Set up test fixtures for different server configurations

2. **Test Suites**
   - Organize tests into logical suites based on the categories above
   - Implement tests in order of priority (critical functionality first)

3. **Test Helpers**
   - Create helper functions to reduce code duplication
   - Implement utilities for common assertions

4. **Documentation**
   - Add detailed comments explaining the purpose of each test
   - Document any assumptions or limitations

## Next Steps

1. Create the new test file with the basic structure
2. Implement the authentication and validation tests
3. Implement the server wrapping tests
4. Implement the tool, resource, and prompt method tests
5. Implement the billing and error handling tests
6. Implement the integration tests
7. Run all tests and fix any issues
8. Document the test coverage and results

## Implementation Priority

We will focus first on tool, resource, and prompt method tests to ensure proper wrapping of the MCP server methods. This is critical to verify that our proxy-based approach correctly intercepts and processes all method calls. 