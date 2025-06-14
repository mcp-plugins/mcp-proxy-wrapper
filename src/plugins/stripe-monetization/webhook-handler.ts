/**
 * @file Webhook Handler for Stripe Monetization Plugin
 * @version 1.0.0
 * @description Handles Stripe webhook events with proper signature verification
 * 
 * Supported webhook events:
 * - payment_intent.succeeded/failed
 * - customer.subscription.created/updated/deleted
 * - invoice.payment_succeeded/failed
 * - customer.created/updated/deleted
 * - billing.meter.usage (for usage-based billing)
 */

import { createHash, timingSafeEqual } from 'crypto';
import { StripeService } from './stripe-service.js';
import { DatabaseManager } from './database.js';
import { WebhookEvent, MonetizationError } from './interfaces.js';

/**
 * Webhook processing result
 */
export interface WebhookProcessingResult {
  processed: boolean;
  error?: string;
  data?: any;
}

/**
 * Webhook handler configuration
 */
export interface WebhookConfig {
  endpoint: string;
  secret: string;
  enableRetries: boolean;
  maxRetries: number;
  retryDelayMs: number;
}

/**
 * Webhook event processor interface
 */
export interface WebhookEventProcessor {
  canHandle(eventType: string): boolean;
  process(event: any): Promise<WebhookProcessingResult>;
}

/**
 * Main webhook handler class
 */
export class WebhookHandler {
  private stripeService: StripeService;
  private databaseManager: DatabaseManager;
  private webhookSecret: string;
  private processors: Map<string, WebhookEventProcessor> = new Map();
  private logger?: any;

  constructor(
    stripeService: StripeService,
    databaseManager: DatabaseManager,
    webhookSecret: string
  ) {
    this.stripeService = stripeService;
    this.databaseManager = databaseManager;
    this.webhookSecret = webhookSecret;
  }

  /**
   * Initialize webhook handler and register event processors
   */
  async initialize(): Promise<void> {
    // Register default event processors
    this.registerProcessor('payment_intent', new PaymentIntentProcessor(this.databaseManager));
    this.registerProcessor('customer.subscription', new SubscriptionProcessor(this.databaseManager, this.stripeService));
    this.registerProcessor('invoice', new InvoiceProcessor(this.databaseManager, this.stripeService));
    this.registerProcessor('customer', new CustomerProcessor(this.databaseManager));
    this.registerProcessor('billing.meter', new MeterUsageProcessor(this.databaseManager));
  }

  /**
   * Set logger instance
   */
  setLogger(logger: any): void {
    this.logger = logger;
  }

  /**
   * Health check for webhook handler
   */
  async healthCheck(): Promise<boolean> {
    return true; // Webhook handler is stateless
  }

  /**
   * Destroy webhook handler
   */
  async destroy(): Promise<void> {
    this.processors.clear();
  }

  /**
   * Register a custom event processor
   */
  registerProcessor(eventTypePrefix: string, processor: WebhookEventProcessor): void {
    this.processors.set(eventTypePrefix, processor);
  }

  /**
   * Process webhook event from HTTP request
   */
  async processWebhook(
    body: string | Buffer,
    signature: string
  ): Promise<WebhookProcessingResult> {
    try {
      // Verify webhook signature
      const event = this.stripeService.constructWebhookEvent(body, signature, this.webhookSecret);
      
      this.logger?.info(`Processing webhook event: ${event.type}`, { eventId: event.id });

      // Store webhook event
      await this.storeWebhookEvent(event);

      // Process the event
      const result = await this.processEvent(event);

      // Mark as processed
      await this.databaseManager.markWebhookProcessed(event.id, result.error);

      this.logger?.info(`Webhook event processed: ${event.type}`, { 
        eventId: event.id, 
        success: result.processed 
      });

      return result;
    } catch (error) {
      this.logger?.error('Webhook processing failed:', error);
      
      if (error instanceof MonetizationError) {
        throw error;
      }
      
      throw new MonetizationError(
        `Webhook processing failed: ${error instanceof Error ? error.message : String(error)}`,
        'WEBHOOK_PROCESSING_FAILED',
        400
      );
    }
  }

