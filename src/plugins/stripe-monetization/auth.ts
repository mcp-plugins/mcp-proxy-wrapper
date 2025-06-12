/**
 * @file Authentication Manager for Stripe Monetization Plugin
 * @version 1.0.0
 * @description Handles JWT tokens and API key authentication for the monetization plugin
 * 
 * Supports multiple authentication methods:
 * - JWT tokens for temporary access
 * - API keys for permanent access
 * - Integration with customer database
 */

import { createHash, randomBytes, timingSafeEqual } from 'crypto';
import { CustomerInfo, AuthenticationError, MonetizationError } from './interfaces.js';
import { DatabaseManager } from './database.js';

/**
 * JWT payload interface
 */
export interface JWTPayload {
  customerId: string;
  email: string;
  iat: number;
  exp: number;
  type: 'access' | 'refresh';
}

/**
 * Authentication configuration
 */
export interface AuthConfig {
  jwtSecret: string;
  tokenExpiration: string;
  enableApiKeys: boolean;
  apiKeyPrefix: string;
}

/**
 * API key generation options
 */
export interface ApiKeyOptions {
  length?: number;
  includeChecksum?: boolean;
  prefix?: string;
}

/**
 * Authentication manager class
 */
export class AuthenticationManager {
  private config: AuthConfig;
  private databaseManager?: DatabaseManager;

  constructor(config: AuthConfig) {
    this.config = config;
  }

  /**
   * Set database manager for customer lookups
   */
  setDatabaseManager(databaseManager: DatabaseManager): void {
    this.databaseManager = databaseManager;
  }

  /**
   * Authenticate a request using token or API key
   */
  async authenticate(authToken: string): Promise<CustomerInfo | null> {
    if (!authToken) {
      throw new AuthenticationError('No authentication token provided');
    }

    // Check if it's a JWT token
    if (authToken.includes('.')) {
      return await this.authenticateJWT(authToken);
    }

    // Check if it's an API key
    if (this.config.enableApiKeys) {
      return await this.authenticateApiKey(authToken);
    }

    throw new AuthenticationError('Invalid authentication token format');
  }

  /**
   * Authenticate using JWT token
   */
  async authenticateJWT(token: string): Promise<CustomerInfo | null> {
    try {
      const payload = this.verifyJWT(token);
      
      if (!this.databaseManager) {
        throw new AuthenticationError('Database not available for customer lookup');
      }

      const customer = await this.databaseManager.getCustomer(payload.customerId);
      if (!customer) {
        throw new AuthenticationError('Customer not found');
      }

      return customer;
    } catch (error) {
      if (error instanceof AuthenticationError) {
        throw error;
      }
      throw new AuthenticationError('Invalid JWT token');
    }
  }

  /**
   * Authenticate using API key
   */
  async authenticateApiKey(apiKey: string): Promise<CustomerInfo | null> {
    if (!this.config.enableApiKeys) {
      throw new AuthenticationError('API key authentication disabled');
    }

    if (!this.databaseManager) {
      throw new AuthenticationError('Database not available for customer lookup');
    }

    // Validate API key format
    if (!this.isValidApiKeyFormat(apiKey)) {
      throw new AuthenticationError('Invalid API key format');
    }

    const customer = await this.databaseManager.getCustomerByApiKey(apiKey);
    if (!customer) {
      throw new AuthenticationError('Invalid API key');
    }

    return customer;
  }

  /**
   * Generate a JWT token for a customer
   */
  generateJWT(customerId: string, email: string, type: 'access' | 'refresh' = 'access'): string {
    const now = Math.floor(Date.now() / 1000);
    const expiration = this.calculateExpiration(type);

    const payload: JWTPayload = {
      customerId,
      email,
      iat: now,
      exp: now + expiration,
      type
    };

    return this.createJWT(payload);
  }

