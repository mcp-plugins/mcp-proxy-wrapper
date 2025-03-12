import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { AuthController } from '../controllers/auth.js';

// Secret key for JWT signing (in a real app, this would be in environment variables)
const JWT_SECRET = 'mock-backend-secret-key';

// Mock user data
const MOCK_USERS = {
  'user_123456': {
    id: 'user_123456',
    name: 'Test User',
    email: 'test@example.com',
    permissions: ['basic_access']
  },
  'low-funds-user': {
    id: 'low-funds-user',
    name: 'Low Funds User',
    email: 'lowfunds@example.com',
    permissions: ['basic_access']
  }
};

// Mock developer data
const MOCK_DEVELOPERS = {
  'valid-api-key': {
    id: 'dev_123456',
    name: 'Test Developer',
    email: 'dev@example.com'
  },
  'admin-api-key': {
    id: 'admin_123456',
    name: 'Admin Developer',
    email: 'admin@example.com',
    isAdmin: true
  }
};

// Store for authentication requests
const authRequests: Record<string, { 
  timestamp: number;
  apiKey: string;
}> = {};

/**
 * Authentication routes
 */
export const authRoutes = (fastify: FastifyInstance, _options: FastifyPluginOptions, done: () => void) => {
  // Validate API key
  fastify.post('/validate-api-key', AuthController.validateApiKey);
  
  // Generate authentication token (admin only)
  fastify.post('/generate-token', AuthController.generateToken);
  
  // Verify authentication token
  fastify.post('/verify-token', AuthController.verifyToken);
  
  // Generate authentication URL
  fastify.get('/url', AuthController.generateAuthUrl);
  
  // 5. Create Authentication Request (additional helper for our mock implementation)
  fastify.post('/auth/create-request', async (request, reply) => {
    const apiKey = request.headers['x-api-key'] as string;
    
    // Generate a UUID for this authentication request
    const uuid = uuidv4();
    
    // Store the authentication request
    authRequests[uuid] = {
      timestamp: Date.now(),
      apiKey
    };
    
    // Return the authentication URL
    const authUrl = `http://localhost:3000/auth/authenticate/${uuid}`;
    
    return reply.code(200).send({
      uuid,
      authUrl
    });
  });

  done();
}; 