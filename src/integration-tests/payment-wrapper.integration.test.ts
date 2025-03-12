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
    // Create a payment wrapper with the mock backend URL
    const wrappedServer = wrapWithPayments(testMcpServer, { 
      apiKey: 'valid-api-key', 
      userToken,
      debugMode: true,
      baseAuthUrl: 'http://localhost:3000'
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

    // Create a payment wrapper with the mock backend URL and test override for funds check
    const wrappedServer = wrapWithPayments(testMcpServer, { 
      apiKey: 'valid-api-key', 
      userToken: lowFundsToken,
      debugMode: true,
      baseAuthUrl: 'http://localhost:3000',
      _testOverrideFundsCheck: false // Force insufficient funds
    });

    // Call the tool
    const result = await (wrappedServer as any).callTool('test_tool', { param: 'integration test' });
    
    // Verify the result indicates insufficient funds
    expect(result).toBeDefined();
    expect(result.error).toBe('insufficient_funds');
    expect(result.message).toBe('Insufficient funds to execute this operation');
  });
}); 