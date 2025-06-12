/**
 * @file Database Manager for Stripe Monetization Plugin
 * @version 1.0.0
 * @description Handles all database operations for the Stripe monetization plugin
 * 
 * Supports multiple database backends:
 * - SQLite (for development and small deployments)
 * - PostgreSQL (for production deployments)
 * - MySQL (alternative production option)
 */

import {
  CustomerInfo,
  UsageRecord,
  PaymentIntentInfo,
  WebhookEvent,
  StripeMonetizationStats,
  MonetizationError
} from './interfaces.js';

/**
 * Database configuration interface
 */
export interface DatabaseConfig {
  type: 'sqlite' | 'postgresql' | 'mysql';
  connectionString: string;
  tablePrefix?: string;
  autoMigrate?: boolean;
}

/**
 * Usage update parameters
 */
export interface UsageUpdate {
  totalCalls?: number;
  currentPeriodCalls?: number;
  lastCallAt?: Date;
  totalSpent?: number;
  creditsUsed?: number;
}

/**
 * Database manager class with support for multiple database backends
 */
export class DatabaseManager {
  private config: DatabaseConfig;
  private connection: any;
  private tablePrefix: string;

  constructor(config: DatabaseConfig) {
    this.config = config;
    this.tablePrefix = config.tablePrefix || 'mcp_stripe_';
  }

  /**
   * Initialize the database connection and create tables if needed
   */
  async initialize(): Promise<void> {
    try {
      await this.connect();
      
      if (this.config.autoMigrate !== false) {
        await this.runMigrations();
      }
    } catch (error) {
      throw new MonetizationError(
        `Database initialization failed: ${error instanceof Error ? error.message : String(error)}`,
        'DATABASE_INIT_FAILED',
        500
      );
    }
  }

