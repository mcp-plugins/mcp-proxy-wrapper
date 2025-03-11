/**
 * @file Payment Wrapper for MCP Server
 * @version 1.0.0
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
import { z } from 'zod';

// Define interfaces for the wrapper options
export interface PaymentWrapperOptions {
  /**
   * Developer API key used for authentication
   */
  apiKey: string;
  
  /**
   * User JWT token for identifying and authenticating the end user
   */
  userToken: string;
  
  /**
   * Optional flag to enable additional debug logging
   */
  debugMode?: boolean;
}

// Define interfaces for billing-related functionality
interface BillingStatus {
  /**
   * Whether the user has sufficient funds to make the call
   */
  sufficientFunds: boolean;
  
  /**
   * The cost of the call in currency units
   */
  callCost: number;
  
  /**
   * Optional user ID extracted from the JWT token
   */
  userId?: string;
}

interface BillingTransaction {
  /**
   * User ID to charge
   */
  userId: string;
  
  /**
   * Amount to charge in currency units
   */
  callCost: number;
  
  /**
   * Timestamp of the transaction
   */
  timestamp: Date;
  
  /**
   * Optional name of the tool being called
   */
  toolName?: string;
  
  /**
   * Optional name of the resource being accessed
   */
  resourceName?: string;
  
  /**
   * Optional name of the prompt being used
   */
  promptName?: string;
}

/**
 * Verifies a user JWT token
 * 
 * In a real implementation, this would validate the JWT signature and expiration.
 * The current implementation is a simplified version for demonstration purposes.
 * 
 * @param token The JWT token to verify
 * @returns Object containing validation result and user ID if valid
 */
function verifyUserJWT(token: string): { valid: boolean; userId?: string } {
  // In a real implementation, this would verify the JWT signature and expiration
  // For now, we'll just simulate a check that the token is non-empty and has a valid format
  if (!token || token.trim() === '') {
    console.log('JWT token validation failed: Empty token');
    return { valid: false };
  }
  
  // Simple check that it looks like a JWT (has two dots)
  const parts = token.split('.');
  if (parts.length !== 3) {
    console.log('JWT token validation failed: Invalid format');
    return { valid: false };
  }
  
  // In a real implementation, we would decode the JWT and validate its signature
  // For this demo, we'll just simulate extracting a user ID from the token
  try {
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf-8'));
    return { valid: true, userId: payload.sub || 'user-123' };
  } catch (error) {
    console.log('JWT token validation failed: Invalid token payload');
    return { valid: false };
  }
}

/**
 * Simulates checking a user's billing status
 * 
 * In a real implementation, this would check a database or call a billing service.
 * The current implementation is a simplified version for demonstration purposes.
 * 
 * @param userId The ID of the user
 * @param toolName Optional name of the tool being called
 * @returns Object indicating whether the user has sufficient funds and the cost of the call
 */
function getUserBillingStatus(userId: string, toolName?: string): BillingStatus {
  // In a real implementation, this would check a database or call a billing service
  // For now, we'll just simulate different scenarios
  
  // Simulate a user with insufficient funds for expensive operations
  const isExpensiveTool = toolName?.includes('complex') || toolName?.includes('advanced');
  const callCost = isExpensiveTool ? 0.10 : 0.01;  // Simulate different costs for different tools
  
  // For demo purposes, we'll simulate that users have sufficient funds most of the time
  const sufficientFunds = Math.random() > 0.1;  // 90% chance of having sufficient funds
  
  console.log(`Billing check for user ${userId}: Sufficient funds: ${sufficientFunds}, Call cost: $${callCost}`);
  
  return {
    sufficientFunds,
    callCost,
    userId
  };
}

/**
 * Simulates processing a billing transaction
 * 
 * In a real implementation, this would record the transaction in a database
 * or call a payment processing service. The current implementation simply
 * logs the transaction details.
 * 
 * @param transaction The billing transaction details
 */
function processDummyCharge(transaction: BillingTransaction): void {
  // In a real implementation, this would record the transaction in a database
  // or call a payment processing service
  console.log(`Processed charge for user ${transaction.userId}:`);
  console.log(`  Amount: $${transaction.callCost}`);
  console.log(`  Timestamp: ${transaction.timestamp.toISOString()}`);
  if (transaction.toolName) console.log(`  Tool: ${transaction.toolName}`);
  if (transaction.resourceName) console.log(`  Resource: ${transaction.resourceName}`);
  if (transaction.promptName) console.log(`  Prompt: ${transaction.promptName}`);
}

/**
 * Creates a proxy that forwards method calls to the target object
 * but allows intercepting and modifying the behavior
 * 
 * @param target The target object to proxy
 * @param handler The handler containing the proxy traps
 * @returns A proxy object
 */
function createProxy<T extends object>(target: T, handler: ProxyHandler<T>): T {
  return new Proxy(target, handler);
}

/**
 * Wraps an MCP server with payment functionality
 * 
 * This function takes an existing MCP server instance and wraps it with payment
 * functionality. The wrapper intercepts calls to the server's methods and adds
 * billing checks and transaction processing.
 * 
 * @param server The MCP server to wrap
 * @param options Configuration options including API key and user token
 * @returns A proxy to the original MCP server with payment functionality added
 * @throws Error if API key or user token is invalid
 */
