/**
 * @file StorageProvider Interface
 * @version 1.0.0
 * @status STABLE - DO NOT MODIFY WITHOUT TESTS
 * @lastModified 2024-03-14
 * 
 * Defines the contract for storage providers in the MCP Payment Wrapper.
 * 
 * IMPORTANT:
 * - Any modifications must be accompanied by corresponding test updates
 * - All implementations must handle concurrent access safely
 * - All implementations must ensure data persistence
 * 
 * Functionality:
 * - Transaction storage
 * - Transaction retrieval
 * - Transaction listing
 */

export interface TransactionRecord {
  transactionId: string;
  userId: string;
  amount: number;
  currency: string;
  status: 'success' | 'failed' | 'refunded';
  metadata: {
    operationType: 'tool' | 'prompt' | 'resource';
    operationId: string;
    description: string;
  };
  timestamp: string;
  receiptUrl?: string;
}

export interface TransactionList {
  transactions: TransactionRecord[];
  total: number;
  hasMore: boolean;
}

export interface ListTransactionsOptions {
  limit?: number;
  offset?: number;
  status?: 'success' | 'failed' | 'refunded';
}

export interface StorageProvider {
  /**
   * Stores a payment transaction record
   * @param transaction - Transaction record to store
   * @returns Promise resolving to storage result
   * @throws {Error} If storage fails
   */
  storeTransaction(transaction: TransactionRecord): Promise<{
    stored: boolean;
    error?: string;
  }>;

  /**
   * Retrieves a specific transaction record
   * @param transactionId - ID of transaction to retrieve
   * @returns Promise resolving to transaction record
   * @throws {Error} If retrieval fails or transaction not found
   */
  getTransaction(transactionId: string): Promise<TransactionRecord>;

  /**
   * Lists transactions for a specific user
   * @param userId - ID of user to get transactions for
   * @param options - Optional filtering and pagination
   * @returns Promise resolving to list of transactions
   * @throws {Error} If listing fails
   */
  listUserTransactions(
    userId: string,
    options?: ListTransactionsOptions
  ): Promise<TransactionList>;
} 