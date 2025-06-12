/**
 * @file Management API Server for Stripe Monetization Plugin
 * @version 1.0.0
 * @description RESTful API for managing customers, analytics, and configuration
 * 
 * Endpoints:
 * - Customer management (CRUD operations)
 * - Usage analytics and reporting
 * - Configuration management
 * - Webhook event monitoring
 * - Revenue and subscription analytics
 */

import { DatabaseManager } from './database.js';
import { StripeService } from './stripe-service.js';
import { AuthenticationManager, AuthMiddleware } from './auth.js';
import { 
  CustomerInfo, 
  StripeMonetizationStats, 
  ManagementApiEndpoints,
  MonetizationError 
} from './interfaces.js';

/**
 * Management API configuration
 */
export interface ManagementApiConfig {
  enabled: boolean;
  port: number;
  host?: string;
  enableCors?: boolean;
  adminAuth?: {
    username: string;
    password: string;
  };
}

/**
 * API response wrapper
 */
interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Management API server class
 */
export class ManagementApiServer {
  private config: ManagementApiConfig;
  private databaseManager: DatabaseManager;
  private stripeService: StripeService;
  private authManager: AuthenticationManager;
  private authMiddleware: AuthMiddleware;
  private server?: any;
  private app?: any;

  constructor(
    config: ManagementApiConfig,
    databaseManager: DatabaseManager,
    stripeService: StripeService,
    authManager: AuthenticationManager
  ) {
    this.config = config;
    this.databaseManager = databaseManager;
    this.stripeService = stripeService;
    this.authManager = authManager;
    this.authMiddleware = new AuthMiddleware(authManager);
  }

  /**
   * Start the management API server
   */
  async start(): Promise<void> {
    if (!this.config.enabled) {
      return;
    }

    try {
      // Dynamically import express to avoid bundling issues
      const express = await import('express');
      const cors = await import('cors');
      
      this.app = express.default();
      
      // Middleware
      if (this.config.enableCors) {
        this.app.use(cors.default());
      }
      
      this.app.use(express.default.json());
      this.app.use(express.default.urlencoded({ extended: true }));
      
      // Routes
      this.setupRoutes();
      
      // Error handling
      this.setupErrorHandling();
      
      // Start server
      this.server = this.app.listen(this.config.port, this.config.host || '127.0.0.1');
      
    } catch (error) {
      throw new MonetizationError(
        `Failed to start management API: ${error instanceof Error ? error.message : String(error)}`,
        'API_START_FAILED',
        500
      );
    }
  }

  /**
   * Stop the management API server
   */
  async stop(): Promise<void> {
    if (this.server) {
      this.server.close();
    }
  }

