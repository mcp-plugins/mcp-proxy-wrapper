# Stripe Monetization Plugin for MCP Servers

A comprehensive Stripe-based monetization plugin for Model Context Protocol (MCP) servers. This plugin enables MCP server operators to implement various billing models including per-call pricing, subscriptions, usage-based billing, freemium models, and credit systems.

## Features

### 🚀 Multiple Billing Models
- **Per-call billing**: Charge users for each tool call
- **Subscription plans**: Monthly/yearly recurring billing
- **Usage-based billing**: Consumption-based pricing with Stripe Meters
- **Freemium model**: Free tier with usage limits and paid upgrades
- **Credit system**: Token-based billing with credit packages

### 🔐 Authentication & Security
- JWT token authentication
- API key management
- Secure webhook signature verification
- Rate limiting and usage quotas
- HMAC-based security for all operations

### 📊 Analytics & Management
- Real-time usage tracking
- Revenue and customer analytics
- RESTful management API
- Webhook event monitoring
- Comprehensive dashboard data

### 🏗️ Enterprise Ready
- Database-agnostic (SQLite, PostgreSQL, MySQL)
- Horizontal scaling support
- Health checks and monitoring
- Configurable retention policies
- Admin management interface

## Quick Start

### Installation

```bash
npm install mcp-proxy-wrapper stripe
```

### Basic Setup

```typescript
import { wrapWithProxy } from 'mcp-proxy-wrapper';
import { createStripeMonetizationPlugin, createQuickSetup } from 'mcp-proxy-wrapper/plugins/stripe-monetization';

// Create your MCP server
const server = new McpServer(/* your server config */);

// Configure monetization
const monetizationConfig = createQuickSetup({
  stripeSecretKey: process.env.STRIPE_SECRET_KEY!,
  stripePublishableKey: process.env.STRIPE_PUBLISHABLE_KEY!,
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET!,
  billingModel: 'per_call',
  defaultPrice: 100, // $1.00 per call
  databasePath: './monetization.db'
});

// Create and register the plugin
const monetizationPlugin = createStripeMonetizationPlugin(monetizationConfig);

// Wrap server with monetization
const wrappedServer = await wrapWithProxy(server, {
  plugins: [monetizationPlugin]
});
```

## Configuration Examples

### Per-Call Billing

```typescript
const perCallConfig = {
  billingModel: 'per_call',
  pricing: {
    currency: 'usd',
    perCall: {
      defaultPrice: 50, // $0.50 per call
      toolPricing: {
        'ai-image-generator': 200, // $2.00 for AI tools
        'simple-calculator': 10,   // $0.10 for simple tools
      },
      bulkTiers: [
        { minCalls: 100, pricePerCall: 40 },  // 20% discount for bulk
        { minCalls: 1000, pricePerCall: 30 }  // 40% discount for high volume
      ]
    }
  }
};
```

### Subscription Model

```typescript
const subscriptionConfig = {
  billingModel: 'subscription',
  pricing: {
    currency: 'usd',
    subscription: {
      plans: [
        {
          id: 'starter',
          name: 'Starter Plan',
          priceId: 'price_1234567890', // Stripe Price ID
          interval: 'month',
          amount: 2900, // $29.00/month
          callsIncluded: 1000,
          overageRate: 5 // $0.05 per call over limit
        },
        {
          id: 'professional',
          name: 'Professional Plan',
          priceId: 'price_0987654321',
          interval: 'month',
          amount: 9900, // $99.00/month
          callsIncluded: 5000,
          overageRate: 3
        }
      ],
      trialPeriod: {
        enabled: true,
        days: 14
      }
    }
  }
};
```

### Freemium Model

```typescript
const freemiumConfig = {
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
    }
  }
};
```

### Credit System

```typescript
const creditConfig = {
  billingModel: 'credit_system',
  pricing: {
    currency: 'usd',
    creditSystem: {
      creditsPerCall: 1,
      toolCredits: {
        'ai-image-generator': 5,
        'data-analysis': 3,
        'simple-calculator': 1
      },
      creditPackages: [
        {
          id: 'small_pack',
          credits: 100,
          price: 1000, // $10.00
          bonus: 10    // 10 bonus credits
        },
        {
          id: 'large_pack',
          credits: 1000,
          price: 8000, // $80.00 (20% discount)
          bonus: 200   // 200 bonus credits
        }
      ]
    }
  }
};
```

