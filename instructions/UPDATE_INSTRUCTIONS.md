# Instructions for Updating payment-tools.test.ts

## Background

The file `payment-tools.test.ts` needs to be updated to follow the MCP Payment Wrapper Testing Specification. The current file already has good test coverage and follows many of the best practices, but it needs a few updates to fully comply with the specification.

## Required Changes

1. **Replace Custom TestLogger with the Shared Implementation**
   - Current: Uses a custom TestLogger class defined in the file
   - Update: Import TestLogger from utils/test-helpers.js

2. **Add a createTestOptions Helper Function**
   - Current: Options created inline in beforeEach
   - Update: Extract to a helper function for better reusability

3. **Add Explicit Mock Auth Service Creation**
   - Current: Mocks are set up but no explicit service creation
   - Update: Create a mockAuthService instance in beforeEach 

4. **Organize Imports According to Specification**
   - Current: Imports are somewhat organized
   - Update: Group imports according to specification categories

## Step-by-Step Instructions

### 1. Update Imports Section

```typescript
// Testing framework imports
import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';

// Module under test
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { wrapWithPayments } from './payment-wrapper.js';

// Mocks and test utilities
import { MockAuthService } from './services/mock-auth-service.js';
import { TestLogger } from './utils/test-helpers.js';

// Other dependencies
import * as winston from 'winston';
```

### 2. Remove Custom TestLogger Implementation

Delete the entire custom TestLogger class implementation (approximately lines 31-72 in the original file).

### 3. Add mockAuthService to Test Setup Variables

```typescript
// Test setup variables
let server: McpServer;
let wrappedServer: McpServer;
let testLogger: TestLogger;
let mockAuthService: MockAuthService;
```

### 4. Add createTestOptions Helper Function

Add this function after the createTestServer function:

```typescript
// Helper function to create test options
function createTestOptions(logger: TestLogger, overrides = {}) {
  return {
    apiKey: 'test-api-key',
    userToken: 'valid-mock-jwt-token', // Add a user token to avoid auth required responses
    loggerOptions: { customLogger: logger.logger },
    _testOverrideFundsCheck: true, // Ensure funds check always passes for tests
    ...overrides
  };
}
```

### 5. Update beforeEach Function

Replace the current beforeEach function with:

```typescript
beforeEach(() => {
  // Create a new test server
  server = createTestServer();
  
  // Create a fresh logger instance for each test
  testLogger = new TestLogger();
  
  // Create mock auth service
  mockAuthService = new MockAuthService({
    apiKey: 'test-api-key',
    baseAuthUrl: 'https://auth.mcp-api.com'
  });
  
  // Mock the authentication service methods
  jest.spyOn(MockAuthService.prototype, 'createSession').mockImplementation((sessionId, data) => {
    return Promise.resolve();
  });
  
  jest.spyOn(MockAuthService.prototype, 'checkSessionStatus').mockImplementation((sessionId) => {
    return Promise.resolve({
      status: 'pending',
      expires_in: 1800
    });
  });
  
  jest.spyOn(MockAuthService.prototype, 'generateAuthUrl').mockImplementation(() => {
    return 'https://auth.mcp-api.com/auth?session=test-session';
  });
  
  jest.spyOn(MockAuthService.prototype, 'verifyToken').mockImplementation(() => {
    return Promise.resolve({
      valid: true,
      userId: 'test-user-id'
    });
  });
  
  // Add the prototype method to call a tool directly for tests
  if (!(McpServer.prototype as any).callTool) {
    (McpServer.prototype as any).callTool = async function(name: string, args: any) {
      const tool = (this as any)._registeredTools[name];
      if (!tool) {
        throw new Error(`Tool not found: ${name}`);
      }
      // Pass an empty object as the second argument (extra) to the callback
      return await tool.callback(args, {});
    };
  }
  
  // Create the wrapped server with test options
  wrappedServer = wrapWithPayments(server, createTestOptions(testLogger));
});
```

### 6. Update the Helper Functions for Log Checking

Replace both the containsLog and getLogsByLevel functions with:

```typescript
// Helper function to check if logs contain text at a specific level
function containsLog(text: string, level: string = 'info'): boolean {
  return testLogger.contains(text, level);
}

// Helper function to get logs by level
function getLogsByLevel(level: string): any[] {
  return testLogger.getLogs(level);
}
```

## Testing the Changes

After making these changes:

1. Run the tests to make sure they still pass:
   ```bash
   npm test -- src/payment-tools.test.ts
   ```

2. Check for any TypeScript errors:
   ```bash
   npx tsc --noEmit
   ```

## Notes

- The TestLogger from utils/test-helpers.js should have the same API as the custom implementation (contains, getLogs, clear methods)
- Make sure to update any imports or implementations if the shared TestLogger has slightly different method signatures
- The changes aim to standardize the testing approach without changing the actual test behaviors or assertions 