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
import * as winston from 'winston';
import { v4 as uuidv4 } from 'uuid';
import { IAuthService } from './interfaces/auth-service.js';
import { MockAuthService } from './services/mock-auth-service.js';
import { z } from 'zod';

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

  // Register payment tools
  registerPaymentTools(proxy, authService, options, logger);

  return proxy as McpServer;
}

/**
 * Register payment-related tools on the wrapped MCP server.
 * These tools extend the server with authentication and balance functionality.
 */
function registerPaymentTools(
  server: McpServer, 
  authService: IAuthService, 
  options: PaymentWrapperOptions, 
  logger: winston.Logger
): void {
  logger.info('Registering payment tools on wrapped MCP server');

  // Check if the auth service supports extended functionality
  const supportsSessionManagement = typeof authService.createSession === 'function' && 
                                   typeof authService.checkSessionStatus === 'function';
  const supportsUserData = typeof authService.validateJWT === 'function';

  if (!supportsSessionManagement) {
    logger.warn('Auth service does not support session management - some payment tools will have limited functionality');
  }

  if (!supportsUserData) {
    logger.warn('Auth service does not support user data retrieval - some payment tools will have limited functionality');
  }

  // Tool 1: Authentication
  server.tool("payment_authenticate", 
    // Parameter schema using direct properties
    { 
      return_url: z.string().url().optional(), 
      user_hint: z.string().optional() 
    }, 
    // Handler function
    async (args, extra) => {
      try {
        const sessionId = uuidv4();
        
        // Check if session management is supported
        if (supportsSessionManagement && authService.createSession) {
          await authService.createSession(sessionId, {
            return_url: args.return_url,
            user_hint: args.user_hint,
            created_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 1800 * 1000).toISOString() // 30 minutes
          });
        } else {
          logger.debug('Session management not supported by auth service, using basic functionality');
        }
        
        // Build the authentication URL
        let authUrl = `${options.baseAuthUrl || 'https://auth.mcp-api.com'}/auth?session=${sessionId}`;
        if (args.user_hint) authUrl += `&hint=${encodeURIComponent(args.user_hint)}`;
        if (args.return_url) authUrl += `&return_url=${encodeURIComponent(args.return_url)}`;
        
        logger.debug('Created authentication session', { sessionId });
        
        // Return in the format expected by MCP server
        return {
          content: [
            { 
              type: "text", 
              text: "Authentication initiated. Please use the following link to authenticate:" 
            },
            {
              type: "text",
              text: authUrl
            }
          ],
          _meta: {
            session_id: sessionId,
            expires_in: 1800, // 30 minutes in seconds
            status: "pending"
          }
        };
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('Error in payment_authenticate', { error: errorMessage });
        return {
          error: true,
          content: [
            {
              type: "text",
              text: "Failed to initialize authentication session. " + 
                    (options.debugMode ? errorMessage : "Please try again later.")
            }
          ]
        };
      }
    }
  );

  // Tool 2: Check Authentication Status
  server.tool("payment_check_auth_status", 
    { 
      session_id: z.string().uuid() 
    }, 
    async (args, extra) => {
      try {
        // Check if session management is supported
        if (!supportsSessionManagement || !authService.checkSessionStatus) {
          logger.warn('Session status checking not supported by auth service');
          return {
            content: [
              {
                type: "text",
                text: "Authentication status checking is not supported by the current configuration."
              }
            ]
          };
        }
        
        // Check the status of the authentication session
        const sessionStatus = await authService.checkSessionStatus(args.session_id);
        
        if (!sessionStatus) {
          return {
            content: [
              {
                type: "text",
                text: "Authentication session has expired or is invalid."
              }
            ]
          };
        }
        
        if (sessionStatus.status === "authenticated") {
          // Store the JWT in the wrapper options for future use
          if (sessionStatus.jwt) {
            options.userToken = sessionStatus.jwt;
            logger.debug('Updated user token from authenticated session');
          }
          
          return {
            content: [
              {
                type: "text",
                text: "Authentication successful! You are now logged in."
              }
            ],
            _meta: {
              status: "authenticated",
              user_id: sessionStatus.user_id,
              name: sessionStatus.name,
              email: sessionStatus.email,
              jwt: sessionStatus.jwt,
              authenticated_at: sessionStatus.authenticated_at
            }
          };
        }
        
        return {
          content: [
            {
              type: "text", 
              text: "Authentication not yet completed. Please complete the authentication process using the link provided earlier."
            }
          ],
          _meta: {
            status: sessionStatus.status || "pending",
            expires_in: sessionStatus.expires_in
          }
        };
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('Error in payment_check_auth_status', { error: errorMessage });
        return {
          error: true,
          content: [
            {
              type: "text",
              text: "Failed to check authentication status. " + 
                    (options.debugMode ? errorMessage : "Please try again later.")
            }
          ]
        };
      }
    }
  );

  // Tool 3: Get Balance
  server.tool("payment_get_balance", 
    { 
      jwt: z.string().min(20) 
    }, 
    async (args, extra) => {
      try {
        // Check if user data retrieval is supported
        if (!supportsUserData || !authService.validateJWT) {
          logger.warn('User data retrieval not supported by auth service');
          return {
            content: [
              {
                type: "text",
                text: "Balance checking is not supported by the current configuration."
              }
            ]
          };
        }
        
        // Validate JWT and get user data
        const userData = await authService.validateJWT(args.jwt);
        
        if (!userData) {
          return {
            content: [
              {
                type: "text",
                text: "Your authentication is invalid or has expired. Please authenticate again."
              }
            ]
          };
        }
        
        // Check if JWT was refreshed
        const refreshedJwt = userData.refreshedJwt || args.jwt;
        
        if (refreshedJwt !== args.jwt) {
          options.userToken = refreshedJwt;
          logger.debug('Updated user token with refreshed JWT');
        }
        
        return {
          content: [
            {
              type: "text",
              text: `Current balance: ${userData.balance} ${userData.currency}`
            }
          ],
          _meta: {
            user_id: userData.user_id,
            balance: userData.balance,
            currency: userData.currency,
            available_credit: userData.available_credit,
            last_updated: new Date().toISOString(),
            jwt: refreshedJwt !== args.jwt ? refreshedJwt : undefined
          }
        };
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logger.error('Error in payment_get_balance', { 
          error: errorMessage,
          jwtProvided: !!args.jwt 
        });
        
        return {
          error: true,
          content: [
            {
              type: "text",
              text: "Failed to retrieve balance information. " + 
                    (options.debugMode ? errorMessage : "Please try again later.")
            }
          ]
        };
      }
    }
  );

  logger.info('Payment tools registered successfully');
} 