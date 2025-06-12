/**
 * @file Configuration Examples for Stripe Monetization Plugin
 * @version 1.0.0
 * @description Example configurations for different billing models and use cases
 * 
 * This file provides pre-configured examples for common monetization scenarios:
 * - Per-call billing
 * - Subscription plans
 * - Usage-based billing
 * - Freemium models
 * - Credit systems
 */

import { StripeMonetizationConfig, BillingModel } from './interfaces.js';

/**
 * Create a default configuration with sensible defaults
 */
export function createDefaultConfig(
  stripeSecretKey: string,
  stripePublishableKey: string,
  webhookSecret: string
): StripeMonetizationConfig {
  return {
    enabled: true,
    priority: 100,
    stripe: {
      secretKey: stripeSecretKey,
      publishableKey: stripePublishableKey,
      webhookSecret: webhookSecret,
      mode: stripeSecretKey.startsWith('sk_test_') ? 'test' : 'live',
      apiVersion: '2023-10-16'
    },
    billingModel: 'per_call',
    pricing: {
      currency: 'usd',
      perCall: {
        defaultPrice: 100, // $1.00 per call
        minimumCharge: 50, // $0.50 minimum
        bulkTiers: [
          { minCalls: 100, pricePerCall: 80 }, // $0.80 for 100+ calls
          { minCalls: 1000, pricePerCall: 60 } // $0.60 for 1000+ calls
        ]
      }
    },
    database: {
      type: 'sqlite',
      connectionString: './stripe-monetization.db',
      autoMigrate: true,
      tablePrefix: 'mcp_stripe_'
    },
    auth: {
      jwtSecret: process.env.JWT_SECRET || 'change-this-secret',
      tokenExpiration: '24h',
      enableApiKeys: true,
      apiKeyPrefix: 'mcp_'
    },
    rateLimiting: {
      enabled: true,
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 100,
      enableBurst: true,
      burstMultiplier: 2
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
      ],
      enableRetries: true,
      maxRetries: 3
    },
    managementApi: {
      enabled: true,
      port: 3001,
      host: '127.0.0.1',
      enableCors: true
    },
    analytics: {
      enabled: true,
      retentionDays: 90,
      realTimeMetrics: true
    }
  };
}

/**
 * Collection of example configurations for different billing models
 */
