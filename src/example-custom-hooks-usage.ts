/**
 * @file Example usage of custom hooks with the MCP Payment Wrapper
 * @version 1.0.0
 * 
 * This file demonstrates how to create and use custom hook implementations
 * with the payment wrapper.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { wrapWithPayments } from './payment-wrapper.js';
import { IAuthProvider } from './hooks/interfaces/auth-provider.js';
import { IPaymentProvider, PaymentMetadata, UserBalance } from './hooks/interfaces/payment-provider.js';
import { IPricingStrategy, PricingOptions, PricingResult, ResourcePricing } from './hooks/interfaces/pricing-strategy.js';
import { VerifyResponse } from './interfaces/auth-service.js';

/**
 * Custom Authentication Provider Example
 * 
 * This is a simple example of a custom authentication provider that
 * always authenticates users without requiring an external service.
 */
class SimpleAuthProvider implements IAuthProvider {
  private apiKey: string;
  
  constructor(apiKey: string) {
    this.apiKey = apiKey;
    console.log('SimpleAuthProvider initialized');
  }
  
  generateAuthUrl(): string {
    return 'https://example.com/auth';
  }
  
  async verifyToken(token: string, resourceType: 'tool' | 'prompt' | 'resource', resourceId: string): Promise<VerifyResponse> {
    // In a real implementation, you would verify the token
    // For this example, we'll just check if it's not empty
    if (!token || token.trim() === '') {
      return {
        valid: false,
        error: 'invalid_token',
        message: 'Token is empty or invalid'
      };
    }
    
    // Always return valid for this example
    return {
      valid: true,
      userId: 'user-123',
      permissions: {
        canAccess: true
      }
    };
  }
  
  generateToken(userId?: string): string {
    // Generate a simple token for testing
    return `simple-token-${userId || 'default'}-${Date.now()}`;
  }
}

/**
 * Custom Payment Provider Example
 * 
 * This is a simple example of a custom payment provider that
 * uses in-memory balances without requiring an external service.
 */
class SimplePaymentProvider implements IPaymentProvider {
  private apiKey: string;
  private userBalances: Map<string, number>;
  
  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.userBalances = new Map();
    
    // Initialize some test balances
    this.userBalances.set('user-123', 10000); // $100.00
    this.userBalances.set('default', 5000);   // $50.00
    
    console.log('SimplePaymentProvider initialized');
  }
  
  async verifyFunds(userId: string, amount: number, metadata?: PaymentMetadata): Promise<boolean> {
    console.log(`Verifying funds for user ${userId}, amount: ${amount}`);
    
    // Get the user's balance or use default if not found
    const balance = this.userBalances.get(userId) || this.userBalances.get('default') || 0;
    
    return balance >= amount;
  }
  
  async processCharge(userId: string, amount: number, metadata: PaymentMetadata): Promise<string> {
    console.log(`Processing charge for user ${userId}, amount: ${amount}`);
    
    // Get the user's balance
    const balance = this.userBalances.get(userId) || this.userBalances.get('default') || 0;
    
    if (balance < amount) {
      throw new Error(`Insufficient funds: user ${userId} has ${balance} but needs ${amount}`);
    }
    
    // Update the balance
    this.userBalances.set(userId, balance - amount);
    
    // Generate a transaction ID
    const transactionId = `txn-${Date.now()}`;
    
    console.log(`Charge processed. New balance: ${balance - amount}`);
    
    return transactionId;
  }
  
  async getBalance(userId: string): Promise<UserBalance> {
    const balance = this.userBalances.get(userId) || this.userBalances.get('default') || 0;
    
    return {
      available: balance,
      pending: 0,
      currency: 'USD',
      lastUpdated: new Date().toISOString()
    };
  }
  
  async verifyApiKey(apiKey: string): Promise<boolean> {
    return apiKey === this.apiKey;
  }
}

/**
 * Custom Pricing Strategy Example
 * 
 * This is a simple example of a custom pricing strategy that
 * uses different pricing models for different resource types.
 */
class SimplePricingStrategy implements IPricingStrategy {
  private resourcePricing: Map<string, ResourcePricing>;
  
