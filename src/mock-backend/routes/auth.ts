import { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';

// Secret key for JWT signing - in a real implementation, this would be secured
const JWT_SECRET = 'mcp-mock-backend-secret-key';

// Mock users database
const users: Record<string, { 
  userId: string;
  username: string;
  email: string;
  permissions: string[];
}> = {
  'test-user': {
    userId: 'user_123456',
    username: 'test_user',
    email: 'test@example.com',
    permissions: ['use_tools', 'use_resources', 'use_prompts']
  },
  'premium-user': {
    userId: 'user_789012',
    username: 'premium_user',
    email: 'premium@example.com',
    permissions: ['use_tools', 'use_resources', 'use_prompts', 'premium_features']
  },
  'basic-user': {
    userId: 'user_345678',
    username: 'basic_user',
    email: 'basic@example.com',
    permissions: ['use_tools', 'use_resources']
  }
};

// Store for authentication requests
const authRequests: Record<string, { 
  timestamp: number;
  apiKey: string;
}> = {};

export function registerAuthRoutes(server: FastifyInstance) {
  // 1. Authentication endpoint
  server.get('/auth/authenticate/:uuid', async (request, reply) => {
    const { uuid } = request.params as { uuid: string };
    
    // Check if this is a valid auth request
    const authRequest = authRequests[uuid];
    if (!authRequest) {
      return reply.code(400).send({
        error: 'invalid_request',
        message: 'Invalid or expired authentication request'
      });
    }
    
    // Check if the request has expired (15 minutes)
    const currentTime = Date.now();
    if (currentTime - authRequest.timestamp > 15 * 60 * 1000) {
      delete authRequests[uuid];
      return reply.code(400).send({
        error: 'expired_request',
        message: 'Authentication request has expired'
      });
    }
    
    // For our mock implementation, we'll just use a fixed user
    const user = users['test-user'];
    const expirationTime = Math.floor(Date.now() / 1000) + (60 * 60); // 1 hour
    
    // Create JWT token
    const token = jwt.sign({
      sub: user.userId,
      iss: 'mcp-auth-service',
      iat: Math.floor(Date.now() / 1000),
      exp: expirationTime,
      apiKey: authRequest.apiKey,
      mcpServerId: 'mock-server-123'
    }, JWT_SECRET);
    
    // Remove the auth request
    delete authRequests[uuid];
    
    return reply.code(200).send({
      token,
      expiresAt: new Date(expirationTime * 1000).toISOString(),
      userId: user.userId
    });
  });

  // 2. Token Verification endpoint
  server.post('/auth/verify-token', async (request, reply) => {
    const { token } = request.body as { token: string };
    
    if (!token) {
      return reply.code(400).send({
        valid: false,
        error: 'invalid_request',
        message: 'Token is required'
      });
    }
    
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as {
        sub: string;
        iss: string;
        exp: number;
        apiKey: string;
      };
      
      // Check expiration (this should be handled by jwt.verify, but let's be explicit)
      if (decoded.exp * 1000 < Date.now()) {
        return reply.code(401).send({
          valid: false,
          error: 'expired_token',
          message: 'Token has expired'
        });
      }
      
      // In a real implementation, we would look up the user
      const userId = decoded.sub;
      let userInfo;
      
      for (const user of Object.values(users)) {
        if (user.userId === userId) {
          userInfo = user;
          break;
        }
      }
      
      if (!userInfo) {
        return reply.code(401).send({
          valid: false,
          error: 'invalid_token',
          message: 'User not found'
        });
      }
      
      return reply.code(200).send({
        valid: true,
        userId: userInfo.userId,
        permissions: userInfo.permissions,
        metadata: {
          username: userInfo.username,
          email: userInfo.email
        }
      });
    } catch (error) {
      return reply.code(401).send({
        valid: false,
        error: 'invalid_token',
        message: 'Token is invalid or expired'
      });
    }
  });

  // 3. Developer API Key Validation
  server.post('/auth/validate-api-key', async (request, reply) => {
    const apiKey = request.headers['x-api-key'] as string;
    
    // For our mock implementation, we'll have some predefined API keys
    const apiKeyInfo: Record<string, {
      developerId: string;
      permissions: string[];
    }> = {
      'valid-api-key': {
        developerId: 'dev_123456',
        permissions: ['payment_processing', 'user_validation']
      },
      'test-api-key': {
        developerId: 'dev_test123',
        permissions: ['user_validation']
      },
      'admin-api-key': {
        developerId: 'dev_admin789',
        permissions: ['payment_processing', 'user_validation', 'admin']
      }
    };
    
    const info = apiKeyInfo[apiKey];
    if (!info) {
      return reply.code(401).send({
        valid: false,
        error: 'invalid_api_key',
        message: 'The provided API key is invalid or has been revoked'
      });
    }
    
    return reply.code(200).send({
      valid: true,
      developerId: info.developerId,
      permissions: info.permissions
    });
  });

  // 4. Generate Token (for admin/testing)
  server.post('/auth/generate-token', async (request, reply) => {
    const apiKey = request.headers['x-api-key'] as string;
    const body = request.body as {
      userId: string;
      expiresIn?: string;
      permissions?: string[];
    };
    
    // Check if API key has admin permission
    if (apiKey !== 'admin-api-key') {
      return reply.code(403).send({
        error: 'insufficient_permissions',
        message: 'Your API key does not have permission to generate tokens'
      });
    }
    
    if (!body.userId) {
      return reply.code(400).send({
        error: 'invalid_request',
        message: 'User ID is required'
      });
    }
    
    // Parse expiresIn (default to 24h)
    let expiresInSeconds = 24 * 60 * 60; // 24 hours
    if (body.expiresIn) {
      const match = body.expiresIn.match(/^(\d+)([smhdw])$/);
      if (match) {
        const value = parseInt(match[1], 10);
        const unit = match[2];
        switch (unit) {
          case 's': expiresInSeconds = value; break;
          case 'm': expiresInSeconds = value * 60; break;
          case 'h': expiresInSeconds = value * 60 * 60; break;
          case 'd': expiresInSeconds = value * 60 * 60 * 24; break;
          case 'w': expiresInSeconds = value * 60 * 60 * 24 * 7; break;
        }
      }
    }
    
    const expirationTime = Math.floor(Date.now() / 1000) + expiresInSeconds;
    
    // Create JWT token
    const token = jwt.sign({
      sub: body.userId,
      iss: 'mcp-auth-service',
      iat: Math.floor(Date.now() / 1000),
      exp: expirationTime,
      apiKey,
      mcpServerId: 'mock-server-123',
      permissions: body.permissions || []
    }, JWT_SECRET);
    
    return reply.code(200).send({
      token,
      expiresAt: new Date(expirationTime * 1000).toISOString()
    });
  });

  // 5. Create Authentication Request (additional helper for our mock implementation)
  server.post('/auth/create-request', async (request, reply) => {
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
} 