export function wrapWithPayments(server: McpServer, options: PaymentWrapperOptions): McpServer {
  // Validate options
  if (!options.apiKey || options.apiKey.trim() === '') {
    throw new Error('Invalid developer API key: API key is required');
  }
  
  if (!options.userToken || options.userToken.trim() === '') {
    throw new Error('Invalid user token: User token is required');
  }
  
  // Verify user JWT token
  const jwtVerification = verifyUserJWT(options.userToken);
  if (!jwtVerification.valid) {
    throw new Error('Invalid user JWT token: Authentication failed');
  }
  
  const userId = jwtVerification.userId || 'unknown-user';
  
  // Debug mode logging
  if (options.debugMode) {
    console.log(`Creating payment-enabled wrapper for MCP server`);
    console.log(`User ID: ${userId}`);
  }
  
  // Create a proxy to intercept method calls to the server
  return createProxy(server, {
    // Intercept property access
    get(target, prop, receiver) {
      // Get the original property value
      const originalValue = Reflect.get(target, prop, receiver);
      
      // If it's not a function, return it as is
      if (typeof originalValue !== 'function') {
        return originalValue;
      }
      
      // Handle specific methods that need payment functionality
      if (prop === 'tool') {
        // Return a wrapped tool method
        return function(name: string, schema: any, handler: any) {
          if (options.debugMode) {
            console.log(`Registering tool with payment wrapper: ${name}`);
          }
          
          // Create a payment-enabled handler
          const paymentEnabledHandler = async (args: any, extra: any) => {
            if (options.debugMode) {
              console.log(`Payment wrapper: Handling tool call for "${name}"`);
              console.log(`Arguments:`, JSON.stringify(args));
            }
            
            // Check if the user has sufficient funds
            const billingStatus = getUserBillingStatus(userId, name);
            
            if (!billingStatus.sufficientFunds) {
              console.error(`Payment rejected: Insufficient funds for user ${userId}`);
              return {
                content: [{
                  type: "text" as const,
                  text: "Error: Insufficient funds to complete this operation"
                }]
              };
            }
            
            try {
              // Call the original handler
              const result = await handler(args, extra);
              
              // Process the billing transaction after successful call
              processDummyCharge({
                userId,
                callCost: billingStatus.callCost,
                timestamp: new Date(),
                toolName: name
              });
              
              return result;
            } catch (error) {
              console.error(`Error in tool handler for "${name}":`, error);
              throw error;
            }
          };
          
          // Register the tool with the payment-enabled handler
          return originalValue.call(target, name, schema, paymentEnabledHandler);
        };
      } else if (prop === 'resource') {
        // Return a wrapped resource method
        return function(name: string, template: string, handler: any) {
          if (options.debugMode) {
            console.log(`Registering resource with payment wrapper: ${name}`);
          }
          
          // Create a payment-enabled handler
          const paymentEnabledHandler = async (uri: URL, extra: any) => {
            if (options.debugMode) {
              console.log(`Payment wrapper: Handling resource request for "${name}"`);
              console.log(`URI: ${uri.toString()}`);
            }
            
            // Check if the user has sufficient funds
            const billingStatus = getUserBillingStatus(userId, name);
            
            if (!billingStatus.sufficientFunds) {
              console.error(`Payment rejected: Insufficient funds for user ${userId}`);
              return {
                contents: [{
                  uri: uri.href,
                  text: "Error: Insufficient funds to access this resource"
                }]
              };
            }
            
            try {
              // Call the original handler
              const result = await handler(uri, extra);
              
              // Process the billing transaction after successful call
              processDummyCharge({
                userId,
                callCost: billingStatus.callCost,
                timestamp: new Date(),
                resourceName: name
              });
              
              return result;
            } catch (error) {
              console.error(`Error in resource handler for "${name}":`, error);
              throw error;
            }
          };
          
          // Register the resource with the payment-enabled handler
          return originalValue.call(target, name, template, paymentEnabledHandler);
        };
      } else if (prop === 'prompt') {
        // Return a wrapped prompt method
        return function(name: string, handler: any) {
          if (options.debugMode) {
            console.log(`Registering prompt with payment wrapper: ${name}`);
          }
          
          // Create a payment-enabled handler
          const paymentEnabledHandler = (extra: any) => {
            if (options.debugMode) {
              console.log(`Payment wrapper: Handling prompt request for "${name}"`);
            }
            
            // Check if the user has sufficient funds
            const billingStatus = getUserBillingStatus(userId, name);
            
            if (!billingStatus.sufficientFunds) {
              console.error(`Payment rejected: Insufficient funds for user ${userId}`);
              return {
                messages: [{
                  role: "assistant",
                  content: {
                    type: "text" as const,
                    text: "Error: Insufficient funds to access this prompt"
                  }
                }]
              };
            }
            
            try {
              // Call the original handler
              const result = handler(extra);
              
              // Process the billing transaction after successful call
              processDummyCharge({
                userId,
                callCost: billingStatus.callCost,
                timestamp: new Date(),
                promptName: name
              });
              
              return result;
            } catch (error) {
              console.error(`Error in prompt handler for "${name}":`, error);
              throw error;
            }
          };
          
          // Register the prompt with the payment-enabled handler
          return originalValue.call(target, name, paymentEnabledHandler);
        };
      }
      
      // For other methods, return them as is
      return originalValue;
    }
  });
} 