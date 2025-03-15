/**
 * @file Default Pricing Strategy Tests
 * @version 1.0.0
 * 
 * Tests for the DefaultPricingStrategy implementation
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { DefaultPricingStrategy } from '../providers/default-pricing-strategy.js';
import { IPricingStrategy, PricingOptions, ResourcePricing } from '../interfaces/pricing-strategy.js';
import { validateInterfaceImplementation } from './utils/interface-validator.js';

describe('DefaultPricingStrategy', () => {
  let pricingStrategy: DefaultPricingStrategy;
  
  beforeEach(() => {
    // Create a fresh instance for each test
    pricingStrategy = new DefaultPricingStrategy({
      defaultBasePrice: 100, // $1.00
      currency: 'USD',
      defaultPricingModel: 'flat',
      strategyConfig: {
        debugMode: true
      }
    });
  });
  
  it('implements the IPricingStrategy interface', () => {
    const requiredMethods = [
      'calculatePrice',
      'getPricingInfo',
      'isApplicable'
    ];
    
    const validation = validateInterfaceImplementation(pricingStrategy, requiredMethods);
    expect(validation.implementsAll).toBe(true);
    expect(validation.missingMethods).toHaveLength(0);
  });
  
  it('calculates flat rate pricing correctly', async () => {
    const options: PricingOptions = {
      resourceId: 'test-resource',
      resourceType: 'tool',
      userId: 'test-user',
      operationType: 'execution'
    };
    
    // Set custom pricing for this test
    const testPrice: ResourcePricing = {
      basePrice: 200, // $2.00
      currency: 'USD',
      pricingModel: 'flat'
    };
    
    pricingStrategy.setResourcePricing('test-resource', 'tool', testPrice);
    
    const result = await pricingStrategy.calculatePrice(options);
    
    expect(result).toBeDefined();
    expect(result.amount).toBe(200);
    expect(result.currency).toBe('USD');
    expect(result.breakdown).toBeDefined();
    expect(result.breakdown?.baseAmount).toBe(200);
    expect(result.breakdown?.discounts).toHaveLength(0);
    expect(result.breakdown?.fees).toHaveLength(0);
  });
  
  it('calculates per-token pricing correctly', async () => {
    const tokenCount = 100;
    const options: PricingOptions = {
      resourceId: 'test-prompt',
      resourceType: 'prompt',
      userId: 'test-user',
      operationType: 'execution',
      tokenCount
    };
    
    // Set custom pricing for this test
    const testPrice: ResourcePricing = {
      basePrice: 2, // $0.02 per token
      currency: 'USD',
      pricingModel: 'per-token',
      pricingDetails: {
        minimumCharge: 50 // $0.50 minimum
      }
    };
    
    pricingStrategy.setResourcePricing('test-prompt', 'prompt', testPrice);
    
    const result = await pricingStrategy.calculatePrice(options);
    
    expect(result).toBeDefined();
    expect(result.amount).toBe(200); // 100 tokens * $0.02 = $2.00
    expect(result.currency).toBe('USD');
    expect(result.breakdown).toBeDefined();
    expect(result.breakdown?.baseAmount).toBe(200);
  });
  
  it('applies minimum charge for small token counts', async () => {
    const tokenCount = 10;
    const options: PricingOptions = {
      resourceId: 'test-prompt',
      resourceType: 'prompt',
      userId: 'test-user',
      operationType: 'execution',
      tokenCount
    };
    
    // Set custom pricing for this test
    const testPrice: ResourcePricing = {
      basePrice: 2, // $0.02 per token
      currency: 'USD',
      pricingModel: 'per-token',
      pricingDetails: {
        minimumCharge: 50 // $0.50 minimum
      }
    };
    
    pricingStrategy.setResourcePricing('test-prompt', 'prompt', testPrice);
    
    const result = await pricingStrategy.calculatePrice(options);
    
    expect(result).toBeDefined();
    expect(result.amount).toBe(50); // 10 tokens * $0.02 = $0.20, but minimum is $0.50
    expect(result.currency).toBe('USD');
    expect(result.breakdown).toBeDefined();
    expect(result.breakdown?.baseAmount).toBe(20);
    expect(result.breakdown?.fees).toHaveLength(1);
    expect(result.breakdown?.fees[0].reason).toBe('minimum_charge');
    expect(result.breakdown?.fees[0].amount).toBe(30); // $0.50 - $0.20 = $0.30
  });
  
  it('uses subscription pricing when specified', async () => {
    const options: PricingOptions = {
      resourceId: 'premium-resource',
      resourceType: 'resource',
      userId: 'premium-user',
      operationType: 'execution'
    };
    
    // Set custom pricing for this test
    const testPrice: ResourcePricing = {
      basePrice: 500, // $5.00
      currency: 'USD',
      pricingModel: 'subscription'
    };
    
    pricingStrategy.setResourcePricing('premium-resource', 'resource', testPrice);
    
    const result = await pricingStrategy.calculatePrice(options);
    
    expect(result).toBeDefined();
    expect(result.amount).toBe(0); // Free with subscription
    expect(result.currency).toBe('USD');
    expect(result.breakdown).toBeDefined();
    expect(result.breakdown?.baseAmount).toBe(500);
    expect(result.breakdown?.discounts).toHaveLength(1);
    expect(result.breakdown?.discounts[0].reason).toBe('subscription');
    expect(result.breakdown?.discounts[0].amount).toBe(500);
  });
  
  it('gets pricing information for a specific resource', async () => {
    const resourceId = 'special-tool';
    const resourceType = 'tool';
    
    // Set custom pricing for this test
    const testPrice: ResourcePricing = {
      basePrice: 250, // $2.50
      currency: 'USD',
      pricingModel: 'flat'
    };
    
    pricingStrategy.setResourcePricing(resourceId, resourceType, testPrice);
    
    const result = await pricingStrategy.getPricingInfo(resourceId, resourceType);
    
    expect(result).toBeDefined();
    expect(result.basePrice).toBe(250);
    expect(result.currency).toBe('USD');
    expect(result.pricingModel).toBe('flat');
  });
  
  it('falls back to default type pricing when no specific resource pricing exists', async () => {
    const resourceId = 'unknown-tool';
    const resourceType = 'tool';
    
    // Set default pricing for tool type
    const defaultToolPrice: ResourcePricing = {
      basePrice: 150, // $1.50
      currency: 'USD',
      pricingModel: 'flat'
    };
    
    pricingStrategy.setDefaultTypePrice(resourceType, defaultToolPrice);
    
    const result = await pricingStrategy.getPricingInfo(resourceId, resourceType);
    
    expect(result).toBeDefined();
    expect(result.basePrice).toBe(150);
    expect(result.currency).toBe('USD');
    expect(result.pricingModel).toBe('flat');
  });
  
  it('falls back to global default pricing when no specific or type pricing exists', async () => {
    const resourceId = 'unknown-resource';
    const resourceType = 'resource';
    
    // No specific pricing set, should use the default from constructor
    
    const result = await pricingStrategy.getPricingInfo(resourceId, resourceType);
    
    expect(result).toBeDefined();
    expect(result.basePrice).toBe(100); // Default from constructor
    expect(result.currency).toBe('USD');
    expect(result.pricingModel).toBe('flat');
  });
  
  it('always returns true for isApplicable', async () => {
    const resourceId = 'any-resource';
    const resourceType = 'tool';
    
    const result = await pricingStrategy.isApplicable(resourceId, resourceType);
    
    expect(result).toBe(true);
  });
});
