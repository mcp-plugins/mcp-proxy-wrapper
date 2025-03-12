import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

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
 * Auth routes plugin for Fastify
 */
export const authRoutes = (fastify: FastifyInstance, _options: FastifyPluginOptions, done: () => void) => {
  /**
   * Validate API key
   * POST /auth/validate-api-key
   */
  fastify.post('/validate-api-key', {
    schema: {
      headers: {
        type: 'object',
        required: ['x-api-key'],
        properties: {
          'x-api-key': { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            valid: { type: 'boolean' },
            developerId: { type: 'string' }
          }
        },
        401: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    const apiKey = request.headers['x-api-key'] as string;
    const developer = MOCK_DEVELOPERS[apiKey];

    if (!developer) {
      return reply.status(401).send({
        error: 'invalid_api_key',
        message: 'Invalid API key'
      });
    }

    return {
      valid: true,
      developerId: developer.id
    };
  });

  /**
   * Generate token for testing
   * POST /auth/generate-token
   * Admin API key required
   */
  fastify.post('/generate-token', {
    schema: {
      headers: {
        type: 'object',
        required: ['x-api-key'],
        properties: {
          'x-api-key': { type: 'string' }
        }
      },
      body: {
        type: 'object',
        required: ['userId'],
        properties: {
          userId: { type: 'string' },
          expiresIn: { type: 'string', default: '1h' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            token: { type: 'string' },
            expiresAt: { type: 'string' }
          }
        },
        401: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    const apiKey = request.headers['x-api-key'] as string;
    const developer = MOCK_DEVELOPERS[apiKey];

    // Only admin API keys can generate tokens
    if (!developer || !developer.isAdmin) {
      return reply.status(401).send({
        error: 'unauthorized',
        message: 'Admin API key required'
      });
    }

    const { userId, expiresIn = '1h' } = request.body as { userId: string, expiresIn?: string };
    
    // Check if user exists
    if (!MOCK_USERS[userId]) {
      return reply.status(400).send({
        error: 'invalid_user',
        message: 'User not found'
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        sub: userId,
        name: MOCK_USERS[userId].name,
        email: MOCK_USERS[userId].email
      }, 
      JWT_SECRET, 
      { expiresIn }
    );

    // Calculate expiration time
    const expirySeconds = expiresIn.endsWith('h') 
      ? parseInt(expiresIn.replace('h', '')) * 3600
      : expiresIn.endsWith('m')
        ? parseInt(expiresIn.replace('m', '')) * 60
        : parseInt(expiresIn);
    
    const expiresAt = new Date(Date.now() + expirySeconds * 1000).toISOString();

    return {
      token,
      expiresAt
    };
  });

  /**
   * Verify token
   * POST /auth/verify-token
   */
  fastify.post('/verify-token', {
    schema: {
      headers: {
        type: 'object',
        required: ['x-api-key'],
        properties: {
          'x-api-key': { type: 'string' }
        }
      },
      body: {
        type: 'object',
        required: ['token'],
        properties: {
          token: { type: 'string' },
          resourceType: { type: 'string', enum: ['tool', 'prompt', 'resource'] },
          resourceId: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            valid: { type: 'boolean' },
            userId: { type: 'string' },
            permissions: {
              type: 'object',
              properties: {
                canAccess: { type: 'boolean' },
                reasonCodes: { type: 'array', items: { type: 'string' } }
              }
            }
          }
        },
        401: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    const apiKey = request.headers['x-api-key'] as string;
    const developer = MOCK_DEVELOPERS[apiKey];

    if (!developer) {
      return reply.status(401).send({
        error: 'invalid_api_key',
        message: 'Invalid API key'
      });
    }

    const { token, resourceType, resourceId } = request.body as { 
      token: string, 
      resourceType?: 'tool' | 'prompt' | 'resource', 
      resourceId?: string 
    };

    try {
      // Verify JWT token
      const decoded = jwt.verify(token, JWT_SECRET) as { sub: string };
      const userId = decoded.sub;
      const user = MOCK_USERS[userId];

      if (!user) {
        return {
          valid: false,
          error: 'invalid_user',
          message: 'User not found'
        };
      }

      // For this mock, all users have access to all resources
      return {
        valid: true,
        userId,
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

  /**
   * Generate auth URL
   * GET /auth/url
   */
  fastify.get('/auth/url', {
    schema: {
      querystring: {
        type: 'object',
        properties: {
          redirectUrl: { type: 'string' },
          apiKey: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            url: { type: 'string' }
          }
        }
      }
    }
  }, async (request) => {
    const { redirectUrl, apiKey } = request.query as { redirectUrl?: string, apiKey?: string };
    
    // In a real implementation, this would generate a URL to the auth service
    const authUrl = `http://localhost:3000/auth/login?redirect=${encodeURIComponent(redirectUrl || '')}&apiKey=${apiKey || ''}`;
    
    return {
      url: authUrl
    };
  });

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