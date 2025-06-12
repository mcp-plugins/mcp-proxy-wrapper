/**
 * @file Stripe Monetization Plugin - Main Export
 * @version 1.0.0
 * @description Main entry point for the Stripe monetization plugin
 * 
 * This file exports all the necessary components to integrate Stripe-based
 * monetization into MCP servers using the proxy wrapper system.
 */

// Main plugin class
export { StripeMonetizationPlugin, createStripeMonetizationPlugin } from './plugin.js';

// Core interfaces and types
export type {
  StripeMonetizationConfig,
  BillingModel,
  PricingConfig,
  CustomerInfo,
  UsageRecord,
  PaymentIntentInfo,
  WebhookEvent,
  StripeMonetizationStats,
  MonetizedToolCallContext,
  MonetizedToolCallResult,
  DatabaseModels,
  ManagementApiEndpoints
} from './interfaces.js';

// Error types
export {
  MonetizationError,
  PaymentRequiredError,
  InsufficientCreditsError,
  SubscriptionRequiredError,
  RateLimitExceededError,
  AuthenticationError
} from './interfaces.js';

// Core services
export { DatabaseManager } from './database.js';
export { StripeService } from './stripe-service.js';
export { AuthenticationManager, AuthMiddleware } from './auth.js';
export { UsageTracker } from './usage-tracker.js';
export { WebhookHandler, createWebhookMiddleware } from './webhook-handler.js';
export { ManagementApiServer, createBasicAuthMiddleware, corsOptions } from './management-api.js';

// Configuration helpers and examples
export { createDefaultConfig, createExampleConfigs } from './config-examples.js';

/**
 * Quick setup function for common use cases
 */
export function createQuickSetup(options: {
  stripeSecretKey: string;
  stripePublishableKey: string;
  webhookSecret: string;
  billingModel: BillingModel;
  defaultPrice?: number;
  databasePath?: string;
}): StripeMonetizationConfig {
  return {
    enabled: true,
    priority: 100,
    stripe: {
      secretKey: options.stripeSecretKey,
      publishableKey: options.stripePublishableKey,
      webhookSecret: options.webhookSecret,
      mode: options.stripeSecretKey.startsWith('sk_test_') ? 'test' : 'live'
    },
    billingModel: options.billingModel,
    pricing: {
      currency: 'usd',
      perCall: {
        defaultPrice: options.defaultPrice || 100 // $1.00 in cents
      }
    },
    database: {
      type: 'sqlite',
      connectionString: options.databasePath || './monetization.db',
      autoMigrate: true
    },
    auth: {
      jwtSecret: process.env.JWT_SECRET || 'your-jwt-secret-here',
      tokenExpiration: '24h',
      enableApiKeys: true,
      apiKeyPrefix: 'mcp_'
    },
    webhooks: {
      endpointUrl: '/webhooks/stripe',
      events: [
        'payment_intent.succeeded',
        'payment_intent.payment_failed',
        'customer.subscription.created',
        'customer.subscription.updated',
        'customer.subscription.deleted',
        'invoice.payment_succeeded',
        'invoice.payment_failed'
      ]
    }
  };
}

/**
 * Type guard to check if an error is a monetization error
 */
export function isMonetizationError(error: any): error is MonetizationError {
  return error instanceof Error && 'code' in error && 'statusCode' in error;
}

/**
 * Helper to extract customer ID from various sources
 */
export function extractCustomerId(context: any): string | null {
  // Try metadata first
  if (context.metadata?.customerId) {
    return context.metadata.customerId;
  }
  
  // Try args
  if (context.args?.customerId) {
    return context.args.customerId;
  }
  
  // Try authentication token
  if (context.metadata?.authorization) {
    // This would require the auth manager to decode
    return null;
  }
  
  return null;
}

/**
 * Utility to format currency amounts
 */
export function formatCurrency(amountInCents: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase()
  }).format(amountInCents / 100);
}

/**
 * Utility to validate pricing configuration
 */
export function validatePricingConfig(pricing: PricingConfig): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!pricing.currency) {
    errors.push('Currency is required');
  }
  
  if (pricing.perCall?.defaultPrice !== undefined && pricing.perCall.defaultPrice < 0) {
    errors.push('Default price cannot be negative');
  }
  
  if (pricing.subscription?.plans) {
    for (const plan of pricing.subscription.plans) {
      if (!plan.id) {
        errors.push('Plan ID is required');
      }
      if (!plan.priceId) {
        errors.push('Stripe Price ID is required for plans');
      }
      if (plan.amount < 0) {
        errors.push('Plan amount cannot be negative');
      }
    }
  }
  
  if (pricing.freemium?.freeTierLimits?.callsPerMonth !== undefined && 
      pricing.freemium.freeTierLimits.callsPerMonth < 0) {
    errors.push('Free tier limits cannot be negative');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Utility to create a test configuration
 */
export function createTestConfig(overrides: Partial<StripeMonetizationConfig> = {}): StripeMonetizationConfig {
  return {
    enabled: true,
    priority: 100,
    stripe: {
      secretKey: 'sk_test_123456789',
      publishableKey: 'pk_test_123456789',
      webhookSecret: 'whsec_test_123456789',
      mode: 'test'
    },
    billingModel: 'per_call',
    pricing: {
      currency: 'usd',
      perCall: {
        defaultPrice: 100 // $1.00
      }
    },
    database: {
      type: 'sqlite',
      connectionString: ':memory:',
      autoMigrate: true
    },
    auth: {
      jwtSecret: 'test-jwt-secret',
      tokenExpiration: '1h',
      enableApiKeys: true,
      apiKeyPrefix: 'test_'
    },
    webhooks: {
      endpointUrl: '/test/webhooks',
      events: ['payment_intent.succeeded']
    },
    managementApi: {
      enabled: false,
      port: 3001
    },
    ...overrides
  };
}

/**
 * Re-export the main types for convenience
 */
export type { StripeMonetizationConfig as Config } from './interfaces.js';
export type { BillingModel } from './interfaces.js';

// Version information
export const VERSION = '1.0.0';
export const PLUGIN_NAME = 'stripe-monetization-plugin';

/**
 * Plugin metadata for registration
 */
export const PLUGIN_METADATA = {
  name: PLUGIN_NAME,
  version: VERSION,
  description: 'Comprehensive Stripe-based monetization for MCP servers',
  author: 'MCP Proxy Wrapper Team',
  tags: ['stripe', 'monetization', 'billing', 'payments', 'subscriptions'],
  minWrapperVersion: '1.0.0'
};