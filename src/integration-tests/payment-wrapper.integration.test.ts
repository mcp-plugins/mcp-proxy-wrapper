import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { wrapWithPayments, PaymentWrapperOptions } from '../payment-wrapper';
import request from 'supertest';
import { IAuthService, VerifyResponse } from '../interfaces/auth-service';

// Import the mock backend server
const mockBackendModule = require('../mock-backend/server-js.cjs');

describe('Payment Wrapper Integration Tests', () => {
  let mockBackend: any;
  let testMcpServer: any;
  let adminApiKey: string;
  let clientApiKey: string;
  let userToken: string;
  let lowFundsToken: string;
  
  beforeAll(async () => {
    console.log('Setting up integration tests...');
    
    // Start the mock backend server
    mockBackend = {};
    mockBackend.server = mockBackendModule.buildServer({ logger: false });
    console.log('Mock backend server created');
    
    // Create a simple MCP server for testing
    testMcpServer = {
      _registeredTools: {},
      tool: function(name: string, schema: any, callback: any) {
        this._registeredTools[name] = { schema, callback };
        return this;
      }
    };
    
    // Register a test tool
    testMcpServer.tool('test_tool', {
      name: 'test_tool',
      description: 'A test tool for integration testing',
      parameters: {
        type: 'object',
        properties: {
          param: {
            type: 'string',
            description: 'Test parameter'
          }
        },
        required: ['param']
      }
    }, async (args: any) => {
      console.log('Test tool called with args:', args);
      return {
        content: [{ type: 'text', text: `Processed: ${args.param}` }]
      };
    });

    // Set up a simple tool invocation method
    (testMcpServer as any).callTool = async function(name: string, args: any) {
      console.log(`Calling tool ${name} with args:`, args);
      const tool = (this as any)._registeredTools[name];
      if (!tool) {
        throw new Error(`Tool not found: ${name}`);
      }
      const result = await tool.callback(args, {});
      console.log('Tool result:', result);
      return result;
    };

    // Set up API keys
    adminApiKey = 'admin-api-key';
    clientApiKey = 'valid-api-key';

    // Generate a valid token using the mock backend
    const tokenResponse = await mockBackend.server.inject({
      method: 'POST',
      url: '/auth/generate-token',
      headers: {
        'X-API-Key': adminApiKey
      },
      payload: {
        userId: 'user_123456',
        expiresIn: '1h',
        clientApiKey: clientApiKey // Specify the client API key
      }
    });

    console.log('Token response:', tokenResponse.statusCode, tokenResponse.body);
    userToken = JSON.parse(tokenResponse.body).token;
    console.log('User token:', userToken);
    
    // Create a special token for a user with low funds
    const lowFundsTokenResponse = await mockBackend.server.inject({
      method: 'POST',
      url: '/auth/generate-token',
      headers: {
        'X-API-Key': adminApiKey
      },
      payload: {
        userId: 'low-funds-user',
        expiresIn: '1h',
        clientApiKey: clientApiKey // Specify the client API key
      }
    });

    console.log('Low funds token response:', lowFundsTokenResponse.statusCode, lowFundsTokenResponse.body);
    lowFundsToken = JSON.parse(lowFundsTokenResponse.body).token;
  });
  
  afterAll(async () => {
    // Close the mock backend server
    console.log('Closing mock backend server');
    await mockBackend.server.close();
  });
  
  test('validates API key with mock backend', async () => {
    const response = await mockBackend.server.inject({
      method: 'POST',
      url: '/auth/validate-api-key',
      headers: {
        'X-API-Key': clientApiKey
      }
    });
    
    console.log('Validate API key response:', response.statusCode, response.body);
    
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.valid).toBe(true);
    expect(body.developerId).toBe('dev_123456');
  });
  
  test('verifies user token with mock backend', async () => {
    const response = await mockBackend.server.inject({
      method: 'POST',
      url: '/auth/verify-token',
      headers: {
        'X-API-Key': clientApiKey
      },
      payload: {
        token: userToken
      }
    });
    
    console.log('Verify token response:', response.statusCode, response.body);
    
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.valid).toBe(true);
    expect(body.userId).toBe('user_123456');
    expect(body.permissions.canAccess).toBe(true);
  });
  
  test('checks user funds with mock backend', async () => {
    const response = await mockBackend.server.inject({
      method: 'POST',
      url: '/billing/check-funds',
      headers: {
        'X-API-Key': clientApiKey
      },
      payload: {
        userId: 'user_123456',
        estimatedCost: 1,
        operationType: 'tool',
        operationId: 'test_tool'
      }
    });
    
    console.log('Check funds response:', response.statusCode, response.body);
    
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.sufficientFunds).toBe(true);
  });
  
  test('processes charge with mock backend', async () => {
    // First, get the initial balance
    const balanceResponse = await mockBackend.server.inject({
      method: 'GET',
      url: '/billing/balance/user_123456',
      headers: {
        'X-API-Key': clientApiKey
      }
    });
    
    console.log('Initial balance response:', balanceResponse.statusCode, balanceResponse.body);
    const initialBalance = JSON.parse(balanceResponse.body).balance;
    
    // Process a charge
    const response = await mockBackend.server.inject({
      method: 'POST',
      url: '/billing/process-charge',
      headers: {
        'X-API-Key': clientApiKey
      },
      payload: {
        userId: 'user_123456',
        operationType: 'tool',
        operationId: 'test_tool',
        cost: 0.05,
        metadata: {
          executionTime: 1250
        }
      }
    });
    
    console.log('Process charge response:', response.statusCode, response.body);
    
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.success).toBe(true);
    expect(body.initialBalance).toBe(initialBalance);
    expect(body.updatedBalance).toBe(initialBalance - 0.05);
  });
  
  test('wrapWithPayments with external backend service', async () => {
    // Set up the baseAuthUrl to point to our mock server
    const baseAuthUrl = 'http://localhost:3000';
    
    console.log('Creating payment wrapper with baseAuthUrl:', baseAuthUrl);
    // Create a payment wrapper with the mock backend URL
    const wrappedServer = wrapWithPayments(testMcpServer, { 
      apiKey: clientApiKey, 
      userToken: userToken,
      debugMode: true,
      baseAuthUrl: baseAuthUrl
    });

    console.log('Calling tool through payment wrapper');
    // Call the tool
    const result = await (wrappedServer as any).callTool('test_tool', { param: 'integration test' });
    
    console.log('Tool call result:', result);
    // Verify the result
    expect(result).toBeDefined();
    expect(result.content[0].text).toBe('Processed: integration test');
  });

  test('handles insufficient funds in integration flow', async () => {
    // Set up the baseAuthUrl to point to our mock server
    const baseAuthUrl = 'http://localhost:3000';
    
    console.log('Creating payment wrapper with insufficient funds');
    // Create a payment wrapper with the mock backend URL
    const wrappedServer = wrapWithPayments(testMcpServer, { 
      apiKey: clientApiKey, 
      userToken: lowFundsToken,
      debugMode: true,
      baseAuthUrl: baseAuthUrl,
      _testOverrideFundsCheck: false // Force insufficient funds
    });

    console.log('Calling tool through payment wrapper with insufficient funds');
    // Call the tool
    const result = await (wrappedServer as any).callTool('test_tool', { param: 'integration test' });
    
    console.log('Tool call result with insufficient funds:', result);
    // Verify the result indicates insufficient funds
    expect(result).toBeDefined();
    expect(result.error).toBe('insufficient_funds');
    expect(result.message).toBe('Insufficient funds to execute this operation');
  });
}); 