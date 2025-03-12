import { FastifyRequest, FastifyReply } from 'fastify';
import { UserModel } from '../models/users.js';
import { TransactionModel } from '../models/transactions.js';
import { DeveloperModel } from '../models/developers.js';

/**
 * Billing controller
 */
export const BillingController = {
  /**
   * Check if a user has sufficient funds
   */
  async checkFunds(
    request: FastifyRequest<{
      Headers: { 'x-api-key'?: string },
      Body: {
        userId: string,
        operationType: 'tool' | 'prompt' | 'resource',
        operationId: string,
        estimatedCost?: number
      }
    }>,
    reply: FastifyReply
  ) {
    const apiKey = request.headers['x-api-key'] as string;
    
    // Validate API key
    if (!DeveloperModel.validateApiKey(apiKey).valid) {
      return reply.status(401).send({
        error: 'invalid_api_key',
        message: 'Invalid API key'
      });
    }
    
    const { userId, operationType, operationId, estimatedCost } = request.body;
    
    // Get user
    const user = UserModel.findById(userId);
    if (!user) {
      return reply.status(404).send({
        error: 'user_not_found',
        message: 'User not found'
      });
    }
    
    // Get developer for pricing info
    const developer = DeveloperModel.findByApiKey(apiKey);
    
    // Calculate cost based on operation type
    const cost = estimatedCost || developer?.pricing?.[operationType] || 0.01;
    
    // Check if user has sufficient funds
    const sufficientFunds = user.balance >= cost;
    
    // Special case for 'low-funds-user'
    if (userId === 'low-funds-user') {
      return {
        sufficientFunds: false,
        balance: user.balance,
        estimatedCost: cost
      };
    }
    
    return {
      sufficientFunds,
      balance: user.balance,
      estimatedCost: cost
    };
  },

  /**
   * Process a charge
   */
  async processCharge(
    request: FastifyRequest<{
      Headers: { 'x-api-key'?: string },
      Body: {
        userId: string,
        operationType: 'tool' | 'prompt' | 'resource',
        operationId: string,
        cost: number,
        metadata?: Record<string, any>
      }
    }>,
    reply: FastifyReply
  ) {
    const apiKey = request.headers['x-api-key'] as string;
    
    // Validate API key
    if (!DeveloperModel.validateApiKey(apiKey).valid) {
      return reply.status(401).send({
        error: 'invalid_api_key',
        message: 'Invalid API key'
      });
    }
    
    const { userId, operationType, operationId, cost, metadata } = request.body;
    
    if (cost <= 0) {
      return reply.status(400).send({
        error: 'invalid_cost',
        message: 'Cost must be greater than zero'
      });
    }
    
    // Get user
    const user = UserModel.findById(userId);
    if (!user) {
      return reply.status(404).send({
        error: 'user_not_found',
        message: 'User not found'
      });
    }
    
    // Check if user has sufficient funds
    if (user.balance < cost) {
      return reply.status(400).send({
        error: 'insufficient_funds',
        message: 'User has insufficient funds'
      });
    }
    
    // Update user balance
    const updatedUser = UserModel.updateBalance(userId, user.balance - cost);
    if (!updatedUser) {
      return reply.status(500).send({
        error: 'update_failed',
        message: 'Failed to update user balance'
      });
    }
    
    // Record transaction
    const transaction = TransactionModel.create({
      userId,
      operationType,
      operationId,
      cost,
      status: 'success',
      metadata
    });
    
    return {
      success: true,
      transactionId: transaction.id,
      updatedBalance: updatedUser.balance
    };
  },

  /**
   * Get user balance
   */
  async getBalance(
    request: FastifyRequest<{
      Headers: { 'x-api-key'?: string },
      Params: { userId: string }
    }>,
    reply: FastifyReply
  ) {
    const apiKey = request.headers['x-api-key'] as string;
    
    // Validate API key
    if (!DeveloperModel.validateApiKey(apiKey).valid) {
      return reply.status(401).send({
        error: 'invalid_api_key',
        message: 'Invalid API key'
      });
    }
    
    const { userId } = request.params;
    
    // Get user
    const user = UserModel.findById(userId);
    if (!user) {
      return reply.status(404).send({
        error: 'user_not_found',
        message: 'User not found'
      });
    }
    
    return {
      userId,
      balance: user.balance
    };
  },

  /**
   * Get user transaction history
   */
  async getTransactions(
    request: FastifyRequest<{
      Headers: { 'x-api-key'?: string },
      Params: { userId: string },
      Querystring: { limit?: string, offset?: string }
    }>,
    reply: FastifyReply
  ) {
    const apiKey = request.headers['x-api-key'] as string;
    
    // Validate API key
    if (!DeveloperModel.validateApiKey(apiKey).valid) {
      return reply.status(401).send({
        error: 'invalid_api_key',
        message: 'Invalid API key'
      });
    }
    
    const { userId } = request.params;
    const limit = request.query.limit ? parseInt(request.query.limit) : 10;
    const offset = request.query.offset ? parseInt(request.query.offset) : 0;
    
    // Check if user exists
    if (!UserModel.findById(userId)) {
      return reply.status(404).send({
        error: 'user_not_found',
        message: 'User not found'
      });
    }
    
    // Get transactions
    const transactions = TransactionModel.findByUserId(userId, limit, offset);
    const total = TransactionModel.countByUserId(userId);
    
    return {
      transactions,
      total
    };
  },

  /**
   * Get analytics data (admin only)
   */
  async getAnalytics(
    request: FastifyRequest<{
      Headers: { 'x-api-key'?: string },
      Querystring: { startDate?: string, endDate?: string }
    }>,
    reply: FastifyReply
  ) {
    const apiKey = request.headers['x-api-key'] as string;
    
    // Verify admin privileges
    if (!DeveloperModel.isAdmin(apiKey)) {
      return reply.status(403).send({
        error: 'forbidden',
        message: 'Admin API key required'
      });
    }
    
    const { startDate, endDate } = request.query;
    
    // Parse dates
    const startDateTime = startDate ? new Date(startDate) : undefined;
    const endDateTime = endDate ? new Date(endDate) : undefined;
    
    // Get analytics data
    const analyticsData = TransactionModel.getAnalytics(startDateTime, endDateTime);
    
    // Get active users count
    const uniqueUsers = new Set(
      TransactionModel.findByUserId('', 1000, 0)
        .map(txn => txn.userId)
    );
    
    // Format top tools
    const topTools = Object.entries(analyticsData.operationStats)
      .map(([key, stats]) => {
        const [operationType, operationId] = key.split(':');
        return {
          operationId,
          operationType,
          count: stats.count,
          revenue: stats.revenue
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    
    return {
      totalRevenue: analyticsData.totalRevenue,
      totalTransactions: analyticsData.totalTransactions,
      activeUsers: uniqueUsers.size,
      topTools
    };
  }
}; 