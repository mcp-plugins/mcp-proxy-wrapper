// CommonJS version of the server for Jest
const fastify = require('fastify');
const cors = require('@fastify/cors');

/**
 * Build a Fastify server instance with all routes configured
 * @param {Object} options Fastify server options
 * @returns {import('fastify').FastifyInstance} Configured Fastify instance
 */
function buildServer(options = {}) {
  console.log('Building server with options:', options);
  const server = fastify(options);
  
  // Register CORS plugin
  server.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key', 'X-Test-Override-Funds-Check']
  });
  
  // Add API key validation middleware for protected routes
  server.addHook('onRequest', async (request, reply) => {
    console.log(`Request received: ${request.method} ${request.url}`);
    
    // Skip API key validation for health check and docs
    const publicPaths = [
      '/health',
      '/docs',
      '/auth/url'
    ];
    
    // Skip validation for public paths
    if (publicPaths.some(path => request.url.startsWith(path))) {
      console.log('Public path, skipping API key validation');
      return;
    }
    
    // Get API key from headers
    const apiKey = request.headers['x-api-key'];
    if (!apiKey) {
      console.log('Missing API key');
      return reply.status(401).send({
        error: 'missing_api_key',
        message: 'API key is required'
      });
    }
    
    // Validate API key
    const validApiKeys = ['valid-api-key', 'admin-api-key'];
    if (!validApiKeys.includes(apiKey)) {
      console.log('Invalid API key:', apiKey);
      return reply.status(401).send({
        error: 'invalid_api_key',
        message: 'Invalid API key'
      });
    }
    
    console.log('API key validated successfully:', apiKey);
  });
  
  // Health check endpoint
  server.get('/health', async () => {
    console.log('Health check endpoint called');
    return { status: 'ok' };
  });
  
  // Auth endpoints
  
  // Get auth URL
  server.get('/auth/url', async (request, reply) => {
    console.log('Auth URL endpoint called with query:', request.query);
    const { redirectUrl } = request.query;
    
    if (!redirectUrl) {
      console.log('Missing redirect URL');
      return reply.status(400).send({
        error: 'missing_redirect_url',
        message: 'Redirect URL is required'
      });
    }
    
    // For the mock implementation, we'll just return a fixed URL
    const url = `https://auth.example.com/login?redirect=${encodeURIComponent(redirectUrl)}`;
    console.log('Returning auth URL:', url);
    return {
      url: url
    };
  });
  
  // Validate API key endpoint
  server.post('/auth/validate-api-key', async (request, reply) => {
    console.log('Validate API key endpoint called with headers:', request.headers);
    const apiKey = request.headers['x-api-key'];
    
    if (!apiKey) {
      console.log('Missing API key');
      return reply.status(401).send({
        error: 'missing_api_key',
        message: 'API key is required'
      });
    }
    
    const validApiKeys = ['valid-api-key', 'admin-api-key'];
    const isValid = validApiKeys.includes(apiKey);
    
    if (!isValid) {
      console.log('Invalid API key:', apiKey);
      return reply.status(401).send({
        error: 'invalid_api_key',
        message: 'Invalid API key'
      });
    }
    
    const response = {
      valid: true,
      developerId: apiKey === 'admin-api-key' ? 'admin_123456' : 'dev_123456'
    };
    console.log('Returning validate API key response:', response);
    return response;
  });
  
  // Generate token
  server.post('/auth/generate-token', async (request, reply) => {
    console.log('Generate token endpoint called with body:', request.body);
    const apiKey = request.headers['x-api-key'];
    
    if (!apiKey) {
      console.log('Missing API key');
      return reply.status(401).send({
        error: 'missing_api_key',
        message: 'API key is required'
      });
    }
    
    // Only admin API key can generate tokens
    if (apiKey !== 'admin-api-key') {
      console.log('Insufficient permissions, not admin API key:', apiKey);
      return reply.status(403).send({
        error: 'insufficient_permissions',
        message: 'Only admin API key can generate tokens'
      });
    }
    
    const { userId, expiresIn } = request.body;
    
    if (!userId) {
      console.log('Missing user ID');
      return reply.status(400).send({
        error: 'missing_user_id',
        message: 'User ID is required'
      });
    }
    
    // Generate a mock token
    const token = `mock_token_${userId}_${Date.now()}`;
    console.log('Generated token:', token);
    
    // Parse expiry time
    let expirySeconds;
    if (expiresIn) {
      if (expiresIn.endsWith('s')) {
        expirySeconds = parseInt(expiresIn.slice(0, -1), 10);
      } else if (expiresIn.endsWith('m')) {
        expirySeconds = parseInt(expiresIn.slice(0, -1), 10) * 60;
      } else if (expiresIn.endsWith('h')) {
        expirySeconds = parseInt(expiresIn.slice(0, -1), 10) * 3600;
      } else if (expiresIn.endsWith('d')) {
        expirySeconds = parseInt(expiresIn.slice(0, -1), 10) * 86400;
      } else {
        expirySeconds = parseInt(expiresIn, 10);
      }
    } else {
      expirySeconds = 3600; // Default to 1 hour
    }
    
    const expiresAt = new Date(Date.now() + expirySeconds * 1000).toISOString();
    
    const response = {
      token,
      expiresAt
    };
    console.log('Returning generate token response:', response);
    return response;
  });
  
  // Verify token endpoint
  server.post('/auth/verify-token', async (request, reply) => {
    console.log('Verify token endpoint called with body:', request.body);
    const apiKey = request.headers['x-api-key'];
    
    if (!apiKey) {
      console.log('Missing API key');
      return reply.status(401).send({
        error: 'missing_api_key',
        message: 'API key is required'
      });
    }
    
    const validApiKeys = ['valid-api-key', 'admin-api-key'];
    if (!validApiKeys.includes(apiKey)) {
      console.log('Invalid API key:', apiKey);
      return reply.status(401).send({
        error: 'invalid_api_key',
        message: 'Invalid API key'
      });
    }
    
    const { token } = request.body;
    console.log('Token to verify:', token);
    
    // For this mock implementation, we'll consider any token that starts with "mock_token_" as valid
    // Extract the user ID from the token
    let userId = 'user_123456';
    if (token && token.startsWith('mock_token_')) {
      const parts = token.split('_');
      if (parts.length >= 3) {
        userId = parts[2];
      }
      console.log('Extracted user ID from token:', userId);
    }
    
    // For the integration test, always return user_123456
    const response = {
      valid: true,
      userId: 'user_123456',
      permissions: {
        canAccess: true,
        reasonCodes: ['user_authenticated']
      }
    };
    console.log('Returning verify token response:', response);
    return response;
  });
  
  // Billing endpoints
  
  // Get user balance
  server.get('/billing/balance/:userId', async (request) => {
    console.log('Get balance endpoint called for user:', request.params.userId);
    const { userId } = request.params;
    
    // Mock balances
    const balances = {
      'user_123456': 100,
      'low-funds-user': 0.05
    };
    
    const response = {
      userId,
      balance: balances[userId] || 0,
      currency: 'USD'
    };
    console.log('Returning balance response:', response);
    return response;
  });
  
  // Check funds
  server.post('/billing/check-funds', async (request) => {
    console.log('Check funds endpoint called with body:', request.body);
    console.log('Check funds headers:', request.headers);
    
    const { userId, estimatedCost = 1.0, operationType, operationId } = request.body;
    
    // Check for test override flag in headers
    const testOverrideFundsCheck = request.headers['x-test-override-funds-check'];
    console.log('Test override funds check:', testOverrideFundsCheck);
    
    // Mock balances
    const balances = {
      'user_123456': 100,
      'low-funds-user': 0.05
    };
    
    const balance = balances[userId] || 0;
    
    // If test override is set to 'false', force insufficient funds
    let hasSufficientFunds = balance >= estimatedCost;
    if (testOverrideFundsCheck === 'false') {
      console.log('Test override set to false, forcing insufficient funds');
      hasSufficientFunds = false;
    } else if (testOverrideFundsCheck === 'true') {
      console.log('Test override set to true, forcing sufficient funds');
      hasSufficientFunds = true;
    }
    
    // Special handling for low-funds-user
    if (userId === 'low-funds-user' && !testOverrideFundsCheck) {
      console.log('Low funds user detected, setting insufficient funds');
      hasSufficientFunds = false;
    }
    
    const response = {
      userId,
      balance,
      estimatedCost,
      sufficientFunds: hasSufficientFunds,
      reasonCodes: hasSufficientFunds ? ['sufficient_funds'] : ['insufficient_funds']
    };
    console.log('Returning check funds response:', response);
    return response;
  });
  
  // Process charge
  server.post('/billing/process-charge', async (request) => {
    console.log('Process charge endpoint called with body:', request.body);
    const { userId, operationType, operationId, cost, metadata } = request.body;
    
    // Mock balances
    const balances = {
      'user_123456': 100,
      'low-funds-user': 0.05
    };
    
    const initialBalance = balances[userId] || 0;
    const updatedBalance = initialBalance - cost;
    
    // Update the mock balance
    balances[userId] = updatedBalance;
    
    const response = {
      transactionId: `tx_${Date.now()}`,
      userId,
      operationType,
      operationId,
      cost,
      initialBalance,
      updatedBalance,
      timestamp: new Date().toISOString(),
      success: true
    };
    console.log('Returning process charge response:', response);
    return response;
  });
  
  // Mock MCP server endpoints for testing
  
  // Register a test tool handler
  server.post('/tools/test_tool', async (request) => {
    console.log('Test tool endpoint called with body:', request.body);
    const { param } = request.body;
    
    const response = {
      content: [{ type: 'text', text: `Processed: ${param}` }]
    };
    console.log('Returning test tool response:', response);
    return response;
  });
  
  // Add a route to handle direct tool calls for the integration test
  server.post('/test_tool', async (request) => {
    console.log('Direct test tool endpoint called with body:', request.body);
    const { param } = request.body;
    
    const response = {
      content: [{ type: 'text', text: `Processed: ${param}` }]
    };
    console.log('Returning direct test tool response:', response);
    return response;
  });
  
  return server;
}

// Export the server builder function
module.exports = {
  buildServer
}; 