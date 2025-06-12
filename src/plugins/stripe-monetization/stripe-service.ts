/**
 * @file Stripe Service Wrapper
 * @version 1.0.0
 * @description Wrapper for Stripe API operations used by the monetization plugin
 * 
 * This service provides a clean interface to Stripe operations including:
 * - Payment Intents for per-call billing
 * - Customer management
 * - Subscription management
 * - Usage-based billing with Meters
 * - Webhook handling
 */

import { MonetizationError } from './interfaces.js';

/**
 * Stripe service configuration
 */
export interface StripeServiceConfig {
  secretKey: string;
  mode: 'test' | 'live';
  apiVersion?: string;
}

/**
 * Payment Intent creation parameters
 */
export interface CreatePaymentIntentParams {
  amount: number;
  currency: string;
  customer?: string;
  description?: string;
  metadata?: Record<string, string>;
  paymentMethodTypes?: string[];
  confirmationMethod?: 'automatic' | 'manual';
}

/**
 * Customer creation parameters
 */
export interface CreateCustomerParams {
  email: string;
  name?: string;
  metadata?: Record<string, string>;
  paymentMethod?: string;
}

/**
 * Subscription creation parameters
 */
export interface CreateSubscriptionParams {
  customer: string;
  priceId: string;
  trialPeriodDays?: number;
  metadata?: Record<string, string>;
}

/**
 * Usage record parameters for metered billing
 */
export interface CreateUsageRecordParams {
  subscriptionItem: string;
  quantity: number;
  timestamp?: number;
  action?: 'increment' | 'set';
}

/**
 * Stripe service wrapper class
 */
export class StripeService {
  private stripe: any;
  private config: StripeServiceConfig;

  constructor(config: StripeServiceConfig) {
    this.config = config;
  }

  /**
   * Initialize the Stripe service
   */
  async initialize(): Promise<void> {
    try {
      // Dynamically import Stripe to avoid bundling issues
      const Stripe = await import('stripe');
      
      this.stripe = new Stripe.default(this.config.secretKey, {
        apiVersion: this.config.apiVersion as any || '2023-10-16',
        typescript: true
      });

      // Test the connection
      await this.healthCheck();
    } catch (error) {
      throw new MonetizationError(
        `Failed to initialize Stripe service: ${error instanceof Error ? error.message : String(error)}`,
        'STRIPE_INIT_FAILED',
        500
      );
    }
  }

  /**
   * Health check for Stripe service
   */
  async healthCheck(): Promise<boolean> {
    try {
      // Try to retrieve account information as a health check
      await this.stripe.accounts.retrieve();
      return true;
    } catch (error) {
      return false;
    }
  }

  // Payment Intent operations

  /**
   * Create a Payment Intent
   */
  async createPaymentIntent(params: CreatePaymentIntentParams): Promise<any> {
    try {
      const paymentIntent = await this.stripe.paymentIntents.create({
        amount: params.amount,
        currency: params.currency,
        customer: params.customer,
        description: params.description,
        metadata: params.metadata || {},
        payment_method_types: params.paymentMethodTypes || ['card'],
        confirmation_method: params.confirmationMethod || 'automatic',
        confirm: params.confirmationMethod === 'automatic'
      });

      return paymentIntent;
    } catch (error) {
      throw new MonetizationError(
        `Failed to create payment intent: ${this.getStripeErrorMessage(error)}`,
        'STRIPE_PAYMENT_INTENT_FAILED',
        402
      );
    }
  }

  /**
   * Confirm a Payment Intent
   */
  async confirmPaymentIntent(paymentIntentId: string, paymentMethod?: string): Promise<any> {
    try {
      const params: any = {};
      if (paymentMethod) {
        params.payment_method = paymentMethod;
      }

      const paymentIntent = await this.stripe.paymentIntents.confirm(paymentIntentId, params);
      return paymentIntent;
    } catch (error) {
      throw new MonetizationError(
        `Failed to confirm payment intent: ${this.getStripeErrorMessage(error)}`,
        'STRIPE_PAYMENT_CONFIRM_FAILED',
        402
      );
    }
  }

  /**
   * Retrieve a Payment Intent
   */
  async getPaymentIntent(paymentIntentId: string): Promise<any> {
    try {
      return await this.stripe.paymentIntents.retrieve(paymentIntentId);
    } catch (error) {
      throw new MonetizationError(
        `Failed to retrieve payment intent: ${this.getStripeErrorMessage(error)}`,
        'STRIPE_PAYMENT_RETRIEVE_FAILED',
        404
      );
    }
  }

