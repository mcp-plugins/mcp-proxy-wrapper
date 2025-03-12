# Winston Logger Implementation for MCP Payment Wrapper

This document outlines the implementation plan for integrating Winston as the logging solution for the MCP Payment Wrapper.

## Problem Statement

The current implementation uses `console.log` and `console.error` for logging, which causes issues when the MCP server uses stdio transport:

1. Console output interferes with the JSON-based communication protocol
2. Random log messages can corrupt the protocol messages
3. Potential deadlocks if stdio buffers fill up

## Implementation Plan

### 1. Add Dependencies

```bash
npm install winston
```

### 2. Create Logger Module

Create a new file `src/utils/logger.ts` that will:
- Provide a factory function to create Winston loggers
- Detect if a server is using stdio transport
- Configure appropriate transports based on the environment

### 3. Update Payment Wrapper Options

Extend the `PaymentWrapperOptions` interface to include logger configuration options.

### 4. Modify Payment Wrapper Implementation

Replace all `console.log` and `console.error` calls with the Winston logger.

### 5. Update Tests

Modify tests to use a memory transport for capturing and verifying logs.

## Detailed Implementation

### Logger Module (`src/utils/logger.ts`)

```typescript
import winston from 'winston';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import path from 'path';
import fs from 'fs';

export interface LoggerOptions {
  level?: string;
  stdioMode?: boolean;
  logFilePath?: string;
  customLogger?: winston.Logger;
}

/**
 * Creates a Winston logger configured based on the provided options
 * 
 * @param options Configuration options for the logger
 * @returns A configured Winston logger instance
 */
export function createLogger(options: LoggerOptions = {}): winston.Logger {
  // If a custom logger is provided, use it
  if (options.customLogger) {
    return options.customLogger;
  }
  
  const { 
    level = 'info', 
    stdioMode = false, 
    logFilePath = './logs/mcp-payment.log' 
  } = options;
  
  // Ensure log directory exists
  const logDir = path.dirname(logFilePath);
  if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir, { recursive: true });
  }
  
  // Define log format
  const format = winston.format.combine(
    winston.format.timestamp(),
    winston.format.printf(({ level, message, timestamp, ...rest }) => {
      const meta = Object.keys(rest).length ? JSON.stringify(rest) : '';
      return `${timestamp} [${level.toUpperCase()}] ${message} ${meta}`;
    })
  );
  
  // Define transports based on environment
  const transports: winston.transport[] = [];
  
  // In stdio mode, only log to file to avoid corrupting the protocol
  if (stdioMode) {
    transports.push(
      new winston.transports.File({ 
        filename: logFilePath,
        level
      })
    );
  } else {
    // In non-stdio mode, we can log to console
    transports.push(
      new winston.transports.Console({
        level,
        format: winston.format.combine(
          winston.format.colorize(),
          format
        )
      })
    );
    
    // Optionally also log to file
    if (logFilePath) {
      transports.push(
        new winston.transports.File({ 
          filename: logFilePath,
          level
        })
      );
    }
  }
  
  // Create the logger
  return winston.createLogger({
    level,
    format,
    transports,
    exitOnError: false
  });
}

/**
 * Attempts to detect if a server is using stdio transport
 * 
 * @param server The MCP server to check
 * @returns True if the server appears to be using stdio transport
 */
export function isUsingStdioTransport(server: McpServer): boolean {
  // This is a best-effort detection - may need to be updated based on MCP SDK internals
  return (
    (server as any)._transport?.type === 'stdio' || 
    (server as any)._transportType === 'stdio' ||
    process.env.MCP_TRANSPORT === 'stdio'
  );
}

/**
 * Memory transport for Winston that captures logs in memory
 * Useful for testing to verify log messages
 */
export class MemoryTransport extends winston.Transport {
  logs: any[] = [];
  
  constructor(opts?: any) {
    super(opts);
  }
  
  log(info: any, callback: () => void) {
    this.logs.push(info);
    callback();
  }
  
  clear() {
    this.logs = [];
  }
  
  contains(substring: string): boolean {
    return this.logs.some(log => 
      JSON.stringify(log).includes(substring)
    );
  }
  
  getLogsByLevel(level: string): any[] {
    return this.logs.filter(log => log.level === level);
  }
}
```

