import { describe, test, expect, beforeAll, afterAll, jest } from '@jest/globals';
import { wrapWithPayments, PaymentWrapperOptions } from '../payment-wrapper';
import request from 'supertest';
import { IAuthService, VerifyResponse } from '../interfaces/auth-service';
import { MockAuthService } from '../services/mock-auth-service';

// Import the mock backend server
const mockBackendModule = require('../mock-backend/server-js.cjs');

// Mock the MockAuthService to use our custom implementation
jest.mock('../services/mock-auth-service', () => {
  return {
    MockAuthService: jest.fn().mockImplementation((config) => {
      console.log('Creating mocked MockAuthService with config:', config);
      
      return {
        apiKey: config.apiKey,
        baseAuthUrl: config.baseAuthUrl || 'https://auth.mcp-api.com',
        
        generateAuthUrl: function() {
          return `${this.baseAuthUrl}/authenticate/${require('uuid').v4()}`;
        },
        
        verifyToken: async function(token, resourceType, resourceId) {
          console.log(`Mocked verifyToken called with token: ${token}, resourceType: ${resourceType}, resourceId: ${resourceId}`);
          
          // For integration tests, we'll consider any token that starts with "mock_token_" as valid
          if (token && token.startsWith('mock_token_')) {
            // Extract user ID from token
            const parts = token.split('_');
            let userId = 'user_123456'; // Default user ID
            
            if (parts.length >= 3) {
              // Handle the case where userId might contain hyphens (like 'low-funds-user')
              if (parts[2] === 'low' && parts.length >= 4 && parts[3] === 'funds') {
                userId = 'low-funds-user';
              } else {
                userId = parts[2];
              }
            }
            
            console.log(`Extracted userId from token: ${userId}`);
            
            return {
              valid: true,
              userId,
              permissions: {
                canAccess: true,
                reasonCodes: ['user_authenticated']
              }
            };
          }
          
          // If token doesn't match our expected format, return an error
          console.log('Invalid token format');
          return {
            valid: false,
            error: 'invalid_token',
            message: 'Token is invalid or expired'
          };
        }
      };
    })
  };
});

// Patch the Math.random function to always return 1 for successful funds check
const originalRandom = Math.random;
Math.random = jest.fn().mockReturnValue(1);

describe('Payment Wrapper Integration Tests', () => {
  let mockBackend: any;
  let testMcpServer: any;
  let adminApiKey: string;
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

    // Get admin API key
    adminApiKey = 'admin-api-key';

    // Generate a valid token using the mock backend
    const tokenResponse = await mockBackend.server.inject({
      method: 'POST',
      url: '/auth/generate-token',
      headers: {
        'X-API-Key': adminApiKey
      },
      payload: {
        userId: 'user_123456',
        expiresIn: '1h'
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
        expiresIn: '1h'
      }
    });

    console.log('Low funds token response:', lowFundsTokenResponse.statusCode, lowFundsTokenResponse.body);
    lowFundsToken = JSON.parse(lowFundsTokenResponse.body).token;
  });
  
  afterAll(async () => {
    // Close the mock backend server
    console.log('Closing mock backend server');
    await mockBackend.server.close();
    
    // Restore original Math.random
    Math.random = originalRandom;
  });
  
  test('validates API key with mock backend', async () => {
    const response = await mockBackend.server.inject({
      method: 'POST',
      url: '/auth/validate-api-key',
      headers: {
        'X-API-Key': 'valid-api-key'
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
        'X-API-Key': 'valid-api-key'
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
        'X-API-Key': 'valid-api-key'
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
        'X-API-Key': 'valid-api-key'
      }
    });
    
    console.log('Initial balance response:', balanceResponse.statusCode, balanceResponse.body);
    const initialBalance = JSON.parse(balanceResponse.body).balance;
    
    // Process a charge
    const response = await mockBackend.server.inject({
      method: 'POST',
      url: '/billing/process-charge',
      headers: {
        'X-API-Key': 'valid-api-key'
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
      apiKey: 'valid-api-key', 
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
    // Override Math.random to simulate insufficient funds
    Math.random = jest.fn().mockReturnValue(0.1); // This will make checkFunds return false
    
    // Set up the baseAuthUrl to point to our mock server
    const baseAuthUrl = 'http://localhost:3000';
    
    console.log('Creating payment wrapper with insufficient funds');
    // Create a payment wrapper with the mock backend URL
    const wrappedServer = wrapWithPayments(testMcpServer, { 
      apiKey: 'valid-api-key', 
      userToken: lowFundsToken,
      debugMode: true,
      baseAuthUrl: baseAuthUrl
    });

    console.log('Calling tool through payment wrapper with insufficient funds');
    // Call the tool
    const result = await (wrappedServer as any).callTool('test_tool', { param: 'integration test' });
    
    console.log('Tool call result with insufficient funds:', result);
    // Verify the result indicates insufficient funds
    expect(result).toBeDefined();
    expect(result.error).toBe('insufficient_funds');
    expect(result.message).toBe('Insufficient funds to execute this operation');
    
    // Restore Math.random for other tests
    Math.random = jest.fn().mockReturnValue(1);
  });
}); 