  // Customer operations

  /**
   * Create a new customer
   */
  async createCustomer(params: CreateCustomerParams): Promise<any> {
    try {
      const customer = await this.stripe.customers.create({
        email: params.email,
        name: params.name,
        metadata: params.metadata || {},
        payment_method: params.paymentMethod
      });

      return customer;
    } catch (error) {
      throw new MonetizationError(
        `Failed to create customer: ${this.getStripeErrorMessage(error)}`,
        'STRIPE_CUSTOMER_CREATE_FAILED',
        400
      );
    }
  }

  /**
   * Retrieve a customer
   */
  async getCustomer(customerId: string): Promise<any> {
    try {
      return await this.stripe.customers.retrieve(customerId);
    } catch (error) {
      throw new MonetizationError(
        `Failed to retrieve customer: ${this.getStripeErrorMessage(error)}`,
        'STRIPE_CUSTOMER_RETRIEVE_FAILED',
        404
      );
    }
  }

  /**
   * Update a customer
   */
  async updateCustomer(customerId: string, updates: Partial<CreateCustomerParams>): Promise<any> {
    try {
      return await this.stripe.customers.update(customerId, updates);
    } catch (error) {
      throw new MonetizationError(
        `Failed to update customer: ${this.getStripeErrorMessage(error)}`,
        'STRIPE_CUSTOMER_UPDATE_FAILED',
        400
      );
    }
  }

  /**
   * Delete a customer
   */
  async deleteCustomer(customerId: string): Promise<any> {
    try {
      return await this.stripe.customers.del(customerId);
    } catch (error) {
      throw new MonetizationError(
        `Failed to delete customer: ${this.getStripeErrorMessage(error)}`,
        'STRIPE_CUSTOMER_DELETE_FAILED',
        400
      );
    }
  }

  // Subscription operations

  /**
   * Create a subscription
   */
  async createSubscription(params: CreateSubscriptionParams): Promise<any> {
    try {
      const subscription = await this.stripe.subscriptions.create({
        customer: params.customer,
        items: [{
          price: params.priceId
        }],
        trial_period_days: params.trialPeriodDays,
        metadata: params.metadata || {}
      });

      return subscription;
    } catch (error) {
      throw new MonetizationError(
        `Failed to create subscription: ${this.getStripeErrorMessage(error)}`,
        'STRIPE_SUBSCRIPTION_CREATE_FAILED',
        400
      );
    }
  }

  /**
   * Retrieve a subscription
   */
  async getSubscription(subscriptionId: string): Promise<any> {
    try {
      return await this.stripe.subscriptions.retrieve(subscriptionId);
    } catch (error) {
      throw new MonetizationError(
        `Failed to retrieve subscription: ${this.getStripeErrorMessage(error)}`,
        'STRIPE_SUBSCRIPTION_RETRIEVE_FAILED',
        404
      );
    }
  }

  /**
   * Update a subscription
   */
  async updateSubscription(subscriptionId: string, updates: any): Promise<any> {
    try {
      return await this.stripe.subscriptions.update(subscriptionId, updates);
    } catch (error) {
      throw new MonetizationError(
        `Failed to update subscription: ${this.getStripeErrorMessage(error)}`,
        'STRIPE_SUBSCRIPTION_UPDATE_FAILED',
        400
      );
    }
  }

  /**
   * Cancel a subscription
   */
  async cancelSubscription(subscriptionId: string, cancelAtPeriodEnd = true): Promise<any> {
    try {
      if (cancelAtPeriodEnd) {
        return await this.stripe.subscriptions.update(subscriptionId, {
          cancel_at_period_end: true
        });
      } else {
        return await this.stripe.subscriptions.del(subscriptionId);
      }
    } catch (error) {
      throw new MonetizationError(
        `Failed to cancel subscription: ${this.getStripeErrorMessage(error)}`,
        'STRIPE_SUBSCRIPTION_CANCEL_FAILED',
        400
      );
    }
  }

  // Product and Price operations