export function createExampleConfigs(): Record<string, StripeMonetizationConfig> {
  const baseStripeConfig = {
    secretKey: process.env.STRIPE_SECRET_KEY || 'sk_test_...',
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || 'pk_test_...',
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || 'whsec_...',
    mode: 'test' as const,
    apiVersion: '2023-10-16'
  };

  const baseDatabaseConfig = {
    type: 'sqlite' as const,
    connectionString: './stripe-monetization.db',
    autoMigrate: true
  };

  const baseAuthConfig = {
    jwtSecret: 'your-jwt-secret-here',
    tokenExpiration: '24h',
    enableApiKeys: true,
    apiKeyPrefix: 'mcp_'
  };

  return {
    /**
     * Per-call billing configuration
     * Charges users for each tool call they make
     */
    perCallBilling: {
      enabled: true,
      priority: 100,
      stripe: baseStripeConfig,
      billingModel: 'per_call',
      pricing: {
        currency: 'usd',
        perCall: {
          defaultPrice: 50, // $0.50 per call
          toolPricing: {
            'expensive-ai-tool': 200, // $2.00 for AI tools
            'simple-calculator': 10,  // $0.10 for simple tools
            'data-processor': 100     // $1.00 for data tools
          },
          minimumCharge: 25, // $0.25 minimum
          bulkTiers: [
            { minCalls: 50, pricePerCall: 45 },   // 10% discount for 50+ calls
            { minCalls: 200, pricePerCall: 40 },  // 20% discount for 200+ calls
            { minCalls: 1000, pricePerCall: 30 }  // 40% discount for 1000+ calls
          ]
        }
      },
      database: baseDatabaseConfig,
      auth: baseAuthConfig,
      rateLimiting: {
        enabled: true,
        windowMs: 60 * 1000, // 1 minute
        maxRequests: 60
      },
      webhooks: {
        endpointUrl: '/webhooks/stripe',
        events: ['payment_intent.succeeded', 'payment_intent.payment_failed']
      }
    },

    /**
     * Subscription-based billing configuration
     * Users pay monthly/yearly for unlimited or limited access
     */
    subscriptionBilling: {
      enabled: true,
      priority: 100,
      stripe: baseStripeConfig,
      billingModel: 'subscription',
      pricing: {
        currency: 'usd',
        subscription: {
          plans: [
            {
              id: 'starter',
              name: 'Starter Plan',
              priceId: 'price_starter_monthly', // Replace with actual Stripe Price ID
              interval: 'month',
              amount: 2900, // $29.00/month
              callsIncluded: 1000,
              overageRate: 5, // $0.05 per call over limit
              features: ['Basic tools', 'Email support']
            },
            {
              id: 'professional',
              name: 'Professional Plan',
              priceId: 'price_pro_monthly',
              interval: 'month',
              amount: 9900, // $99.00/month
              callsIncluded: 5000,
              overageRate: 3, // $0.03 per call over limit
              features: ['All tools', 'Priority support', 'Analytics']
            },
            {
              id: 'enterprise',
              name: 'Enterprise Plan',
              priceId: 'price_enterprise_monthly',
              interval: 'month',
              amount: 29900, // $299.00/month
              callsIncluded: 20000,
              features: ['Unlimited tools', '24/7 support', 'Custom integrations']
            }
          ],
          trialPeriod: {
            enabled: true,
            days: 14
          }
        }
      },
      database: baseDatabaseConfig,
      auth: baseAuthConfig,
      webhooks: {
        endpointUrl: '/webhooks/stripe',
        events: [
          'customer.subscription.created',
          'customer.subscription.updated',
          'customer.subscription.deleted',
          'invoice.payment_succeeded',
          'invoice.payment_failed'
        ]
      },
      managementApi: {
        enabled: true,
        port: 3002,
        enableCors: true
      }
    },

    /**
     * Usage-based billing with Stripe Meters
     * Bills based on actual consumption (2024 Stripe feature)
     */
    usageBasedBilling: {
      enabled: true,
      priority: 100,
      stripe: baseStripeConfig,
      billingModel: 'usage_based',
      pricing: {
        currency: 'usd',
        usageBased: {
          meterId: 'meter_api_calls', // Replace with actual Stripe Meter ID
          pricePerUnit: 2, // $0.02 per API call
          minimumMonthly: 500, // $5.00 minimum monthly charge
          tiers: [
            { upTo: 1000, pricePerUnit: 2 },    // $0.02 for first 1000 calls
            { upTo: 10000, pricePerUnit: 1.5 }, // $0.015 for next 9000 calls
            { upTo: 'inf', pricePerUnit: 1 }    // $0.01 for calls beyond 10000
          ]
        }
      },
      database: baseDatabaseConfig,
      auth: baseAuthConfig,
      webhooks: {
        endpointUrl: '/webhooks/stripe',
        events: [
          'billing.meter.usage',
          'invoice.payment_succeeded',
          'invoice.payment_failed'
        ]
      }
    },

    /**
     * Freemium model configuration
     * Free tier with limits, paid upgrade options
     */
    freemiumModel: {
      enabled: true,
      priority: 100,
      stripe: baseStripeConfig,
      billingModel: 'freemium',
      pricing: {
        currency: 'usd',
        freemium: {
          freeTierLimits: {
            callsPerMonth: 100,
            callsPerDay: 10,
            callsPerHour: 5
          },
          overageBehavior: 'upgrade_prompt',
          premiumPlanId: 'professional'
        },
        subscription: {
          plans: [
            {
              id: 'professional',
              name: 'Professional',
              priceId: 'price_pro_monthly',
              interval: 'month',
              amount: 4900, // $49.00/month
              callsIncluded: 10000,
              features: ['Unlimited basic tools', 'Priority support']
            }
          ]
        }
      },
      database: baseDatabaseConfig,
      auth: baseAuthConfig,
      rateLimiting: {
        enabled: true,
        windowMs: 60 * 1000,
        maxRequests: 10 // Strict rate limiting for free users
      },
      webhooks: {
        endpointUrl: '/webhooks/stripe',
        events: ['customer.subscription.created', 'customer.subscription.deleted']
      }
    },

    /**
     * Credit/token-based system
     * Users purchase credits and spend them on tool calls
     */
    creditSystem: {
      enabled: true,
      priority: 100,
      stripe: baseStripeConfig,
      billingModel: 'credit_system',
      pricing: {
        currency: 'usd',
        creditSystem: {
          creditsPerCall: 1,
          toolCredits: {
            'ai-image-generator': 5,
            'data-analysis': 3,
            'simple-calculator': 1,
            'file-converter': 2
          },
          creditPackages: [
            {
              id: 'small_pack',
              credits: 100,
              price: 1000, // $10.00
              bonus: 10 // 10 bonus credits
            },
            {
              id: 'medium_pack',
              credits: 500,
              price: 4500, // $45.00 (10% discount)
              bonus: 75 // 75 bonus credits
            },
            {
              id: 'large_pack',
              credits: 1000,
              price: 8000, // $80.00 (20% discount)
              bonus: 200 // 200 bonus credits
            }
          ]
        }
      },
      database: baseDatabaseConfig,
      auth: baseAuthConfig,
      webhooks: {
        endpointUrl: '/webhooks/stripe',
        events: ['payment_intent.succeeded']
      },
      notifications: {
        enabled: true,
        emailService: {
          provider: 'smtp',
          config: {
            host: 'smtp.gmail.com',
            port: 587,
            secure: false,
            auth: {
              user: process.env.EMAIL_USER,
              pass: process.env.EMAIL_PASS
            }
          }
        },
        types: {
          lowCredits: true,
          usageLimitReached: true
        }
      }
    },

    /**
     * Enterprise configuration
     * High-volume, feature-rich setup for enterprise customers
     */
    enterpriseSetup: {
      enabled: true,
      priority: 100,
      stripe: {
        ...baseStripeConfig,
        mode: 'live' // Production mode
      },
      billingModel: 'subscription',
      pricing: {
        currency: 'usd',
        subscription: {
          plans: [
            {
              id: 'enterprise',
              name: 'Enterprise',
              priceId: 'price_enterprise_annual',
              interval: 'year',
              amount: 119880, // $1198.80/year (10% annual discount)
              callsIncluded: 100000,
              overageRate: 1, // $0.01 per call over limit
              features: [
                'All tools and features',
                'Dedicated support team',
                'Custom integrations',
                'SLA guarantee',
                'Advanced analytics'
              ]
            }
          ]
        }
      },
      database: {
        type: 'postgresql',
        connectionString: process.env.DATABASE_URL || 'postgresql://user:pass@localhost/db',
        autoMigrate: true
      },
      auth: {
        jwtSecret: process.env.JWT_SECRET!,
        tokenExpiration: '8h', // Shorter for security
        enableApiKeys: true,
        apiKeyPrefix: 'mcp_ent_'
      },
      rateLimiting: {
        enabled: true,
        windowMs: 60 * 1000,
        maxRequests: 1000, // High limit for enterprise
        enableBurst: true,
        burstMultiplier: 3
      },
      webhooks: {
        endpointUrl: '/webhooks/stripe',
        events: [
          'customer.subscription.created',
          'customer.subscription.updated',
          'customer.subscription.deleted',
          'invoice.payment_succeeded',
          'invoice.payment_failed',
          'customer.created',
          'customer.updated'
        ],
        enableRetries: true,
        maxRetries: 5
      },
      managementApi: {
        enabled: true,
        port: 3000,
        host: '0.0.0.0', // Allow external access
        enableCors: true,
        adminAuth: {
          username: process.env.ADMIN_USERNAME!,
          password: process.env.ADMIN_PASSWORD!
        }
      },
      analytics: {
        enabled: true,
        retentionDays: 365, // 1 year retention
        realTimeMetrics: true,
        export: {
          enabled: true,
          format: 'json',
          schedule: '0 0 * * 0' // Weekly export
        }
      },
      notifications: {
        enabled: true,
        emailService: {
          provider: 'sendgrid',
          config: {
            apiKey: process.env.SENDGRID_API_KEY
          }
        },
        types: {
          paymentFailed: true,
          subscriptionCancelled: true,
          usageLimitReached: true
        }
      }
    },

    /**
     * Development/Testing configuration
     * Minimal setup for development and testing
     */
    developmentSetup: {
      enabled: true,
      priority: 100,
      stripe: {
        secretKey: 'sk_test_dev',
        publishableKey: 'pk_test_dev',
        webhookSecret: 'whsec_test_dev',
        mode: 'test'
      },
      billingModel: 'per_call',
      pricing: {
        currency: 'usd',
        perCall: {
          defaultPrice: 1 // $0.01 for testing
        }
      },
      database: {
        type: 'sqlite',
        connectionString: ':memory:', // In-memory for testing
        autoMigrate: true
      },
      auth: {
        jwtSecret: 'test-secret',
        tokenExpiration: '1h',
        enableApiKeys: true,
        apiKeyPrefix: 'test_'
      },
      rateLimiting: {
        enabled: false // Disabled for testing
      },
      webhooks: {
        endpointUrl: '/test/webhooks',
        events: ['payment_intent.succeeded']
      },
      managementApi: {
        enabled: true,
        port: 3001,
        enableCors: true
      },
      analytics: {
        enabled: false // Disabled for testing
      }
    }
  };
}

