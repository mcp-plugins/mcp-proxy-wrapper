import { FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import { DeveloperModel } from '../models/developers.js';
import { UserModel } from '../models/users.js';

// Secret key for JWT signing
const JWT_SECRET = 'mock-backend-secret-key';

/**
 * Authentication controller
 */
export const AuthController = {
  /**
   * Validate an API key
   */
  async validateApiKey(
    request: FastifyRequest<{ Headers: { 'x-api-key'?: string } }>,
    reply: FastifyReply
  ) {
    const apiKey = request.headers['x-api-key'] as string;
    
    if (!apiKey) {
      return reply.status(401).send({
        error: 'missing_api_key',
        message: 'API key is required'
      });
    }
    
    const result = DeveloperModel.validateApiKey(apiKey);
    
    if (!result.valid) {
      return reply.status(401).send({
        error: 'invalid_api_key',
        message: 'Invalid API key'
      });
    }
    
    return {
      valid: true,
      developerId: result.developerId
    };
  },

  /**
   * Generate a JWT token (admin only)
   */
  async generateToken(
    request: FastifyRequest<{
      Headers: { 'x-api-key'?: string },
      Body: { userId: string, expiresIn?: string }
    }>,
    reply: FastifyReply
  ) {
    const apiKey = request.headers['x-api-key'] as string;
    
    // Verify admin privileges
    if (!DeveloperModel.isAdmin(apiKey)) {
      return reply.status(403).send({
        error: 'forbidden',
        message: 'Admin API key required'
      });
    }
    
    const { userId, expiresIn = '1h' } = request.body;
    
    // Check if user exists
    const user = UserModel.findById(userId);
    if (!user) {
      return reply.status(400).send({
        error: 'invalid_user',
        message: 'User not found'
      });
    }
    
    // Generate JWT token
    const token = jwt.sign(
      { 
        sub: userId,
        name: user.name,
        email: user.email
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
  },

  /**
   * Verify a JWT token
   */
  async verifyToken(
    request: FastifyRequest<{
      Headers: { 'x-api-key'?: string },
      Body: {
        token: string,
        resourceType?: 'tool' | 'prompt' | 'resource',
        resourceId?: string
      }
    }>,
    reply: FastifyReply
  ) {
    const apiKey = request.headers['x-api-key'] as string;
    
    // Validate API key
    if (!DeveloperModel.validateApiKey(apiKey).valid) {
      return reply.status(401).send({
        error: 'invalid_api_key',
        message: 'Invalid API key'
      });
    }
    
    const { token, resourceType, resourceId } = request.body;
    
    try {
      // Verify JWT token
      const decoded = jwt.verify(token, JWT_SECRET) as { sub: string };
      const userId = decoded.sub;
      
      // Check if user exists
      const user = UserModel.findById(userId);
      if (!user) {
        return {
          valid: false,
          error: 'invalid_user',
          message: 'User not found'
        };
      }
      
      // For this mock implementation, all users have access to all resources
      // In a real implementation, you would check permissions here
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
  },

  /**
   * Generate an authentication URL
   */
  async generateAuthUrl(
    request: FastifyRequest<{
      Querystring: { redirectUrl?: string, apiKey?: string }
    }>
  ) {
    const { redirectUrl, apiKey } = request.query;
    
    // In a real implementation, this would generate a URL to the auth service
    const authUrl = `http://localhost:3000/auth/login?redirect=${encodeURIComponent(redirectUrl || '')}&apiKey=${apiKey || ''}`;
    
    return {
      url: authUrl
    };
  }
}; 