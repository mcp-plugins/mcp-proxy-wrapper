/**
 * @file Default Auth Provider Tests
 * @version 1.0.0
 * 
 * Tests for the DefaultAuthProvider implementation
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { DefaultAuthProvider } from '../providers/default-auth-provider';
import { validateInterfaceImplementation } from './utils/interface-validator';

describe('DefaultAuthProvider', () => {
  let authProvider: DefaultAuthProvider;
  
  beforeEach(() => {
    // Create a fresh instance for each test
    authProvider = new DefaultAuthProvider({
      apiKey: 'test-api-key',
      baseAuthUrl: 'https://test-auth.example.com',
      providerConfig: {
        debugMode: true
      }
    });
  });
  
  it('implements the IAuthProvider interface', () => {
    const requiredMethods = [
      'generateAuthUrl',
      'verifyToken',
      'generateToken',
      'createSession',
      'checkSessionStatus',
      'validateJWT'
    ];
    
    const validation = validateInterfaceImplementation(authProvider, requiredMethods);
    expect(validation.implementsAll).toBe(true);
    expect(validation.missingMethods).toHaveLength(0);
  });
  
  it('generates an authentication URL', () => {
    const authUrl = authProvider.generateAuthUrl();
    
    expect(authUrl).toBeDefined();
    expect(typeof authUrl).toBe('string');
    expect(authUrl).toContain('https://');
    expect(authUrl).toContain('/authenticate/');
  });
  
  it('generates a token with the specified user ID', () => {
    const userId = 'test-user-id';
    const token = authProvider.generateToken(userId);
    
    expect(token).toBeDefined();
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(0);
  });
  
  it('verifies a valid token', async () => {
    // Generate a valid token
    const userId = 'test-user-id';
    const token = authProvider.generateToken(userId);
    
    // Verify the token
    const result = await authProvider.verifyToken(token, 'tool', 'test-tool');
    
    expect(result).toBeDefined();
    expect(result.valid).toBe(true);
    expect(result.userId).toBeDefined();
    expect(result.permissions).toBeDefined();
    expect(result.permissions?.canAccess).toBe(true);
  });
  
  it('rejects an invalid token', async () => {
    const invalidToken = 'invalid-token';
    
    // Verify the token
    const result = await authProvider.verifyToken(invalidToken, 'tool', 'test-tool');
    
    expect(result).toBeDefined();
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.message).toBeDefined();
  });
  
  it('creates a session', async () => {
    const sessionId = 'test-session-id';
    const options = {
      return_url: 'https://example.com/return',
      user_hint: 'test@example.com'
    };
    
    const result = await authProvider.createSession!(sessionId, options);
    
    expect(result).toBeDefined();
    expect(result.status).toBeDefined();
    expect(result.expires_in).toBeGreaterThan(0);
  });
  
  it('checks a session status', async () => {
    const sessionId = 'test-session-id';
    
    // Directly mock the implementation rather than relying on the internal method
    const mockResult = {
      status: 'pending',
      expires_in: 600 // 10 minutes
    };
    
    // Replace the authService method
    (authProvider as any).authService.checkSessionStatus = jest.fn().mockResolvedValue(mockResult);
    
    const result = await authProvider.checkSessionStatus!(sessionId);
    
    expect(result).toBeDefined();
    expect(result.status).toBeDefined();
    expect(result.expires_in).toBeGreaterThan(0);
    
    // Verify our mock was called with the right sessionId
    expect((authProvider as any).authService.checkSessionStatus).toHaveBeenCalledWith(sessionId);
  });
  
  it('validates a JWT token', async () => {
    // Generate a valid token
    const userId = 'test-user-id';
    const token = authProvider.generateToken(userId);
    
    // Validate the token
    const result = await authProvider.validateJWT!(token);
    
    expect(result).toBeDefined();
    expect(result).not.toBeNull();
    
    if (result) {
      expect(result.user_id).toBeDefined();
      expect(result.name).toBeDefined();
      expect(result.email).toBeDefined();
      expect(result.balance).toBeGreaterThan(0);
      expect(result.currency).toBe('USD');
    }
  });
  
  it('returns null for invalid JWT token', async () => {
    const invalidToken = 'invalid-token';
    
    // Validate the token
    const result = await authProvider.validateJWT!(invalidToken);
    
    expect(result).toBeNull();
  });
});
