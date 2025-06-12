/**
 * @file Stripe Monetization Plugin Interfaces
 * @version 1.0.0
 * @description TypeScript interfaces for the Stripe monetization plugin
 * 
 * This file defines all the interfaces, types, and configurations needed
 * for implementing comprehensive Stripe-based monetization in MCP servers.
 */

import { PluginConfig } from '../../interfaces/plugin.js';
import { ToolCallContext, ToolCallResult } from '../../interfaces/proxy-hooks.js';

/**
 * Supported billing models for the Stripe monetization plugin
 */
export type BillingModel = 
  | 'per_call'          // Per-tool-call pricing
  | 'subscription'      // Monthly/yearly subscriptions
  | 'usage_based'       // Usage-based billing with Stripe Meters
  | 'freemium'          // Free tier with usage limits
  | 'credit_system';    // Credit/token-based system

/**
 * Stripe API mode configuration
 */
export type StripeMode = 'test' | 'live';

/**
 * Pricing structure for different billing models
 */
export interface PricingConfig {
  /** Base currency (ISO 4217 code) */
  currency: string;
  
  /** Per-call pricing configuration */
  perCall?: {
    /** Default price per tool call in cents */
    defaultPrice: number;
    
    /** Tool-specific pricing overrides */
    toolPricing?: Record<string, number>;
    
    /** Minimum charge amount in cents */
    minimumCharge?: number;
    
    /** Bulk pricing tiers */
    bulkTiers?: Array<{
      minCalls: number;
      pricePerCall: number;
    }>;
  };
  
  /** Subscription pricing configuration */
  subscription?: {
    /** Available subscription plans */
    plans: Array<{
      id: string;
      name: string;
      priceId: string; // Stripe Price ID
      interval: 'month' | 'year';
      amount: number; // in cents
      callsIncluded: number;
      overageRate?: number; // price per call beyond included
      features?: string[];
    }>;
    
    /** Trial period configuration */
    trialPeriod?: {
      enabled: boolean;
      days: number;
    };
  };
  
  /** Usage-based pricing configuration */
  usageBased?: {
    /** Stripe Meter ID for tracking usage */
    meterId: string;
    
    /** Price per unit of usage in cents */
    pricePerUnit: number;
    
    /** Minimum monthly charge */
    minimumMonthly?: number;
    
    /** Tiered pricing structure */
    tiers?: Array<{
      upTo: number | 'inf';
      pricePerUnit: number;
    }>;
  };
  
  /** Freemium model configuration */
  freemium?: {
    /** Free tier limits */
    freeTierLimits: {
      callsPerMonth: number;
      callsPerDay?: number;
      callsPerHour?: number;
    };
    
    /** What happens when limits are exceeded */
    overageBehavior: 'block' | 'charge' | 'upgrade_prompt';
    
    /** Premium plan to upgrade to */
    premiumPlanId?: string;
  };
  
  /** Credit system configuration */
  creditSystem?: {
    /** Cost per tool call in credits */
    creditsPerCall: number;
    
    /** Tool-specific credit costs */
    toolCredits?: Record<string, number>;
    
    /** Credit purchase options */
    creditPackages: Array<{
      id: string;
      credits: number;
      price: number; // in cents
      bonus?: number; // bonus credits
    }>;
  };
}

/**
 * Customer information and authentication
 */
export interface CustomerInfo {
  /** Unique customer identifier */
  customerId: string;
  
  /** Stripe Customer ID */
  stripeCustomerId: string;
  
  /** Customer email */
  email: string;
  
  /** Customer name */
  name?: string;
  
  /** Current subscription status */
  subscriptionStatus?: 'active' | 'inactive' | 'past_due' | 'cancelled' | 'trialing';
  
  /** Current subscription ID */
  subscriptionId?: string;
  
  /** Current plan ID */
  planId?: string;
  
  /** API key or token for authentication */
  apiKey: string;
  
  /** Account creation timestamp */
  createdAt: Date;
  
  /** Last billing date */
  lastBilledAt?: Date;
  
  /** Current period start */
  currentPeriodStart?: Date;
  
  /** Current period end */
  currentPeriodEnd?: Date;
  
  /** Available credits (for credit system) */
  credits?: number;
  
  /** Usage statistics */
  usage?: {
    currentPeriodCalls: number;
    totalCalls: number;
    lastCallAt?: Date;
  };
}

/**
 * Usage tracking and analytics
 */
export interface UsageRecord {
  /** Unique record identifier */
  id: string;
  
  /** Customer ID */
  customerId: string;
  
  /** Tool name */
  toolName: string;
  
  /** Tool call arguments (for analytics) */
  args: Record<string, any>;
  
  /** Cost in cents */
  cost: number;
  
  /** Credits consumed (if using credit system) */
  credits?: number;
  
