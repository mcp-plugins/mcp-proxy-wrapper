/**
 * @file PaymentProvider Interface
 * @version 1.0.0
 * @status STABLE - DO NOT MODIFY WITHOUT TESTS
 * @lastModified 2024-03-19
 * 
 * Defines the contract for payment provider implementations.
 * External payment services must implement this interface.
 * 
 * IMPORTANT:
 * - All implementations must handle their own error cases
 * - All methods must be idempotent where possible
 * - All monetary values should be in smallest currency unit (e.g., cents)
 */

export interface PaymentProvider {
  /**
   * Verifies if a user has sufficient funds for an operation
   * @param userId - Unique identifier for the user
   * @param amount - Amount to verify in smallest currency unit
   * @returns Promise resolving to boolean indicating if user has sufficient funds
   */
  verifyFunds(userId: string, amount: number): Promise<boolean>;

  /**
   * Processes a charge for a completed operation
   * @param userId - Unique identifier for the user
   * @param amount - Amount to charge in smallest currency unit
   * @param metadata - Additional information about the charge
   * @returns Promise resolving to a unique transaction ID
   */
  processCharge(userId: string, amount: number, metadata: Record<string, unknown>): Promise<string>;

  /**
   * Retrieves the current balance for a user
   * @param userId - Unique identifier for the user
   * @returns Promise resolving to current balance in smallest currency unit
   */
  getBalance(userId: string): Promise<number>;

  /**
   * Verifies the validity of an API key
   * @param apiKey - The API key to verify
   * @returns Promise resolving to boolean indicating if API key is valid
   */
  verifyApiKey(apiKey: string): Promise<boolean>;
} 