/**
 * Helper function to create a configuration for a specific billing model
 */
export function createConfigForBillingModel(
  billingModel: BillingModel,
  stripeConfig: {
    secretKey: string;
    publishableKey: string;
    webhookSecret: string;
  },
  customizations: Partial<StripeMonetizationConfig> = {}
): StripeMonetizationConfig {
  const examples = createExampleConfigs();
  
  const baseConfig = (() => {
    switch (billingModel) {
      case 'per_call':
        return examples.perCallBilling;
      case 'subscription':
        return examples.subscriptionBilling;
      case 'usage_based':
        return examples.usageBasedBilling;
      case 'freemium':
        return examples.freemiumModel;
      case 'credit_system':
        return examples.creditSystem;
      default:
        return examples.perCallBilling;
    }
  })();

  return {
    ...baseConfig,
    stripe: {
      ...baseConfig.stripe,
      ...stripeConfig,
      mode: stripeConfig.secretKey.startsWith('sk_test_') ? 'test' : 'live'
    },
    ...customizations
  };
}

/**
 * Configuration validation helper
 */
export function validateConfiguration(config: StripeMonetizationConfig): {
  valid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Required fields
  if (!config.stripe.secretKey) {
    errors.push('Stripe secret key is required');
  }
  if (!config.stripe.publishableKey) {
    errors.push('Stripe publishable key is required');
  }
  if (!config.stripe.webhookSecret) {
    errors.push('Webhook secret is required');
  }

  // Key validation
  if (config.stripe.secretKey && !config.stripe.secretKey.startsWith('sk_')) {
    errors.push('Invalid Stripe secret key format');
  }
  if (config.stripe.publishableKey && !config.stripe.publishableKey.startsWith('pk_')) {
    errors.push('Invalid Stripe publishable key format');
  }

  // Mode consistency
  const isTestSecret = config.stripe.secretKey?.startsWith('sk_test_');
  const isTestPublishable = config.stripe.publishableKey?.startsWith('pk_test_');
  const configMode = config.stripe.mode;

  if (isTestSecret !== isTestPublishable) {
    errors.push('Stripe secret and publishable keys must be for the same mode (test or live)');
  }

  if (configMode === 'live' && isTestSecret) {
    warnings.push('Configuration mode is live but using test keys');
  }
  if (configMode === 'test' && !isTestSecret) {
    warnings.push('Configuration mode is test but using live keys');
  }

  // Database validation
  if (!config.database.connectionString) {
    errors.push('Database connection string is required');
  }

  // Auth validation
  if (!config.auth.jwtSecret) {
    errors.push('JWT secret is required');
  }
  if (config.auth.jwtSecret === 'change-this-secret' || 
      config.auth.jwtSecret === 'your-jwt-secret-here') {
    warnings.push('Using default JWT secret - change this in production');
  }

  // Pricing validation
  if (config.billingModel === 'subscription' && !config.pricing.subscription?.plans?.length) {
    errors.push('Subscription billing model requires at least one plan');
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
}