  /**
   * Generate a secure API key
   */
  generateApiKey(options: ApiKeyOptions = {}): string {
    const {
      length = 32,
      includeChecksum = true,
      prefix = this.config.apiKeyPrefix
    } = options;

    // Generate random bytes
    const randomPart = randomBytes(Math.ceil(length / 2)).toString('hex').substring(0, length);
    
    let apiKey = `${prefix}${randomPart}`;

    // Add checksum for validation
    if (includeChecksum) {
      const checksum = this.calculateChecksum(randomPart);
      apiKey += `_${checksum}`;
    }

    return apiKey;
  }

  /**
   * Verify JWT token and return payload
   */
  verifyJWT(token: string): JWTPayload {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) {
        throw new Error('Invalid JWT format');
      }

      const [headerB64, payloadB64, signatureB64] = parts;
      
      // Verify signature
      const expectedSignature = this.signJWT(`${headerB64}.${payloadB64}`);
      const providedSignature = Buffer.from(signatureB64, 'base64url');
      const expectedBuffer = Buffer.from(expectedSignature, 'base64url');

      if (!timingSafeEqual(providedSignature, expectedBuffer)) {
        throw new Error('Invalid JWT signature');
      }

      // Decode payload
      const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString()) as JWTPayload;

      // Check expiration
      const now = Math.floor(Date.now() / 1000);
      if (payload.exp < now) {
        throw new Error('JWT token expired');
      }

      return payload;
    } catch (error) {
      throw new AuthenticationError(`Invalid JWT: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Refresh a JWT token
   */
  refreshJWT(refreshToken: string): string {
    const payload = this.verifyJWT(refreshToken);
    
    if (payload.type !== 'refresh') {
      throw new AuthenticationError('Invalid refresh token type');
    }

    // Generate new access token
    return this.generateJWT(payload.customerId, payload.email, 'access');
  }

  /**
   * Validate API key format
   */
  isValidApiKeyFormat(apiKey: string): boolean {
    if (!apiKey.startsWith(this.config.apiKeyPrefix)) {
      return false;
    }

    // Check if it has a checksum
    const parts = apiKey.split('_');
    if (parts.length === 2) {
      const [keyPart, checksum] = parts;
      const keyWithoutPrefix = keyPart.substring(this.config.apiKeyPrefix.length);
      const expectedChecksum = this.calculateChecksum(keyWithoutPrefix);
      return timingSafeEqual(
        Buffer.from(checksum, 'hex'),
        Buffer.from(expectedChecksum, 'hex')
      );
    }

    // Basic format validation without checksum
    const keyPart = apiKey.substring(this.config.apiKeyPrefix.length);
    return /^[a-f0-9]{32,}$/.test(keyPart);
  }

  /**
   * Hash password for storage (if implementing password auth)
   */
  hashPassword(password: string, salt?: string): { hash: string; salt: string } {
    const actualSalt = salt || randomBytes(16).toString('hex');
    const hash = createHash('pbkdf2')
      .update(password + actualSalt)
      .digest('hex');
    
    return { hash, salt: actualSalt };
  }

  /**
   * Verify password against hash
   */
  verifyPassword(password: string, hash: string, salt: string): boolean {
    const { hash: computedHash } = this.hashPassword(password, salt);
    return timingSafeEqual(
      Buffer.from(hash, 'hex'),
      Buffer.from(computedHash, 'hex')
    );
  }

  /**
   * Generate a secure reset token
   */
  generateResetToken(): string {
    return randomBytes(32).toString('hex');
  }

  /**
   * Create rate limiting key for authentication attempts
   */
  createRateLimitKey(identifier: string, type: 'login' | 'api'): string {
    return `auth_${type}_${createHash('sha256').update(identifier).digest('hex')}`;
  }

  /**
   * Extract customer ID from various token types
   */
  extractCustomerId(authToken: string): string | null {
    try {
      if (authToken.includes('.')) {
        // JWT token
        const payload = this.verifyJWT(authToken);
        return payload.customerId;
      } else {
        // API key - would need database lookup
        return null; // Can't extract without database lookup
      }
    } catch (error) {
      return null;
    }
  }

  // Private helper methods

  /**
   * Create JWT with signature
   */
  private createJWT(payload: JWTPayload): string {
    const header = {
      typ: 'JWT',
      alg: 'HS256'
    };

    const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
    const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
    
    const signature = this.signJWT(`${headerB64}.${payloadB64}`);
    
    return `${headerB64}.${payloadB64}.${signature}`;
  }

  /**
   * Sign JWT data with secret
   */
  private signJWT(data: string): string {
    return createHash('sha256')
      .update(data + this.config.jwtSecret)
      .digest('base64url');
  }

  /**
   * Calculate token expiration in seconds
   */
  private calculateExpiration(type: 'access' | 'refresh'): number {
    if (type === 'refresh') {
      return 30 * 24 * 60 * 60; // 30 days
    }

    // Parse expiration string (e.g., '24h', '7d', '1w')
    const expiration = this.config.tokenExpiration;
    const match = expiration.match(/^(\d+)([smhdw])$/);
    
    if (!match) {
      return 24 * 60 * 60; // Default 24 hours
    }

    const [, value, unit] = match;
    const num = parseInt(value, 10);

    switch (unit) {
      case 's': return num;
      case 'm': return num * 60;
      case 'h': return num * 60 * 60;
      case 'd': return num * 24 * 60 * 60;
      case 'w': return num * 7 * 24 * 60 * 60;
      default: return 24 * 60 * 60;
    }
  }

  /**
   * Calculate checksum for API key validation
   */
  private calculateChecksum(data: string): string {
    return createHash('sha256')
      .update(data + this.config.jwtSecret)
      .digest('hex')
      .substring(0, 8);
  }

  /**
   * Secure string comparison to prevent timing attacks
   */
  private secureCompare(a: string, b: string): boolean {
    if (a.length !== b.length) {
      return false;
    }

    return timingSafeEqual(
      Buffer.from(a, 'utf8'),
      Buffer.from(b, 'utf8')
    );
  }
}

/**
 * Utility functions for authentication middleware
 */
export class AuthMiddleware {
  private authManager: AuthenticationManager;

  constructor(authManager: AuthenticationManager) {
    this.authManager = authManager;
  }

  /**
   * Express-style middleware for JWT authentication
   */
  requireAuth() {
    return async (req: any, res: any, next: any) => {
      try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return res.status(401).json({ error: 'No authorization token provided' });
        }

        const token = authHeader.substring(7);
        const customer = await this.authManager.authenticate(token);
        
        if (!customer) {
          return res.status(401).json({ error: 'Invalid authentication token' });
        }

        req.customer = customer;
        next();
      } catch (error) {
        if (error instanceof AuthenticationError) {
          return res.status(401).json({ error: error.message });
        }
        return res.status(500).json({ error: 'Authentication error' });
      }
    };
  }

  /**
   * Optional authentication middleware
   */
  optionalAuth() {
    return async (req: any, res: any, next: any) => {
      try {
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
          const token = authHeader.substring(7);
          const customer = await this.authManager.authenticate(token);
          req.customer = customer;
        }
        next();
      } catch (error) {
        // Continue without authentication for optional auth
        next();
      }
    };
  }

  /**
   * Admin-only authentication middleware
   */
  requireAdmin() {
    return async (req: any, res: any, next: any) => {
      try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
          return res.status(401).json({ error: 'No authorization token provided' });
        }

        const token = authHeader.substring(7);
        const customer = await this.authManager.authenticate(token);
        
        if (!customer) {
          return res.status(401).json({ error: 'Invalid authentication token' });
        }

        // Check if customer has admin privileges (implement your own logic)
        if (!this.isAdmin(customer)) {
          return res.status(403).json({ error: 'Admin access required' });
        }

        req.customer = customer;
        next();
      } catch (error) {
        if (error instanceof AuthenticationError) {
          return res.status(401).json({ error: error.message });
        }
        return res.status(500).json({ error: 'Authentication error' });
      }
    };
  }

  private isAdmin(customer: CustomerInfo): boolean {
    // Implement your admin check logic here
    // For example, check metadata or specific customer IDs
    return customer.email?.endsWith('@admin.example.com') || false;
  }
}