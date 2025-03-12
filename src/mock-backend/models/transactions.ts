/**
 * Transaction data model for the mock backend
 */

export interface Transaction {
  id: string;
  userId: string;
  operationType: 'tool' | 'prompt' | 'resource';
  operationId: string;
  cost: number;
  timestamp: string;
  status: 'success' | 'failed' | 'refunded';
  metadata?: Record<string, any>;
}

// In-memory database for transactions
const transactions: Transaction[] = [];

let transactionIdCounter = 1;

// Transaction data access methods
export const TransactionModel = {
  /**
   * Record a new transaction
   */
  create(transactionData: Omit<Transaction, 'id' | 'timestamp'>): Transaction {
    const transaction: Transaction = {
      ...transactionData,
      id: `txn_${Date.now()}_${transactionIdCounter++}`,
      timestamp: new Date().toISOString()
    };
    
    transactions.push(transaction);
    return transaction;
  },

  /**
   * Get transactions for a user
   */
  findByUserId(userId: string, limit = 10, offset = 0): Transaction[] {
    return transactions
      .filter(txn => txn.userId === userId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(offset, offset + limit);
  },

  /**
   * Get transaction count for a user
   */
  countByUserId(userId: string): number {
    return transactions.filter(txn => txn.userId === userId).length;
  },

  /**
   * Get total spending for a user
   */
  getTotalSpendingByUserId(userId: string): number {
    return transactions
      .filter(txn => txn.userId === userId && txn.status === 'success')
      .reduce((sum, txn) => sum + txn.cost, 0);
  },

  /**
   * Get analytics data
   */
  getAnalytics(startDate?: Date, endDate?: Date): {
    totalRevenue: number;
    totalTransactions: number;
    operationStats: Record<string, { count: number, revenue: number }>;
  } {
    let filteredTransactions = [...transactions];
    
    if (startDate) {
      filteredTransactions = filteredTransactions.filter(
        txn => new Date(txn.timestamp) >= startDate
      );
    }
    
    if (endDate) {
      filteredTransactions = filteredTransactions.filter(
        txn => new Date(txn.timestamp) <= endDate
      );
    }
    
    const totalRevenue = filteredTransactions
      .filter(txn => txn.status === 'success')
      .reduce((sum, txn) => sum + txn.cost, 0);
    
    const operationStats: Record<string, { count: number, revenue: number }> = {};
    
    filteredTransactions.forEach(txn => {
      const key = `${txn.operationType}:${txn.operationId}`;
      if (!operationStats[key]) {
        operationStats[key] = { count: 0, revenue: 0 };
      }
      operationStats[key].count++;
      if (txn.status === 'success') {
        operationStats[key].revenue += txn.cost;
      }
    });
    
    return {
      totalRevenue,
      totalTransactions: filteredTransactions.length,
      operationStats
    };
  }
}; 