  /**
   * Create a product
   */
  async createProduct(name: string, description?: string, metadata?: Record<string, string>): Promise<any> {
    try {
      return await this.stripe.products.create({
        name,
        description,
        metadata: metadata || {}
      });
    } catch (error) {
      throw new MonetizationError(
        `Failed to create product: ${this.getStripeErrorMessage(error)}`,
        'STRIPE_PRODUCT_CREATE_FAILED',
        400
      );
    }
  }

  /**
   * Create a price
   */
  async createPrice(params: {
    product: string;
    unitAmount?: number;
    currency: string;
    recurring?: {
      interval: 'day' | 'week' | 'month' | 'year';
      intervalCount?: number;
    };
    usageType?: 'metered' | 'licensed';
    billingScheme?: 'per_unit' | 'tiered';
    tiers?: Array<{
      upTo: number | 'inf';
      unitAmount?: number;
      flatAmount?: number;
    }>;
  }): Promise<any> {
    try {
      const priceData: any = {
        product: params.product,
        currency: params.currency,
        billing_scheme: params.billingScheme || 'per_unit'
      };

      if (params.unitAmount) {
        priceData.unit_amount = params.unitAmount;
      }

      if (params.recurring) {
        priceData.recurring = {
          interval: params.recurring.interval,
          interval_count: params.recurring.intervalCount || 1,
          usage_type: params.usageType || 'licensed'
        };
      }

      if (params.tiers) {
        priceData.tiers = params.tiers.map(tier => ({
          up_to: tier.upTo,
          unit_amount: tier.unitAmount,
          flat_amount: tier.flatAmount
        }));
      }

      return await this.stripe.prices.create(priceData);
    } catch (error) {
      throw new MonetizationError(
        `Failed to create price: ${this.getStripeErrorMessage(error)}`,
        'STRIPE_PRICE_CREATE_FAILED',
        400
      );
    }
  }

  // Usage-based billing with Meters (2024 feature)

  /**
   * Create a meter for usage tracking
   */
  async createMeter(params: {
    displayName: string;
    eventName: string;
    customerMapping?: {
      eventPayloadKey: string;
      type: 'by_id';
    };
    defaultAggregation?: {
      formula: 'count' | 'sum';
    };
  }): Promise<any> {
    try {
      return await this.stripe.billing.meters.create({
        display_name: params.displayName,
        event_name: params.eventName,
        customer_mapping: params.customerMapping,
        default_aggregation: params.defaultAggregation || { formula: 'count' }
      });
    } catch (error) {
      throw new MonetizationError(
        `Failed to create meter: ${this.getStripeErrorMessage(error)}`,
        'STRIPE_METER_CREATE_FAILED',
        400
      );
    }
  }

  /**
   * Send a meter event
   */
  async createMeterEvent(params: {
    eventName: string;
    payload: Record<string, any>;
    timestamp?: number;
  }): Promise<any> {
    try {
      return await this.stripe.billing.meterEvents.create({
        event_name: params.eventName,
        payload: params.payload,
        timestamp: params.timestamp || Math.floor(Date.now() / 1000)
      });
    } catch (error) {
      throw new MonetizationError(
        `Failed to create meter event: ${this.getStripeErrorMessage(error)}`,
        'STRIPE_METER_EVENT_FAILED',
        400
      );
    }
  }

  // Legacy usage records (for older metered billing)

  /**
   * Create a usage record for a subscription item
   */
  async createUsageRecord(params: CreateUsageRecordParams): Promise<any> {
    try {
      return await this.stripe.subscriptionItems.createUsageRecord(
        params.subscriptionItem,
        {
          quantity: params.quantity,
          timestamp: params.timestamp || Math.floor(Date.now() / 1000),
          action: params.action || 'increment'
        }
      );
    } catch (error) {
      throw new MonetizationError(
        `Failed to create usage record: ${this.getStripeErrorMessage(error)}`,
        'STRIPE_USAGE_RECORD_FAILED',
        400
      );
    }
  }

  // Webhook operations

  /**
   * Construct webhook event from request
   */
  constructWebhookEvent(payload: string | Buffer, signature: string, secret: string): any {
    try {
      return this.stripe.webhooks.constructEvent(payload, signature, secret);
    } catch (error) {
      throw new MonetizationError(
        `Invalid webhook signature: ${this.getStripeErrorMessage(error)}`,
        'STRIPE_WEBHOOK_INVALID',
        400
      );
    }
  }

  // Invoice operations

