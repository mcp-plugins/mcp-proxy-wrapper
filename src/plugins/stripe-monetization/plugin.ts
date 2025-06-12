/**
 * @file Stripe Monetization Plugin
 * @version 1.0.0
 * @description Core implementation of the Stripe monetization plugin for MCP servers
 * 
 * This plugin provides comprehensive monetization capabilities including:
 * - Per-call billing with Stripe Payment Intents
 * - Subscription management
 * - Usage-based billing with Stripe Meters
 * - Credit/token systems
 * - Freemium models with usage limits
 */

import { BasePlugin } from '../../interfaces/plugin.js';
import { ToolCallResult } from '../../interfaces/proxy-hooks.js';
import { PluginInitContext, PluginContext } from '../../interfaces/plugin.js';
import {
  StripeMonetizationConfig,
  MonetizedToolCallContext,
  MonetizedToolCallResult,
  BillingModel,
  CustomerInfo,
  UsageRecord,
  PaymentIntentInfo,
  StripeMonetizationStats,
  MonetizationError,
  PaymentRequiredError,
  InsufficientCreditsError,
  SubscriptionRequiredError,
  RateLimitExceededError,
  AuthenticationError
} from './interfaces.js';
import { DatabaseManager } from './database.js';
import { StripeService } from './stripe-service.js';
import { AuthenticationManager } from './auth.js';
import { UsageTracker } from './usage-tracker.js';
import { WebhookHandler } from './webhook-handler.js';
import { ManagementApiServer } from './management-api.js';
import { createHash, timingSafeEqual } from 'crypto';

/**
 * Main Stripe monetization plugin class
 */
export class StripeMonetizationPlugin extends BasePlugin {
  readonly name = 'stripe-monetization-plugin';
  readonly version = '1.0.0';
  
  readonly metadata = {
    description: 'Comprehensive Stripe-based monetization for MCP servers',
    author: 'Dennison Bertram',
    homepage: 'https://github.com/crazyrabbitltc/mcp-proxy-wrapper',
    tags: ['stripe', 'monetization', 'billing', 'payments', 'subscriptions'],
    minWrapperVersion: '1.0.0'
  };

  declare public config: StripeMonetizationConfig;
  private databaseManager!: DatabaseManager;
  private stripeService!: StripeService;
  private authManager!: AuthenticationManager;
  private usageTracker!: UsageTracker;
  private webhookHandler!: WebhookHandler;
  private managementApi?: ManagementApiServer;
  
  private initialized = false;
  private startTime = Date.now();

  constructor(config: StripeMonetizationConfig) {
    super();
    this.config = {
      enabled: true,
      priority: 100, // High priority for monetization
      ...config
    };
  }

  /**
   * Initialize the plugin with all required services
   */
  async initialize(context: PluginInitContext): Promise<void> {
    await super.initialize(context);
    
    if (!this.config.enabled) {
      this.logger?.info('Stripe monetization plugin is disabled');
      return;
    }

    try {
      this.logger?.info('Initializing Stripe monetization plugin...');

      // Validate configuration
      await this.validateConfiguration();

      // Initialize database
      this.databaseManager = new DatabaseManager(this.config.database);
      await this.databaseManager.initialize();
      this.logger?.info('Database initialized successfully');

      // Initialize Stripe service
      this.stripeService = new StripeService({
        secretKey: this.config.stripe.secretKey,
        mode: this.config.stripe.mode,
        apiVersion: this.config.stripe.apiVersion
      });
      await this.stripeService.initialize();
      this.logger?.info('Stripe service initialized successfully');

      // Initialize authentication manager
      this.authManager = new AuthenticationManager({
        jwtSecret: this.config.auth.jwtSecret,
        tokenExpiration: this.config.auth.tokenExpiration || '24h',
        enableApiKeys: this.config.auth.enableApiKeys || true,
        apiKeyPrefix: this.config.auth.apiKeyPrefix || 'mcp_'
      });
      this.logger?.info('Authentication manager initialized successfully');

      // Initialize usage tracker
      this.usageTracker = new UsageTracker(
        this.databaseManager,
        this.config.rateLimiting
      );
      this.logger?.info('Usage tracker initialized successfully');

      // Initialize webhook handler
      this.webhookHandler = new WebhookHandler(
        this.stripeService,
        this.databaseManager,
        this.config.stripe.webhookSecret
      );
      await this.webhookHandler.initialize();
      this.logger?.info('Webhook handler initialized successfully');

      // Initialize management API if enabled
      if (this.config.managementApi?.enabled) {
        this.managementApi = new ManagementApiServer(
          this.config.managementApi,
          this.databaseManager,
          this.stripeService,
          this.authManager
        );
        await this.managementApi.start();
        this.logger?.info(`Management API started on port ${this.config.managementApi.port}`);
      }

      this.initialized = true;
      this.logger?.info('Stripe monetization plugin initialized successfully');

    } catch (error) {
      this.logger?.error('Failed to initialize Stripe monetization plugin:', error);
      throw new MonetizationError(
        `Plugin initialization failed: ${error instanceof Error ? error.message : String(error)}`,
        'INITIALIZATION_FAILED',
        500
      );
    }
  }

