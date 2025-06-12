/**
 * @file Example Usage of Stripe Monetization Plugin
 * @version 1.0.0
 * @description Complete examples showing how to integrate the Stripe monetization plugin
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { wrapWithProxy } from '../../proxy-wrapper.js';
import { 
  createStripeMonetizationPlugin, 
  createQuickSetup,
  createExampleConfigs,
  StripeMonetizationConfig 
} from './index.js';

/**
 * Example 1: Basic Per-Call Billing Setup
 */
export async function basicPerCallExample() {
  // Create your MCP server
  const server = new McpServer({
    name: 'monetized-calculator-server',
    version: '1.0.0'
  });

  // Add some tools to your server
  server.tool('calculate', {
    description: 'Perform basic calculations',
    inputSchema: {
      type: 'object',
      properties: {
        operation: { type: 'string', enum: ['add', 'subtract', 'multiply', 'divide'] },
        a: { type: 'number' },
        b: { type: 'number' }
      },
      required: ['operation', 'a', 'b']
    }
  }, async (args) => {
    const { operation, a, b } = args;
    
    let result: number;
    switch (operation) {
      case 'add':
        result = a + b;
        break;
      case 'subtract':
        result = a - b;
        break;
      case 'multiply':
        result = a * b;
        break;
      case 'divide':
        if (b === 0) throw new Error('Division by zero');
        result = a / b;
        break;
      default:
        throw new Error('Invalid operation');
    }

    return {
      content: [{
        type: 'text',
        text: `Result: ${result}`
      }]
    };
  });

  // Configure monetization with quick setup
  const monetizationConfig = createQuickSetup({
    stripeSecretKey: process.env.STRIPE_SECRET_KEY!,
    stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY!,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
    billingModel: 'per_call',
    defaultPrice: 50, // $0.50 per calculation
    databasePath: './calculator-billing.db'
  });

  // Create and configure the plugin
  const monetizationPlugin = createStripeMonetizationPlugin(monetizationConfig);

  // Wrap server with monetization
  const wrappedServer = await wrapWithProxy(server, {
    plugins: [monetizationPlugin],
    debug: true
  });

  console.log('Calculator server with per-call billing is ready!');
  return wrappedServer;
}

/**
 * Example 2: Advanced Subscription-Based AI Service
 */
export async function subscriptionAIServiceExample() {
  const server = new McpServer({
    name: 'ai-service-server',
    version: '1.0.0'
  });

  // Add AI-powered tools with different complexity levels
  server.tool('generate-text', {
    description: 'Generate text using AI',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: { type: 'string' },
        maxTokens: { type: 'number', default: 100 }
      },
      required: ['prompt']
    }
  }, async (args) => {
    // Simulate AI text generation
    const { prompt, maxTokens = 100 } = args;
    const generatedText = `Generated response for: "${prompt}" (max ${maxTokens} tokens)`;
    
    return {
      content: [{
        type: 'text',
        text: generatedText
      }]
    };
  });

  server.tool('analyze-sentiment', {
    description: 'Analyze sentiment of text',
    inputSchema: {
      type: 'object',
      properties: {
        text: { type: 'string' }
      },
      required: ['text']
    }
  }, async (args) => {
    // Simulate sentiment analysis
    const { text } = args;
    const sentiment = Math.random() > 0.5 ? 'positive' : 'negative';
    const confidence = Math.random();
    
    return {
      content: [{
        type: 'text',
        text: `Sentiment: ${sentiment} (confidence: ${(confidence * 100).toFixed(1)}%)`
      }]
    };
  });

  // Advanced subscription configuration
  const subscriptionConfig: StripeMonetizationConfig = {
    enabled: true,
    priority: 100,
    stripe: {
      secretKey: process.env.STRIPE_SECRET_KEY!,
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY!,
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
      mode: process.env.NODE_ENV === 'production' ? 'live' : 'test'
    },
    billingModel: 'subscription',
    pricing: {
      currency: 'usd',
      subscription: {
        plans: [
          {
            id: 'basic',
            name: 'Basic AI Plan',
            priceId: 'price_basic_monthly',
            interval: 'month',
            amount: 1900, // $19.00/month
            callsIncluded: 1000,
            overageRate: 2, // $0.02 per call over limit
            features: ['Text generation', 'Basic sentiment analysis']
          },
          {
            id: 'professional',
            name: 'Professional AI Plan',
            priceId: 'price_pro_monthly',
            interval: 'month',
            amount: 4900, // $49.00/month
            callsIncluded: 5000,
            overageRate: 1, // $0.01 per call over limit
            features: ['Advanced text generation', 'Sentiment analysis', 'Priority processing']
          },
          {
            id: 'enterprise',
            name: 'Enterprise AI Plan',
            priceId: 'price_enterprise_monthly',
            interval: 'month',
            amount: 19900, // $199.00/month
            callsIncluded: 25000,
            features: ['Unlimited AI tools', 'Custom models', '24/7 support']
          }
        ],
        trialPeriod: {
          enabled: true,
          days: 7
        }
      }
    },
    database: {
      type: 'postgresql',
      connectionString: process.env.DATABASE_URL!,
      autoMigrate: true
    },
    auth: {
      jwtSecret: process.env.JWT_SECRET!,
      tokenExpiration: '8h',
      enableApiKeys: true,
      apiKeyPrefix: 'ai_'
    },
    rateLimiting: {
      enabled: true,
      windowMs: 60 * 1000, // 1 minute
      maxRequests: 60,      // 60 requests per minute
      enableBurst: true,
      burstMultiplier: 2
    },
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
      port: 3001,
      enableCors: true,
      adminAuth: {
        username: process.env.ADMIN_USERNAME!,
        password: process.env.ADMIN_PASSWORD!
      }
    },
    analytics: {
      enabled: true,
      retentionDays: 90,
      realTimeMetrics: true
    }
  };

  const monetizationPlugin = createStripeMonetizationPlugin(subscriptionConfig);

  const wrappedServer = await wrapWithProxy(server, {
    plugins: [monetizationPlugin],
    debug: process.env.NODE_ENV !== 'production'
  });

  console.log('AI service with subscription billing is ready!');
  console.log('Management API available at http://localhost:3001');
  
  return wrappedServer;
}