  /** Timestamp */
  timestamp: Date;
  
  /** Processing time in milliseconds */
  processingTime?: number;
  
  /** Success/failure status */
  success: boolean;
  
  /** Error message if failed */
  error?: string;
  
  /** Additional metadata */
  metadata?: Record<string, any>;
}

/**
 * Payment intent information
 */
export interface PaymentIntentInfo {
  /** Stripe Payment Intent ID */
  paymentIntentId: string;
  
  /** Amount in cents */
  amount: number;
  
  /** Currency */
  currency: string;
  
  /** Status */
  status: string;
  
  /** Associated customer */
  customerId: string;
  
  /** Description */
  description?: string;
  
  /** Metadata */
  metadata?: Record<string, any>;
}

/**
 * Webhook event data
 */
export interface WebhookEvent {
  /** Stripe event ID */
  eventId: string;
  
  /** Event type */
  type: string;
  
  /** Event data */
  data: any;
  
  /** Timestamp */
  timestamp: Date;
  
  /** Processing status */
  processed: boolean;
  
  /** Error message if processing failed */
  error?: string;
}

/**
 * Plugin configuration specific to Stripe monetization
 */
export interface StripeMonetizationConfig extends PluginConfig {
  /** Stripe configuration */
  stripe: {
    /** Stripe secret key */
    secretKey: string;
    
    /** Stripe publishable key */
    publishableKey: string;
    
    /** Webhook endpoint secret */
    webhookSecret: string;
    
    /** API mode */
    mode: StripeMode;
    
    /** API version */
    apiVersion?: string;
  };
  
  /** Billing model to use */
  billingModel: BillingModel;
  
  /** Pricing configuration */
  pricing: PricingConfig;
  
  /** Database configuration */
  database: {
    /** Database type */
    type: 'sqlite' | 'postgresql' | 'mysql';
    
    /** Connection string or file path */
    connectionString: string;
    
    /** Table prefix */
    tablePrefix?: string;
    
    /** Enable automatic migrations */
    autoMigrate?: boolean;
  };
  
  /** Authentication configuration */
  auth: {
    /** JWT secret for signing tokens */
    jwtSecret: string;
    
    /** Token expiration time */
    tokenExpiration?: string;
    
    /** Enable API key authentication */
    enableApiKeys?: boolean;
    
    /** API key prefix */
    apiKeyPrefix?: string;
  };
  
  /** Rate limiting configuration */
  rateLimiting?: {
    /** Enable rate limiting */
    enabled: boolean;
    
    /** Window size in milliseconds */
    windowMs: number;
    
    /** Maximum requests per window */
    maxRequests: number;
    
    /** Enable burst allowance */
    enableBurst?: boolean;
    
    /** Burst multiplier */
    burstMultiplier?: number;
  };
  
  /** Webhook configuration */
  webhooks: {
    /** Webhook endpoint URL */
    endpointUrl: string;
    
    /** Events to listen for */
    events: string[];
    
    /** Enable webhook retries */
    enableRetries?: boolean;
    
    /** Max retry attempts */
    maxRetries?: number;
  };
  
  /** Management API configuration */
  managementApi?: {
    /** Enable management API */
    enabled: boolean;
    
    /** API port */
    port: number;
    
    /** API host */
    host?: string;
    
    /** Enable CORS */
    enableCors?: boolean;
    
    /** Admin authentication */
    adminAuth?: {
      username: string;
      password: string;
    };
  };
  
  /** Analytics configuration */
  analytics?: {
    /** Enable analytics */
    enabled: boolean;
    
    /** Data retention period in days */
    retentionDays: number;
    
    /** Enable real-time metrics */
    realTimeMetrics?: boolean;
    
    /** Export configuration */
    export?: {
      /** Enable data export */
      enabled: boolean;
      
      /** Export format */
      format: 'csv' | 'json';
      
      /** Export schedule */
      schedule?: string; // cron expression
    };
  };
  
  /** Email notifications */
  notifications?: {
    /** Enable email notifications */
    enabled: boolean;
    
    /** Email service configuration */
    emailService: {
      provider: 'smtp' | 'sendgrid' | 'mailgun';
      config: Record<string, any>;
    };
    
    /** Notification types */
    types: {
      paymentFailed?: boolean;
      subscriptionCancelled?: boolean;
      usageLimitReached?: boolean;
      lowCredits?: boolean;
    };
  };
}

/**
 * Enhanced tool call context with monetization data
 */
export interface MonetizedToolCallContext extends ToolCallContext {
  /** Customer information */
  customer: CustomerInfo;
  
  /** Calculated cost for this call */
  cost: number;
  
  /** Credits to be consumed */
  credits?: number;
  
  /** Payment intent (for per-call billing) */
  paymentIntent?: PaymentIntentInfo;
  
