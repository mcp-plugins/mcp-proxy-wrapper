/**
 * @file Authentication Provider Interface
 * @version 1.0.0
 * 
 * Defines the contract for authentication provider implementations.
 * Custom authentication services must implement this interface.
 */

import { 
  VerifyResponse, 
  SessionOptions, 
  SessionStatus, 
  UserData, 
  AuthConfig
} from '../../interfaces/auth-service.js';

/**
 * Authentication Provider Interface
 * Defines the required methods for authentication and token verification
 */
export interface IAuthProvider {
  /**
   * Generate an authentication URL for a user
   * @param options Optional configuration for the authentication URL
   * @returns URL for user authentication
   */
  generateAuthUrl(options?: Record<string, unknown>): string;
  
  /**
   * Verify a JWT token for a specific resource
   * @param token JWT token to verify
   * @param resourceType Type of resource being accessed
   * @param resourceId Identifier of the resource being accessed
   * @returns Promise resolving to verification response
   */
  verifyToken(token: string, resourceType: 'tool' | 'prompt' | 'resource', resourceId: string): Promise<VerifyResponse>;
  
  /**
   * Generates a user token (primarily for testing)
   * @param userId Optional user ID to include in the token
   * @returns A token string
   */
  generateToken(userId?: string): string;
  
  /**
   * Creates an authentication session
   * @param sessionId The unique session identifier
   * @param options Session configuration options
   * @returns A promise resolving to the session status
   */
  createSession?(sessionId: string, options: SessionOptions): Promise<SessionStatus>;
  
  /**
   * Checks the status of an authentication session
   * @param sessionId The session ID to check
   * @returns A promise resolving to the current session status
   */
  checkSessionStatus?(sessionId: string): Promise<SessionStatus>;
  
  /**
   * Validates a JWT token and retrieves user data
   * @param jwt The JWT token to validate
   * @returns A promise resolving to user data or null if invalid
   */
  validateJWT?(jwt: string): Promise<UserData | null>;
}

/**
 * Authentication Provider Options Interface
 * Configuration options for authentication providers
 */
export interface AuthProviderOptions extends AuthConfig {
  /**
   * Optional custom configuration specific to the provider implementation
   */
  providerConfig?: Record<string, unknown>;
}
