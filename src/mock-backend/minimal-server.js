// Minimal server with just the auth URL endpoint
import fastify from 'fastify';
import cors from '@fastify/cors';

console.log('Starting minimal server...');

// Create the server
const server = fastify({
  logger: true
});

// Register CORS
server.register(cors);

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

// Mock billing endpoints
server.get('/billing/balance/:userId', async (request, reply) => {
  const { userId } = request.params;
  const apiKey = request.headers['x-api-key'];
  
  if (!apiKey) {
    return reply.status(401).send({
      error: 'missing_api_key',
      message: 'API key is required'
    });
  }
  
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

server.post('/billing/check-funds', async (request, reply) => {
  const { userId, estimatedCost = 1.0 } = request.body;
  const apiKey = request.headers['x-api-key'];
  
  if (!apiKey) {
    return reply.status(401).send({
      error: 'missing_api_key',
      message: 'API key is required'
    });
  }
  
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

server.post('/billing/process-charge', async (request, reply) => {
  const { userId, operationType, operationId, cost } = request.body;
  const apiKey = request.headers['x-api-key'];
  
  if (!apiKey) {
    return reply.status(401).send({
      error: 'missing_api_key',
      message: 'API key is required'
    });
  }
  
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

// Start the server
const start = async () => {
  try {
    await server.listen({ port: 3004, host: '0.0.0.0' });
    console.log('Server listening on http://localhost:3004');
    
    // Print registered routes for debugging
    console.log('Registered routes:');
    server.printRoutes();
  } catch (err) {
    console.error('Error starting server:', err);
    process.exit(1);
  }
};

// Start the server
start(); 