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
} 