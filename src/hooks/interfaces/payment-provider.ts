/**
 * @file Payment Provider Interface
 * @version 1.0.0
 * 
 * Defines the contract for payment provider implementations.
 * Custom payment services must implement this interface.
 */

/**
 * Payment Metadata Interface
 * Additional information for payment processing
 */
export interface PaymentMetadata {
  /** Type of resource being accessed */
  resourceType: 'tool' | 'prompt' | 'resource';
  
  /** Identifier of the resource being accessed */
  resourceId: string;
  
  /** Type of operation being performed */
  operationType: string;
  
  /** Number of tokens processed (if applicable) */
  tokenCount?: number;
  
  /** Processing time in milliseconds (if applicable) */
  processingTime?: number;
  
  /** Any additional custom data */
  customData?: Record<string, unknown>;
}

/**
 * User Balance Interface
 * Detailed information about a user's balance
 */
export interface UserBalance {
  /** Available balance in smallest currency unit (e.g., cents) */
  available: number;
  
  /** Pending balance in smallest currency unit */
  pending: number;
  
  /** Currency code (e.g., USD) */
  currency: string;
  
  /** When the balance was last updated (ISO 8601 date string) */
  lastUpdated: string;
}

/**
 * Payment Provider Interface
 * Defines the required methods for payment processing
 */
export interface IPaymentProvider {
  /**
   * Verifies if a user has sufficient funds for an operation
   * @param userId - Unique identifier for the user
   * @param amount - Amount to verify in smallest currency unit
   * @param metadata - Additional information about the charge
   * @returns Promise resolving to boolean indicating if user has sufficient funds
   */
  verifyFunds(userId: string, amount: number, metadata?: PaymentMetadata): Promise<boolean>;

  /**
   * Processes a charge for a completed operation
   * @param userId - Unique identifier for the user
   * @param amount - Amount to charge in smallest currency unit
   * @param metadata - Additional information about the charge
   * @returns Promise resolving to a unique transaction ID
   */
  processCharge(userId: string, amount: number, metadata: PaymentMetadata): Promise<string>;

  /**
   * Retrieves the current balance for a user
   * @param userId - Unique identifier for the user
   * @returns Promise resolving to user balance information
   */
  getBalance(userId: string): Promise<UserBalance>;

  /**
   * Verifies the validity of an API key
   * @param apiKey - The API key to verify
   * @returns Promise resolving to boolean indicating if API key is valid
   */
  verifyApiKey(apiKey: string): Promise<boolean>;
  
  /**
   * Preauthorizes a payment amount (optional)
   * @param userId - Unique identifier for the user
   * @param amount - Amount to preauthorize in smallest currency unit
   * @param metadata - Additional information about the preauth
   * @returns Promise resolving to a preauthorization ID
   */
  preauthorize?(userId: string, amount: number, metadata: PaymentMetadata): Promise<string>;
  
  /**
   * Captures a preauthorized payment (optional)
   * @param userId - Unique identifier for the user
   * @param preauthId - Preauthorization ID from preauthorize call
   * @param finalAmount - Final amount to charge (may be less than preauthorized)
   * @param metadata - Additional information about the charge
   * @returns Promise resolving to a unique transaction ID
   */
  capturePreauthorized?(userId: string, preauthId: string, finalAmount: number, metadata: PaymentMetadata): Promise<string>;
  
  /**
   * Cancels a preauthorized payment (optional)
   * @param userId - Unique identifier for the user
   * @param preauthId - Preauthorization ID to cancel
   * @returns Promise resolving to boolean indicating success
   */
  cancelPreauthorization?(userId: string, preauthId: string): Promise<boolean>;
}

/**
 * Payment Provider Options Interface
 * Configuration options for payment providers
 */
export interface PaymentProviderOptions {
  /** API key for the payment service */
  apiKey: string;
  
  /** Base URL for the payment service (if applicable) */
  basePaymentUrl?: string;
  
  /** Optional custom configuration specific to the provider implementation */
  providerConfig?: Record<string, unknown>;
}
