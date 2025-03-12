// JavaScript version of the server.ts file for integration tests
import fastify from 'fastify';
import cors from '@fastify/cors';

/**
 * Build a Fastify server instance with all routes configured
 * @param {Object} options Fastify server options
 * @returns {import('fastify').FastifyInstance} Configured Fastify instance
 */
export function buildServer(options = {}) {
  console.log('Building server with options:', options);
  const server = fastify(options);
  
  // Register CORS plugin
  server.register(cors, {
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key']
  });
  
  // Add API key validation middleware for protected routes
  server.addHook('onRequest', async (request, reply) => {
    // Skip API key validation for health check and docs
    const publicPaths = [
      '/health',
      '/docs',
      '/auth/url'
    ];
    
    // Skip validation for public paths
    if (publicPaths.some(path => request.url.startsWith(path))) {
      return;
    }
    
    // Get API key from headers
    const apiKey = request.headers['x-api-key'];
    if (!apiKey) {
      return reply.status(401).send({
        error: 'missing_api_key',
        message: 'API key is required'
      });
    }
    
    // Validate API key
    const validApiKeys = ['valid-api-key', 'admin-api-key'];
    if (!validApiKeys.includes(apiKey)) {
      return reply.status(401).send({
        error: 'invalid_api_key',
        message: 'Invalid API key'
      });
    }
  });
  
  // Health check endpoint
  server.get('/health', async () => {
    return { 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    };
  });
  
  // Auth URL endpoint
  server.get('/auth/url', async (request) => {
    const { redirectUrl, apiKey } = request.query;
    
    // In a real implementation, this would generate a URL to the auth service
    const authUrl = `http://localhost:3000/auth/login?redirect=${encodeURIComponent(redirectUrl || '')}&apiKey=${apiKey || ''}`;
    
    return {
      url: authUrl
    };
  });
  
  // Validate API key endpoint
  server.post('/auth/validate-api-key', async (request, reply) => {
    const apiKey = request.headers['x-api-key'];
    
    if (!apiKey) {
      return reply.status(401).send({
        error: 'missing_api_key',
        message: 'API key is required'
      });
    }
    
    const validApiKeys = ['valid-api-key', 'admin-api-key'];
    const isValid = validApiKeys.includes(apiKey);
    
    if (!isValid) {
      return reply.status(401).send({
        error: 'invalid_api_key',
        message: 'Invalid API key'
      });
    }
    
    return {
      valid: true,
      developerId: apiKey === 'admin-api-key' ? 'admin_123456' : 'dev_123456'
    };
  });
  
  // Generate token endpoint
  server.post('/auth/generate-token', async (request, reply) => {
    const apiKey = request.headers['x-api-key'];
    
    if (apiKey !== 'admin-api-key') {
      return reply.status(403).send({
        error: 'forbidden',
        message: 'Admin API key required'
      });
    }
    
    const { userId, expiresIn = '1h' } = request.body;
    
    // Mock user data
    const users = {
      'user_123456': {
        id: 'user_123456',
        name: 'Test User',
        email: 'test@example.com'
      },
      'low-funds-user': {
        id: 'low-funds-user',
        name: 'Low Funds User',
        email: 'lowfunds@example.com'
      }
    };
    
    // Check if user exists
    if (!users[userId]) {
      return reply.status(400).send({
        error: 'invalid_user',
        message: 'User not found'
      });
    }
    
    // Generate a mock token
    const token = `mock_token_${userId}_${Date.now()}`;
    
    // Calculate expiration time
    let expirySeconds;
    if (typeof expiresIn === 'string') {
      if (expiresIn.endsWith('h')) {
        expirySeconds = parseInt(expiresIn.replace('h', '')) * 3600;
      } else if (expiresIn.endsWith('m')) {
        expirySeconds = parseInt(expiresIn.replace('m', '')) * 60;
      } else {
        expirySeconds = parseInt(expiresIn);
      }
    } else {
      expirySeconds = 3600; // Default to 1 hour
    }
    
    const expiresAt = new Date(Date.now() + expirySeconds * 1000).toISOString();
    
    return {
      token,
      expiresAt
    };
  });
  
  // Verify token endpoint
  server.post('/auth/verify-token', async (request, reply) => {
    const apiKey = request.headers['x-api-key'];
    
    if (!apiKey) {
      return reply.status(401).send({
        error: 'missing_api_key',
        message: 'API key is required'
      });
    }
    
    const validApiKeys = ['valid-api-key', 'admin-api-key'];
    if (!validApiKeys.includes(apiKey)) {
      return reply.status(401).send({
        error: 'invalid_api_key',
        message: 'Invalid API key'
      });
    }
    
    const { token } = request.body;
    
    // For this mock implementation, we'll consider any token that starts with "mock_token_" as valid
    if (token && token.startsWith('mock_token_')) {
      const userId = token.split('_')[2]; // Extract user ID from token
      
      return {
        valid: true,
        userId,
        permissions: {
          canAccess: true,
          reasonCodes: ['user_authenticated']
        }
      };
    }
    
    return {
      valid: false,
      error: 'invalid_token',
      message: 'Invalid or expired token'
    };
  });
  
  // Billing endpoints
  
  // Get user balance
  server.get('/billing/balance/:userId', async (request) => {
    const { userId } = request.params;
    
    // Mock balances
    const balances = {
      'user_123456': 100,
      'low-funds-user': 0.05
    };
    
    return {
      userId,
      balance: balances[userId] || 0
    };
  });
  
  // Check funds
  server.post('/billing/check-funds', async (request) => {
    const { userId, estimatedCost = 1.0 } = request.body;
    
    // Mock balances
    const balances = {
      'user_123456': 100,
      'low-funds-user': 0.05
    };
    
    const balance = balances[userId] || 0;
    const hasSufficientFunds = balance >= estimatedCost;
    
    return {
      userId,
      balance,
      estimatedCost,
      hasSufficientFunds,
      reasonCodes: hasSufficientFunds ? ['sufficient_funds'] : ['insufficient_funds']
    };
  });
  
  // Process charge
  server.post('/billing/process-charge', async (request) => {
    const { userId, operationType, operationId, cost } = request.body;
    
    return {
      transactionId: `tx_${Date.now()}`,
      userId,
      operationType,
      operationId,
      cost,
      timestamp: new Date().toISOString(),
      status: 'success'
    };
  });
  
  return server;
}

// Export a function to start the server
export async function startServer(port = 3004) {
  const server = buildServer({
    logger: {
      level: 'info',
      transport: {
        target: 'pino-pretty',
        options: {
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname'
        }
      }
    }
  });
  
  try {
    await server.listen({ port, host: '0.0.0.0' });
    console.log(`Server listening on http://localhost:${port}`);
    return server;
  } catch (err) {
    console.error('Error during server.listen():', err);
    process.exit(1);
  }
} 