import { describe, test, expect, beforeAll, afterAll, jest } from '@jest/globals';
import { FastifyInstance } from 'fastify';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { wrapWithPayments } from '../payment-wrapper.js';
import { buildServer } from '../mock-backend/server.js';
import request from 'supertest';

describe('Payment Wrapper Integration Tests', () => {
  let mockBackend: FastifyInstance;
  let testMcpServer: McpServer;
  let userToken: string;
  let adminApiKey: string;

  beforeAll(async () => {
    // Start the mock backend server
    mockBackend = buildServer({ logger: false });
    await mockBackend.ready();

    // Create a test MCP server
    testMcpServer = new McpServer({
      name: "Test MCP Server",
      version: "1.0.0",
      description: "Test server for integration tests"
    });

    // Register a test tool
    testMcpServer.tool('test_tool', {
      param: z.string().describe('Test parameter')
    }, async (args) => {
      return {
        content: [{ type: 'text' as const, text: `Processed: ${args.param}` }]
      };
    });

    // Set up a simple tool invocation method
    (testMcpServer as any).callTool = async function(name: string, args: any) {
      const tool = (this as any)._registeredTools[name];
      if (!tool) {
        throw new Error(`Tool not found: ${name}`);
      }
      return await tool.callback(args, {});
    };

    // Get admin API key
    adminApiKey = 'admin-api-key';

    // Generate a valid token using the mock backend
    const tokenResponse = await request(mockBackend.server)
      .post('/auth/generate-token')
      .set('X-API-Key', adminApiKey)
      .send({
        userId: 'user_123456',
        expiresIn: '1h'
      });

    userToken = tokenResponse.body.token;
  });

  afterAll(async () => {
    // Close the mock backend server
    await mockBackend.close();
  });

  test('validates API key with mock backend', async () => {
    // Send a request to validate API key
    const response = await request(mockBackend.server)
      .post('/auth/validate-api-key')
      .set('X-API-Key', 'valid-api-key');

    expect(response.status).toBe(200);
    expect(response.body.valid).toBe(true);
    expect(response.body.developerId).toBe('dev_123456');
  });

  test('verifies user token with mock backend', async () => {
    // Send a request to verify token
    const response = await request(mockBackend.server)
      .post('/auth/verify-token')
      .set('X-API-Key', 'valid-api-key')
      .send({ token: userToken });

    expect(response.status).toBe(200);
    expect(response.body.valid).toBe(true);
    expect(response.body.userId).toBe('user_123456');
  });

  test('checks user funds with mock backend', async () => {
    // Send a request to check funds
    const response = await request(mockBackend.server)
      .post('/billing/check-funds')
      .set('X-API-Key', 'valid-api-key')
      .send({
        userId: 'user_123456',
        operationType: 'tool',
        operationId: 'test_tool'
      });

    expect(response.status).toBe(200);
    expect(response.body.sufficientFunds).toBe(true);
    expect(response.body.balance).toBeGreaterThan(0);
  });

  test('processes charge with mock backend', async () => {
    // Get initial balance
    const initialBalanceResponse = await request(mockBackend.server)
      .get('/billing/balance/user_123456')
      .set('X-API-Key', 'valid-api-key');

    const initialBalance = initialBalanceResponse.body.balance;

    // Process a charge
    const response = await request(mockBackend.server)
      .post('/billing/process-charge')
      .set('X-API-Key', 'valid-api-key')
      .send({
        userId: 'user_123456',
        operationType: 'tool',
        operationId: 'test_tool',
        cost: 0.05,
        metadata: {
          executionTime: 1250
        }
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.updatedBalance).toBe(initialBalance - 0.05);
  });

  test('wrapWithPayments with external backend service', async () => {
    // Create a real HTTP client for our AuthService
    class HttpAuthService {
      private baseUrl: string;
      private apiKey: string;
      
      constructor(options: { baseUrl: string; apiKey: string }) {
        this.baseUrl = options.baseUrl;
        this.apiKey = options.apiKey;
      }
      
      async verifyToken(token: string): Promise<{ 
        valid: boolean; 
        userId?: string; 
        permissions?: string[];
        error?: string;
        message?: string;
      }> {
        try {
          const response = await fetch(`${this.baseUrl}/auth/verify-token`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-API-Key': this.apiKey
            },
            body: JSON.stringify({ token })
          });
          
          return await response.json();
        } catch (error) {
          console.error('Error verifying token:', error);
          return {
            valid: false,
            error: 'service_unavailable',
            message: 'Authentication service is unavailable'
          };
        }
      }
    }

    // Create a payment wrapper with a real HTTP auth service
    const wrappedServer = wrapWithPayments(testMcpServer, { 
      apiKey: 'valid-api-key', 
      userToken,
      debugMode: true,
      authService: new HttpAuthService({
        baseUrl: 'http://localhost:3000',
        apiKey: 'valid-api-key'
      })
    });

    // Call the tool
    const result = await (wrappedServer as any).callTool('test_tool', { param: 'integration test' });
    
    // Verify the result
    expect(result).toBeDefined();
    expect(result.content[0].text).toBe('Processed: integration test');
  });

  test('handles insufficient funds in integration flow', async () => {
    // Create a special token for a user with low funds
    const lowFundsTokenResponse = await request(mockBackend.server)
      .post('/auth/generate-token')
      .set('X-API-Key', adminApiKey)
      .send({
        userId: 'low-funds-user',
        expiresIn: '1h'
      });

    const lowFundsToken = lowFundsTokenResponse.body.token;

    // Create a custom AuthService that uses our mock backend
    class CustomAuthService {
      private baseUrl: string;
      private apiKey: string;
      
      constructor(options: { baseUrl: string; apiKey: string }) {
        this.baseUrl = options.baseUrl;
        this.apiKey = options.apiKey;
      }
      
      async verifyToken(token: string): Promise<{ 
        valid: boolean; 
        userId?: string; 
        permissions?: string[];
        error?: string;
        message?: string;
      }> {
        try {
          const response = await fetch(`${this.baseUrl}/auth/verify-token`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-API-Key': this.apiKey
            },
            body: JSON.stringify({ token })
          });
          
          return await response.json();
        } catch (error) {
          console.error('Error verifying token:', error);
          return {
            valid: false,
            error: 'service_unavailable',
            message: 'Authentication service is unavailable'
          };
        }
      }
    }

    // Override the checkFunds function to test insufficient funds
    const originalCheckFunds = require('../payment-wrapper.js').checkFunds;
    jest.spyOn(require('../payment-wrapper.js'), 'checkFunds').mockImplementation(async () => {
      return {
        sufficientFunds: false,
        error: 'insufficient_funds',
        message: 'Insufficient funds to execute this operation'
      };
    });

    // Create a payment wrapper with a real HTTP auth service but mocked funds check
    const wrappedServer = wrapWithPayments(testMcpServer, { 
      apiKey: 'valid-api-key', 
      userToken: lowFundsToken,
      debugMode: true,
      authService: new CustomAuthService({
        baseUrl: 'http://localhost:3000',
        apiKey: 'valid-api-key'
      })
    });

    try {
      // Call the tool - should fail due to insufficient funds
      await (wrappedServer as any).callTool('test_tool', { param: 'should fail' });
      // If we get here, the test should fail
      expect(true).toBe(false); // This should not be reached
    } catch (error: any) {
      // Verify the error
      expect(error).toBeDefined();
      expect(error.message).toContain('insufficient_funds');
    }

    // Restore the original checkFunds function
    jest.spyOn(require('../payment-wrapper.js'), 'checkFunds').mockRestore();
  });
}); 