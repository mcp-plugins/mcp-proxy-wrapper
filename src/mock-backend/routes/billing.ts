import { FastifyInstance } from 'fastify';

// Mock user balances
const userBalances: Record<string, {
  balance: number;
  currency: string;
  lastUpdated: string;
}> = {
  'user_123456': {
    balance: 10.00,
    currency: 'USD',
    lastUpdated: new Date().toISOString()
  },
  'user_789012': {
    balance: 25.75,
    currency: 'USD',
    lastUpdated: new Date().toISOString()
  },
  'user_345678': {
    balance: 0.50,
    currency: 'USD',
    lastUpdated: new Date().toISOString()
  },
  'low-funds-user': {
    balance: 0.02,
    currency: 'USD',
    lastUpdated: new Date().toISOString()
  }
};

// Mock operation costs
const operationCosts: Record<string, Record<string, number>> = {
  'tool': {
    'default': 0.05,
    'expensive_tool': 0.10,
    'premium_tool': 0.20
  },
  'resource': {
    'default': 0.02,
    'large_resource': 0.05
  },
  'prompt': {
    'default': 0.10,
    'complex_prompt': 0.15
  }
};

// Mock usage history
const usageHistory: Record<string, Array<{
  transactionId: string;
  timestamp: string;
  operationType: string;
  operationId: string;
  cost: number;
  metadata?: Record<string, any>;
}>> = {};

// Transaction counter for generating transaction IDs
let transactionCounter = 1000;