  /** Whether this call is covered by subscription */
  coveredBySubscription?: boolean;
  
  /** Remaining free tier calls */
  remainingFreeCalls?: number;
}

/**
 * Enhanced tool call result with monetization metadata
 */
export interface MonetizedToolCallResult extends ToolCallResult {
  /** Billing information */
  billing: {
    /** Amount charged in cents */
    charged: number;
    
    /** Credits consumed */
    creditsConsumed?: number;
    
    /** Payment method used */
    paymentMethod?: 'subscription' | 'per_call' | 'credits' | 'free_tier';
    
    /** Transaction ID */
    transactionId?: string;
    
    /** Remaining balance/credits */
    remainingBalance?: number;
  };
  
  /** Usage tracking */
  usage: {
    /** Calls remaining in current period */
    callsRemaining?: number;
    
    /** Current period usage */
    periodUsage: number;
    
    /** Total usage */
    totalUsage: number;
  };
}

/**
 * Plugin statistics and metrics
 */
export interface StripeMonetizationStats {
  /** Revenue metrics */
  revenue: {
    /** Total revenue in cents */
    total: number;
    
    /** Revenue this month */
    thisMonth: number;
    
    /** Revenue breakdown by billing model */
    byModel: Record<BillingModel, number>;
    
    /** Average revenue per user */
    arpu: number;
  };
  
  /** Usage metrics */
  usage: {
    /** Total tool calls */
    totalCalls: number;
    
    /** Calls this month */
    callsThisMonth: number;
    
    /** Average calls per user */
    avgCallsPerUser: number;
    
    /** Most popular tools */
    popularTools: Array<{
      toolName: string;
      calls: number;
      revenue: number;
    }>;
  };
  
  /** Customer metrics */
  customers: {
    /** Total customers */
    total: number;
    
    /** Active customers */
    active: number;
    
    /** New customers this month */
    newThisMonth: number;
    
    /** Churn rate */
    churnRate: number;
  };
  
  /** Subscription metrics */
  subscriptions?: {
    /** Active subscriptions */
    active: number;
    
    /** Subscription breakdown by plan */
    byPlan: Record<string, number>;
    
    /** Monthly recurring revenue */
    mrr: number;
    
    /** Average subscription value */
    asv: number;
  };
  
  /** Payment metrics */
  payments: {
    /** Successful payments */
    successful: number;
    
    /** Failed payments */
    failed: number;
    
    /** Payment success rate */
    successRate: number;
    
    /** Average payment amount */
    avgAmount: number;
  };
}

/**
 * Database models for persistence
 */
export interface DatabaseModels {
  customers: CustomerInfo;
  usageRecords: UsageRecord;
  paymentIntents: PaymentIntentInfo;
  webhookEvents: WebhookEvent;
}

/**
 * API endpoints for management interface
 */
export interface ManagementApiEndpoints {
  /** Customer management */
  '/customers': {
    GET: { page?: number; limit?: number };
    POST: Omit<CustomerInfo, 'customerId' | 'createdAt'>;
  };
  
  '/customers/:id': {
    GET: {};
    PUT: Partial<CustomerInfo>;
    DELETE: {};
  };
  
  /** Usage analytics */
  '/analytics/revenue': {
    GET: { startDate?: string; endDate?: string };
  };
  
  '/analytics/usage': {
    GET: { startDate?: string; endDate?: string; toolName?: string };
  };
  
  /** Configuration management */
  '/config': {
    GET: {};
    PUT: Partial<StripeMonetizationConfig>;
  };
  
  /** Webhook management */
  '/webhooks/events': {
    GET: { page?: number; limit?: number; processed?: boolean };
  };
  
  '/webhooks/retry/:eventId': {
    POST: {};
  };
}

/**
 * Error types specific to monetization
 */
export class MonetizationError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number = 400
  ) {
    super(message);
    this.name = 'MonetizationError';
  }
}

export class PaymentRequiredError extends MonetizationError {
  constructor(message: string = 'Payment required') {
    super(message, 'PAYMENT_REQUIRED', 402);
  }
}

export class InsufficientCreditsError extends MonetizationError {
  constructor(message: string = 'Insufficient credits') {
    super(message, 'INSUFFICIENT_CREDITS', 402);
  }
}

export class SubscriptionRequiredError extends MonetizationError {
  constructor(message: string = 'Active subscription required') {
    super(message, 'SUBSCRIPTION_REQUIRED', 402);
  }
}

export class RateLimitExceededError extends MonetizationError {
  constructor(message: string = 'Rate limit exceeded') {
    super(message, 'RATE_LIMIT_EXCEEDED', 429);
  }
}

export class AuthenticationError extends MonetizationError {
  constructor(message: string = 'Authentication failed') {
    super(message, 'AUTHENTICATION_FAILED', 401);
  }
}