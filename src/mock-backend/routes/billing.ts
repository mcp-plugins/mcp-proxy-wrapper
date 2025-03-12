import { FastifyInstance, FastifyPluginOptions } from 'fastify';

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
 * Billing routes plugin for Fastify
 */
export const billingRoutes = (fastify: FastifyInstance, _options: FastifyPluginOptions, done: () => void) => {
  /**
   * Check if user has sufficient funds
   * POST /billing/check-funds
   */
  fastify.post('/check-funds', {
    schema: {
      headers: {
        type: 'object',
        required: ['x-api-key'],
        properties: {
          'x-api-key': { type: 'string' }
        }
      },
      body: {
        type: 'object',
        required: ['userId', 'operationType', 'operationId'],
        properties: {
          userId: { type: 'string' },
          operationType: { type: 'string', enum: ['tool', 'prompt', 'resource'] },
          operationId: { type: 'string' },
          estimatedCost: { type: 'number' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            sufficientFunds: { type: 'boolean' },
            balance: { type: 'number' },
            estimatedCost: { type: 'number' }
          }
        },
        401: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    const apiKey = request.headers['x-api-key'] as string;
    
    // Validate API key (simplified for mock)
    if (apiKey !== 'valid-api-key' && apiKey !== 'admin-api-key') {
      return reply.status(401).send({
        error: 'invalid_api_key',
        message: 'Invalid API key'
      });
    }

    const { userId, operationType, operationId, estimatedCost = 0.01 } = request.body as {
      userId: string;
      operationType: 'tool' | 'prompt' | 'resource';
      operationId: string;
      estimatedCost?: number;
    };

    // Get user balance
    const balance = USER_BALANCES[userId] || 0;
    
    // Special case for low-funds-user
    if (userId === 'low-funds-user') {
      return {
        sufficientFunds: false,
        balance,
        estimatedCost
      };
    }

    // Check if balance is sufficient
    const sufficientFunds = balance >= estimatedCost;

    return {
      sufficientFunds,
      balance,
      estimatedCost
    };
  });

  /**
   * Process a charge
   * POST /billing/process-charge
   */
  fastify.post('/process-charge', {
    schema: {
      headers: {
        type: 'object',
        required: ['x-api-key'],
        properties: {
          'x-api-key': { type: 'string' }
        }
      },
      body: {
        type: 'object',
        required: ['userId', 'operationType', 'operationId', 'cost'],
        properties: {
          userId: { type: 'string' },
          operationType: { type: 'string', enum: ['tool', 'prompt', 'resource'] },
          operationId: { type: 'string' },
          cost: { type: 'number' },
          metadata: { type: 'object' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            transactionId: { type: 'string' },
            updatedBalance: { type: 'number' }
          }
        },
        400: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' }
          }
        },
        401: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    const apiKey = request.headers['x-api-key'] as string;
    
    // Validate API key (simplified for mock)
    if (apiKey !== 'valid-api-key' && apiKey !== 'admin-api-key') {
      return reply.status(401).send({
        error: 'invalid_api_key',
        message: 'Invalid API key'
      });
    }

    const { userId, operationType, operationId, cost, metadata } = request.body as {
      userId: string;
      operationType: 'tool' | 'prompt' | 'resource';
      operationId: string;
      cost: number;
      metadata?: Record<string, any>;
    };

    // Get user balance
    let balance = USER_BALANCES[userId] || 0;
    
    // Check if balance is sufficient
    if (balance < cost) {
      return reply.status(400).send({
        error: 'insufficient_funds',
        message: 'User has insufficient funds'
      });
    }

    // Process the charge
    balance -= cost;
    USER_BALANCES[userId] = balance;
    
    // Record the transaction
    const transactionId = `txn_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const transaction = {
      id: transactionId,
      userId,
      operationType,
      operationId,
      cost,
      timestamp: new Date().toISOString(),
      metadata
    };
    
    TRANSACTIONS.push(transaction);

    return {
      success: true,
      transactionId,
      updatedBalance: balance
    };
  });

  /**
   * Get user balance
   * GET /billing/balance/:userId
   */
  fastify.get('/balance/:userId', {
    schema: {
      headers: {
        type: 'object',
        required: ['x-api-key'],
        properties: {
          'x-api-key': { type: 'string' }
        }
      },
      params: {
        type: 'object',
        required: ['userId'],
        properties: {
          userId: { type: 'string' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            userId: { type: 'string' },
            balance: { type: 'number' }
          }
        },
        401: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    const apiKey = request.headers['x-api-key'] as string;
    
    // Validate API key (simplified for mock)
    if (apiKey !== 'valid-api-key' && apiKey !== 'admin-api-key') {
      return reply.status(401).send({
        error: 'invalid_api_key',
        message: 'Invalid API key'
      });
    }

    const { userId } = request.params as { userId: string };
    const balance = USER_BALANCES[userId] || 0;

    return {
      userId,
      balance
    };
  });

  /**
   * Get user transaction history
   * GET /billing/transactions/:userId
   */
  fastify.get('/transactions/:userId', {
    schema: {
      headers: {
        type: 'object',
        required: ['x-api-key'],
        properties: {
          'x-api-key': { type: 'string' }
        }
      },
      params: {
        type: 'object',
        required: ['userId'],
        properties: {
          userId: { type: 'string' }
        }
      },
      querystring: {
        type: 'object',
        properties: {
          limit: { type: 'integer', default: 10 },
          offset: { type: 'integer', default: 0 }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            transactions: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  operationType: { type: 'string' },
                  operationId: { type: 'string' },
                  cost: { type: 'number' },
                  timestamp: { type: 'string' }
                }
              }
            },
            total: { type: 'integer' }
          }
        },
        401: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    const apiKey = request.headers['x-api-key'] as string;
    
    // Validate API key (simplified for mock)
    if (apiKey !== 'valid-api-key' && apiKey !== 'admin-api-key') {
      return reply.status(401).send({
        error: 'invalid_api_key',
        message: 'Invalid API key'
      });
    }

    const { userId } = request.params as { userId: string };
    const { limit = 10, offset = 0 } = request.query as { limit?: number, offset?: number };
    
    // Filter transactions for this user
    const userTransactions = TRANSACTIONS.filter(txn => txn.userId === userId);
    
    // Apply pagination
    const paginatedTransactions = userTransactions
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(offset, offset + limit);

    return {
      transactions: paginatedTransactions,
      total: userTransactions.length
    };
  });

  /**
   * Get developer analytics
   * GET /billing/developer/analytics
   */
  fastify.get('/developer/analytics', {
    schema: {
      headers: {
        type: 'object',
        required: ['x-api-key'],
        properties: {
          'x-api-key': { type: 'string' }
        }
      },
      querystring: {
        type: 'object',
        properties: {
          startDate: { type: 'string', format: 'date' },
          endDate: { type: 'string', format: 'date' }
        }
      },
      response: {
        200: {
          type: 'object',
          properties: {
            totalRevenue: { type: 'number' },
            totalTransactions: { type: 'integer' },
            activeUsers: { type: 'integer' },
            topTools: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  operationId: { type: 'string' },
                  operationType: { type: 'string' },
                  count: { type: 'integer' },
                  revenue: { type: 'number' }
                }
              }
            }
          }
        },
        401: {
          type: 'object',
          properties: {
            error: { type: 'string' },
            message: { type: 'string' }
          }
        }
      }
    }
  }, async (request, reply) => {
    const apiKey = request.headers['x-api-key'] as string;
    
    // Validate API key (simplified for mock)
    if (apiKey !== 'valid-api-key' && apiKey !== 'admin-api-key') {
      return reply.status(401).send({
        error: 'invalid_api_key',
        message: 'Invalid API key'
      });
    }

    const { startDate, endDate } = request.query as { startDate?: string, endDate?: string };
    
    // Filter transactions by date if provided
    let filteredTransactions = [...TRANSACTIONS];
    if (startDate) {
      const start = new Date(startDate);
      filteredTransactions = filteredTransactions.filter(txn => 
        new Date(txn.timestamp) >= start
      );
    }
    if (endDate) {
      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999); // End of day
      filteredTransactions = filteredTransactions.filter(txn => 
        new Date(txn.timestamp) <= end
      );
    }
    
    // Calculate analytics
    const totalRevenue = filteredTransactions.reduce((sum, txn) => sum + txn.cost, 0);
    const uniqueUsers = new Set(filteredTransactions.map(txn => txn.userId));
    
    // Group by operation
    const operationStats: Record<string, { count: number, revenue: number, type: string }> = {};
    filteredTransactions.forEach(txn => {
      const key = `${txn.operationType}:${txn.operationId}`;
      if (!operationStats[key]) {
        operationStats[key] = { count: 0, revenue: 0, type: txn.operationType };
      }
      operationStats[key].count++;
      operationStats[key].revenue += txn.cost;
    });
    
    // Convert to array and sort by count
    const topTools = Object.entries(operationStats)
      .map(([key, stats]) => {
        const [_, operationId] = key.split(':');
        return {
          operationId,
          operationType: stats.type,
          count: stats.count,
          revenue: stats.revenue
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    return {
      totalRevenue,
      totalTransactions: filteredTransactions.length,
      activeUsers: uniqueUsers.size,
      topTools
    };
  });

  done();
}; 