  /**
   * Process a Stripe event
   */
  private async processEvent(event: any): Promise<WebhookProcessingResult> {
    const processor = this.findProcessor(event.type);
    
    if (!processor) {
      this.logger?.warn(`No processor found for event type: ${event.type}`);
      return { processed: false, error: `No processor for event type: ${event.type}` };
    }

    try {
      return await processor.process(event);
    } catch (error) {
      this.logger?.error(`Error processing ${event.type}:`, error);
      return { 
        processed: false, 
        error: error instanceof Error ? error.message : String(error) 
      };
    }
  }

  /**
   * Find appropriate processor for event type
   */
  private findProcessor(eventType: string): WebhookEventProcessor | null {
    for (const [prefix, processor] of this.processors) {
      if (processor.canHandle(eventType)) {
        return processor;
      }
    }
    return null;
  }

  /**
   * Store webhook event in database
   */
  private async storeWebhookEvent(event: any): Promise<void> {
    const webhookEvent: Omit<WebhookEvent, 'processed'> = {
      eventId: event.id,
      type: event.type,
      data: event.data,
      timestamp: new Date(event.created * 1000)
    };

    await this.databaseManager.createWebhookEvent(webhookEvent);
  }
}

/**
 * Payment Intent event processor
 */
class PaymentIntentProcessor implements WebhookEventProcessor {
  private databaseManager: DatabaseManager;

  constructor(databaseManager: DatabaseManager) {
    this.databaseManager = databaseManager;
  }

  canHandle(eventType: string): boolean {
    return eventType.startsWith('payment_intent.');
  }

  async process(event: any): Promise<WebhookProcessingResult> {
    const paymentIntent = event.data.object;

    switch (event.type) {
      case 'payment_intent.succeeded':
        return await this.handlePaymentSucceeded(paymentIntent);
      
      case 'payment_intent.payment_failed':
        return await this.handlePaymentFailed(paymentIntent);
      
      case 'payment_intent.created':
        return await this.handlePaymentCreated(paymentIntent);
      
      default:
        return { processed: false, error: `Unhandled payment_intent event: ${event.type}` };
    }
  }

  private async handlePaymentSucceeded(paymentIntent: any): Promise<WebhookProcessingResult> {
    // Update payment intent status in database
    await this.databaseManager.updatePaymentIntent(paymentIntent.id, 'succeeded');
    
    // Update customer usage/billing if needed
    const customerId = paymentIntent.metadata?.customerId;
    if (customerId) {
      // Could update customer balance, unlock features, etc.
    }

    return { processed: true, data: { status: 'succeeded' } };
  }

  private async handlePaymentFailed(paymentIntent: any): Promise<WebhookProcessingResult> {
    // Update payment intent status
    await this.databaseManager.updatePaymentIntent(paymentIntent.id, 'failed');
    
    // Could trigger retry logic, notification, etc.
    const customerId = paymentIntent.metadata?.customerId;
    if (customerId) {
      // Handle payment failure - could disable access, send notification, etc.
    }

    return { processed: true, data: { status: 'failed' } };
  }

  private async handlePaymentCreated(paymentIntent: any): Promise<WebhookProcessingResult> {
    // Store payment intent in database if not already stored
    const customerId = paymentIntent.metadata?.customerId;
    if (customerId) {
      await this.databaseManager.createPaymentIntent({
        paymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount,
        currency: paymentIntent.currency,
        status: paymentIntent.status,
        customerId,
        description: paymentIntent.description,
        metadata: paymentIntent.metadata
      });
    }

    return { processed: true };
  }
}

/**
 * Subscription event processor
 */
class SubscriptionProcessor implements WebhookEventProcessor {
  private databaseManager: DatabaseManager;
  private stripeService: StripeService;

  constructor(databaseManager: DatabaseManager, stripeService: StripeService) {
    this.databaseManager = databaseManager;
    this.stripeService = stripeService;
  }

