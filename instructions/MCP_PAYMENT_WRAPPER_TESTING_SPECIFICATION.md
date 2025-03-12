# MCP Payment Wrapper Testing Specification

## 1. Overview

This document defines the standards and best practices for testing the MCP Payment Wrapper. It provides guidelines to ensure consistent, reliable, and maintainable tests.

## 2. Test File Organization

### 2.1 File Naming Convention

Tests should be organized into separate files based on their focus area:

- `payment-wrapper.test.ts`: Core functionality tests
- `payment-wrapper.{feature}.test.ts`: Feature-specific tests
- `payment-wrapper.edge-cases.test.ts`: Edge cases and error handling
- Integration tests should be placed in the `integration-tests` directory

### 2.2 File Structure

Each test file should include:

1. **File header comment**:
   ```typescript
   /**
    * @file Test Description
    * @version x.y.z
    * @status [STABLE | IN_PROGRESS]
    * @lastModified YYYY-MM-DD
    * 
    * Detailed description of what this test file covers
    */
   ```

2. **Imports**: Organize imports in the following order:
   - Testing framework imports
   - Module under test
   - Mocks and test utilities
   - Other dependencies

3. **Test Setup Variables**: Declare variables needed across multiple tests

4. **Setup and Teardown**: Define `beforeEach`, `afterEach`, `beforeAll`, and `afterAll` hooks

5. **Test Groups**: Organize tests into logical groups using `describe` blocks

6. **Individual Tests**: Write individual test cases using `test` or `it` functions

## 3. Logging in Tests

### 3.1 TestLogger

The project uses a custom `TestLogger` class for capturing and verifying logs in tests.

```typescript
import { TestLogger } from './utils/test-helpers.js';

let testLogger: TestLogger;

beforeEach(() => {
  testLogger = new TestLogger();
});

afterEach(() => {
  testLogger.clear();
});

test('example test with logging', () => {
  // Use the test logger
  const wrappedServer = wrapWithPayments(server, {
    // ...other options
    loggerOptions: { customLogger: testLogger.logger }
  });
  
  // Perform operations...
  
  // Verify logs
  expect(testLogger.contains('Expected log message')).toBe(true);
  
  // Get all logs
  const allLogs = testLogger.getAllLogs();
  
  // Get specific level logs
  const errorLogs = testLogger.getLogs('error');
});
```

### 3.2 MemoryTransport

For more advanced logging tests, use the Winston MemoryTransport:

```typescript
import { MemoryTransport } from './utils/logger.js';
import winston from 'winston';

let memoryTransport: MemoryTransport;
let testLogger: winston.Logger;

beforeEach(() => {
  memoryTransport = new MemoryTransport();
  testLogger = winston.createLogger({
    level: 'debug',
    transports: [memoryTransport as unknown as winston.transport.TransportStream]
  });
});

// Use memoryTransport.contains() to verify log messages
expect(memoryTransport.contains('Expected log message')).toBe(true);

// Use memoryTransport.logs to access all captured logs
const debugLogs = memoryTransport.logs.filter(log => log.level === 'debug');
```

Note: When using `MemoryTransport`, you need to cast it to `winston.transport.TransportStream` to avoid type errors.

## 4. Server Mocking

### 4.1 Test Server Creation

Use the helper functions to create consistent test servers:

```typescript
import { createTestServer, createExtendedTestServer } from './utils/test-helpers.js';

// Basic MCP server
const server = createTestServer();

// Extended server with custom properties and methods
const extendedServer = createExtendedTestServer();
```

### 4.2 Adding `callTool` Method for Testing

To test tool execution, add the `callTool` method to the MCP server prototype:

```typescript
// Add once in your test setup
(McpServer.prototype as any).callTool = async function(name: string, args: any) {
  const tool = (this as any)._registeredTools[name];
  if (!tool) {
    throw new Error(`Tool not found: ${name}`);
  }
  return await tool.callback(args, {});
};
```

## 5. Authentication Testing

### 5.1 Mock Auth Service

