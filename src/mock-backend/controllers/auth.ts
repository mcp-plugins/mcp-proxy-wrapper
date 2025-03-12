import { FastifyRequest, FastifyReply } from 'fastify';
import jwt, { Secret, SignOptions } from 'jsonwebtoken';
import { DeveloperModel } from '../models/developers.js';
import { UserModel } from '../models/users.js';

// Secret key for JWT signing (in a real app, this would be in environment variables)
// Convert to Buffer to avoid type issues with jsonwebtoken
const JWT_SECRET: Secret = Buffer.from('mock-backend-secret-key', 'utf-8');

console.log('Auth controller loaded');
console.log('JWT_SECRET type:', typeof JWT_SECRET);
console.log('JWT_SECRET is Buffer:', Buffer.isBuffer(JWT_SECRET));

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
    console.log('Generating token for user:', userId);
    console.log('Token expiration:', expiresIn);
    
    // Check if user exists
    const user = UserModel.findById(userId);
    if (!user) {
      return reply.status(400).send({
        error: 'invalid_user',
        message: 'User not found'
      });
    }
    
    try {
      console.log('Attempting to sign JWT with payload:', { sub: userId, name: user.name, email: user.email });
      
      // Create the payload
      const payload = { 
        sub: userId,
        name: user.name,
        email: user.email
      };
      
      // Create options with explicit typing for expiresIn
      // The expiresIn can be a string like '1h' or a number in seconds
      const options: SignOptions = { 
        expiresIn: expiresIn as string | number
      };
      
      // Sign the token with explicit typing
      const token = jwt.sign(payload, JWT_SECRET, options);
      
      console.log('JWT token generated successfully');
      
      // Calculate expiration time
      let expirySeconds: number;
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
    } catch (error) {
      console.error('Error signing JWT:', error);
      return reply.status(500).send({
        error: 'token_generation_failed',
        message: 'Failed to generate authentication token'
      });
    }
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