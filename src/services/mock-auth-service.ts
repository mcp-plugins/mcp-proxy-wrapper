/**
 * @file Mock Authentication Service
 * @version 0.1.0
 * 
 * Mock implementation of the Authentication Service for testing
 */

import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import { IAuthService, VerifyResponse, AuthConfig } from '../interfaces/auth-service.js';

/**
 * Mock Authentication Service
 * Provides a mock implementation of the authentication service for testing
 */
export class MockAuthService implements IAuthService {
  private apiKey: string;
  private baseAuthUrl: string;
  private jwtSecret = 'mock-secret-key-for-testing-only';
  private tokenExpirationSeconds = 3600; // 1 hour
  
  constructor(config: AuthConfig) {
    this.apiKey = config.apiKey;
    this.baseAuthUrl = config.baseAuthUrl || 'https://auth.mcp-api.com';
  }
  
  /**
   * Generate an authentication URL for a user
   * @returns URL for user authentication
   */
  generateAuthUrl(): string {
    const uuid = uuidv4();
    return `${this.baseAuthUrl}/authenticate/${uuid}`;
  }
  
  /**
   * Verify a JWT token
   * @param token JWT token to verify
   * @param resourceType Type of resource being accessed
   * @param resourceId Identifier of the resource being accessed
   * @returns Verification response
   */
  async verifyToken(
    token: string, 
    resourceType: 'tool' | 'prompt' | 'resource', 
    resourceId: string
  ): Promise<VerifyResponse> {
    try {
      // Verify the token
      const decoded = jwt.verify(token, this.jwtSecret) as jwt.JwtPayload;
      
      // Check if the token is for the correct API key
      if (decoded.apiKey !== this.apiKey) {
        return {
          valid: false,
          error: 'invalid_token',
          message: 'Token is not valid for this API key'
        };
      }
      
      // For testing, we'll always return successful verification
      // In a real implementation, this would check user permissions, funds, etc.
      return {
        valid: true,
        userId: decoded.sub as string,
        permissions: {
          canAccess: true,
          reasonCodes: ['sufficient_funds', 'authorized_resource']
        }
      };
    } catch (error) {
      // If token verification fails, return an error
      return {
        valid: false,
        error: 'invalid_token',
        message: 'Token is invalid or expired'
      };
    }
  }
  
  /**
   * Generate a JWT token for testing
   * This method is not part of the IAuthService interface
   * It's provided for testing purposes only
   * 
   * @param userId User ID to include in the token
   * @returns Generated JWT token
   */
  generateToken(userId: string = 'test-user-123'): string {
    const now = Math.floor(Date.now() / 1000);
    
    const payload = {
      sub: userId,
      iss: 'mcp-auth-service',
      iat: now,
      exp: now + this.tokenExpirationSeconds,
      apiKey: this.apiKey,
      mcpServerId: 'mock-server-id'
    };
    
    return jwt.sign(payload, this.jwtSecret);
  }
} 