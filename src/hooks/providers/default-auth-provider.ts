/**
 * @file Default Authentication Provider Implementation
 * @version 1.0.0
 * 
 * Default implementation of the IAuthProvider interface
 * using the existing MockAuthService for backward compatibility
 */

import { AuthProviderOptions, IAuthProvider } from '../interfaces/auth-provider.js';
import { MockAuthService } from '../../services/mock-auth-service.js';
import { 
  VerifyResponse, 
  SessionOptions, 
  SessionStatus, 
  UserData 
} from '../../interfaces/auth-service.js';
import { createLogger } from '../../utils/mcp-logger.js';

/**
 * Default Authentication Provider
 * Wraps the existing MockAuthService to implement the IAuthProvider interface
 */
export class DefaultAuthProvider implements IAuthProvider {
  private authService: MockAuthService;
  private logger: ReturnType<typeof createLogger>;
  
  /**
   * Creates a new DefaultAuthProvider instance
   * @param options Configuration options
   */
  constructor(options: AuthProviderOptions) {
    this.authService = new MockAuthService({
      apiKey: options.apiKey,
      baseAuthUrl: options.baseAuthUrl
    });
    
    this.logger = createLogger({
      level: options.providerConfig?.debugMode ? 'debug' : 'info'
    });
    
    this.logger.debug('DefaultAuthProvider initialized', { 
      baseAuthUrl: options.baseAuthUrl || 'default' 
    });
  }
  
  /**
   * Generate an authentication URL for a user
   * @returns URL for user authentication
   */
  generateAuthUrl(options?: Record<string, unknown>): string {
    this.logger.debug('Generating auth URL', { options });
    return this.authService.generateAuthUrl();
  }
  
  /**
   * Verify a JWT token for resource access
   * @param token JWT token to verify
   * @param resourceType Type of resource being accessed
   * @param resourceId Identifier of the resource being accessed
   * @returns Promise resolving to verification response
   */
  async verifyToken(
    token: string, 
    resourceType: 'tool' | 'prompt' | 'resource', 
    resourceId: string
  ): Promise<VerifyResponse> {
    this.logger.debug('Verifying token', { resourceType, resourceId });
    return this.authService.verifyToken(token, resourceType, resourceId);
  }
  
  /**
   * Generate a test token with optional user ID
   * @param userId Optional user ID to include in token
   * @returns JWT token string
   */
  generateToken(userId?: string): string {
    this.logger.debug('Generating token', { userId });
    return this.authService.generateToken(userId);
  }
  
  /**
   * Creates an authentication session
   * @param sessionId The unique session identifier
   * @param options Session configuration options
   * @returns Promise resolving to the session status
   */
  async createSession(sessionId: string, options: SessionOptions): Promise<SessionStatus> {
    this.logger.debug('Creating session', { sessionId, options });
    
    // Use the existing MockAuthService implementation if available
    if (typeof this.authService.createSession === 'function') {
      return this.authService.createSession(sessionId, options);
    }
    
    // Fallback implementation if not available in the wrapped service
    return {
      status: 'pending',
      expires_in: 600 // 10 minutes
    };
  }
  
  /**
   * Checks the status of an authentication session
   * @param sessionId The session ID to check
   * @returns Promise resolving to the current session status
   */
  async checkSessionStatus(sessionId: string): Promise<SessionStatus> {
    this.logger.debug('Checking session status', { sessionId });
    
    // Use the existing MockAuthService implementation if available
    if (typeof this.authService.checkSessionStatus === 'function') {
      return this.authService.checkSessionStatus(sessionId);
    }
    
    // Fallback implementation if not available in the wrapped service
    return {
      status: 'pending',
      expires_in: 600 // 10 minutes
    };
  }
  
  /**
   * Validates a JWT token and retrieves user data
   * @param jwt The JWT token to validate
   * @returns Promise resolving to user data or null if invalid
   */
  async validateJWT(jwt: string): Promise<UserData | null> {
    this.logger.debug('Validating JWT');
    
    // Use the existing MockAuthService implementation if available
    if (typeof this.authService.validateJWT === 'function') {
      return this.authService.validateJWT(jwt);
    }
    
    // Extract user ID from token for fallback implementation
    try {
      // Simple verification - in a real implementation, this would validate the token cryptographically
      const verifyResult = await this.verifyToken(jwt, 'tool', 'token-validation');
      
      if (!verifyResult.valid || !verifyResult.userId) {
        return null;
      }
      
      // Fallback implementation if not available in the wrapped service
      return {
        user_id: verifyResult.userId,
        name: 'Test User',
        email: 'test@example.com',
        balance: 10000, // $100.00
        currency: 'USD',
        available_credit: 0
      };
    } catch (error) {
      this.logger.error('Error validating JWT', { error });
      return null;
    }
  }
}
