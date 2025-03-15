/**
 * @file Pricing Strategy Interface
 * @version 1.0.0
 * 
 * Defines the contract for pricing strategy implementations.
 * Custom pricing models must implement this interface.
 */

import { PaymentMetadata } from './payment-provider.js';

/**
 * Pricing Options Interface
 * Input parameters for price calculation
 */
export interface PricingOptions {
  /** Identifier of the resource being accessed */
  resourceId: string;
  
  /** Type of resource being accessed */
  resourceType: 'tool' | 'prompt' | 'resource';
  
  /** Unique identifier for the user */
  userId: string;
  
  /** Type of operation being performed */
  operationType: string;
  
  /** Number of tokens processed (if applicable) */
  tokenCount?: number;
  
  /** Processing time in milliseconds (if applicable) */
  processingTime?: number;
  
  /** Any additional metadata about the operation */
  metadata?: Record<string, unknown>;
}

/**
 * Pricing Result Interface
 * Output of price calculation
 */
export interface PricingResult {
  /** Total amount to charge in smallest currency unit */
  amount: number;
  
  /** Currency code (e.g., USD) */
  currency: string;
  
  /** Optional breakdown of the pricing calculation */
  breakdown?: {
    /** Base amount before adjustments */
    baseAmount: number;
    
    /** List of discounts applied */
    discounts: { reason: string; amount: number }[];
    
    /** List of fees applied */
    fees: { reason: string; amount: number }[];
  };
}

/**
 * Resource Pricing Interface
 * Pricing information for a specific resource
 */
export interface ResourcePricing {
  /** Base price in smallest currency unit */
  basePrice: number;
  
  /** Currency code (e.g., USD) */
  currency: string;
  
  /** Pricing model used for this resource */
  pricingModel: 'flat' | 'per-token' | 'subscription' | 'custom';
  
  /** Optional additional details about pricing */
  pricingDetails?: Record<string, unknown>;
}

/**
 * Pricing Strategy Interface
 * Defines methods for calculating prices
 */
export interface IPricingStrategy {
  /**
   * Calculate the price for an operation
   * @param options Options containing resource and operation details
   * @returns Promise resolving to price calculation result
   */
  calculatePrice(options: PricingOptions): Promise<PricingResult>;
  
  /**
   * Get pricing information for a resource
   * @param resourceId Identifier of the resource
   * @param resourceType Type of the resource
   * @returns Promise resolving to resource pricing information
   */
  getPricingInfo(resourceId: string, resourceType: 'tool' | 'prompt' | 'resource'): Promise<ResourcePricing>;
  
  /**
   * Check if this pricing strategy applies to a specific resource
   * @param resourceId Identifier of the resource
   * @param resourceType Type of the resource
   * @returns Promise resolving to boolean indicating if strategy applies
   */
  isApplicable(resourceId: string, resourceType: 'tool' | 'prompt' | 'resource'): Promise<boolean>;
}

/**
 * Pricing Strategy Options Interface
 * Configuration options for pricing strategies
 */
export interface PricingStrategyOptions {
  /** Default base price in smallest currency unit */
  defaultBasePrice?: number;
  
  /** Currency code (e.g., USD) */
  currency?: string;
  
  /** Default pricing model */
  defaultPricingModel?: 'flat' | 'per-token' | 'subscription' | 'custom';
  
  /** Optional custom configuration specific to the strategy implementation */
  strategyConfig?: Record<string, unknown>;
}
