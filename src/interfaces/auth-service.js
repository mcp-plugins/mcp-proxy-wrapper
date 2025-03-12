/**
 * @file Auth Service Interface
 * @version 1.0.0
 * @status STABLE - DO NOT MODIFY WITHOUT TESTS
 * @lastModified 2024-03-15
 * 
 * This module defines the interface for authentication services used by the payment wrapper.
 * 
 * IMPORTANT:
 * - All changes must be accompanied by tests
 * - Do not modify the interface without updating all implementations
 * 
 * Functionality:
 * - JWT token verification
 * - Authentication session management
 * - User validation
 * - URL generation for authentication
 */

/**
 * Permission verification result
 */
export interface PermissionsVerificationResult {
  canAccess: boolean;
  reasonCodes?: string[];
  errorMessage?: string;
}

/**
 * Result of token verification
 */
export interface TokenVerificationResult {
  valid: boolean;
  userId?: string;
  error?: string;
  message?: string;
  permissions?: PermissionsVerificationResult;
}

/**
 * Session options for creating an authentication session
 */
export interface SessionOptions {
  return_url?: string;
  user_hint?: string;
  created_at: string;
  expires_at: string;
}

/**
 * Session status information
 */
export interface SessionStatus {
  status: 'pending' | 'authenticated' | 'expired';
  user_id?: string;
  name?: string;
  email?: string;
  jwt?: string;
  authenticated_at?: string;
  expires_in?: number;
}

/**
 * User data returned after JWT validation
 */
export interface UserData {
  user_id: string;
  name?: string;
  email?: string;
  balance: number;
  currency: string;
  available_credit?: number;
  refreshedJwt?: string;
}

/**
 * Interface for authentication services
 */
export interface IAuthService {
  /**
   * Verify a JWT token for accessing a specific resource
   * 
   * @param token The JWT token to verify
   * @param resourceType The type of resource being accessed
   * @param resourceId The ID of the resource being accessed
   * @returns Promise<TokenVerificationResult> The result of verification
   */
  verifyToken(token: string, resourceType: string, resourceId: string): Promise<TokenVerificationResult>;

  /**
   * Generate a URL for authentication
   * 
   * @returns string The URL for authentication
   */
  generateAuthUrl(): string;

  /**
   * Create a new authentication session
   * Optional: Supported only by authentication services with session management
   * 
   * @param sessionId The unique session ID
   * @param options Session creation options
   * @returns Promise<void>
   */
  createSession?(sessionId: string, options?: SessionOptions): Promise<void>;

  /**
   * Check the status of an authentication session
   * Optional: Supported only by authentication services with session management
   * 
   * @param sessionId The session ID to check
   * @returns Promise<SessionStatus | null> The session status or null if not found
   */
  checkSessionStatus?(sessionId: string): Promise<SessionStatus | null>;

  /**
   * Validate a JWT token and return user data
   * Optional: Supported only by authentication services with user data capabilities
   * 
   * @param jwt The JWT token to validate
   * @returns Promise<UserData | null> User data if valid, null otherwise
   */
  validateJWT?(jwt: string): Promise<UserData | null>;
} 