Use the `MockAuthService` for authentication testing:

```typescript
import { MockAuthService } from './services/mock-auth-service.js';

let mockAuthService: MockAuthService;

beforeEach(() => {
  mockAuthService = new MockAuthService({
    apiKey: 'test-api-key',
    baseAuthUrl: 'https://auth.mcp-api.com'
  });
});

// Generate a valid token
const validToken = mockAuthService.generateToken('test-user');
```

### 5.2 Test Options Creation

Use a helper function to create consistent test options:

```typescript
function createTestOptions(logger: TestLogger, overrides = {}) {
  // Generate a valid token
  const validToken = mockAuthService.generateToken('test-user');
  
  return {
    apiKey: 'test-api-key',
    userToken: validToken,
    debugMode: true,
    loggerOptions: {
      customLogger: logger.logger
    },
    ...overrides
  };
}
```

## 6. Testing Payment Verification

### 6.1 Testing Funds Checks

Use the `_testOverrideFundsCheck` option to control funds check behavior:

```typescript
// Force funds check to pass
const options = createTestOptions(testLogger, { _testOverrideFundsCheck: true });

// Force funds check to fail
const options = createTestOptions(testLogger, { _testOverrideFundsCheck: false });
```

### 6.2 Verifying Billing Operations

Check logs to verify billing operations:

```typescript
// Verify funds check
expect(testLogger.contains('Checking funds for user')).toBe(true);

// Verify charge processing
expect(testLogger.contains('Processed charge for user')).toBe(true);
```

## 7. Edge Case Testing

### 7.1 Input Validation

Test with invalid inputs:

```typescript
// Test with missing required option
expect(() => {
  wrapWithPayments(server, { /* missing apiKey */ });
}).toThrow('Developer API key is required');

// Test with invalid inputs
expect(() => {
  // @ts-expect-error - Testing invalid input
  wrapWithPayments(null, validOptions);
}).toThrow();
```

### 7.2 Error Handling

Test error propagation and recovery:

```typescript
// Test error propagation
try {
  await wrappedServer.callTool('error_tool', { param: 'test' });
} catch (error) {
  // Expected to throw
}

// Verify error was logged
expect(testLogger.contains('Error in tool')).toBe(true);

// Test recovery after errors
try {
  await wrappedServer.callTool('error_tool', { param: 'test' });
} catch (error) {
  // Expected to throw
}

// Should still be able to use the server
const result = await wrappedServer.callTool('working_tool', { param: 'test' });
expect(result.content[0].text).toBe('Success');
```

## 8. Integration Testing

### 8.1 Mock Backend Server

For integration tests, use the mock backend server:

```typescript
import request from 'supertest';

// Import and start mock backend
const mockBackendModule = require('../mock-backend/server-js.cjs');
const mockBackend = mockBackendModule.buildServer({ logger: false });
await mockBackend.server.listen(TEST_PORT);

// Close server after tests
afterAll(async () => {
  await mockBackend.server.close();
});
```

### 8.2 API Testing

Test interactions with the mock backend:

```typescript
// Test backend API
const response = await request(mockBackend.server.server)
  .post('/auth/verify-token')
  .set('X-API-Key', clientApiKey)
  .send({ token: userToken });

expect(response.status).toBe(200);
expect(response.body.valid).toBe(true);
```

### 8.3 Full Integration Flow

Test the complete integration flow:

```typescript
// Create payment wrapper with mock backend
const wrappedServer = wrapWithPayments(testMcpServer, {
  apiKey: clientApiKey,
  userToken: userToken,
  baseAuthUrl: TEST_BASE_URL
});

// Test the full flow
const result = await wrappedServer.callTool('test_tool', { param: 'integration test' });
expect(result.content[0].text).toBe('Processed: integration test');
```

## 9. Best Practices

