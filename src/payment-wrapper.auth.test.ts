/**
 * @file Authentication Tests for MCP Payment Wrapper
 * @version 0.1.0
 * 
 * Tests for the authentication flow in the MCP Payment Wrapper
 */

import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { wrapWithPayments, PaymentWrapperOptions } from './payment-wrapper.js';
import { MockAuthService } from './services/mock-auth-service.js';
import { TestLogger, createTestServer } from './utils/test-helpers.js';

// Add a method to the McpServer prototype for testing
// This is needed because the proxy intercepts method calls
(McpServer.prototype as any).callTool = async function(name: string, args: any) {
  const tool = (this as any)._registeredTools[name];
  if (!tool) {
    throw new Error(`Tool not found: ${name}`);
  }
  return await tool.callback(args, {});
};

describe('MCP Payment Wrapper Authentication', () => {
  let logger: TestLogger;
  let mockServer: McpServer;
  let mockAuthService: MockAuthService;
  
  beforeEach(() => {
    // Setup logger to capture logs
    logger = new TestLogger();
    
    // Create a mock MCP server
    mockServer = createTestServer('auth-test-server');
    
    // Register a test tool on the mock server
    mockServer.tool('test-tool', {
      value: z.string().describe('Test input')
    }, async (args: any) => {
      return {
        content: [{ type: 'text' as const, text: `Result: ${args.value}` }]
      };
    });
    
    // Create a mock auth service
    mockAuthService = new MockAuthService({
      apiKey: 'test-api-key',
      baseAuthUrl: 'https://test-auth.example.com'
    });
  });
  
  afterEach(() => {
    // Clear logs between tests
    logger.clear();
  });

  it('should require authentication when no user token is provided', async () => {
    // Create a payment-wrapped server without a user token
    const wrappedServer = wrapWithPayments(mockServer, {
      apiKey: 'test-api-key',
      loggerOptions: { customLogger: logger.logger }
    });
    
    // Call the tool through the proxy
    const result = await (wrappedServer as any).callTool('test-tool', { value: 'test-value' });
    
    // Verify the result is an authentication-required error
    expect(result).toHaveProperty('error', 'authentication_required');
    expect(result).toHaveProperty('message', 'Authentication required to access this resource');
    expect(result).toHaveProperty('authUrl');
    
    // Verify the URL contains the base auth URL
    expect(result.authUrl).toContain('https://auth.mcp-api.com/authenticate/');
    
    // Verify that the auth URL contains a UUID
    const uuidRegex = /\/authenticate\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/;
    expect(result.authUrl).toMatch(uuidRegex);
    
    // Verify that appropriate logs were generated
    expect(logger.contains('No user token provided, authentication required')).toBe(true);
    expect(logger.contains('Authentication required for tool: test-tool')).toBe(true);
  });
  
  it('should require authentication when an invalid user token is provided', async () => {
    // Create a payment-wrapped server with an invalid user token
    const wrappedServer = wrapWithPayments(mockServer, {
      apiKey: 'test-api-key',
      userToken: 'invalid-token',
      loggerOptions: { customLogger: logger.logger }
    });
    
    // Call the tool through the proxy
    const result = await (wrappedServer as any).callTool('test-tool', { value: 'test-value' });
    
    // Verify the result is an authentication-required error
    expect(result).toHaveProperty('error', 'authentication_required');
    
    // Verify that appropriate logs were generated
    expect(logger.contains('Invalid token, authentication required')).toBe(true);
  });
  
  it('should allow access when a valid user token is provided', async () => {
    // Generate a valid token
    const validToken = mockAuthService.generateToken('test-user');
    
    // Create a payment-wrapped server with a valid user token
    const wrappedServer = wrapWithPayments(mockServer, {
      apiKey: 'test-api-key',
      userToken: validToken,
      _testOverrideFundsCheck: true, // Override funds check to always pass
      loggerOptions: { customLogger: logger.logger }
    });
    
    // Call the tool through the proxy
    const result = await (wrappedServer as any).callTool('test-tool', { value: 'test-value' });
    
    // Verify the result is the expected tool response
    expect(result).toHaveProperty('content');
    expect(result.content[0]).toHaveProperty('text', 'Result: test-value');
    
    // Verify that appropriate logs were generated
    expect(logger.contains('Authentication successful')).toBe(true);
  });
  
  it('should use the custom baseAuthUrl when provided', async () => {
    // Create a payment-wrapped server with a custom base auth URL
    const wrappedServer = wrapWithPayments(mockServer, {
      apiKey: 'test-api-key',
      baseAuthUrl: 'https://custom-auth.example.com',
      loggerOptions: { customLogger: logger.logger }
    });
    
    // Call the tool through the proxy
    const result = await (wrappedServer as any).callTool('test-tool', { value: 'test-value' });
    
    // Verify the result is an authentication-required error
    expect(result).toHaveProperty('error', 'authentication_required');
    
    // Verify the URL contains the custom base auth URL
    expect(result.authUrl).toContain('https://custom-auth.example.com/authenticate/');
  });
  
  it('should deny access when user has insufficient funds', async () => {
    // Generate a valid token
    const validToken = mockAuthService.generateToken('test-user');
    
    // Create a payment-wrapped server with a valid user token
    const wrappedServer = wrapWithPayments(mockServer, {
      apiKey: 'test-api-key',
      userToken: validToken,
      _testOverrideFundsCheck: false, // Override funds check to always fail
      loggerOptions: { customLogger: logger.logger }
    });
    
    // Call the tool through the proxy
    const result = await (wrappedServer as any).callTool('test-tool', { value: 'test-value' });
    
    // Verify the result is an insufficient funds error
    expect(result).toHaveProperty('error', 'insufficient_funds');
    expect(result).toHaveProperty('message', 'Insufficient funds to execute this operation');
    
    // Verify that appropriate logs were generated
    expect(logger.contains('Insufficient funds for user user-from-token')).toBe(true);
  });
}); 