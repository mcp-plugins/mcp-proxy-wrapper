/**
 * @file Default Payment Provider Implementation
 * @version 1.0.0
 * 
 * Default implementation of the IPaymentProvider interface
 * using simplified mock payment logic for backward compatibility
 */

import { 
  IPaymentProvider, 
  PaymentMetadata, 
  UserBalance,
  PaymentProviderOptions
} from '../interfaces/payment-provider.js';
import { createLogger } from '../../utils/logger.js';

/**
 * Default Payment Provider
 * Implements a mock payment service compatible with the existing system
 */
export class DefaultPaymentProvider implements IPaymentProvider {
  private apiKey: string;
  private logger: ReturnType<typeof createLogger>;
  private mockBalances: Map<string, number> = new Map();
  
  /**
   * Creates a new DefaultPaymentProvider instance
   * @param options Configuration options
   */
  constructor(options: PaymentProviderOptions) {
    this.apiKey = options.apiKey;
    
    // Set up logging
    this.logger = createLogger({
      level: options.providerConfig?.debugMode ? 'debug' : 'info'
    });
    
    this.logger.debug('DefaultPaymentProvider initialized');
    
    // Initialize some mock balances for testing
    this.mockBalances.set('default', 10000); // $100.00
    this.mockBalances.set('test-user', 5000); // $50.00
    this.mockBalances.set('premium-user', 100000); // $1000.00
  }
  
  /**
   * Verifies if a user has sufficient funds for an operation
   * @param userId - Unique identifier for the user
   * @param amount - Amount to verify in smallest currency unit
   * @param metadata - Additional information about the charge
   * @returns Promise resolving to boolean indicating if user has sufficient funds
   */
  async verifyFunds(userId: string, amount: number, metadata?: PaymentMetadata): Promise<boolean> {
    this.logger.debug('Verifying funds', { userId, amount, metadata });
    
    // For testing: special handling for test override
    if (userId === 'test-override-always-has-funds') {
      return true;
    }
    
    if (userId === 'test-override-never-has-funds') {
      return false;
    }
    
    // Get user balance or default if not found
    const balance = this.mockBalances.get(userId) || this.mockBalances.get('default') || 0;
    
    // Check if balance is sufficient
    const hasSufficientFunds = balance >= amount;
    
    this.logger.debug('Funds verification result', { 
      userId, 
      amount, 
      balance, 
      hasSufficientFunds 
    });
    
    return hasSufficientFunds;
  }
  
  /**
   * Processes a charge for a completed operation
   * @param userId - Unique identifier for the user
   * @param amount - Amount to charge in smallest currency unit
   * @param metadata - Additional information about the charge
   * @returns Promise resolving to a unique transaction ID
   */
  async processCharge(userId: string, amount: number, metadata: PaymentMetadata): Promise<string> {
    this.logger.debug('Processing charge', { userId, amount, metadata });
    
    // Get current balance
    const currentBalance = this.mockBalances.get(userId) || this.mockBalances.get('default') || 0;
    
    // Check if balance is sufficient
    if (currentBalance < amount) {
      throw new Error(`Insufficient funds: user ${userId} has ${currentBalance} but needs ${amount}`);
    }
    
    // Update balance
    this.mockBalances.set(userId, currentBalance - amount);
    
    // Generate a transaction ID
    const transactionId = `txn_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    
    this.logger.debug('Charge processed', { 
      userId, 
      amount, 
      newBalance: currentBalance - amount,
      transactionId
    });
    
    return transactionId;
  }
  
  /**
   * Retrieves the current balance for a user
   * @param userId - Unique identifier for the user
   * @returns Promise resolving to user balance information
   */
  async getBalance(userId: string): Promise<UserBalance> {
    this.logger.debug('Getting balance', { userId });
    
    // Get balance or default if not found
    const balance = this.mockBalances.get(userId) || this.mockBalances.get('default') || 0;
    
    return {
      available: balance,
      pending: 0,
      currency: 'USD',
      lastUpdated: new Date().toISOString()
    };
  }
  
  /**
   * Verifies the validity of an API key
   * @param apiKey - The API key to verify
   * @returns Promise resolving to boolean indicating if API key is valid
   */
  async verifyApiKey(apiKey: string): Promise<boolean> {
    this.logger.debug('Verifying API key');
    
    // Check if API key matches the configured one
    const isValid = apiKey === this.apiKey;
    
    return isValid;
  }
  
  /**
   * Preauthorizes a payment amount
   * @param userId - Unique identifier for the user
   * @param amount - Amount to preauthorize in smallest currency unit
   * @param metadata - Additional information about the preauth
   * @returns Promise resolving to a preauthorization ID
   */
  async preauthorize(userId: string, amount: number, metadata: PaymentMetadata): Promise<string> {
    this.logger.debug('Preauthorizing payment', { userId, amount, metadata });
    
    // Check if user has sufficient funds
    const hasFunds = await this.verifyFunds(userId, amount);
    
    if (!hasFunds) {
      throw new Error(`Insufficient funds for preauthorization: user ${userId} for amount ${amount}`);
    }
    
    // Generate a preauth ID
    const preauthId = `preauth_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    
    this.logger.debug('Payment preauthorized', { 
      userId, 
      amount, 
      preauthId
    });
    
    return preauthId;
  }
  
  /**
   * Captures a preauthorized payment
   * @param userId - Unique identifier for the user
   * @param preauthId - Preauthorization ID from preauthorize call
   * @param finalAmount - Final amount to charge (may be less than preauthorized)
   * @param metadata - Additional information about the charge
   * @returns Promise resolving to a unique transaction ID
   */
  async capturePreauthorized(
    userId: string, 
    preauthId: string, 
    finalAmount: number, 
    metadata: PaymentMetadata
  ): Promise<string> {
    this.logger.debug('Capturing preauthorized payment', { 
      userId, 
      preauthId,
      finalAmount, 
      metadata 
    });
    
    // In a real implementation, we would verify the preauth ID and its validity
    // For this mock implementation, we'll just process the charge directly
    return this.processCharge(userId, finalAmount, metadata);
  }
  
  /**
   * Cancels a preauthorized payment
   * @param userId - Unique identifier for the user
   * @param preauthId - Preauthorization ID to cancel
   * @returns Promise resolving to boolean indicating success
   */
  async cancelPreauthorization(userId: string, preauthId: string): Promise<boolean> {
    this.logger.debug('Canceling preauthorization', { userId, preauthId });
    
    // In a real implementation, we would verify the preauth ID and cancel it
    // For this mock implementation, we'll just return success
    return true;
  }
}