  constructor() {
    this.resourcePricing = new Map();
    
    // Set up some default pricing
    this.setDefaultTypePricing('tool', {
      basePrice: 50, // $0.50
      currency: 'USD',
      pricingModel: 'flat'
    });
    
    this.setDefaultTypePricing('prompt', {
      basePrice: 100, // $1.00
      currency: 'USD',
      pricingModel: 'flat'
    });
    
    this.setDefaultTypePricing('resource', {
      basePrice: 25, // $0.25
      currency: 'USD',
      pricingModel: 'flat'
    });
    
    // Set up some specific resource pricing
    this.setResourcePricing('premium_tool', 'tool', {
      basePrice: 200, // $2.00
      currency: 'USD',
      pricingModel: 'flat'
    });
    
    console.log('SimplePricingStrategy initialized');
  }
  
  async calculatePrice(options: PricingOptions): Promise<PricingResult> {
    console.log(`Calculating price for ${options.resourceType}:${options.resourceId}`);
    
    // Get the pricing info for this resource
    const pricingInfo = await this.getPricingInfo(options.resourceId, options.resourceType);
    
    // For this simple example, we'll just use the base price
    return {
      amount: pricingInfo.basePrice,
      currency: pricingInfo.currency
    };
  }
  
  async getPricingInfo(resourceId: string, resourceType: 'tool' | 'prompt' | 'resource'): Promise<ResourcePricing> {
    // Check if we have specific pricing for this resource
    const resourceKey = `${resourceType}:${resourceId}`;
    if (this.resourcePricing.has(resourceKey)) {
      return this.resourcePricing.get(resourceKey)!;
    }
    
    // Otherwise, use the default pricing for this resource type
    const typeKey = `default:${resourceType}`;
    if (this.resourcePricing.has(typeKey)) {
      return this.resourcePricing.get(typeKey)!;
    }
    
    // If all else fails, use a fallback
    return {
      basePrice: 10, // $0.10
      currency: 'USD',
      pricingModel: 'flat'
    };
  }
  
  async isApplicable(resourceId: string, resourceType: 'tool' | 'prompt' | 'resource'): Promise<boolean> {
    // This strategy applies to all resources
    return true;
  }
  
  setResourcePricing(resourceId: string, resourceType: 'tool' | 'prompt' | 'resource', pricing: ResourcePricing): void {
    const key = `${resourceType}:${resourceId}`;
    this.resourcePricing.set(key, pricing);
  }
  
  setDefaultTypePricing(resourceType: 'tool' | 'prompt' | 'resource', pricing: ResourcePricing): void {
    const key = `default:${resourceType}`;
    this.resourcePricing.set(key, pricing);
  }
}

async function main() {
  // Create a simple demo MCP server
  const demoServer = new McpServer({
    name: "Demo MCP Server with Custom Hooks",
    version: "1.0.0",
    description: "A demo MCP server showing custom hook implementations"
  });

  // Register a simple tool for demonstration
  demoServer.tool("greet", { name: z.string() }, async (args) => {
    return {
      content: [{ 
        type: "text" as const, 
        text: `Hello, ${args.name}!` 
      }]
    };
  });

  // Register a premium tool for demonstration
  demoServer.tool("premium_tool", { data: z.string() }, async (args) => {
    return {
      content: [{ 
        type: "text" as const, 
        text: `Premium analysis complete: ${args.data.length} characters processed.` 
      }]
    };
  });

  // Create custom hook implementations
  const customAuthProvider = new SimpleAuthProvider('demo-api-key-123');
  const customPaymentProvider = new SimplePaymentProvider('demo-api-key-123');
  const customPricingStrategy = new SimplePricingStrategy();

  // Generate a token for testing
  const userToken = customAuthProvider.generateToken('user-123');

  // Wrap the demo server with payment functionality using custom hooks
  const paymentsEnabledServer = wrapWithPayments(demoServer, {
    apiKey: 'demo-api-key-123',
    userToken: userToken,
    debugMode: true,
    // Use our custom hook implementations
    authProvider: customAuthProvider,
    paymentProvider: customPaymentProvider,
    pricingStrategy: customPricingStrategy
  });
  
  // Set up the transport
  const transport = new StdioServerTransport();
  
  // Connect the payments-enabled server to the transport
  await paymentsEnabledServer.connect(transport);
  
  console.log('Server started with custom hooks. Try calling the "greet" or "premium_tool" tools.');
}

// Start the example
main().catch(err => {
  console.error('Error starting the server:', err);
  process.exit(1);
}); 