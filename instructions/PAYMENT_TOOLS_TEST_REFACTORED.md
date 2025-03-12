/**
 * @file Payment Tools Tests
 * @version 1.0.0
 * @status STABLE - COMPLETE TEST COVERAGE
 * @lastModified 2024-03-15
 * 
 * Tests for the payment authentication tools added by the MCP Payment Wrapper.
 * 
 * Test coverage areas:
 * - Payment authentication flow
 * - Authentication status checking
 * - Balance checking
 * - JWT token handling
 * - Error handling
 */

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

// Extend the McpServer type definition to include callTool method for testing
declare module '@modelcontextprotocol/sdk/server/mcp.js' {
  interface McpServer {
    callTool(name: string, args: any): Promise<any>;
  }
}

// Test setup variables
let server: McpServer;
let wrappedServer: McpServer;
let testLogger: TestLogger;
let mockAuthService: MockAuthService;

// Helper function to create test server
function createTestServer() {
  return new McpServer({
    name: 'Test MCP Server',
    version: '1.0.0',
    description: 'Test server for payment tools'
  });
}

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

describe('Payment Tools', () => {
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
  
  afterEach(() => {
    // Clear logs between tests
    testLogger.clear();
    jest.restoreAllMocks();
  });
  
  // Helper function to check if logs contain text at a specific level
  function containsLog(text: string, level: string = 'info'): boolean {
    return testLogger.contains(text, level);
  }
  
  // Helper function to get logs by level
  function getLogsByLevel(level: string): any[] {
    return testLogger.getLogs(level);
  }

  describe('payment_authenticate', () => {
    test('should create an authentication session', async () => {
      const result = await wrappedServer.callTool('payment_authenticate', {});
      
      // Verify result structure
      expect(result.content).toBeDefined();
      expect(result.content.length).toBeGreaterThan(0);
      
      // Find text content
      const textContent = result.content.filter((item: { type: string }) => item.type === 'text');
      expect(textContent.length).toBeGreaterThan(0);
      
      // Check session details in metadata
      expect(result._meta).toBeDefined();
      expect(result._meta.session_id).toBeDefined();
      expect(typeof result._meta.session_id).toBe('string');
      expect(result._meta.status).toBe('pending');
      
      // Check that auth URL is in the text
      const authUrl = textContent[1].text;
      expect(authUrl).toContain(result._meta.session_id);
      
      // Verify appropriate logging occurred
      expect(containsLog('Created authentication session', 'debug')).toBe(true);
    });

    test('should handle optional parameters', async () => {
      const result = await wrappedServer.callTool('payment_authenticate', {
        return_url: 'https://example.com/return',
        user_hint: 'user@example.com'
      });
      
      const authUrl = result.content[1].text;
      expect(authUrl).toContain('return_url=https%3A%2F%2Fexample.com%2Freturn');
      expect(authUrl).toContain('hint=user%40example.com');
    });

    test('should handle error cases gracefully', async () => {
      // Mock an error in the auth service
      jest.spyOn(MockAuthService.prototype, 'createSession').mockImplementationOnce(() => {
        throw new Error('Service unavailable');
      });
      
      const result = await wrappedServer.callTool('payment_authenticate', {});
      
      expect(result.error).toBe(true);
      expect(result.content[0].text).toContain('Failed to initialize authentication session');
      
      // Verify error was logged
      expect(containsLog('Error in payment_authenticate', 'error')).toBe(true);
    });
  });

  describe('payment_check_auth_status', () => {
    test('should check pending authentication status', async () => {
      // First create a session
      const authResult = await wrappedServer.callTool('payment_authenticate', {});
      const sessionId = authResult._meta.session_id;
      
      // Check status immediately (should be pending)
      const statusResult = await wrappedServer.callTool('payment_check_auth_status', {
        session_id: sessionId
      });
      
      expect(statusResult._meta.status).toBe('pending');
      expect(statusResult._meta.expires_in).toBeDefined();
    });

    test('should handle non-existent sessions', async () => {
      const result = await wrappedServer.callTool('payment_check_auth_status', {
        session_id: '00000000-0000-0000-0000-000000000000' // Non-existent UUID
      });
      
      expect(result.content[0].text).toContain('expired or is invalid');
    });

    test('should detect authenticated sessions', async () => {
      // Mock an authenticated session
      const mockSession = {
        status: 'authenticated' as const,
        user_id: 'test-user-id',
        name: 'Test User',
        email: 'test@example.com',
        jwt: 'mock-jwt-token',
        authenticated_at: new Date().toISOString(),
        expires_in: 1800 // 30 minutes
      };
      
      jest.spyOn(MockAuthService.prototype, 'checkSessionStatus').mockResolvedValueOnce(mockSession);
      
      const result = await wrappedServer.callTool('payment_check_auth_status', {
        session_id: '00000000-0000-0000-0000-000000000000'
      });
      
      expect(result._meta.status).toBe('authenticated');
      expect(result._meta.user_id).toBe('test-user-id');
      expect(result._meta.jwt).toBe('mock-jwt-token');
      expect(result.content[0].text).toContain('successful');
      
      // Verify appropriate logging occurred
      expect(containsLog('Updated user token from authenticated session', 'debug')).toBe(true);
    });
  });

  describe('payment_get_balance', () => {
    test('should retrieve user balance with valid JWT', async () => {
      // Mock a valid JWT and user data
      const mockUserData = {
        user_id: 'test-user-id',
        name: 'Test User',
        email: 'test@example.com',
        balance: 500.75,
        currency: 'USD',
        available_credit: 100.00
      };
      
      jest.spyOn(MockAuthService.prototype, 'validateJWT').mockResolvedValueOnce(mockUserData);
      
      const result = await wrappedServer.callTool('payment_get_balance', {
        jwt: 'valid-mock-jwt-token'
      });
      
      expect(result.content[0].text).toContain('500.75 USD');
      expect(result._meta.balance).toBe(500.75);
      expect(result._meta.currency).toBe('USD');
      expect(result._meta.user_id).toBe('test-user-id');
    });

    test('should handle invalid JWT', async () => {
      jest.spyOn(MockAuthService.prototype, 'validateJWT').mockResolvedValueOnce(null);
      
      const result = await wrappedServer.callTool('payment_get_balance', {
        jwt: 'invalid-jwt-token'
      });
      
      expect(result.content[0].text).toContain('authentication is invalid or has expired');
    });

    test('should handle JWT refresh', async () => {
      // Mock user data with refreshed JWT
      const mockUserData = {
        user_id: 'test-user-id',
        name: 'Test User',
        email: 'test@example.com',
        balance: 750.25,
        currency: 'EUR',
        available_credit: 100.00,
        refreshedJwt: 'refreshed-jwt-token'
      };
      
      jest.spyOn(MockAuthService.prototype, 'validateJWT').mockResolvedValueOnce(mockUserData);
      
      const result = await wrappedServer.callTool('payment_get_balance', {
        jwt: 'old-jwt-token'
      });
      
      expect(result._meta.jwt).toBe('refreshed-jwt-token');
      expect(result._meta.balance).toBe(750.25);
      
      // Verify JWT refresh was logged
      expect(containsLog('Updated user token with refreshed JWT', 'debug')).toBe(true);
    });
  });

  describe('Integration test', () => {
    test('should complete the full authentication flow', async () => {
      // Step 1: Initiate authentication
      const authResult = await wrappedServer.callTool('payment_authenticate', {});
      const sessionId = authResult._meta.session_id;
      
      // Step 2: Initially status is pending
      let statusResult = await wrappedServer.callTool('payment_check_auth_status', {
        session_id: sessionId
      });
      expect(statusResult._meta.status).toBe('pending');
      
      // Step 3: Mock successful authentication
      const mockSession = {
        status: 'authenticated' as const,
        user_id: 'test-user-id',
        name: 'Test User',
        email: 'test@example.com',
        jwt: 'valid-jwt-for-test-user',
        authenticated_at: new Date().toISOString(),
        expires_in: 1800 // 30 minutes
      };
      
      jest.spyOn(MockAuthService.prototype, 'checkSessionStatus').mockResolvedValueOnce(mockSession);
      
      // Step 4: Check status again after authentication
      statusResult = await wrappedServer.callTool('payment_check_auth_status', {
        session_id: sessionId
      });
      
      const jwt = statusResult._meta.jwt;
      expect(jwt).toBe('valid-jwt-for-test-user');
      
      // Step 5: Get balance with the JWT
      const mockUserData = {
        user_id: 'test-user-id',
        name: 'Test User',
        email: 'test@example.com',
        balance: 1250.00,
        currency: 'USD',
        available_credit: 100.00
      };
      
      jest.spyOn(MockAuthService.prototype, 'validateJWT').mockResolvedValueOnce(mockUserData);
      
      const balanceResult = await wrappedServer.callTool('payment_get_balance', {
        jwt: jwt
      });
      
      expect(balanceResult._meta.balance).toBe(1250.00);
      expect(balanceResult._meta.user_id).toBe('test-user-id');
      
      // Verify full flow logging
      expect(getLogsByLevel('info').length).toBeGreaterThan(0);
      expect(getLogsByLevel('debug').length).toBeGreaterThan(0);
    });
  });
}); 