/**
 * Example 3: Freemium Developer Tools Service
 */
export async function freemiumDeveloperToolsExample() {
  const server = new McpServer({
    name: 'developer-tools-server',
    version: '1.0.0'
  });

  // Add developer tools
  server.tool('format-code', {
    description: 'Format code in various languages',
    inputSchema: {
      type: 'object',
      properties: {
        code: { type: 'string' },
        language: { type: 'string', enum: ['javascript', 'typescript', 'python', 'json'] }
      },
      required: ['code', 'language']
    }
  }, async (args) => {
    const { code, language } = args;
    // Simulate code formatting
    return {
      content: [{
        type: 'text',
        text: `Formatted ${language} code:\n\n${code}`
      }]
    };
  });

  server.tool('validate-json', {
    description: 'Validate JSON syntax',
    inputSchema: {
      type: 'object',
      properties: {
        json: { type: 'string' }
      },
      required: ['json']
    }
  }, async (args) => {
    const { json } = args;
    try {
      JSON.parse(json);
      return {
        content: [{
          type: 'text',
          text: 'Valid JSON ✅'
        }]
      };
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Invalid JSON ❌: ${error instanceof Error ? error.message : String(error)}`
        }]
      };
    }
  });

  server.tool('generate-uuid', {
    description: 'Generate a UUID',
    inputSchema: {
      type: 'object',
      properties: {
        version: { type: 'number', enum: [1, 4], default: 4 }
      }
    }
  }, async (args) => {
    // Simulate UUID generation
    const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
    
    return {
      content: [{
        type: 'text',
        text: uuid
      }]
    };
  });

  // Freemium configuration
  const freemiumConfig: StripeMonetizationConfig = {
    enabled: true,
    priority: 100,
    stripe: {
      secretKey: process.env.STRIPE_SECRET_KEY!,
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY!,
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
      mode: 'test'
    },
    billingModel: 'freemium',
    pricing: {
      currency: 'usd',
      freemium: {
        freeTierLimits: {
          callsPerMonth: 500,   // 500 free calls per month
          callsPerDay: 50,      // 50 free calls per day
          callsPerHour: 10      // 10 free calls per hour
        },
        overageBehavior: 'upgrade_prompt',
        premiumPlanId: 'developer-pro'
      },
      subscription: {
        plans: [
          {
            id: 'developer-pro',
            name: 'Developer Pro',
            priceId: 'price_dev_pro_monthly',
            interval: 'month',
            amount: 999, // $9.99/month
            callsIncluded: 10000,
            features: [
              'Unlimited basic tools',
              'Advanced formatting',
              'Priority support',
              'API access'
            ]
          }
        ]
      }
    },
    database: {
      type: 'sqlite',
      connectionString: './developer-tools.db',
      autoMigrate: true
    },
    auth: {
      jwtSecret: process.env.JWT_SECRET || 'dev-tools-secret',
      tokenExpiration: '30d', // Longer for developer tools
      enableApiKeys: true,
      apiKeyPrefix: 'dev_'
    },
    rateLimiting: {
      enabled: true,
      windowMs: 60 * 60 * 1000, // 1 hour window for free tier
      maxRequests: 10,           // 10 requests per hour for free users
      enableBurst: false         // No burst for free tier
    },
    webhooks: {
      endpointUrl: '/webhooks/stripe',
      events: [
        'customer.subscription.created',
        'customer.subscription.deleted'
      ]
    },
    managementApi: {
      enabled: true,
      port: 3002,
      enableCors: true
    }
  };

  const monetizationPlugin = createStripeMonetizationPlugin(freemiumConfig);

  const wrappedServer = await wrapWithProxy(server, {
    plugins: [monetizationPlugin],
    debug: true
  });

  console.log('Developer tools with freemium model is ready!');
  console.log('Free tier: 500 calls/month, 50 calls/day, 10 calls/hour');
  
  return wrappedServer;
}

/**
 * Example 4: Enterprise Credit-Based System
 */
export async function enterpriseCreditSystemExample() {
  const server = new McpServer({
    name: 'enterprise-api-server',
    version: '1.0.0'
  });

  // Add enterprise-grade tools with varying credit costs
  server.tool('data-analysis', {
    description: 'Perform complex data analysis',
    inputSchema: {
      type: 'object',
      properties: {
        dataset: { type: 'string' },
        analysisType: { 
          type: 'string', 
          enum: ['basic', 'advanced', 'machine-learning'] 
        }
      },
      required: ['dataset', 'analysisType']
    }
  }, async (args) => {
    const { dataset, analysisType } = args;
    
    // Simulate data analysis
    const results = {
      basic: 'Basic statistics calculated',
      advanced: 'Advanced statistical analysis completed',
      'machine-learning': 'ML model trained and predictions generated'
    };
    
    return {
      content: [{
        type: 'text',
        text: `Data Analysis Results: ${results[analysisType as keyof typeof results]}`
      }]
    };
  });

  server.tool('image-processing', {
    description: 'Process and analyze images',
    inputSchema: {
      type: 'object',
      properties: {
        imageUrl: { type: 'string' },
        operations: { 
          type: 'array', 
          items: { 
            type: 'string',
            enum: ['resize', 'filter', 'ocr', 'object-detection']
          }
        }
      },
      required: ['imageUrl', 'operations']
    }
  }, async (args) => {
    const { imageUrl, operations } = args;
    
    return {
      content: [{
        type: 'text',
        text: `Image processed with operations: ${operations.join(', ')}`
      }]
    };
  });

  // Enterprise credit system configuration
  const creditSystemConfig: StripeMonetizationConfig = {
    enabled: true,
    priority: 100,
    stripe: {
      secretKey: process.env.STRIPE_SECRET_KEY!,
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY!,
      webhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
      mode: 'live' // Production mode for enterprise
    },
    billingModel: 'credit_system',
    pricing: {
      currency: 'usd',
      creditSystem: {
        creditsPerCall: 1, // Default 1 credit per call
        toolCredits: {
          'data-analysis': 5,      // 5 credits for data analysis
          'image-processing': 10   // 10 credits for image processing
        },
        creditPackages: [
          {
            id: 'starter_pack',
            credits: 100,
            price: 2000, // $20.00
            bonus: 0
          },
          {
            id: 'business_pack',
            credits: 500,
            price: 9000, // $90.00 (10% discount)
            bonus: 50   // 50 bonus credits
          },
          {
            id: 'enterprise_pack',
            credits: 2000,
            price: 32000, // $320.00 (20% discount)
            bonus: 400    // 400 bonus credits
          },
          {
            id: 'mega_pack',
            credits: 10000,
            price: 140000, // $1400.00 (30% discount)
            bonus: 3000    // 3000 bonus credits
          }
        ]
      }
    },
    database: {
      type: 'postgresql',
      connectionString: process.env.DATABASE_URL!,
      autoMigrate: true,
      tablePrefix: 'enterprise_'
    },
    auth: {
      jwtSecret: process.env.JWT_SECRET!,
      tokenExpiration: '4h', // Shorter for security
      enableApiKeys: true,
      apiKeyPrefix: 'ent_'
    },
    rateLimiting: {
      enabled: true,
      windowMs: 60 * 1000,    // 1 minute
      maxRequests: 1000,      // High limit for enterprise
      enableBurst: true,
      burstMultiplier: 5      // High burst capacity
    },
    webhooks: {
      endpointUrl: '/webhooks/stripe',
      events: [
        'payment_intent.succeeded',
        'payment_intent.payment_failed'
      ],
      enableRetries: true,
      maxRetries: 5
    },
    managementApi: {
      enabled: true,
      port: 3000,
      host: '0.0.0.0', // Allow external access for enterprise
      enableCors: true,
      adminAuth: {
        username: process.env.ADMIN_USERNAME!,
        password: process.env.ADMIN_PASSWORD!
      }
    },
    analytics: {
      enabled: true,
      retentionDays: 365, // 1 year retention for enterprise
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
          apiKey: process.env.SENDGRID_API_KEY!
        }
      },
      types: {
        lowCredits: true,
        paymentFailed: true
      }
    }
  };

  const monetizationPlugin = createStripeMonetizationPlugin(creditSystemConfig);

  const wrappedServer = await wrapWithProxy(server, {
    plugins: [monetizationPlugin],
    debug: false // Production mode
  });

  console.log('Enterprise credit-based system is ready!');
  console.log('Credit costs: Data Analysis (5 credits), Image Processing (10 credits)');
  console.log('Management API available at http://localhost:3000');
  
  return wrappedServer;
}

/**
 * Example 5: Multi-Model Configuration with Different Tools
 */
export async function multiModelExample() {
  const server = new McpServer({
    name: 'multi-model-server',
    version: '1.0.0'
  });

  // Free tools
  server.tool('ping', {
    description: 'Simple ping tool (free)',
    inputSchema: { type: 'object', properties: {} }
  }, async () => ({
    content: [{ type: 'text', text: 'pong' }]
  }));

  // Paid tools
  server.tool('premium-analysis', {
    description: 'Premium analysis tool',
    inputSchema: {
      type: 'object',
      properties: {
        data: { type: 'string' }
      },
      required: ['data']
    }
  }, async (args) => ({
    content: [{ type: 'text', text: `Premium analysis of: ${args.data}` }]
  }));

  // Create configuration that combines multiple billing approaches
  const exampleConfigs = createExampleConfigs();
  
  // Use the freemium config as base but customize it
  const multiModelConfig: StripeMonetizationConfig = {
    ...exampleConfigs.freemiumModel,
    // Override specific tools to exclude from billing
    options: {
      includeTools: ['premium-analysis'], // Only charge for premium tools
      excludeTools: ['ping'] // Free tools
    }
  };

  const monetizationPlugin = createStripeMonetizationPlugin(multiModelConfig);

  const wrappedServer = await wrapWithProxy(server, {
    plugins: [monetizationPlugin],
    hooks: {
      beforeToolCall: async (context) => {
        console.log(`Tool call: ${context.toolName} by customer: ${context.metadata?.customerId || 'anonymous'}`);
      },
      afterToolCall: async (context, result) => {
        console.log(`Tool call completed: ${context.toolName}`);
        return result;
      }
    }
  });

  console.log('Multi-model server ready!');
  console.log('Free tools: ping');
  console.log('Paid tools: premium-analysis');
  
  return wrappedServer;
}

/**
 * Example 6: Complete Express.js Integration
 */
export async function completeExpressIntegration() {
  const express = await import('express');
  const app = express.default();

  // Create the MCP server with monetization
  const wrappedServer = await basicPerCallExample();

  // Middleware
  app.use(express.default.json());
  app.use(express.default.raw({ type: 'application/json' }));

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
  });

  // Webhook endpoint (handled by the plugin)
  app.post('/webhooks/stripe', async (req, res) => {
    // The webhook handler is set up by the plugin
    // This endpoint should be configured in your Stripe dashboard
    res.status(200).json({ received: true });
  });

  // Start the server
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Webhook endpoint: http://localhost:${PORT}/webhooks/stripe`);
  });

  return { app, server: wrappedServer };
}

// Export all examples for easy testing
export const examples = {
  basicPerCall: basicPerCallExample,
  subscriptionAI: subscriptionAIServiceExample,
  freemiumDevTools: freemiumDeveloperToolsExample,
  enterpriseCredits: enterpriseCreditSystemExample,
  multiModel: multiModelExample,
  expressIntegration: completeExpressIntegration
};

// If running this file directly, run a basic example
if (require.main === module) {
  basicPerCallExample()
    .then(() => console.log('Example server started successfully'))
    .catch(console.error);
}