export function registerBillingRoutes(server: FastifyInstance) {
  // 1. Check User Funds
  server.post('/billing/check-funds', async (request, reply) => {
    const body = request.body as {
      userId: string;
      operationType: 'tool' | 'resource' | 'prompt';
      operationId: string;
      estimatedCost?: number;
    };
    
    if (!body.userId || !body.operationType || !body.operationId) {
      return reply.code(400).send({
        error: 'invalid_request',
        message: 'UserId, operationType, and operationId are required'
      });
    }
    
    // Check if user exists
    const userBalance = userBalances[body.userId];
    if (!userBalance) {
      return reply.code(404).send({
        error: 'user_not_found',
        message: 'User with the provided ID could not be found'
      });
    }
    
    // Calculate operation cost
    const operationCost = body.estimatedCost || 
      operationCosts[body.operationType][body.operationId] ||
      operationCosts[body.operationType].default;
    
    // Check if user has sufficient funds
    const sufficientFunds = userBalance.balance >= operationCost;
    
    if (sufficientFunds) {
      return reply.code(200).send({
        sufficientFunds: true,
        balance: userBalance.balance,
        operationCost,
        estimatedRemainingOperations: Math.floor(userBalance.balance / operationCost)
      });
    } else {
      return reply.code(402).send({
        sufficientFunds: false,
        balance: userBalance.balance,
        operationCost,
        error: 'insufficient_funds',
        message: 'User has insufficient funds for this operation'
      });
    }
  });

  // 2. Process Charge
  server.post('/billing/process-charge', async (request, reply) => {
    const body = request.body as {
      userId: string;
      operationType: 'tool' | 'resource' | 'prompt';
      operationId: string;
      cost: number;
      metadata?: Record<string, any>;
    };
    
    if (!body.userId || !body.operationType || !body.operationId) {
      return reply.code(400).send({
        success: false,
        error: 'invalid_request',
        message: 'UserId, operationType, and operationId are required'
      });
    }
    
    if (body.cost <= 0) {
      return reply.code(400).send({
        success: false,
        error: 'invalid_cost',
        message: 'Cost must be greater than zero'
      });
    }
    
    // Check if user exists
    const userBalance = userBalances[body.userId];
    if (!userBalance) {
      return reply.code(404).send({
        success: false,
        error: 'user_not_found',
        message: 'User with the provided ID could not be found'
      });
    }
    
    // Check if user has sufficient funds
    if (userBalance.balance < body.cost) {
      return reply.code(402).send({
        success: false,
        error: 'insufficient_funds',
        message: 'User has insufficient funds to process this charge'
      });
    }
    
    // Process the charge
    userBalance.balance -= body.cost;
    userBalance.lastUpdated = new Date().toISOString();
    
    // Create transaction record
    const transactionId = `txn_${transactionCounter++}`;
    const timestamp = new Date().toISOString();
    
    const transaction = {
      transactionId,
      timestamp,
      operationType: body.operationType,
      operationId: body.operationId,
      cost: body.cost,
      metadata: body.metadata
    };
    
    // Add to user's usage history
    if (!usageHistory[body.userId]) {
      usageHistory[body.userId] = [];
    }
    usageHistory[body.userId].push(transaction);
    
    return reply.code(200).send({
      success: true,
      transactionId,
      updatedBalance: userBalance.balance,
      receipt: {
        timestamp,
        amount: body.cost,
        description: `Charge for ${body.operationType}: ${body.operationId}`
      }
    });
  });

  // 3. Get User Balance
  server.get('/billing/balance/:userId', async (request, reply) => {
    const { userId } = request.params as { userId: string };
    
    // Check if user exists
    const userBalance = userBalances[userId];
    if (!userBalance) {
      return reply.code(404).send({
        error: 'user_not_found',
        message: 'User with the provided ID could not be found'
      });
    }
    
    return reply.code(200).send({
      userId,
      balance: userBalance.balance,
      currency: userBalance.currency,
      lastUpdated: userBalance.lastUpdated
    });
  });

  // 4. Get Usage History
  server.get('/billing/usage/:userId', async (request, reply) => {
    const { userId } = request.params as { userId: string };
    const query = request.query as {
      startDate?: string;
      endDate?: string;
      limit?: string;
      offset?: string;
    };
    
    // Check if user exists
    if (!userBalances[userId]) {
      return reply.code(404).send({
        error: 'user_not_found',
        message: 'User with the provided ID could not be found'
      });
    }
    
    // Default values for pagination
    const limit = query.limit ? parseInt(query.limit, 10) : 50;
    const offset = query.offset ? parseInt(query.offset, 10) : 0;
    
    // Get user's usage history
    const userUsage = usageHistory[userId] || [];
    
    // Filter by date if provided
    let filteredUsage = userUsage;
    if (query.startDate || query.endDate) {
      const startDate = query.startDate ? new Date(query.startDate).getTime() : 0;
      const endDate = query.endDate ? new Date(query.endDate).getTime() : Date.now();
      
      filteredUsage = userUsage.filter(item => {
        const itemDate = new Date(item.timestamp).getTime();
        return itemDate >= startDate && itemDate <= endDate;
      });
    }
    
    // Apply pagination
    const paginatedUsage = filteredUsage.slice(offset, offset + limit);
    
    return reply.code(200).send({
      userId,
      totalRecords: filteredUsage.length,
      returnedRecords: paginatedUsage.length,
      usage: paginatedUsage
    });
  });

  // 5. Get Developer Analytics (for admin only)
  server.get('/developer/analytics', async (request, reply) => {
    const apiKey = request.headers['x-api-key'] as string;
    
    // Only admin API key can access analytics
    if (apiKey !== 'admin-api-key') {
      return reply.code(403).send({
        error: 'insufficient_permissions',
        message: 'Your API key does not have permission to access analytics'
      });
    }
    
    // Calculate totals
    const totalUsers = Object.keys(userBalances).length;
    let totalOperations = 0;
    let totalRevenue = 0;
    
    Object.values(usageHistory).forEach(userHistory => {
      totalOperations += userHistory.length;
      userHistory.forEach(transaction => {
        totalRevenue += transaction.cost;
      });
    });
    
    // Mock analytics data by day
    const analytics = [
      {
        period: '2023-12-15',
        operations: {
          total: 1250,
          byType: {
            tool: 850,
            resource: 300,
            prompt: 100
          }
        },
        revenue: 62.50,
        activeUsers: 120
      },
      {
        period: '2023-12-16',
        operations: {
          total: 1500,
          byType: {
            tool: 900,
            resource: 400,
            prompt: 200
          }
        },
        revenue: 75.00,
        activeUsers: 150
      }
    ];
    
    return reply.code(200).send({
      totalUsers,
      totalOperations,
      totalRevenue,
      analytics
    });
  });

  // 6. Get Developer Settings
  server.get('/developer/settings', async (request, reply) => {
    const apiKey = request.headers['x-api-key'] as string;
    
    // Mock developer settings based on API key
    const developerSettings: Record<string, any> = {
      'valid-api-key': {
        developerId: 'dev_123456',
        pricing: {
          tool: 0.05,
          resource: 0.02,
          prompt: 0.10
        },
        webhooks: {
          lowBalanceAlert: 'https://example.com/webhooks/low-balance',
          chargeProcessed: 'https://example.com/webhooks/charge'
        },
        notificationSettings: {
          lowBalanceThreshold: 5.00,
          dailyUsageSummary: true,
          notifyOnError: true
        }
      },
      'test-api-key': {
        developerId: 'dev_test123',
        pricing: {
          tool: 0.03,
          resource: 0.01,
          prompt: 0.05
        },
        webhooks: {},
        notificationSettings: {
          lowBalanceThreshold: 1.00,
          dailyUsageSummary: false,
          notifyOnError: false
        }
      },
      'admin-api-key': {
        developerId: 'dev_admin789',
        pricing: {
          tool: 0.10,
          resource: 0.05,
          prompt: 0.20
        },
        webhooks: {
          lowBalanceAlert: 'https://admin.example.com/webhooks/low-balance',
          chargeProcessed: 'https://admin.example.com/webhooks/charge'
        },
        notificationSettings: {
          lowBalanceThreshold: 10.00,
          dailyUsageSummary: true,
          notifyOnError: true
        }
      }
    };
    
    const settings = developerSettings[apiKey];
    if (!settings) {
      return reply.code(404).send({
        error: 'developer_not_found',
        message: 'Developer with the provided API key could not be found'
      });
    }
    
    return reply.code(200).send(settings);
  });

  // 7. Update Developer Settings
  server.put('/developer/settings', async (request, reply) => {
    const apiKey = request.headers['x-api-key'] as string;
    const body = request.body as {
      pricing?: {
        tool?: number;
        resource?: number;
        prompt?: number;
      };
      webhooks?: Record<string, string>;
      notificationSettings?: {
        lowBalanceThreshold?: number;
        dailyUsageSummary?: boolean;
        notifyOnError?: boolean;
      };
    };
    
    // Mock developer settings based on API key
    const developerSettings: Record<string, any> = {
      'valid-api-key': {
        developerId: 'dev_123456',
        pricing: {
          tool: 0.05,
          resource: 0.02,
          prompt: 0.10
        },
        webhooks: {
          lowBalanceAlert: 'https://example.com/webhooks/low-balance',
          chargeProcessed: 'https://example.com/webhooks/charge'
        },
        notificationSettings: {
          lowBalanceThreshold: 5.00,
          dailyUsageSummary: true,
          notifyOnError: true
        }
      },
      'test-api-key': {
        developerId: 'dev_test123',
        pricing: {
          tool: 0.03,
          resource: 0.01,
          prompt: 0.05
        },
        webhooks: {},
        notificationSettings: {
          lowBalanceThreshold: 1.00,
          dailyUsageSummary: false,
          notifyOnError: false
        }
      },
      'admin-api-key': {
        developerId: 'dev_admin789',
        pricing: {
          tool: 0.10,
          resource: 0.05,
          prompt: 0.20
        },
        webhooks: {
          lowBalanceAlert: 'https://admin.example.com/webhooks/low-balance',
          chargeProcessed: 'https://admin.example.com/webhooks/charge'
        },
        notificationSettings: {
          lowBalanceThreshold: 10.00,
          dailyUsageSummary: true,
          notifyOnError: true
        }
      }
    };
    
    const settings = developerSettings[apiKey];
    if (!settings) {
      return reply.code(404).send({
        error: 'developer_not_found',
        message: 'Developer with the provided API key could not be found'
      });
    }
    
    // Validate pricing values
    if (body.pricing) {
      for (const [key, value] of Object.entries(body.pricing)) {
        if (value !== undefined && value <= 0) {
          return reply.code(400).send({
            error: 'invalid_pricing',
            message: 'Pricing values must be greater than zero'
          });
        }
      }
      
      // Update pricing
      settings.pricing = {
        ...settings.pricing,
        ...body.pricing
      };
    }
    
    // Update webhooks
    if (body.webhooks) {
      settings.webhooks = {
        ...settings.webhooks,
        ...body.webhooks
      };
    }
    
    // Update notification settings
    if (body.notificationSettings) {
      settings.notificationSettings = {
        ...settings.notificationSettings,
        ...body.notificationSettings
      };
    }
    
    return reply.code(200).send({
      success: true,
      message: 'Settings updated successfully',
      updatedSettings: settings
    });
  });
} 