/**
 * @file Authentication Service Interfaces
 * @version 0.1.0
 * 
 * Interfaces for the MCP Authentication Backend Service
 */

/**
 * Authentication Configuration Options
 */
export interface AuthConfig {
  /**
   * Base URL for the authentication service
   * @default "https://auth.mcp-api.com"
   */
  baseAuthUrl?: string;
  
  /**
   * Developer API key for the MCP server
   * Required for authenticating the MCP server with the backend
   */
  apiKey: string;
}

/**
 * User Authentication Response
 * Returned when a user successfully authenticates
 */
export interface AuthResponse {
  /** JWT token for the authenticated user */
  token: string;
  
  /** Expiration time of the token in ISO 8601 format */
  expiresAt: string;
  
  /** Unique identifier for the authenticated user */
  userId: string;
}

/**
 * Token Verification Request
 * Used when verifying a JWT token for accessing resources
 */
export interface VerifyRequest {
  /** JWT token to verify */
  token: string;
  
  /** Developer API key */
  apiKey: string;
  
  /** Type of resource being accessed */
  resourceType: 'tool' | 'prompt' | 'resource';
  
  /** Identifier of the resource being accessed */
  resourceId: string;
}

/**
 * Token Verification Response
 * Returned when verifying a JWT token
 */
export interface VerifyResponse {
  /** Whether the token is valid */
  valid: boolean;
  
  /** User ID associated with the token (if valid) */
  userId?: string;
  
  /** Permissions for accessing the requested resource */
  permissions?: {
    /** Whether the user can access the resource */
    canAccess: boolean;
    
    /** Reason codes explaining the permission decision */
    reasonCodes: string[];
    
    /** Error message if access is denied */
    errorMessage?: string;
  };
  
  /** Error code if the token is invalid */
  error?: string;
  
  /** Error message if the token is invalid */
  message?: string;
}

/**
 * Error Response
 * Standard format for error responses
 */
export interface ErrorResponse {
  /** Error code */
  error: string;
  
  /** Human-readable error message */
  message: string;
  
  /** Optional additional details */
  details?: Record<string, unknown>;
}

/**
 * Session options for creating an authentication session
 */
export interface SessionOptions {
  /** URL to redirect after authentication */
  return_url?: string;
  
  /** Email or username to pre-fill in the auth form */
  user_hint?: string;
  
  /** Creation timestamp in ISO format */
  created_at?: string;
  
  /** Expiration timestamp in ISO format */
  expires_at?: string;
}

/**
 * Session status information
 */
export interface SessionStatus {
  /** Current status of the authentication session */
  status: 'pending' | 'authenticated' | 'expired' | 'error';
  
  /** User ID if authenticated */
  user_id?: string;
  
  /** User's name if available */
  name?: string;
  
  /** User's email if available */
  email?: string;
  
  /** JWT token if authenticated */
  jwt?: string;
  
  /** Timestamp of authentication */
  authenticated_at?: string;
  
  /** Seconds until this session expires */
  expires_in: number;
  
  /** Error message if status is 'error' */
  error?: string;
}

/**
 * User data returned after JWT validation
 */
export interface UserData {
  /** User's unique identifier */
  user_id: string;
  
  /** User's display name */
  name: string;
  
  /** User's email address */
  email: string;
  
  /** Current balance amount */
  balance: number;
  
  /** Currency code (e.g., USD) */
  currency: string;
  
  /** Available credit (if applicable) */
  available_credit: number;
  
  /** Updated JWT token (only if token was refreshed) */
  refreshedJwt?: string;
}

/**
 * Authentication Service Interface
 * Defines the methods for authentication and token verification
 */
export interface IAuthService {
  /**
   * Generate an authentication URL for a user
   * @returns URL for user authentication
   */
  generateAuthUrl(): string;
  
  /**
   * Verify a JWT token
   * @param token JWT token to verify
   * @param resourceType Type of resource being accessed
   * @param resourceId Identifier of the resource being accessed
   * @returns Verification response
   */
  verifyToken(token: string, resourceType: 'tool' | 'prompt' | 'resource', resourceId: string): Promise<VerifyResponse>;
  
  /**
   * Verifies a user token for a specific resource
   * @param token The user token to verify
   * @param resourceType The type of resource being accessed
   * @param resourceId The ID of the resource being accessed
   * @returns A promise resolving to a verification result
   */
  verifyToken(token: string, resourceType: 'tool' | 'prompt' | 'resource', resourceId: string): Promise<VerifyResponse>;
  
  /**
   * Generates a user token (primarily for testing)
   * @param userId Optional user ID to include in the token
   * @returns A promise resolving to a token string
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