  /**
   * Health check for database connectivity
   */
  async healthCheck(): Promise<boolean> {
    try {
      if (this.config.type === 'sqlite') {
        // For SQLite, try a simple query
        await this.query('SELECT 1');
      } else {
        // For PostgreSQL/MySQL, check connection status
        await this.query('SELECT 1');
      }
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Close database connection
   */
  async close(): Promise<void> {
    if (this.connection) {
      if (this.config.type === 'sqlite') {
        await this.connection.close();
      } else {
        await this.connection.end();
      }
    }
  }

  // Customer management methods

  /**
   * Create a new customer record
   */
  async createCustomer(customer: Omit<CustomerInfo, 'customerId'>): Promise<CustomerInfo> {
    const customerId = this.generateCustomerId();
    const now = new Date();
    
    const fullCustomer: CustomerInfo = {
      ...customer,
      customerId,
      createdAt: now,
      usage: {
        currentPeriodCalls: 0,
        totalCalls: 0,
        ...customer.usage
      }
    };

    const sql = `
      INSERT INTO ${this.tablePrefix}customers (
        customer_id, stripe_customer_id, email, name, subscription_status,
        subscription_id, plan_id, api_key, created_at, last_billed_at,
        current_period_start, current_period_end, credits,
        current_period_calls, total_calls, last_call_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await this.query(sql, [
      fullCustomer.customerId,
      fullCustomer.stripeCustomerId,
      fullCustomer.email,
      fullCustomer.name || null,
      fullCustomer.subscriptionStatus || null,
      fullCustomer.subscriptionId || null,
      fullCustomer.planId || null,
      fullCustomer.apiKey,
      fullCustomer.createdAt.toISOString(),
      fullCustomer.lastBilledAt?.toISOString() || null,
      fullCustomer.currentPeriodStart?.toISOString() || null,
      fullCustomer.currentPeriodEnd?.toISOString() || null,
      fullCustomer.credits || null,
      fullCustomer.usage?.currentPeriodCalls || 0,
      fullCustomer.usage?.totalCalls || 0,
      fullCustomer.usage?.lastCallAt?.toISOString() || null
    ]);

    return fullCustomer;
  }

  /**
   * Get customer by ID
   */
  async getCustomer(customerId: string): Promise<CustomerInfo | null> {
    const sql = `
      SELECT * FROM ${this.tablePrefix}customers 
      WHERE customer_id = ?
    `;
    
    const result = await this.query(sql, [customerId]);
    if (!result || result.length === 0) {
      return null;
    }

    return this.mapRowToCustomer(result[0]);
  }

  /**
   * Get customer by API key
   */
  async getCustomerByApiKey(apiKey: string): Promise<CustomerInfo | null> {
    const sql = `
      SELECT * FROM ${this.tablePrefix}customers 
      WHERE api_key = ?
    `;
    
    const result = await this.query(sql, [apiKey]);
    if (!result || result.length === 0) {
      return null;
    }

    return this.mapRowToCustomer(result[0]);
  }

  /**
   * Get customer by Stripe customer ID
   */
  async getCustomerByStripeId(stripeCustomerId: string): Promise<CustomerInfo | null> {
    const sql = `
      SELECT * FROM ${this.tablePrefix}customers 
      WHERE stripe_customer_id = ?
    `;
    
    const result = await this.query(sql, [stripeCustomerId]);
    if (!result || result.length === 0) {
      return null;
    }

    return this.mapRowToCustomer(result[0]);
  }

  /**
   * Update customer information
   */
  async updateCustomer(customerId: string, updates: Partial<CustomerInfo>): Promise<void> {
    const setClause = [];
    const values = [];

    for (const [key, value] of Object.entries(updates)) {
      if (key === 'customerId' || key === 'createdAt') continue; // Don't update these fields
      
      const columnName = this.camelToSnake(key);
      setClause.push(`${columnName} = ?`);
      
      if (value instanceof Date) {
        values.push(value.toISOString());
      } else if (typeof value === 'object' && value !== null) {
        values.push(JSON.stringify(value));
      } else {
        values.push(value);
      }
    }

    if (setClause.length === 0) return;

    const sql = `
      UPDATE ${this.tablePrefix}customers 
      SET ${setClause.join(', ')}
      WHERE customer_id = ?
    `;
    
    values.push(customerId);
    await this.query(sql, values);
  }

  /**
   * Update customer usage statistics
   */
  async updateCustomerUsage(customerId: string, usage: UsageUpdate): Promise<void> {
    const updates: any = {};
    
    if (usage.totalCalls) {
      updates.total_calls = `total_calls + ${usage.totalCalls}`;
    }
    
    if (usage.currentPeriodCalls) {
      updates.current_period_calls = `current_period_calls + ${usage.currentPeriodCalls}`;
    }
    
    if (usage.lastCallAt) {
      updates.last_call_at = usage.lastCallAt.toISOString();
    }

    const setClause = Object.entries(updates).map(([key, value]) => 
      typeof value === 'string' && value.includes(' + ') ? 
        `${key} = ${value}` : 
        `${key} = ?`
    );
    
    const values = Object.values(updates).filter(value => 
      typeof value !== 'string' || !value.includes(' + ')
    );

    const sql = `
      UPDATE ${this.tablePrefix}customers 
      SET ${setClause.join(', ')}
      WHERE customer_id = ?
    `;
    
    values.push(customerId);
    await this.query(sql, values);
  }

  /**
   * Update customer credits
   */
  async updateCustomerCredits(customerId: string, creditsDelta: number): Promise<void> {
    const sql = `
      UPDATE ${this.tablePrefix}customers 
      SET credits = COALESCE(credits, 0) + ?
      WHERE customer_id = ?
    `;
    
    await this.query(sql, [creditsDelta, customerId]);
  }

  // Usage tracking methods

  /**
   * Create a usage record
   */
  async createUsageRecord(record: Omit<UsageRecord, 'id'>): Promise<UsageRecord> {
    const id = this.generateId();
    const fullRecord: UsageRecord = { ...record, id };

    const sql = `
      INSERT INTO ${this.tablePrefix}usage_records (
        id, customer_id, tool_name, args, cost, credits,
        timestamp, processing_time, success, error, metadata
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await this.query(sql, [
      fullRecord.id,
      fullRecord.customerId,
      fullRecord.toolName,
      JSON.stringify(fullRecord.args),
      fullRecord.cost,
      fullRecord.credits || null,
      fullRecord.timestamp.toISOString(),
      fullRecord.processingTime || null,
      fullRecord.success,
      fullRecord.error || null,
      JSON.stringify(fullRecord.metadata || {})
    ]);

    return fullRecord;
  }

  /**
   * Get usage records for a customer
   */
  async getUsageRecords(
    customerId: string,
    limit = 100,
    offset = 0
  ): Promise<UsageRecord[]> {
    const sql = `
      SELECT * FROM ${this.tablePrefix}usage_records 
      WHERE customer_id = ?
      ORDER BY timestamp DESC
      LIMIT ? OFFSET ?
    `;
    
    const results = await this.query(sql, [customerId, limit, offset]);
    return results.map(this.mapRowToUsageRecord.bind(this));
  }

  /**
   * Get usage count for a specific period
   */
  async getUsageForPeriod(customerId: string, period: 'current' | 'month'): Promise<number> {
    let whereClause = 'customer_id = ?';
    const params = [customerId];

    if (period === 'month') {
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);
      
      whereClause += ' AND timestamp >= ?';
      params.push(startOfMonth.toISOString());
    } else if (period === 'current') {
      // For current period, we need to get customer's billing period
      const customer = await this.getCustomer(customerId);
      if (customer?.currentPeriodStart) {
        whereClause += ' AND timestamp >= ?';
        params.push(customer.currentPeriodStart.toISOString());
      }
    }

    const sql = `
      SELECT COUNT(*) as count 
      FROM ${this.tablePrefix}usage_records 
      WHERE ${whereClause}
    `;
    
    const result = await this.query(sql, params);
    return result[0]?.count || 0;
  }

  // Payment tracking methods

  /**
   * Store payment intent information
   */
  async createPaymentIntent(paymentIntent: PaymentIntentInfo): Promise<void> {
    const sql = `
      INSERT INTO ${this.tablePrefix}payment_intents (
        payment_intent_id, amount, currency, status, customer_id,
        description, metadata, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `;

    await this.query(sql, [
      paymentIntent.paymentIntentId,
      paymentIntent.amount,
      paymentIntent.currency,
      paymentIntent.status,
      paymentIntent.customerId,
      paymentIntent.description || null,
      JSON.stringify(paymentIntent.metadata || {}),
      new Date().toISOString()
    ]);
  }

  /**
   * Update payment intent status
   */
  async updatePaymentIntent(paymentIntentId: string, status: string): Promise<void> {
    const sql = `
      UPDATE ${this.tablePrefix}payment_intents 
      SET status = ?, updated_at = ?
      WHERE payment_intent_id = ?
    `;
    
    await this.query(sql, [status, new Date().toISOString(), paymentIntentId]);
  }

  // Webhook event tracking

  /**
   * Store webhook event
   */
  async createWebhookEvent(event: Omit<WebhookEvent, 'processed'>): Promise<void> {
    const sql = `
      INSERT INTO ${this.tablePrefix}webhook_events (
        event_id, type, data, timestamp, processed, error
      ) VALUES (?, ?, ?, ?, ?, ?)
    `;

    await this.query(sql, [
      event.eventId,
      event.type,
      JSON.stringify(event.data),
      event.timestamp.toISOString(),
      false,
      event.error || null
    ]);
  }

  /**
   * Mark webhook event as processed
   */
  async markWebhookProcessed(eventId: string, error?: string): Promise<void> {
    const sql = `
      UPDATE ${this.tablePrefix}webhook_events 
      SET processed = ?, error = ?, processed_at = ?
      WHERE event_id = ?
    `;
    
    await this.query(sql, [!error, error || null, new Date().toISOString(), eventId]);
  }

  // Analytics and reporting

  /**
   * Get comprehensive statistics
   */
  async getStats(): Promise<StripeMonetizationStats> {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    // Revenue metrics
    const revenueQuery = `
      SELECT 
        SUM(cost) as total_revenue,
        SUM(CASE WHEN timestamp >= ? THEN cost ELSE 0 END) as month_revenue
      FROM ${this.tablePrefix}usage_records 
      WHERE success = true
    `;
    const revenueResult = await this.query(revenueQuery, [startOfMonth.toISOString()]);

    // Usage metrics
    const usageQuery = `
      SELECT 
        COUNT(*) as total_calls,
        COUNT(CASE WHEN timestamp >= ? THEN 1 END) as month_calls,
        tool_name,
        COUNT(*) as tool_calls,
        SUM(cost) as tool_revenue
      FROM ${this.tablePrefix}usage_records 
      WHERE success = true
      GROUP BY tool_name
      ORDER BY tool_calls DESC
      LIMIT 10
    `;
    const usageResult = await this.query(usageQuery, [startOfMonth.toISOString()]);

    // Customer metrics
    const customerQuery = `
      SELECT 
        COUNT(*) as total_customers,
        COUNT(CASE WHEN last_call_at >= ? THEN 1 END) as active_customers,
        COUNT(CASE WHEN created_at >= ? THEN 1 END) as new_customers
      FROM ${this.tablePrefix}customers
    `;
    const customerResult = await this.query(customerQuery, [
      new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days ago
      startOfMonth.toISOString()
    ]);

    // Payment metrics
    const paymentQuery = `
      SELECT 
        COUNT(CASE WHEN status = 'succeeded' THEN 1 END) as successful,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed,
        AVG(CASE WHEN status = 'succeeded' THEN amount END) as avg_amount
      FROM ${this.tablePrefix}payment_intents
    `;
    const paymentResult = await this.query(paymentQuery);

    const revenue = revenueResult[0] || {};
    const customers = customerResult[0] || {};
    const payments = paymentResult[0] || {};

    return {
      revenue: {
        total: revenue.total_revenue || 0,
        thisMonth: revenue.month_revenue || 0,
        byModel: {}, // TODO: Implement by billing model breakdown
        arpu: customers.total_customers > 0 ? 
          (revenue.total_revenue || 0) / customers.total_customers : 0
      },
      usage: {
        totalCalls: usageResult.reduce((sum: number, row: any) => sum + (row.tool_calls || 0), 0),
        callsThisMonth: usageResult.reduce((sum: number, row: any) => sum + (row.month_calls || 0), 0),
        avgCallsPerUser: customers.total_customers > 0 ? 
          usageResult.reduce((sum: number, row: any) => sum + (row.tool_calls || 0), 0) / customers.total_customers : 0,
        popularTools: usageResult.map((row: any) => ({
          toolName: row.tool_name,
          calls: row.tool_calls || 0,
          revenue: row.tool_revenue || 0
        }))
      },
      customers: {
        total: customers.total_customers || 0,
        active: customers.active_customers || 0,
        newThisMonth: customers.new_customers || 0,
        churnRate: 0 // TODO: Calculate churn rate
      },
      payments: {
        successful: payments.successful || 0,
        failed: payments.failed || 0,
        successRate: (payments.successful || 0) / Math.max(1, (payments.successful || 0) + (payments.failed || 0)),
        avgAmount: payments.avg_amount || 0
      }
    };
  }

  // Private helper methods

  private async connect(): Promise<void> {
    if (this.config.type === 'sqlite') {
      const { default: Database } = await import('better-sqlite3');
      this.connection = new Database(this.config.connectionString);
    } else if (this.config.type === 'postgresql') {
      const { Client } = await import('pg');
      this.connection = new Client({ connectionString: this.config.connectionString });
      await this.connection.connect();
    } else if (this.config.type === 'mysql') {
      const mysql = await import('mysql2/promise');
      this.connection = await mysql.createConnection(this.config.connectionString);
    } else {
      throw new Error(`Unsupported database type: ${this.config.type}`);
    }
  }

  private async query(sql: string, params: any[] = []): Promise<any[]> {
    if (this.config.type === 'sqlite') {
      const stmt = this.connection.prepare(sql);
      if (sql.trim().toUpperCase().startsWith('SELECT')) {
        return stmt.all(...params);
      } else {
        stmt.run(...params);
        return [];
      }
    } else if (this.config.type === 'postgresql') {
      const result = await this.connection.query(sql, params);
      return result.rows;
    } else if (this.config.type === 'mysql') {
      const [rows] = await this.connection.execute(sql, params);
      return Array.isArray(rows) ? rows : [];
    } else {
      throw new Error(`Unsupported database type: ${this.config.type}`);
    }
  }

  private async runMigrations(): Promise<void> {
    const migrations = [
      this.createCustomersTable(),
      this.createUsageRecordsTable(),
      this.createPaymentIntentsTable(),
      this.createWebhookEventsTable(),
      this.createIndexes()
    ];

    for (const migration of migrations) {
      await migration;
    }
  }

  private async createCustomersTable(): Promise<void> {
    const sql = `
      CREATE TABLE IF NOT EXISTS ${this.tablePrefix}customers (
        customer_id VARCHAR(255) PRIMARY KEY,
        stripe_customer_id VARCHAR(255) UNIQUE NOT NULL,
        email VARCHAR(255) NOT NULL,
        name VARCHAR(255),
        subscription_status VARCHAR(50),
        subscription_id VARCHAR(255),
        plan_id VARCHAR(255),
        api_key VARCHAR(255) UNIQUE NOT NULL,
        created_at TIMESTAMP NOT NULL,
        last_billed_at TIMESTAMP,
        current_period_start TIMESTAMP,
        current_period_end TIMESTAMP,
        credits INTEGER DEFAULT 0,
        current_period_calls INTEGER DEFAULT 0,
        total_calls INTEGER DEFAULT 0,
        last_call_at TIMESTAMP
      )
    `;
    
    await this.query(sql);
  }

  private async createUsageRecordsTable(): Promise<void> {
    const sql = `
      CREATE TABLE IF NOT EXISTS ${this.tablePrefix}usage_records (
        id VARCHAR(255) PRIMARY KEY,
        customer_id VARCHAR(255) NOT NULL,
        tool_name VARCHAR(255) NOT NULL,
        args TEXT,
        cost INTEGER NOT NULL,
        credits INTEGER,
        timestamp TIMESTAMP NOT NULL,
        processing_time INTEGER,
        success BOOLEAN NOT NULL DEFAULT true,
        error TEXT,
        metadata TEXT,
        FOREIGN KEY (customer_id) REFERENCES ${this.tablePrefix}customers(customer_id)
      )
    `;
    
    await this.query(sql);
  }

  private async createPaymentIntentsTable(): Promise<void> {
    const sql = `
      CREATE TABLE IF NOT EXISTS ${this.tablePrefix}payment_intents (
        payment_intent_id VARCHAR(255) PRIMARY KEY,
        amount INTEGER NOT NULL,
        currency VARCHAR(3) NOT NULL,
        status VARCHAR(50) NOT NULL,
        customer_id VARCHAR(255) NOT NULL,
        description TEXT,
        metadata TEXT,
        created_at TIMESTAMP NOT NULL,
        updated_at TIMESTAMP,
        FOREIGN KEY (customer_id) REFERENCES ${this.tablePrefix}customers(customer_id)
      )
    `;
    
    await this.query(sql);
  }

  private async createWebhookEventsTable(): Promise<void> {
    const sql = `
      CREATE TABLE IF NOT EXISTS ${this.tablePrefix}webhook_events (
        event_id VARCHAR(255) PRIMARY KEY,
        type VARCHAR(255) NOT NULL,
        data TEXT NOT NULL,
        timestamp TIMESTAMP NOT NULL,
        processed BOOLEAN NOT NULL DEFAULT false,
        processed_at TIMESTAMP,
        error TEXT
      )
    `;
    
    await this.query(sql);
  }

  private async createIndexes(): Promise<void> {
    const indexes = [
      `CREATE INDEX IF NOT EXISTS idx_${this.tablePrefix}customers_email ON ${this.tablePrefix}customers(email)`,
      `CREATE INDEX IF NOT EXISTS idx_${this.tablePrefix}customers_api_key ON ${this.tablePrefix}customers(api_key)`,
      `CREATE INDEX IF NOT EXISTS idx_${this.tablePrefix}usage_customer_time ON ${this.tablePrefix}usage_records(customer_id, timestamp)`,
      `CREATE INDEX IF NOT EXISTS idx_${this.tablePrefix}usage_tool_name ON ${this.tablePrefix}usage_records(tool_name)`,
      `CREATE INDEX IF NOT EXISTS idx_${this.tablePrefix}webhooks_processed ON ${this.tablePrefix}webhook_events(processed, timestamp)`
    ];

    for (const indexSql of indexes) {
      await this.query(indexSql);
    }
  }

  private mapRowToCustomer(row: any): CustomerInfo {
    return {
      customerId: row.customer_id,
      stripeCustomerId: row.stripe_customer_id,
      email: row.email,
      name: row.name,
      subscriptionStatus: row.subscription_status,
      subscriptionId: row.subscription_id,
      planId: row.plan_id,
      apiKey: row.api_key,
      createdAt: new Date(row.created_at),
      lastBilledAt: row.last_billed_at ? new Date(row.last_billed_at) : undefined,
      currentPeriodStart: row.current_period_start ? new Date(row.current_period_start) : undefined,
      currentPeriodEnd: row.current_period_end ? new Date(row.current_period_end) : undefined,
      credits: row.credits,
      usage: {
        currentPeriodCalls: row.current_period_calls || 0,
        totalCalls: row.total_calls || 0,
        lastCallAt: row.last_call_at ? new Date(row.last_call_at) : undefined
      }
    };
  }

  private mapRowToUsageRecord(row: any): UsageRecord {
    return {
      id: row.id,
      customerId: row.customer_id,
      toolName: row.tool_name,
      args: JSON.parse(row.args || '{}'),
      cost: row.cost,
      credits: row.credits,
      timestamp: new Date(row.timestamp),
      processingTime: row.processing_time,
      success: row.success,
      error: row.error,
      metadata: JSON.parse(row.metadata || '{}')
    };
  }

  private generateCustomerId(): string {
    return `cust_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateId(): string {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }
}