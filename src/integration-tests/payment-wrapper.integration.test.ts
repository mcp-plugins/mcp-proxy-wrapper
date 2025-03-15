import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { wrapWithPayments } from '../payment-wrapper.js';
import request from 'supertest';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const backendScript = require('../mock-backend/server-js.cjs');

// Define a port for the test server
const TEST_PORT = 3004;
const TEST_BASE_URL = `http://localhost:${TEST_PORT}`;

describe('Payment Wrapper Integration Tests', () => {
  let mockBackend: any;
  let testMcpServer: any; 
  let adminApiKey: string;
  let clientApiKey: string;
  let userToken: string;
  let lowFundsToken: string;
  
  beforeAll(async () => {
    jest.setTimeout(30000); 
    
    console.log('Setting up integration tests...');
    
    // Start the mock backend server
    mockBackend = {};
    mockBackend.server = backendScript.buildServer({ logger: false });
    
    // Start the server on an actual port
    await mockBackend.server.listen(TEST_PORT);
    console.log(`Mock backend server created and listening on port ${TEST_PORT}`);
    
    // Create a mock MCP server for testing
    testMcpServer = {
      // Mock implementation of the tool method
      tool: function(name: string, descriptionOrCallback: any, callbackOrUndefined?: any) {
        // Simple mock that just records the tool registration
        if (!this._registeredTools) {
          this._registeredTools = {};
        }
        
        // Handle both function signatures (name, callback) and (name, description, callback)
        const callback = callbackOrUndefined || descriptionOrCallback;
        this._registeredTools[name] = { callback };
        return this;
      },
      _registeredTools: {}
    };
    
    // Register a test tool
    testMcpServer.tool('test_tool', 'Test tool description', async (extra: any) => {
      console.log('Test tool called with args:', extra);
      return {
        content: [
          {
            type: 'text',
            text: `Processed: ${extra.args.param}`
          }
        ]
      };
    });

    // Set up a simple tool invocation method
    (testMcpServer as any).callTool = async function(name: string, args: any) {
      console.log(`Calling tool ${name} with args:`, args);
      const tool = (this as any)._registeredTools[name];
      if (!tool) {
        throw new Error(`Tool not found: ${name}`);
      }
      const result = await tool.callback({ args, ...args }, {});
      console.log('Tool result:', result);
      return result;
    };

    // Set up API keys
    adminApiKey = 'admin-api-key';
    clientApiKey = 'valid-api-key';

    // Generate a valid token using the mock backend
    const tokenResponse = await request(mockBackend.server.server)
      .post('/auth/generate-token')
      .set('X-API-Key', adminApiKey)
      .send({
        userId: 'user_123456',
        expiresIn: '1h',
        clientApiKey: clientApiKey 
      });

    console.log('Token response:', tokenResponse.status, tokenResponse.body);
    userToken = tokenResponse.body.token;
    console.log('User token:', userToken);
    
    // Create a special token for a user with low funds
    const lowFundsTokenResponse = await request(mockBackend.server.server)
      .post('/auth/generate-token')
      .set('X-API-Key', adminApiKey)
      .send({
        userId: 'low-funds-user',
        expiresIn: '1h',
        clientApiKey: clientApiKey 
      });

    console.log('Low funds token response:', lowFundsTokenResponse.status, lowFundsTokenResponse.body);
    lowFundsToken = lowFundsTokenResponse.body.token;
  });
  
  afterAll(async () => {
    // Close the mock backend server
    console.log('Closing mock backend server');
    await mockBackend.server.close();
  });
  
  test('validates API key with mock backend', async () => {
    const response = await request(mockBackend.server.server)
      .post('/auth/validate-api-key')
      .set('X-API-Key', clientApiKey);
    
    console.log('Validate API key response:', response.status, response.body);
    
    expect(response.status).toBe(200);
    expect(response.body.valid).toBe(true);
    expect(response.body.developerId).toBe('dev_123456');
  });
  
  test('verifies user token with mock backend', async () => {
    const response = await request(mockBackend.server.server)
      .post('/auth/verify-token')
      .set('X-API-Key', clientApiKey)
      .send({
        token: userToken
      });
    
    console.log('Verify token response:', response.status, response.body);
    
    expect(response.status).toBe(200);
    expect(response.body.valid).toBe(true);
    expect(response.body.userId).toBe('user_123456');
    expect(response.body.permissions.canAccess).toBe(true);
  });
  
  test('checks user funds with mock backend', async () => {
    const response = await request(mockBackend.server.server)
      .post('/billing/check-funds')
      .set('X-API-Key', clientApiKey)
      .send({
        userId: 'user_123456',
        estimatedCost: 1,
        operationType: 'tool',
        operationId: 'test_tool'
      });
    
    console.log('Check funds response:', response.status, response.body);
    
    expect(response.status).toBe(200);
    expect(response.body.sufficientFunds).toBe(true);
  });
  
  test('processes charge with mock backend', async () => {
    // First, get the initial balance
    const balanceResponse = await request(mockBackend.server.server)
      .get('/billing/balance/user_123456')
      .set('X-API-Key', clientApiKey);
    
    console.log('Initial balance response:', balanceResponse.status, balanceResponse.body);
    const initialBalance = balanceResponse.body.balance;
    
    // Process a charge
    const response = await request(mockBackend.server.server)
      .post('/billing/process-charge')
      .set('X-API-Key', clientApiKey)
      .send({
        userId: 'user_123456',
        operationType: 'tool',
        operationId: 'test_tool',
        cost: 0.05,
        metadata: {
          executionTime: 1250
        }
      });
    
    console.log('Process charge response:', response.status, response.body);
    
    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.initialBalance).toBe(initialBalance);
    expect(response.body.updatedBalance).toBe(initialBalance - 0.05);
  });
  
  test('wrapWithPayments with external backend service', async () => {
    // Use the actual server URL
    const baseAuthUrl = TEST_BASE_URL;
    
    console.log('Creating payment wrapper with baseAuthUrl:', baseAuthUrl);
    // Create a payment wrapper with the mock backend URL
    const wrappedServer = wrapWithPayments(testMcpServer, { 
      apiKey: clientApiKey, 
      userToken: userToken,
      debugMode: true,
      baseAuthUrl: baseAuthUrl,
      _testOverrideFundsCheck: true 
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
    // Use the actual server URL
    const baseAuthUrl = TEST_BASE_URL;
    
    console.log('Creating payment wrapper with insufficient funds');
    // Create a payment wrapper with the mock backend URL
    const wrappedServer = wrapWithPayments(testMcpServer, { 
      apiKey: clientApiKey, 
      userToken: lowFundsToken,
      debugMode: true,
      baseAuthUrl: baseAuthUrl,
      _testOverrideFundsCheck: false 
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