  /**
   * Before tool call hook - handles authentication, authorization, and billing setup
   */
  async beforeToolCall(context: PluginContext): Promise<void | ToolCallResult> {
    if (!this.initialized) {
      throw new MonetizationError('Plugin not initialized', 'NOT_INITIALIZED', 500);
    }

    const startTime = Date.now();

    try {
      // Extract authentication information from context
      const authToken = this.extractAuthToken(context);
      if (!authToken) {
        throw new AuthenticationError('No authentication token provided');
      }

      // Authenticate and get customer information
      const customer = await this.authManager.authenticate(authToken);
      if (!customer) {
        throw new AuthenticationError('Invalid authentication token');
      }

      // Check if tool should be processed
      if (!this.shouldProcessTool(context.toolName)) {
        return; // Skip monetization for this tool
      }

      // Calculate cost for this tool call
      const cost = await this.calculateToolCallCost(customer, context);

      // Create monetized context
      const monetizedContext: MonetizedToolCallContext = {
        ...context,
        customer,
        cost,
        credits: this.config.billingModel === 'credit_system' ? 
          this.calculateCreditsRequired(context.toolName) : undefined
      };

      // Check rate limits
      await this.checkRateLimits(customer, context.toolName);

      // Handle billing based on the configured model
      await this.handleBilling(monetizedContext);

      // Track usage
      await this.usageTracker.recordCall(customer.customerId, context.toolName, cost);

      // Store monetized context for use in afterToolCall
      context.pluginData.set(this.name, {
        customer,
        cost,
        credits: monetizedContext.credits,
        startTime,
        billingHandled: true
      });

    } catch (error) {
      this.updateStats(Date.now() - startTime, true);
      
      if (error instanceof MonetizationError) {
        throw error;
      }
      
      this.logger?.error('Error in beforeToolCall:', error);
      throw new MonetizationError(
        `Billing error: ${error instanceof Error ? error.message : String(error)}`,
        'BILLING_ERROR',
        402
      );
    }
  }

  /**
   * After tool call hook - handles post-billing tasks and usage tracking
   */
  async afterToolCall(
    context: PluginContext,
    result: ToolCallResult
  ): Promise<ToolCallResult> {
    if (!this.initialized) {
      return result;
    }

    const pluginData = context.pluginData.get(this.name);
    if (!pluginData || !pluginData.billingHandled) {
      return result; // No billing was handled, return original result
    }

    const { customer, cost, credits, startTime } = pluginData;
    const processingTime = Date.now() - startTime;

    try {
      // Record successful usage
      const usageRecord: Omit<UsageRecord, 'id'> = {
        customerId: customer.customerId,
        toolName: context.toolName,
        args: context.args,
        cost,
        credits,
        timestamp: new Date(),
        processingTime,
        success: !result.result?.isError,
        error: result.result?.isError ? 
          result.result.content?.[0]?.text || 'Unknown error' : undefined,
        metadata: {
          requestId: context.metadata?.requestId,
          ...result.metadata
        }
      };

      await this.databaseManager.createUsageRecord(usageRecord);

      // Update customer usage statistics
      await this.updateCustomerUsage(customer.customerId, cost, credits);

      // Create monetized result
      const monetizedResult: MonetizedToolCallResult = {
        ...result,
        billing: {
          charged: cost,
          creditsConsumed: credits,
          paymentMethod: this.getPaymentMethod(customer) as 'subscription' | 'per_call' | 'credits' | 'free_tier',
          transactionId: pluginData.transactionId,
          remainingBalance: await this.getRemainingBalance(customer)
        },
        usage: {
          callsRemaining: await this.getRemainingCalls(customer),
          periodUsage: await this.getPeriodUsage(customer.customerId),
          totalUsage: customer.usage?.totalCalls || 0
        }
      };

      this.updateStats(processingTime, false);
      return monetizedResult;

    } catch (error) {
      this.logger?.error('Error in afterToolCall:', error);
      this.updateStats(processingTime, true);
      
      // Don't fail the tool call for post-processing errors
      // Just log and return the original result
      return result;
    }
  }