  canHandle(eventType: string): boolean {
    return eventType.startsWith('customer.subscription.');
  }

  async process(event: any): Promise<WebhookProcessingResult> {
    const subscription = event.data.object;

    switch (event.type) {
      case 'customer.subscription.created':
        return await this.handleSubscriptionCreated(subscription);
      
      case 'customer.subscription.updated':
        return await this.handleSubscriptionUpdated(subscription);
      
      case 'customer.subscription.deleted':
        return await this.handleSubscriptionDeleted(subscription);
      
      default:
        return { processed: false, error: `Unhandled subscription event: ${event.type}` };
    }
  }

  private async handleSubscriptionCreated(subscription: any): Promise<WebhookProcessingResult> {
    // Find customer by Stripe customer ID
    const customer = await this.databaseManager.getCustomerByStripeId(subscription.customer);
    
    if (customer) {
      // Update customer with subscription information
      await this.databaseManager.updateCustomer(customer.customerId, {
        subscriptionStatus: subscription.status,
        subscriptionId: subscription.id,
        planId: subscription.items.data[0]?.price?.id,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000)
      });
    }

    return { processed: true, data: { subscriptionId: subscription.id } };
  }

  private async handleSubscriptionUpdated(subscription: any): Promise<WebhookProcessingResult> {
    const customer = await this.databaseManager.getCustomerByStripeId(subscription.customer);
    
    if (customer) {
      await this.databaseManager.updateCustomer(customer.customerId, {
        subscriptionStatus: subscription.status,
        planId: subscription.items.data[0]?.price?.id,
        currentPeriodStart: new Date(subscription.current_period_start * 1000),
        currentPeriodEnd: new Date(subscription.current_period_end * 1000)
      });
    }

    return { processed: true };
  }

  private async handleSubscriptionDeleted(subscription: any): Promise<WebhookProcessingResult> {
    const customer = await this.databaseManager.getCustomerByStripeId(subscription.customer);
    
    if (customer) {
      await this.databaseManager.updateCustomer(customer.customerId, {
        subscriptionStatus: 'cancelled',
        subscriptionId: undefined,
        planId: undefined
      });
    }

    return { processed: true };
  }
}

/**
 * Invoice event processor
 */
class InvoiceProcessor implements WebhookEventProcessor {
  private databaseManager: DatabaseManager;
  private stripeService: StripeService;

  constructor(databaseManager: DatabaseManager, stripeService: StripeService) {
    this.databaseManager = databaseManager;
    this.stripeService = stripeService;
  }

  canHandle(eventType: string): boolean {
    return eventType.startsWith('invoice.');
  }

  async process(event: any): Promise<WebhookProcessingResult> {
    const invoice = event.data.object;

    switch (event.type) {
      case 'invoice.payment_succeeded':
        return await this.handleInvoicePaymentSucceeded(invoice);
      
      case 'invoice.payment_failed':
        return await this.handleInvoicePaymentFailed(invoice);
      
      default:
        return { processed: false, error: `Unhandled invoice event: ${event.type}` };
    }
  }

  private async handleInvoicePaymentSucceeded(invoice: any): Promise<WebhookProcessingResult> {
    const customer = await this.databaseManager.getCustomerByStripeId(invoice.customer);
    
    if (customer) {
      // Update last billed date
      await this.databaseManager.updateCustomer(customer.customerId, {
        lastBilledAt: new Date(invoice.status_transitions.paid_at * 1000)
      });

      // Reset usage counters for new billing period if this is a subscription invoice
      if (invoice.subscription) {
        await this.databaseManager.updateCustomer(customer.customerId, {
          currentPeriodStart: new Date(invoice.period_start * 1000),
          currentPeriodEnd: new Date(invoice.period_end * 1000)
        });
        
        // Reset current period usage
        await this.databaseManager.updateCustomerUsage(customer.customerId, {
          currentPeriodCalls: -(customer.usage?.currentPeriodCalls || 0) // Reset to 0
        });
      }
    }

    return { processed: true };
  }

