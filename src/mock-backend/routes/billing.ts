import { FastifyInstance, FastifyPluginOptions } from 'fastify';
import { BillingController } from '../controllers/billing.js';

// Mock user balances
const USER_BALANCES: Record<string, number> = {
  'user_123456': 100.00,  // Regular user with $100
  'low-funds-user': 0.05, // User with low funds
};

// Mock transaction history
const TRANSACTIONS: Array<{
  id: string;
  userId: string;
  operationType: string;
  operationId: string;
  cost: number;
  timestamp: string;
  metadata?: Record<string, any>;
}> = [];

/**
 * Billing routes
 */
export const billingRoutes = (fastify: FastifyInstance, _options: FastifyPluginOptions, done: () => void) => {
  // Check if user has sufficient funds
  fastify.post('/check-funds', BillingController.checkFunds);
  
  // Process a charge
  fastify.post('/process-charge', BillingController.processCharge);
  
  // Get user balance
  fastify.get('/balance/:userId', BillingController.getBalance);
  
  // Get user transaction history
  fastify.get('/transactions/:userId', BillingController.getTransactions);
  
  // Get analytics data (admin only)
  fastify.get('/analytics', BillingController.getAnalytics);
  
  done();
}; 