  /**
   * Health check for the plugin
   */
  async healthCheck(): Promise<boolean> {
    try {
      if (!this.initialized) return false;

      // Check database connection
      const dbHealthy = await this.databaseManager.healthCheck();
      if (!dbHealthy) return false;

      // Check Stripe service
      const stripeHealthy = await this.stripeService.healthCheck();
      if (!stripeHealthy) return false;

      // Check webhook handler
      const webhookHealthy = await this.webhookHandler.healthCheck();
      if (!webhookHealthy) return false;

      return true;
    } catch (error) {
      this.logger?.error('Health check failed:', error);
      return false;
    }
  }

  /**
   * Get plugin statistics
   */
  async getStats(): Promise<StripeMonetizationStats> {
    const baseStats = await super.getStats();
    
    if (!this.initialized) {
      return {
        ...baseStats,
        revenue: { total: 0, thisMonth: 0, byModel: {} as any, arpu: 0 },
        usage: { totalCalls: 0, callsThisMonth: 0, avgCallsPerUser: 0, popularTools: [] },
        customers: { total: 0, active: 0, newThisMonth: 0, churnRate: 0 },
        payments: { successful: 0, failed: 0, successRate: 0, avgAmount: 0 }
      } as StripeMonetizationStats;
    }

    try {
      return await this.databaseManager.getStats();
    } catch (error) {
      this.logger?.error('Error getting stats:', error);
      throw error;
    }
  }

  /**
   * Cleanup resources when plugin is destroyed
   */
  async destroy(): Promise<void> {
    this.logger?.info('Destroying Stripe monetization plugin...');

    try {
      if (this.managementApi) {
        await this.managementApi.stop();
      }

      if (this.webhookHandler) {
        await this.webhookHandler.destroy();
      }

      if (this.databaseManager) {
        await this.databaseManager.close();
      }

      this.initialized = false;
      this.logger?.info('Stripe monetization plugin destroyed successfully');
    } catch (error) {
      this.logger?.error('Error destroying plugin:', error);
    }
  }

  // Private helper methods