### Update Payment Wrapper Options

```typescript
export interface PaymentWrapperOptions {
  /**
   * Developer API key used for authentication
   */
  apiKey: string;
  
  /**
   * User JWT token for identifying and authenticating the end user
   */
  userToken: string;
  
  /**
   * Optional flag to enable additional debug logging
   */
  debugMode?: boolean;
  
  /**
   * Optional configuration for the logger
   */
  loggerOptions?: LoggerOptions;
}
```

### Modify Payment Wrapper Implementation

Replace all console logging with the Winston logger:

```typescript
import { createLogger, isUsingStdioTransport } from './utils/logger.js';

export function wrapWithPayments(server: McpServer, options: PaymentWrapperOptions): McpServer {
  // Determine if we're in stdio mode
  const stdioMode = isUsingStdioTransport(server);
  
  // Create logger with appropriate settings
  const logger = createLogger({
    level: options.debugMode ? 'debug' : 'info',
    stdioMode,
    ...options.loggerOptions
  });
  
  // Validate options
  if (!options.apiKey || options.apiKey.trim() === '') {
    logger.error('Invalid developer API key');
    throw new Error('Invalid developer API key: API key is required');
  }
  
  // ... rest of the implementation, replacing console.log/error with logger
}
```

### Update Tests

```typescript
import { createLogger, MemoryTransport } from './utils/logger.js';
import winston from 'winston';

describe('Billing Edge Cases', () => {
  let memoryTransport: MemoryTransport;
  let testLogger: winston.Logger;
  
  beforeEach(() => {
    memoryTransport = new MemoryTransport();
    testLogger = winston.createLogger({
      transports: [memoryTransport]
    });
  });
  
  test('handles insufficient funds correctly', () => {
    const server = createTestServer();
    const wrappedServer = wrapWithPayments(server, {
      ...createValidOptions(),
      loggerOptions: { 
        customLogger: testLogger
      }
    });
    
    // Test logic...
    
    // Verify logs
    expect(memoryTransport.contains('Insufficient funds')).toBe(true);
  });
});
```

## Migration Steps

1. Install Winston dependency
2. Create the logger module
3. Update the payment wrapper options interface
4. Modify the payment wrapper implementation to use the logger
5. Update tests to use the memory transport
6. Run tests to verify everything works correctly

## Benefits

- Proper handling of stdio vs. non-stdio environments
- Structured logging with timestamps and levels
- File-based logging for production environments
- Memory-based logging for tests
- Flexible configuration options

## Future Enhancements

- Add log rotation for production environments
- Integrate with cloud logging services
- Add request ID tracking for correlation
- Add performance metrics logging

## Implementation Checklist

- [x] Install Winston memory transport package
- [x] Update logger implementation to use Winston's memory transport
- [x] Create a TestLogger helper class in test-helpers.ts
- [x] Update logger.test.ts to use the new memory transport approach
- [x] Update payment-wrapper.test.ts to use TestLogger instead of console mocking
- [x] Update payment-wrapper.comprehensive.test.ts to use TestLogger
- [x] Fix resource testing approach for comprehensive tests
- [x] Verify all tests pass with the new implementation
- [x] Update README documentation with information about the memory transport
- [x] Add examples of using TestLogger in the README

## Benefits

1. **Simpler Testing**: The new approach makes it easier to test logging behavior without mocking console methods.
2. **More Reliable Tests**: Using Winston's built-in memory transport reduces the chance of bugs in our custom implementation.
3. **Better Log Management**: The TestLogger class provides a clean interface for checking, filtering, and clearing logs during tests.
4. **Improved Documentation**: The updated README provides clear examples for how to use the TestLogger in tests.

## Future Improvements

- Consider adding more helper methods to TestLogger for specific log patterns
- Expand logging to include more detailed information about payment operations
- Add structured log formatting for better analysis 