  /**
   * Create an invoice
   */
  async createInvoice(customerId: string, description?: string): Promise<any> {
    try {
      return await this.stripe.invoices.create({
        customer: customerId,
        description,
        auto_advance: true
      });
    } catch (error) {
      throw new MonetizationError(
        `Failed to create invoice: ${this.getStripeErrorMessage(error)}`,
        'STRIPE_INVOICE_CREATE_FAILED',
        400
      );
    }
  }

  /**
   * Finalize and send an invoice
   */
  async finalizeInvoice(invoiceId: string): Promise<any> {
    try {
      return await this.stripe.invoices.finalizeInvoice(invoiceId, {
        auto_advance: true
      });
    } catch (error) {
      throw new MonetizationError(
        `Failed to finalize invoice: ${this.getStripeErrorMessage(error)}`,
        'STRIPE_INVOICE_FINALIZE_FAILED',
        400
      );
    }
  }

  // Payment Method operations

  /**
   * Attach a payment method to a customer
   */
  async attachPaymentMethod(paymentMethodId: string, customerId: string): Promise<any> {
    try {
      return await this.stripe.paymentMethods.attach(paymentMethodId, {
        customer: customerId
      });
    } catch (error) {
      throw new MonetizationError(
        `Failed to attach payment method: ${this.getStripeErrorMessage(error)}`,
        'STRIPE_PAYMENT_METHOD_ATTACH_FAILED',
        400
      );
    }
  }

  /**
   * Set default payment method for customer
   */
  async setDefaultPaymentMethod(customerId: string, paymentMethodId: string): Promise<any> {
    try {
      return await this.stripe.customers.update(customerId, {
        invoice_settings: {
          default_payment_method: paymentMethodId
        }
      });
    } catch (error) {
      throw new MonetizationError(
        `Failed to set default payment method: ${this.getStripeErrorMessage(error)}`,
        'STRIPE_PAYMENT_METHOD_DEFAULT_FAILED',
        400
      );
    }
  }

  // Portal operations

  /**
   * Create a billing portal session
   */
  async createBillingPortalSession(customerId: string, returnUrl: string): Promise<any> {
    try {
      return await this.stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: returnUrl
      });
    } catch (error) {
      throw new MonetizationError(
        `Failed to create billing portal session: ${this.getStripeErrorMessage(error)}`,
        'STRIPE_PORTAL_CREATE_FAILED',
        400
      );
    }
  }

  /**
   * Create a checkout session
   */
  async createCheckoutSession(params: {
    customer?: string;
    lineItems: Array<{
      price: string;
      quantity: number;
    }>;
    mode: 'payment' | 'subscription' | 'setup';
    successUrl: string;
    cancelUrl: string;
    metadata?: Record<string, string>;
  }): Promise<any> {
    try {
      return await this.stripe.checkout.sessions.create({
        customer: params.customer,
        line_items: params.lineItems,
        mode: params.mode,
        success_url: params.successUrl,
        cancel_url: params.cancelUrl,
        metadata: params.metadata || {}
      });
    } catch (error) {
      throw new MonetizationError(
        `Failed to create checkout session: ${this.getStripeErrorMessage(error)}`,
        'STRIPE_CHECKOUT_CREATE_FAILED',
        400
      );
    }
  }

  // Helper methods

  /**
   * Extract user-friendly error message from Stripe error
   */
  private getStripeErrorMessage(error: any): string {
    if (error?.type === 'StripeCardError') {
      return error.message || 'Your card was declined.';
    } else if (error?.type === 'StripeInvalidRequestError') {
      return error.message || 'Invalid request parameters.';
    } else if (error?.type === 'StripeAPIError') {
      return 'Stripe service temporarily unavailable. Please try again.';
    } else if (error?.type === 'StripeConnectionError') {
      return 'Network communication with Stripe failed.';
    } else if (error?.type === 'StripeAuthenticationError') {
      return 'Stripe authentication failed.';
    } else if (error?.type === 'StripeRateLimitError') {
      return 'Too many requests to Stripe. Please try again later.';
    } else {
      return error?.message || 'An unknown error occurred.';
    }
  }

  /**
   * Get Stripe API mode (test or live)
   */
  getMode(): 'test' | 'live' {
    return this.config.mode;
  }

  /**
   * Check if in test mode
   */
  isTestMode(): boolean {
    return this.config.mode === 'test';
  }
}