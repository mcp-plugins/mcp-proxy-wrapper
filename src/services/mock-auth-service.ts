/**
 * @file Mock Authentication Service
 * @version 1.0.0
 * @status STABLE - DO NOT MODIFY WITHOUT TESTS
 * @lastModified 2024-03-15
 * 
 * This module provides a mock implementation of the authentication service
 * for testing and development. It simulates JWT verification, session management,
 * and user validation without requiring an actual authentication backend.
 * 
 * IMPORTANT:
 * - This is a mock implementation and should not be used in production
 * - Real implementations should connect to an actual authentication service
 * 
 * Functionality:
 * - Simulated JWT token verification
 * - Simulated authentication session management
 * - Mock user data generation
 */

import { v4 as uuidv4 } from 'uuid';
import * as jwt from 'jsonwebtoken';
import { 
  IAuthService, 
  VerifyResponse, 
  AuthConfig, 
  SessionOptions, 
  SessionStatus, 
  UserData 
} from '../interfaces/auth-service.js';

interface SessionData {
  status: string;
  created: number;
  user_id?: string;
  name?: string;
  email?: string;
  jwt?: string;
  authenticated_at?: string;
  return_url?: string;
  user_hint?: string;
}

/**
 * Mock Authentication Service
 * Provides a mock implementation of the authentication service for testing
 */
export class MockAuthService implements IAuthService {
  private apiKey: string;
  private baseAuthUrl: string;
  private jwtSecret = 'mock-secret-key-for-testing-only';
  private tokenExpirationSeconds = 3600; // 1 hour
  private sessions: Map<string, SessionData>;
  private mockJwtStore: Map<string, UserData>;
  
  constructor(config: AuthConfig) {
    this.apiKey = config.apiKey;
    this.baseAuthUrl = config.baseAuthUrl || 'https://auth.mcp-api.com';
    this.sessions = new Map();
    this.mockJwtStore = new Map();
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

  /**
   * Creates a new authentication session
   * 
   * @param sessionId Unique session ID
   * @param options Session options
   */
  async createSession(sessionId: string, options?: SessionOptions): Promise<SessionStatus> {
    this.sessions.set(sessionId, {
      ...options,
      status: 'pending',
      created: Date.now()
    });
    
    // For testing, automatically authenticate sessions after 5 seconds
    // In a real implementation, this would happen when the user completes authentication
    const timeoutId = setTimeout(() => {
      const session = this.sessions.get(sessionId);
      if (session && session.status === 'pending') {
        // Generate a mock JWT
        const jwt = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoibW9jay11c2VyLWlkIiwibmFtZSI6Ik1vY2sgVXNlciIsImVtYWlsIjoibW9ja0B1c2VyLmNvbSIsImV4cCI6MTc5ODc5MTY5MCwiaWF0IjoxNjk4NzkxNjkwfQ.${this.apiKey.substring(0, 10)}`;
        
        // Store JWT in mock store for validation
        this.mockJwtStore.set(jwt, {
          user_id: 'mock-user-id',
          name: 'Mock User',
          email: 'mock@user.com',
          balance: 100.00,
          currency: 'USD',
          available_credit: 50.00
        });
        
        // Update session status
        this.sessions.set(sessionId, {
          ...session,
          status: 'authenticated',
          authenticated_at: new Date().toISOString(),
          user_id: 'mock-user-id',
          name: 'Mock User',
          email: 'mock@user.com',
          jwt
        });
      }
    }, 5000); // 5 seconds for testing
    
    // Allow the process to exit even if the timeout is pending
    timeoutId.unref();
    
    // Return initial session status
    return {
      status: 'pending',
      expires_in: 30 * 60, // 30 minutes
    };
  }

  /**
   * Checks the status of an authentication session
   * 
   * @param sessionId Session ID to check
   * @returns Session status or null if not found
   */
  async checkSessionStatus(sessionId: string): Promise<SessionStatus> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      return {
        status: 'error',
        error: 'Session not found',
        expires_in: 0
      };
    }
    
    // Check if session has expired
    const now = Date.now();
    const created = session.created;
    const expiresAt = created + 30 * 60 * 1000; // 30 minutes
    const expired = now > expiresAt;
    
    if (expired && session.status === 'pending') {
      this.sessions.set(sessionId, {
        ...session,
        status: 'expired'
      });
      return {
        status: 'expired',
        expires_in: 0
      };
    }
    
    // Calculate time remaining
    const expiresIn = Math.max(0, Math.floor((expiresAt - now) / 1000));
    
    return {
      status: session.status as 'pending' | 'authenticated' | 'expired' | 'error',
      user_id: session.user_id,
      name: session.name,
      email: session.email,
      jwt: session.jwt,
      authenticated_at: session.authenticated_at,
      expires_in: expiresIn
    };
  }

  /**
   * Validates a JWT token and returns user data
   * 
   * @param jwt JWT token to validate
   * @returns User data if valid, null otherwise
   */
  async validateJWT(jwt: string): Promise<UserData | null> {
    // Check if JWT is in our mock store
    if (this.mockJwtStore.has(jwt)) {
      return this.mockJwtStore.get(jwt) || null;
    }
    
    // For testing, also validate tokens that look like JWTs
    if (jwt.includes('eyJ') && jwt.split('.').length === 3) {
      // Create a mock user with a simulated balance
      const userData: UserData = {
        user_id: 'mock-user-id',
        name: 'Mock User',
        email: 'mock@user.com',
        balance: 100 + Math.random() * 900, // Random balance between 100-1000
        currency: 'USD',
        available_credit: 50 + Math.random() * 450, // Random credit between 50-500
      };
      
      // Occasionally refresh the JWT
      if (Math.random() > 0.7) {
        userData.refreshedJwt = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoibW9jay11c2VyLWlkIiwiZXhwIjoxNzk4NzkxNjkwLCJpYXQiOjE2OTg3OTE2OTB9.${this.apiKey.substring(0, 10)}-refreshed`;
      }
      
      return userData;
    }
    
    return null;
  }
} 