## Authentication

### API Key Authentication

```javascript
// Client-side usage with API key
const response = await fetch('your-mcp-server.com/tool/calculate', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer mcp_your_api_key_here',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    operation: 'add',
    numbers: [1, 2, 3]
  })
});
```

### JWT Token Authentication

```typescript
// Generate JWT token for customer
const authManager = new AuthenticationManager(authConfig);
const token = authManager.generateJWT(customerId, customerEmail);

// Use token in requests
const response = await fetch('your-mcp-server.com/tool/analyze', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

## Webhook Setup

### Express.js Integration

```typescript
import express from 'express';
import { createWebhookMiddleware } from 'mcp-proxy-wrapper/plugins/stripe-monetization';

const app = express();

// Raw body parser for webhooks
app.use('/webhooks/stripe', express.raw({ type: 'application/json' }));

// Webhook handler
app.post('/webhooks/stripe', createWebhookMiddleware(webhookHandler));
```

### Stripe Configuration

1. Create a webhook endpoint in your Stripe dashboard
2. Set the endpoint URL to `https://your-domain.com/webhooks/stripe`
3. Select these events:
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`

## Management API

The plugin includes a RESTful API for managing customers and analytics:

### Enable Management API

```typescript
const config = {
  managementApi: {
    enabled: true,
    port: 3001,
    host: '127.0.0.1',
    enableCors: true,
    adminAuth: {
      username: 'admin',
      password: 'secure-password'
    }
  }
};
```

### API Endpoints

```bash
# Customer management
GET    /customers              # List customers
POST   /customers              # Create customer
GET    /customers/:id          # Get customer details
PUT    /customers/:id          # Update customer
DELETE /customers/:id          # Delete customer
GET    /customers/:id/usage    # Customer usage history

# Analytics
GET    /analytics/revenue      # Revenue analytics
GET    /analytics/usage        # Usage analytics
GET    /analytics/customers    # Customer analytics
GET    /analytics/dashboard    # Comprehensive dashboard data

# Webhook management
GET    /webhooks/events        # List webhook events
POST   /webhooks/retry/:id     # Retry failed webhook

# Subscription management
GET    /subscriptions          # List active subscriptions
GET    /subscriptions/:id      # Get subscription details
DELETE /subscriptions/:id      # Cancel subscription
```

## Database Configuration

### SQLite (Development)

```typescript
const config = {
  database: {
    type: 'sqlite',
    connectionString: './monetization.db',
    autoMigrate: true
  }
};
```

### PostgreSQL (Production)

```typescript
const config = {
  database: {
    type: 'postgresql',
    connectionString: 'postgresql://user:pass@localhost:5432/dbname',
    autoMigrate: true,
    tablePrefix: 'mcp_stripe_'
  }
};
```

### MySQL

```typescript
const config = {
  database: {
    type: 'mysql',
    connectionString: 'mysql://user:pass@localhost:3306/dbname',
    autoMigrate: true
  }
};
```

## Rate Limiting

```typescript
const config = {
  rateLimiting: {
    enabled: true,
    windowMs: 60 * 1000,    // 1 minute window
    maxRequests: 100,       // 100 requests per minute
    enableBurst: true,      // Allow temporary bursts
    burstMultiplier: 2      // 2x burst capacity
  }
};
```

## Error Handling

The plugin provides specific error types for different scenarios:

```typescript
import { 
  PaymentRequiredError, 
  InsufficientCreditsError, 
  SubscriptionRequiredError, 
  RateLimitExceededError,
  AuthenticationError 
} from 'mcp-proxy-wrapper/plugins/stripe-monetization';