  private async handleInvoicePaymentFailed(invoice: any): Promise<WebhookProcessingResult> {
    const customer = await this.databaseManager.getCustomerByStripeId(invoice.customer);
    
    if (customer) {
      // Could implement grace period, service suspension, etc.
      // For now, just update subscription status if applicable
      if (invoice.subscription) {
        await this.databaseManager.updateCustomer(customer.customerId, {
          subscriptionStatus: 'past_due'
        });
      }
    }

    return { processed: true };
  }
}

/**
 * Customer event processor
 */
class CustomerProcessor implements WebhookEventProcessor {
  private databaseManager: DatabaseManager;

  constructor(databaseManager: DatabaseManager) {
    this.databaseManager = databaseManager;
  }

  canHandle(eventType: string): boolean {
    return eventType.startsWith('customer.') && !eventType.startsWith('customer.subscription.');
  }

  async process(event: any): Promise<WebhookProcessingResult> {
    const stripeCustomer = event.data.object;

    switch (event.type) {
      case 'customer.updated':
        return await this.handleCustomerUpdated(stripeCustomer);
      
      case 'customer.deleted':
        return await this.handleCustomerDeleted(stripeCustomer);
      
      default:
        return { processed: false, error: `Unhandled customer event: ${event.type}` };
    }
  }

  private async handleCustomerUpdated(stripeCustomer: any): Promise<WebhookProcessingResult> {
    const customer = await this.databaseManager.getCustomerByStripeId(stripeCustomer.id);
    
    if (customer) {
      // Update customer information
      await this.databaseManager.updateCustomer(customer.customerId, {
        email: stripeCustomer.email,
        name: stripeCustomer.name
      });
    }

    return { processed: true };
  }

  private async handleCustomerDeleted(stripeCustomer: any): Promise<WebhookProcessingResult> {
    const customer = await this.databaseManager.getCustomerByStripeId(stripeCustomer.id);
    
    if (customer) {
      // Mark customer as inactive or delete (implement your own logic)
      // For now, we'll just clear the Stripe customer ID
      await this.databaseManager.updateCustomer(customer.customerId, {
        subscriptionStatus: 'cancelled'
      });
    }

    return { processed: true };
  }
}

/**
 * Meter usage event processor (for 2024 usage-based billing)
 */
class MeterUsageProcessor implements WebhookEventProcessor {
  private databaseManager: DatabaseManager;

  constructor(databaseManager: DatabaseManager) {
    this.databaseManager = databaseManager;
  }

  canHandle(eventType: string): boolean {
    return eventType.startsWith('billing.meter.');
  }

  async process(event: any): Promise<WebhookProcessingResult> {
    // Handle meter events for usage-based billing
    // This would be used with Stripe's new Meters API
    
    switch (event.type) {
      case 'billing.meter.usage':
        return await this.handleMeterUsage(event.data.object);
      
      default:
        return { processed: false, error: `Unhandled meter event: ${event.type}` };
    }
  }

  private async handleMeterUsage(meterData: any): Promise<WebhookProcessingResult> {
    // Process meter usage data
    // This could trigger billing calculations, usage alerts, etc.
    
    return { processed: true, data: meterData };
  }
}

/**
 * Express middleware for handling Stripe webhooks
 */
export function createWebhookMiddleware(webhookHandler: WebhookHandler) {
  return async (req: any, res: any) => {
    try {
      const signature = req.headers['stripe-signature'];
      if (!signature) {
        return res.status(400).json({ error: 'Missing Stripe signature' });
      }

      const result = await webhookHandler.processWebhook(req.body, signature);
      
      if (result.processed) {
        res.status(200).json({ received: true });
      } else {
        res.status(400).json({ error: result.error || 'Event not processed' });
      }
    } catch (error) {
      if (error instanceof MonetizationError) {
        res.status(error.statusCode).json({ error: error.message });
      } else {
        res.status(500).json({ error: 'Internal server error' });
      }
    }
  };
}