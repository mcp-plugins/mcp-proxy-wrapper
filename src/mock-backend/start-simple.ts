import fastify from 'fastify';
import cors from '@fastify/cors';
import jwt from 'jsonwebtoken';

// Simple constants
const PORT = 3000;
const JWT_SECRET = 'simple-test-secret';

// Simple in-memory data
const users = {
  'user_123456': { balance: 100.00 },
  'low-funds-user': { balance: 0.05 }
};

// Create the server
const server = fastify({ 
  logger: {
    level: 'info'
  }
});

// Add CORS
server.register(cors);

// Simple health check
server.get('/health', async () => {
  return { status: 'ok' };
});

// Auth endpoints
server.post('/auth/generate-token', async (request, reply) => {
  const { userId = 'user_123456', expiresIn = '1h' } = request.body as any;
  
  if (!users[userId]) {
    return reply.status(400).send({
      error: 'invalid_user',
      message: 'User not found'
    });
  }
  
  const token = jwt.sign({ sub: userId }, JWT_SECRET, { expiresIn });
  return { 
    token,
    expiresAt: new Date(Date.now() + 3600 * 1000).toISOString() 
  };
});

server.post('/auth/verify-token', async (request) => {
  const { token } = request.body as any;
  
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { sub: string };
    return {
      valid: true,
      userId: decoded.sub,
      permissions: {
        canAccess: true,
        reasonCodes: ['user_authenticated']
      }
    };
  } catch (error) {
    return {
      valid: false,
      error: 'invalid_token',
      message: 'Invalid or expired token'
    };
  }
});

// Billing endpoints
server.post('/billing/check-funds', async (request) => {
  const { userId, estimatedCost = 0.01 } = request.body as any;
  const user = users[userId] || { balance: 0 };
  
  // Special case for low-funds user
  if (userId === 'low-funds-user') {
    return {
      sufficientFunds: false,
      balance: user.balance,
      estimatedCost
    };
  }
  
  return {
    sufficientFunds: user.balance >= estimatedCost,
    balance: user.balance,
    estimatedCost
  };
});

server.post('/billing/process-charge', async (request, reply) => {
  const { userId, cost = 0.01 } = request.body as any;
  const user = users[userId];
  
  if (!user) {
    return reply.status(404).send({
      error: 'user_not_found',
      message: 'User not found'
    });
  }
  
  if (user.balance < cost) {
    return reply.status(400).send({
      error: 'insufficient_funds',
      message: 'User has insufficient funds'
    });
  }
  
  user.balance -= cost;
  
  return {
    success: true,
    transactionId: `txn_${Date.now()}`,
    updatedBalance: user.balance
  };
});

server.get('/billing/balance/:userId', async (request, reply) => {
  const { userId } = request.params as any;
  const user = users[userId];
  
  if (!user) {
    return reply.status(404).send({
      error: 'user_not_found',
      message: 'User not found'
    });
  }
  
  return {
    userId,
    balance: user.balance
  };
});

// Start the server
const start = async () => {
  try {
    await server.listen({ port: PORT, host: '0.0.0.0' });
    console.log(`Server listening on http://localhost:${PORT}`);
  } catch (err) {
    console.error('Error starting server:', err);
    process.exit(1);
  }
};

start(); 