  private async validateConfiguration(): Promise<void> {
    const required = [
      'stripe.secretKey',
      'stripe.publishableKey',
      'stripe.webhookSecret',
      'billing.model',
      'pricing.currency',
      'database.connectionString',
      'auth.jwtSecret'
    ];

    for (const path of required) {
      const value = this.getNestedValue(this.config, path);
      if (!value) {
        throw new MonetizationError(
          `Missing required configuration: ${path}`,
          'INVALID_CONFIG',
          500
        );
      }
    }
  }

  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((o, p) => o?.[p], obj);
  }

  private extractAuthToken(context: PluginContext): string | null {
    // Try to extract from metadata first
    const authHeader = context.metadata?.authorization;
    if (authHeader?.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // Try to extract API key
    const apiKey = context.metadata?.apiKey || context.args?.apiKey;
    if (apiKey && typeof apiKey === 'string') {
      return apiKey;
    }

    return null;
  }

  private async calculateToolCallCost(
    customer: CustomerInfo,
    context: PluginContext
  ): Promise<number> {
    const { billingModel, pricing } = this.config;

    switch (billingModel) {
      case 'per_call':
        return pricing.perCall?.toolPricing?.[context.toolName] || 
               pricing.perCall?.defaultPrice || 0;

      case 'subscription':
        // Check if covered by subscription
        if (customer.subscriptionStatus === 'active') {
          const plan = pricing.subscription?.plans.find(p => p.id === customer.planId);
          if (plan) {
            const periodUsage = await this.getPeriodUsage(customer.customerId);
            if (periodUsage < plan.callsIncluded) {
              return 0; // Covered by subscription
            } else if (plan.overageRate) {
              return plan.overageRate; // Overage charge
            }
          }
        }
        return pricing.perCall?.defaultPrice || 0;

      case 'usage_based':
        return pricing.usageBased?.pricePerUnit || 0;

      case 'freemium':
        const monthlyUsage = await this.getMonthlyUsage(customer.customerId);
        const freeTierLimit = pricing.freemium?.freeTierLimits.callsPerMonth || 0;
        
        if (monthlyUsage < freeTierLimit) {
          return 0; // Free tier
        }
        
        if (pricing.freemium?.overageBehavior === 'charge') {
          return pricing.perCall?.defaultPrice || 0;
        }
        
        return 0; // Will be blocked or prompted for upgrade

      case 'credit_system':
        return 0; // Credits are handled separately

      default:
        return 0;
    }
  }

  private calculateCreditsRequired(toolName: string): number {
    if (this.config.billingModel !== 'credit_system') return 0;
    
    return this.config.pricing.creditSystem?.toolCredits?.[toolName] ||
           this.config.pricing.creditSystem?.creditsPerCall || 1;
  }

  private async checkRateLimits(customer: CustomerInfo, toolName: string): Promise<void> {
    if (!this.config.rateLimiting?.enabled) return;

    const isLimited = await this.usageTracker.checkRateLimit(
      customer.customerId,
      toolName,
      this.config.rateLimiting
    );

    if (isLimited) {
      throw new RateLimitExceededError(
        `Rate limit exceeded for tool: ${toolName}`
      );
    }
  }

  private async handleBilling(context: MonetizedToolCallContext): Promise<void> {
    const { billingModel } = this.config;
    const { customer, cost, credits } = context;

    switch (billingModel) {
      case 'per_call':
        if (cost > 0) {
          await this.handlePerCallBilling(customer, cost, context);
        }
        break;

      case 'subscription':
        await this.handleSubscriptionBilling(customer, context);
        break;

      case 'usage_based':
        // Usage is tracked and billed periodically by Stripe
        break;

      case 'freemium':
        await this.handleFreemiumBilling(customer, context);
        break;

      case 'credit_system':
        if (credits && credits > 0) {
          await this.handleCreditSystemBilling(customer, credits, context);
        }
        break;
    }
  }

  private async handlePerCallBilling(
    customer: CustomerInfo,
    cost: number,
    context: MonetizedToolCallContext
  ): Promise<void> {
    // Create Stripe Payment Intent
    const paymentIntent = await this.stripeService.createPaymentIntent({
      amount: cost,
      currency: this.config.pricing.currency,
      customer: customer.stripeCustomerId,
      description: `Tool call: ${context.toolName}`,
      metadata: {
        toolName: context.toolName,
        customerId: customer.customerId,
        requestId: context.metadata?.requestId || ''
      }
    });

    // Store payment intent info
    context.paymentIntent = {
      paymentIntentId: paymentIntent.id,
      amount: cost,
      currency: this.config.pricing.currency,
      status: paymentIntent.status,
      customerId: customer.customerId,
      description: `Tool call: ${context.toolName}`
    };

    // Confirm payment immediately for saved payment methods
    if (paymentIntent.status !== 'succeeded') {
      const confirmed = await this.stripeService.confirmPaymentIntent(paymentIntent.id);
      if (confirmed.status !== 'succeeded') {
        throw new PaymentRequiredError('Payment failed - please update payment method');
      }
    }
  }

  private async handleSubscriptionBilling(
    customer: CustomerInfo,
    context: MonetizedToolCallContext
  ): Promise<void> {
    if (customer.subscriptionStatus !== 'active') {
      throw new SubscriptionRequiredError('Active subscription required');
    }

    // Check if within subscription limits
    const plan = this.config.pricing.subscription?.plans.find(p => p.id === customer.planId);
    if (!plan) {
      throw new SubscriptionRequiredError('Invalid subscription plan');
    }

    const periodUsage = await this.getPeriodUsage(customer.customerId);
    if (periodUsage >= plan.callsIncluded && !plan.overageRate) {
      throw new SubscriptionRequiredError('Subscription usage limit exceeded');
    }
  }

  private async handleFreemiumBilling(
    customer: CustomerInfo,
    context: MonetizedToolCallContext
  ): Promise<void> {
    const monthlyUsage = await this.getMonthlyUsage(customer.customerId);
    const freeTierLimit = this.config.pricing.freemium?.freeTierLimits.callsPerMonth || 0;

    if (monthlyUsage >= freeTierLimit) {
      const behavior = this.config.pricing.freemium?.overageBehavior;
      
      if (behavior === 'block') {
        throw new PaymentRequiredError('Free tier limit exceeded - upgrade required');
      } else if (behavior === 'upgrade_prompt') {
        throw new PaymentRequiredError('Free tier limit exceeded - please upgrade your plan');
      }
      // 'charge' behavior is handled in calculateToolCallCost
    }
  }

  private async handleCreditSystemBilling(
    customer: CustomerInfo,
    credits: number,
    context: MonetizedToolCallContext
  ): Promise<void> {
    if ((customer.credits || 0) < credits) {
      throw new InsufficientCreditsError(
        `Insufficient credits. Required: ${credits}, Available: ${customer.credits || 0}`
      );
    }

    // Deduct credits
    await this.databaseManager.updateCustomerCredits(
      customer.customerId,
      -credits
    );
  }

  private getPaymentMethod(customer: CustomerInfo): string {
    switch (this.config.billingModel) {
      case 'subscription':
        return 'subscription';
      case 'per_call':
        return 'per_call';
      case 'credit_system':
        return 'credits';
      case 'freemium':
        return 'free_tier';
      default:
        return 'unknown';
    }
  }

  private async getRemainingBalance(customer: CustomerInfo): Promise<number | undefined> {
    if (this.config.billingModel === 'credit_system') {
      return customer.credits || 0;
    }
    return undefined;
  }

  private async getRemainingCalls(customer: CustomerInfo): Promise<number | undefined> {
    if (this.config.billingModel === 'subscription' && customer.planId) {
      const plan = this.config.pricing.subscription?.plans.find(p => p.id === customer.planId);
      if (plan) {
        const periodUsage = await this.getPeriodUsage(customer.customerId);
        return Math.max(0, plan.callsIncluded - periodUsage);
      }
    } else if (this.config.billingModel === 'freemium') {
      const monthlyUsage = await this.getMonthlyUsage(customer.customerId);
      const limit = this.config.pricing.freemium?.freeTierLimits.callsPerMonth || 0;
      return Math.max(0, limit - monthlyUsage);
    }
    return undefined;
  }

  private async getPeriodUsage(customerId: string): Promise<number> {
    // Get usage for current billing period
    return await this.databaseManager.getUsageForPeriod(customerId, 'current');
  }

  private async getMonthlyUsage(customerId: string): Promise<number> {
    // Get usage for current month
    return await this.databaseManager.getUsageForPeriod(customerId, 'month');
  }

  private async updateCustomerUsage(
    customerId: string,
    cost: number,
    credits?: number
  ): Promise<void> {
    await this.databaseManager.updateCustomerUsage(customerId, {
      totalCalls: 1,
      currentPeriodCalls: 1,
      lastCallAt: new Date(),
      totalSpent: cost,
      creditsUsed: credits
    });
  }
}

/**
 * Factory function to create a Stripe monetization plugin instance
 */
export function createStripeMonetizationPlugin(
  config: StripeMonetizationConfig
): StripeMonetizationPlugin {
  return new StripeMonetizationPlugin(config);
}