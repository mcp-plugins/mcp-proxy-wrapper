/**
 * @file Default Pricing Strategy Implementation
 * @version 1.0.0
 * 
 * Default implementation of the IPricingStrategy interface
 * using flat-rate pricing for backward compatibility
 */

import { 
  IPricingStrategy, 
  PricingOptions, 
  PricingResult,
  ResourcePricing,
  PricingStrategyOptions
} from '../interfaces/pricing-strategy';
import { createLogger } from '../../utils/logger';

/**
 * Default Pricing Strategy
 * Implements a simple flat-rate pricing model compatible with the existing system
 */
export class DefaultPricingStrategy implements IPricingStrategy {
  private defaultBasePrice: number;
  private currency: string;
  private defaultPricingModel: 'flat' | 'per-token' | 'subscription' | 'custom';
  private logger: ReturnType<typeof createLogger>;
  private resourcePricing: Map<string, ResourcePricing> = new Map();
  
  /**
   * Creates a new DefaultPricingStrategy instance
   * @param options Configuration options
   */
  constructor(options: PricingStrategyOptions = {}) {
    this.defaultBasePrice = options.defaultBasePrice || 100; // $1.00 by default
    this.currency = options.currency || 'USD';
    this.defaultPricingModel = options.defaultPricingModel || 'flat';
    
    this.logger = createLogger({
      level: options.strategyConfig?.debugMode ? 'debug' : 'info'
    });
    
    this.logger.debug('DefaultPricingStrategy initialized', {
      defaultBasePrice: this.defaultBasePrice,
      currency: this.currency,
      defaultPricingModel: this.defaultPricingModel
    });
    
    // Initialize some example resource pricing
    this.setupDefaultResourcePricing();
  }
  
  /**
   * Set up default pricing for common resource types
   * @private
   */
  private setupDefaultResourcePricing(): void {
    // Set up pricing for some resource types as examples
    
    // Tools - flat rate
    const toolPricing: ResourcePricing = {
      basePrice: this.defaultBasePrice,
      currency: this.currency,
      pricingModel: 'flat'
    };
    
    // Prompts - per token
    const promptPricing: ResourcePricing = {
      basePrice: 1, // $0.01 per token
      currency: this.currency,
      pricingModel: 'per-token',
      pricingDetails: {
        minimumCharge: 10, // $0.10 minimum
      }
    };
    
    // Generic resources - use same base price as tools
    const resourcePricing: ResourcePricing = {
      basePrice: this.defaultBasePrice, // Use the full defaultBasePrice, not half
      currency: this.currency,
      pricingModel: 'flat'
    };
    
    // Set default pricing by resource type
    this.resourcePricing.set('default:tool', toolPricing);
    this.resourcePricing.set('default:prompt', promptPricing);
    this.resourcePricing.set('default:resource', resourcePricing);
  }
  
  /**
   * Calculate the price for an operation
   * @param options Options containing resource and operation details
   * @returns Promise resolving to price calculation result
   */
  async calculatePrice(options: PricingOptions): Promise<PricingResult> {
    this.logger.debug('Calculating price', options);
    
    // Get pricing info for this resource
    const pricingInfo = await this.getPricingInfo(options.resourceId, options.resourceType);
    
    // Initialize the result
    const result: PricingResult = {
      amount: pricingInfo.basePrice,
      currency: pricingInfo.currency,
      breakdown: {
        baseAmount: pricingInfo.basePrice,
        discounts: [],
        fees: []
      }
    };
    
    // Apply pricing model logic
    switch (pricingInfo.pricingModel) {
      case 'flat':
        // Flat rate - just use the base price
        break;
        
      case 'per-token':
        // Per-token pricing - multiply by token count
        if (options.tokenCount) {
          const tokenRate = pricingInfo.basePrice;
          const rawAmount = tokenRate * options.tokenCount;
          
          // Apply minimum charge if specified
          const minimumCharge = (pricingInfo.pricingDetails?.minimumCharge as number) || 0;
          result.amount = Math.max(rawAmount, minimumCharge);
          
          // Update breakdown
          result.breakdown = {
            baseAmount: rawAmount,
            discounts: [],
            fees: []
          };
          
          // If minimum charge was applied, show it as a fee
          if (rawAmount < minimumCharge) {
            result.breakdown.fees.push({
              reason: 'minimum_charge',
              amount: minimumCharge - rawAmount
            });
          }
        }
        break;
        
      case 'subscription':
        // For subscription, we might check if the user has an active subscription
        // For now, just return 0 as the cost is covered by subscription
        result.amount = 0;
        result.breakdown = {
          baseAmount: pricingInfo.basePrice,
          discounts: [{
            reason: 'subscription',
            amount: pricingInfo.basePrice
          }],
          fees: []
        };
        break;
        
      case 'custom':
        // For custom pricing, we'd have specialized logic
        // For now, just use the base price
        break;
    }
    
    this.logger.debug('Price calculation result', result);
    
    return result;
  }
  
  /**
   * Get pricing information for a resource
   * @param resourceId Identifier of the resource
   * @param resourceType Type of the resource
   * @returns Promise resolving to resource pricing information
   */
  async getPricingInfo(
    resourceId: string, 
    resourceType: 'tool' | 'prompt' | 'resource'
  ): Promise<ResourcePricing> {
    this.logger.debug('Getting pricing info', { resourceId, resourceType });
    
    // First check if there's specific pricing for this resource
    const resourceKey = `${resourceType}:${resourceId}`;
    if (this.resourcePricing.has(resourceKey)) {
      return this.resourcePricing.get(resourceKey)!;
    }
    
    // Next, check if there's default pricing for this resource type
    const typeKey = `default:${resourceType}`;
    if (this.resourcePricing.has(typeKey)) {
      return this.resourcePricing.get(typeKey)!;
    }
    
    // If no specific pricing is found, return a default based on the constructor values
    return {
      basePrice: this.defaultBasePrice, // Use the original defaultBasePrice (100)
      currency: this.currency,
      pricingModel: this.defaultPricingModel
    };
  }
  
  /**
   * Check if this pricing strategy applies to a specific resource
   * @param resourceId Identifier of the resource
   * @param resourceType Type of the resource
   * @returns Promise resolving to boolean indicating if strategy applies
   */
  async isApplicable(
    resourceId: string, 
    resourceType: 'tool' | 'prompt' | 'resource'
  ): Promise<boolean> {
    // Default pricing strategy applies to all resources
    return true;
  }
  
  /**
   * Set custom pricing for a specific resource
   * @param resourceId Identifier of the resource
   * @param resourceType Type of the resource
   * @param pricing Pricing information
   */
  setResourcePricing(
    resourceId: string,
    resourceType: 'tool' | 'prompt' | 'resource',
    pricing: ResourcePricing
  ): void {
    const key = `${resourceType}:${resourceId}`;
    this.resourcePricing.set(key, pricing);
    
    this.logger.debug('Set custom resource pricing', {
      resourceId,
      resourceType,
      pricing
    });
  }
  
  /**
   * Set default pricing for a resource type
   * @param resourceType Type of the resource
   * @param pricing Pricing information
   */
  setDefaultTypePrice(
    resourceType: 'tool' | 'prompt' | 'resource',
    pricing: ResourcePricing
  ): void {
    const key = `default:${resourceType}`;
    this.resourcePricing.set(key, pricing);
    
    this.logger.debug('Set default type pricing', {
      resourceType,
      pricing
    });
  }
}
