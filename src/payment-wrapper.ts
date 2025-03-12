/**
 * @file Payment Wrapper for MCP Server
 * @version 1.1.0
 * @status STABLE - DO NOT MODIFY WITHOUT TESTS
 * @lastModified 2024-03-12
 * 
 * This module provides a wrapper for an MCP Server that adds payment functionality.
 * It validates API keys, user JWT tokens, and simulates billing checks before
 * forwarding calls to the underlying MCP server.
 * 
 * IMPORTANT:
 * - All changes must be accompanied by tests
 * - Do not modify the interface without updating documentation
 * 
 * Functionality:
 * - Instance wrapping of an existing MCP server
 * - Developer API key verification
 * - User JWT token verification
 * - Simulated billing checks
 * - Call forwarding to the underlying MCP server
 * - Simulated billing transactions
 * - Error handling and logging
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createLogger, isUsingStdioTransport, LoggerOptions } from './utils/logger.js';
import winston from 'winston';
import { v4 as uuidv4 } from 'uuid';
import { IAuthService } from './interfaces/auth-service.js';
import { MockAuthService } from './services/mock-auth-service.js';

// Define interfaces for the wrapper options
export interface PaymentWrapperOptions {
  /**
   * Developer API key used for authentication
   */
  apiKey: string;
  
  /**
   * User JWT token for identifying and authenticating the end user
   * If not provided, the wrapper will return authentication-required responses
   */
  userToken?: string;
  
  /**
   * Optional flag to enable additional debug logging
   */
  debugMode?: boolean;

  /**
   * Optional configuration for the logger
   */
  loggerOptions?: LoggerOptions;

  /**
   * Optional base URL for the authentication service
   * @default "https://auth.mcp-api.com"
   */
  baseAuthUrl?: string;
  
  /**
   * Optional override for the funds check result (for testing)
   * @default undefined
   */
  _testOverrideFundsCheck?: boolean;
}

/**
 * Error response for authentication required
 */
export interface AuthRequiredResponse {
  error: string;
  message: string;
  authUrl: string;
}

/**
 * Create a payment-enabled wrapper around an existing McpServer instance.
 * The wrapper validates API keys and user tokens, and simulates billing checks
 * before forwarding calls to the underlying MCP server.
 * 
 * @param server The existing McpServer instance to wrap
 * @param options The options for the payment wrapper
 * @returns A proxy McpServer instance with payment functionality
 */