  /**
   * Setup API routes
   */
  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', (req: any, res: any) => {
      res.json(this.createResponse({ status: 'healthy', timestamp: new Date().toISOString() }));
    });

    // Customer management endpoints
    this.setupCustomerRoutes();
    
    // Analytics endpoints
    this.setupAnalyticsRoutes();
    
    // Configuration endpoints
    this.setupConfigRoutes();
    
    // Webhook management endpoints
    this.setupWebhookRoutes();
    
    // Subscription management endpoints
    this.setupSubscriptionRoutes();
  }

  /**
   * Customer management routes
   */
  private setupCustomerRoutes(): void {
    // List customers
    this.app.get('/customers', this.authMiddleware.requireAdmin(), async (req: any, res: any) => {
      try {
        const page = parseInt(req.query.page || '1');
        const limit = Math.min(parseInt(req.query.limit || '50'), 100);
        const search = req.query.search;
        
        // This would need to be implemented in DatabaseManager
        const customers = await this.getCustomers(page, limit, search);
        
        res.json(this.createResponse(customers.data, customers.pagination));
      } catch (error) {
        res.status(500).json(this.createErrorResponse(error));
      }
    });

    // Get customer by ID
    this.app.get('/customers/:id', this.authMiddleware.requireAdmin(), async (req: any, res: any) => {
      try {
        const customer = await this.databaseManager.getCustomer(req.params.id);
        
        if (!customer) {
          return res.status(404).json(this.createErrorResponse('Customer not found'));
        }
        
        res.json(this.createResponse(customer));
      } catch (error) {
        res.status(500).json(this.createErrorResponse(error));
      }
    });

    // Create new customer
    this.app.post('/customers', this.authMiddleware.requireAdmin(), async (req: any, res: any) => {
      try {
        const customerData = req.body;
        
        // Validate required fields
        if (!customerData.email || !customerData.stripeCustomerId) {
          return res.status(400).json(this.createErrorResponse('Missing required fields'));
        }
        
        // Generate API key
        customerData.apiKey = this.authManager.generateApiKey();
        
        const customer = await this.databaseManager.createCustomer(customerData);
        res.status(201).json(this.createResponse(customer));
      } catch (error) {
        res.status(500).json(this.createErrorResponse(error));
      }
    });

    // Update customer
    this.app.put('/customers/:id', this.authMiddleware.requireAdmin(), async (req: any, res: any) => {
      try {
        const updates = req.body;
        delete updates.customerId; // Prevent ID changes
        delete updates.createdAt; // Prevent timestamp changes
        
        await this.databaseManager.updateCustomer(req.params.id, updates);
        const updatedCustomer = await this.databaseManager.getCustomer(req.params.id);
        
        res.json(this.createResponse(updatedCustomer));
      } catch (error) {
        res.status(500).json(this.createErrorResponse(error));
      }
    });

    // Delete customer
    this.app.delete('/customers/:id', this.authMiddleware.requireAdmin(), async (req: any, res: any) => {
      try {
        const customer = await this.databaseManager.getCustomer(req.params.id);
        
        if (!customer) {
          return res.status(404).json(this.createErrorResponse('Customer not found'));
        }
        
        // Cancel Stripe customer if exists
        if (customer.stripeCustomerId) {
          try {
            await this.stripeService.deleteCustomer(customer.stripeCustomerId);
          } catch (error) {
            // Log error but continue with local deletion
            console.warn('Failed to delete Stripe customer:', error);
          }
        }
        
        // For safety, we'll mark as inactive rather than hard delete
        await this.databaseManager.updateCustomer(req.params.id, {
          subscriptionStatus: 'cancelled'
        });
        
        res.json(this.createResponse({ deleted: true }));
      } catch (error) {
        res.status(500).json(this.createErrorResponse(error));
      }
    });

    // Customer usage history
    this.app.get('/customers/:id/usage', this.authMiddleware.requireAdmin(), async (req: any, res: any) => {
      try {
        const limit = Math.min(parseInt(req.query.limit || '100'), 1000);
        const offset = parseInt(req.query.offset || '0');
        
        const usage = await this.databaseManager.getUsageRecords(req.params.id, limit, offset);
        res.json(this.createResponse(usage));
      } catch (error) {
        res.status(500).json(this.createErrorResponse(error));
      }
    });
  }

  /**
   * Analytics routes
   */
  private setupAnalyticsRoutes(): void {
    // Revenue analytics
    this.app.get('/analytics/revenue', this.authMiddleware.requireAdmin(), async (req: any, res: any) => {
      try {
        const startDate = req.query.startDate ? new Date(req.query.startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const endDate = req.query.endDate ? new Date(req.query.endDate) : new Date();
        
        const stats = await this.databaseManager.getStats();
        
        // Add date filtering logic here if needed
        res.json(this.createResponse({
          revenue: stats.revenue,
          dateRange: { startDate, endDate }
        }));
      } catch (error) {
        res.status(500).json(this.createErrorResponse(error));
      }
    });

    // Usage analytics
    this.app.get('/analytics/usage', this.authMiddleware.requireAdmin(), async (req: any, res: any) => {
      try {
        const toolName = req.query.toolName;
        const startDate = req.query.startDate ? new Date(req.query.startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        const endDate = req.query.endDate ? new Date(req.query.endDate) : new Date();
        
        const stats = await this.databaseManager.getStats();
        
        let filteredStats = stats.usage;
        if (toolName) {
          filteredStats = {
            ...filteredStats,
            popularTools: stats.usage.popularTools.filter(tool => tool.toolName === toolName)
          };
        }
        
        res.json(this.createResponse({
          usage: filteredStats,
          dateRange: { startDate, endDate }
        }));
      } catch (error) {
        res.status(500).json(this.createErrorResponse(error));
      }
    });

    // Customer analytics
    this.app.get('/analytics/customers', this.authMiddleware.requireAdmin(), async (req: any, res: any) => {
      try {
        const stats = await this.databaseManager.getStats();
        res.json(this.createResponse(stats.customers));
      } catch (error) {
        res.status(500).json(this.createErrorResponse(error));
      }
    });

    // Payment analytics
    this.app.get('/analytics/payments', this.authMiddleware.requireAdmin(), async (req: any, res: any) => {
      try {
        const stats = await this.databaseManager.getStats();
        res.json(this.createResponse(stats.payments));
      } catch (error) {
        res.status(500).json(this.createErrorResponse(error));
      }
    });

    // Comprehensive dashboard data
    this.app.get('/analytics/dashboard', this.authMiddleware.requireAdmin(), async (req: any, res: any) => {
      try {
        const stats = await this.databaseManager.getStats();
        res.json(this.createResponse(stats));
      } catch (error) {
        res.status(500).json(this.createErrorResponse(error));
      }
    });
  }

  /**
   * Configuration routes
   */
  private setupConfigRoutes(): void {
    // Get current configuration (sanitized)
    this.app.get('/config', this.authMiddleware.requireAdmin(), async (req: any, res: any) => {
      try {
        // Return sanitized config without sensitive data
        const config = {
          billingModel: 'configured', // Don't expose actual config
          rateLimiting: { enabled: true }, // Sanitized version
          analytics: { enabled: true }
        };
        
        res.json(this.createResponse(config));
      } catch (error) {
        res.status(500).json(this.createErrorResponse(error));
      }
    });
  }

  /**
   * Webhook management routes
   */
  private setupWebhookRoutes(): void {
    // List webhook events
    this.app.get('/webhooks/events', this.authMiddleware.requireAdmin(), async (req: any, res: any) => {
      try {
        const page = parseInt(req.query.page || '1');
        const limit = Math.min(parseInt(req.query.limit || '50'), 100);
        const processed = req.query.processed !== undefined ? req.query.processed === 'true' : undefined;
        
        // This would need to be implemented in DatabaseManager
        const events = await this.getWebhookEvents(page, limit, processed);
        
        res.json(this.createResponse(events.data, events.pagination));
      } catch (error) {
        res.status(500).json(this.createErrorResponse(error));
      }
    });

    // Retry webhook event
    this.app.post('/webhooks/retry/:eventId', this.authMiddleware.requireAdmin(), async (req: any, res: any) => {
      try {
        // This would implement webhook retry logic
        res.json(this.createResponse({ retried: true, eventId: req.params.eventId }));
      } catch (error) {
        res.status(500).json(this.createErrorResponse(error));
      }
    });
  }

  /**
   * Subscription management routes
   */
  private setupSubscriptionRoutes(): void {
    // List active subscriptions
    this.app.get('/subscriptions', this.authMiddleware.requireAdmin(), async (req: any, res: any) => {
      try {
        // This would query customers with active subscriptions
        const activeSubscriptions = await this.getActiveSubscriptions();
        res.json(this.createResponse(activeSubscriptions));
      } catch (error) {
        res.status(500).json(this.createErrorResponse(error));
      }
    });

    // Get subscription details
    this.app.get('/subscriptions/:id', this.authMiddleware.requireAdmin(), async (req: any, res: any) => {
      try {
        const subscription = await this.stripeService.getSubscription(req.params.id);
        res.json(this.createResponse(subscription));
      } catch (error) {
        res.status(500).json(this.createErrorResponse(error));
      }
    });

    // Cancel subscription
    this.app.delete('/subscriptions/:id', this.authMiddleware.requireAdmin(), async (req: any, res: any) => {
      try {
        const cancelAtPeriodEnd = req.query.cancelAtPeriodEnd !== 'false';
        const result = await this.stripeService.cancelSubscription(req.params.id, cancelAtPeriodEnd);
        res.json(this.createResponse(result));
      } catch (error) {
        res.status(500).json(this.createErrorResponse(error));
      }
    });
  }

  /**
   * Setup error handling middleware
   */
  private setupErrorHandling(): void {
    // 404 handler
    this.app.use((req: any, res: any) => {
      res.status(404).json(this.createErrorResponse('Endpoint not found'));
    });

    // General error handler
    this.app.use((error: any, req: any, res: any, next: any) => {
      if (error instanceof MonetizationError) {
        res.status(error.statusCode).json(this.createErrorResponse(error.message));
      } else {
        res.status(500).json(this.createErrorResponse('Internal server error'));
      }
    });
  }

  // Helper methods

  private createResponse<T>(data: T, pagination?: any): ApiResponse<T> {
    return {
      success: true,
      data,
      pagination
    };
  }

  private createErrorResponse(error: any): ApiResponse {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error)
    };
  }

  private async getCustomers(page: number, limit: number, search?: string): Promise<{
    data: CustomerInfo[];
    pagination: any;
  }> {
    // This would need proper implementation in DatabaseManager
    // For now, returning empty result
    return {
      data: [],
      pagination: {
        page,
        limit,
        total: 0,
        totalPages: 0
      }
    };
  }

  private async getWebhookEvents(page: number, limit: number, processed?: boolean): Promise<{
    data: any[];
    pagination: any;
  }> {
    // This would need proper implementation in DatabaseManager
    return {
      data: [],
      pagination: {
        page,
        limit,
        total: 0,
        totalPages: 0
      }
    };
  }

  private async getActiveSubscriptions(): Promise<any[]> {
    // This would query customers with active subscriptions
    return [];
  }
}

/**
 * Express middleware for basic auth (if not using JWT)
 */
export function createBasicAuthMiddleware(username: string, password: string) {
  return (req: any, res: any, next: any) => {
    const auth = req.headers.authorization;
    
    if (!auth || !auth.startsWith('Basic ')) {
      res.setHeader('WWW-Authenticate', 'Basic realm="Management API"');
      return res.status(401).json({ error: 'Authentication required' });
    }
    
    const credentials = Buffer.from(auth.substring(6), 'base64').toString();
    const [user, pass] = credentials.split(':');
    
    if (user !== username || pass !== password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    next();
  };
}

/**
 * CORS configuration for the API
 */
export const corsOptions = {
  origin: function (origin: string, callback: Function) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Add your allowed origins here
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3001',
      'https://your-dashboard.com'
    ];
    
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
};