// Handle errors in your tool calls
try {
  const result = await toolCall(args);
  return result;
} catch (error) {
  if (error instanceof PaymentRequiredError) {
    return {
      isError: true,
      content: [{
        type: "text",
        text: "Payment required. Please add a payment method to continue."
      }]
    };
  }
  
  if (error instanceof InsufficientCreditsError) {
    return {
      isError: true,
      content: [{
        type: "text", 
        text: "Insufficient credits. Please purchase more credits to continue."
      }]
    };
  }
  
  // Handle other errors...
}
```

## Analytics and Reporting

### Real-time Usage Statistics

```typescript
// Get usage stats for a customer
const stats = await usageTracker.getUsageStats(customerId, 24 * 60 * 60 * 1000); // 24 hours

console.log(`Total calls: ${stats.totalCalls}`);
console.log(`Successful calls: ${stats.successfulCalls}`);
console.log(`Total cost: $${stats.totalCost / 100}`);
console.log(`Top tools:`, stats.topTools);
```

### Revenue Analytics

```typescript
// Get comprehensive statistics
const stats = await plugin.getStats();

console.log(`Total revenue: $${stats.revenue.total / 100}`);
console.log(`This month: $${stats.revenue.thisMonth / 100}`);
console.log(`ARPU: $${stats.revenue.arpu / 100}`);
console.log(`Active customers: ${stats.customers.active}`);
```

## Production Deployment

### Environment Variables

```bash
# Stripe Configuration
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Database
DATABASE_URL=postgresql://user:pass@localhost/db

# Security
JWT_SECRET=your-super-secure-jwt-secret

# Management API
ADMIN_USERNAME=admin
ADMIN_PASSWORD=secure-admin-password

# Email Notifications (optional)
SENDGRID_API_KEY=SG.xxxxx
EMAIL_FROM=noreply@yourdomain.com
```

### Docker Deployment

```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm ci --only=production

COPY . .
RUN npm run build

EXPOSE 3000 3001

CMD ["node", "dist/server.js"]
```

### Health Checks

```typescript
// Health check endpoint
app.get('/health', async (req, res) => {
  const healthy = await plugin.healthCheck();
  res.status(healthy ? 200 : 503).json({
    status: healthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString()
  });
});
```

## Security Best Practices

1. **Environment Variables**: Store all secrets in environment variables
2. **HTTPS Only**: Always use HTTPS in production
3. **Webhook Verification**: Verify all webhook signatures
4. **Rate Limiting**: Implement appropriate rate limits
5. **Database Security**: Use encrypted connections and proper access controls
6. **API Key Rotation**: Regularly rotate API keys and JWT secrets
7. **Audit Logging**: Enable comprehensive audit logging
8. **Input Validation**: Validate all input parameters

## Troubleshooting

### Common Issues

1. **Webhook Signature Verification Failed**
   ```
   Error: Invalid webhook signature
   ```
   - Ensure webhook secret is correct
   - Verify raw body is passed to webhook handler
   - Check Stripe dashboard for webhook endpoint configuration

2. **Database Connection Failed**
   ```
   Error: Database initialization failed
   ```
   - Verify database connection string
   - Ensure database server is running
   - Check network connectivity and firewall rules

3. **Payment Intent Failed**
   ```
   Error: Your card was declined
   ```
   - Customer needs to update payment method
   - Check Stripe dashboard for payment details
   - Verify customer has sufficient funds

4. **Rate Limit Exceeded**
   ```
   Error: Rate limit exceeded
   ```
   - Customer is making too many requests
   - Adjust rate limiting configuration
   - Consider implementing exponential backoff

### Debug Mode

Enable debug logging for troubleshooting:

```typescript
const config = {
  debug: true,
  // ... other config
};
```

## License

MIT License - see LICENSE file for details.

## Support

For support and questions:
- GitHub Issues: [Create an issue](https://github.com/crazyrabbitltc/mcp-proxy-wrapper/issues)
- Documentation: [Full documentation](https://github.com/crazyrabbitltc/mcp-proxy-wrapper/blob/main/docs/stripe-monetization.md)
- Examples: [Example implementations](https://github.com/crazyrabbitltc/mcp-proxy-wrapper/tree/main/examples)

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting pull requests.

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## Roadmap

- [ ] Multi-currency support
- [ ] Advanced analytics dashboard
- [ ] Integration with other payment providers
- [ ] Advanced fraud detection
- [ ] Custom billing periods
- [ ] API usage forecasting
- [ ] Customer portal integration
- [ ] Advanced rate limiting strategies