export function wrapWithPayments(server: McpServer, options: PaymentWrapperOptions): McpServer {
  if (!options.apiKey) {
    throw new Error('Developer API key is required');
  }

  // Initialize logger
  const logger = createLogger(options.loggerOptions || {});
  const debugMode = options.debugMode || false;

  // Create auth service
  const authService: IAuthService = new MockAuthService({
    apiKey: options.apiKey,
    baseAuthUrl: options.baseAuthUrl
  });

  logger.debug(`Creating payment-enabled wrapper for McpServer`, {
    apiKey: options.apiKey ? '***' : undefined,
    userToken: options.userToken ? '***' : undefined,
    debugMode
  });

  // Function to check authentication
  const checkAuth = async (resourceType: 'tool' | 'prompt' | 'resource', resourceId: string): Promise<{ authenticated: boolean, authRequiredResponse?: AuthRequiredResponse }> => {
    if (!options.userToken) {
      logger.debug('No user token provided, authentication required');
      const authUrl = authService.generateAuthUrl();
      return { 
        authenticated: false,
        authRequiredResponse: {
          error: 'authentication_required',
          message: 'Authentication required to access this resource',
          authUrl
        }
      };
    }

    try {
      const verifyResult = await authService.verifyToken(options.userToken, resourceType, resourceId);
      
      if (!verifyResult.valid) {
        logger.debug('Invalid token, authentication required', { error: verifyResult.error });
        const authUrl = authService.generateAuthUrl();
        return { 
          authenticated: false,
          authRequiredResponse: {
            error: 'authentication_required',
            message: verifyResult.message || 'Authentication required to access this resource',
            authUrl
          }
        };
      }

      if (verifyResult.permissions && !verifyResult.permissions.canAccess) {
        logger.debug('Insufficient permissions to access resource', { 
          userId: verifyResult.userId,
          resourceType,
          resourceId,
          reasonCodes: verifyResult.permissions.reasonCodes
        });
        return { 
          authenticated: false,
          authRequiredResponse: {
            error: 'insufficient_permissions',
            message: verifyResult.permissions.errorMessage || 'Insufficient permissions to access this resource',
            authUrl: ''  // No auth URL needed for insufficient permissions
          }
        };
      }

      logger.debug('Authentication successful', { 
        userId: verifyResult.userId,
        resourceType,
        resourceId
      });
      return { authenticated: true };
    } catch (error) {
      logger.error('Error verifying token', { error });
      const authUrl = authService.generateAuthUrl();
      return { 
        authenticated: false,
        authRequiredResponse: {
          error: 'authentication_error',
          message: 'Error verifying authentication token',
          authUrl
        }
      };
    }
  };

  // Function to extract user ID from token
  const extractUserId = () => {
    // For now, return a default user ID if token is not provided
    // In a real implementation, this would decode the JWT token and extract the user ID
    return options.userToken ? 'user-from-token' : 'unauthenticated-user';
  };

  // Function to check if funds are sufficient
  const checkFunds = (): boolean => {
    // If a test override is provided, use it
    if (typeof options._testOverrideFundsCheck !== 'undefined') {
      return options._testOverrideFundsCheck;
    }
    
    // Simulate checking if the user has sufficient funds
    // For now, just use Math.random to simulate some failures
    return Math.random() > 0.2; // 80% success rate
  };

  // Function to simulate a billing transaction
  const processBilling = (userId: string, amount: number): void => {
    logger.debug(`Processed charge for user ${userId}: ${amount}`);
  };

  // Create a proxy around the server to intercept calls to handler functions
  const proxy = new Proxy(server, {
    get(target, prop, receiver) {
      const originalValue = Reflect.get(target, prop, receiver);

      // Only intercept functions
      if (typeof originalValue !== 'function') {
        return originalValue;
      }

      // Special handling for tool, prompt, and resource registration methods
      if (prop === 'tool' || prop === 'prompt' || prop === 'resource') {
        return function(this: any, ...args: any[]) {
          logger.debug(`Registering ${prop.toString()}`, { args: args[0] });
          return Reflect.apply(originalValue, this, args);
        };
      }

      // Special handling for methods that execute handlers (callTool, getResource, callPrompt)
      if (prop === 'callTool' || prop === 'getResource' || prop === 'callPrompt') {
        return async function(this: any, ...args: any[]) {
          const methodType = prop === 'callTool' ? 'tool' : (prop === 'getResource' ? 'resource' : 'prompt');
          const resourceId = args[0]; // First argument is always the tool/resource/prompt name

          logger.debug(`Executing ${methodType} handler: ${resourceId}`, { debugMode });

          // Check authentication
          const authCheck = await checkAuth(methodType as 'tool' | 'resource' | 'prompt', resourceId);
          if (!authCheck.authenticated) {
            logger.debug(`Authentication required for ${methodType}: ${resourceId}`);
            return authCheck.authRequiredResponse;
          }

          // Extract user ID from token
          const userId = extractUserId();

          // Check if the user has sufficient funds
          if (!checkFunds()) {
            logger.debug(`Insufficient funds for user ${userId}`);
            return {
              error: 'insufficient_funds',
              message: 'Insufficient funds to execute this operation'
            };
          }

          try {
            // Call the original method
            const result = await Reflect.apply(originalValue, this, args);

            // Process billing if the call was successful
            processBilling(userId, 0.01); // Charge a small amount

            return result;
          } catch (error) {
            logger.error(`Error in ${methodType} execution`, { error });

            // Re-throw the error to maintain original behavior
            throw error;
          }
        };
      }

      // For all other functions, just pass through
      return function(this: any, ...args: any[]) {
        return Reflect.apply(originalValue, this, args);
      };
    }
  });

  return proxy as McpServer;
} 