1. **Isolated Tests**: Each test should be independent and not rely on the state from other tests
2. **Clear Assertions**: Use descriptive assertions that clearly explain what is being tested
3. **Minimal Test Code**: Keep test code minimal and focused on what's being tested
4. **Consistent Mocking**: Use consistent mocking patterns across all tests
5. **Comprehensive Coverage**: Test both happy paths and edge cases
6. **Mock External Dependencies**: Always mock external services in unit tests
7. **Clear Test Names**: Use descriptive test names that explain what is being tested
8. **One Assertion Per Test**: Prefer one main assertion per test where possible
9. **Test Isolation**: Clean up after tests using afterEach/afterAll hooks
10. **Avoid Test Interdependence**: Tests should not depend on the order of execution

## 10. TypeScript Considerations

1. **Type Safety**: Use proper typings for all test variables
2. **Handle 'any' Types**: When using 'any', add a comment explaining why
3. **Type Assertions**: Use type assertions only when necessary
4. **Mock Types**: Ensure mocks have correct typings
5. **Fix Type Errors**: Address TypeScript errors in tests rather than suppressing them

## Appendix A: Common Test Patterns

### A.1 Testing Tool Registration and Execution

```typescript
test('registers and calls a tool successfully', async () => {
  const server = createTestServer();
  const wrappedServer = wrapWithPayments(server, createTestOptions(testLogger, {
    _testOverrideFundsCheck: true
  }));
  
  // Register a tool
  wrappedServer.tool('test_tool', { value: z.string() }, async (args: any) => {
    return {
      content: [{ type: 'text' as const, text: `Result: ${args.value}` }]
    };
  });
  
  // Call the tool
  const result = await (wrappedServer as any).callTool('test_tool', { value: 'test' });
  
  // Verify result
  expect(result.content[0].text).toBe('Result: test');
  
  // Verify logs
  expect(testLogger.contains('Executing tool')).toBe(true);
  expect(testLogger.contains('Processed charge for user')).toBe(true);
});
```

### A.2 Testing Authentication Flow

```typescript
test('requires authentication when no token provided', async () => {
  const server = createTestServer();
  const wrappedServer = wrapWithPayments(server, {
    apiKey: 'test-api-key',
    loggerOptions: { customLogger: testLogger.logger }
  });
  
  // Call a tool without authentication
  const result = await (wrappedServer as any).callTool('test_tool', { value: 'test' });
  
  // Verify authentication required response
  expect(result).toHaveProperty('error', 'authentication_required');
  expect(result).toHaveProperty('authUrl');
  
  // Verify logs
  expect(testLogger.contains('Authentication required')).toBe(true);
});
```

### A.3 Testing Proxy Behavior

```typescript
test('forwards methods and preserves context', () => {
  const server = createExtendedTestServer();
  server.customMethod = function(arg: string) {
    return `${this.name}: ${arg}`;
  };
  
  const wrappedServer = wrapWithPayments(server, createTestOptions(testLogger));
  
  // Call method on wrapped server
  const result = (wrappedServer as any).customMethod('test');
  
  // Verify context preservation
  expect(result).toBe('Test Server: test');
});
```

## Appendix B: Fixing Common Issues

### B.1 MemoryTransport Type Error

When using `MemoryTransport` with Winston, cast it to the correct type:

```typescript
memoryTransport = new MemoryTransport();
testLogger = winston.createLogger({
  level: 'debug',
  // Cast to the Winston transport type
  transports: [memoryTransport as unknown as winston.transport.TransportStream]
});
```

### B.2 Adding callTool Method

If you get errors about missing `callTool` method:

```typescript
// Add in beforeAll or at the top of the test file
if (!(McpServer.prototype as any).callTool) {
  (McpServer.prototype as any).callTool = async function(name: string, args: any) {
    const tool = (this as any)._registeredTools[name];
    if (!tool) {
      throw new Error(`Tool not found: ${name}`);
    }
    return await tool.callback(args, {});
  };
}
```

### B.3 Fixing Type Errors in Tests

Always fix type errors rather than ignoring them. If you need to test invalid inputs:

```typescript
// Use @ts-expect-error with explanation
// @ts-expect-error - Intentionally testing with invalid input
wrapWithPayments(null, validOptions);
``` 