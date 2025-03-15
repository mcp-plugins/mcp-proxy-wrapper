/**
 * @file Interface Definition Tests
 * @version 1.0.0
 * 
 * Tests to validate interface definitions for the extensible hooks system
 */

import { describe, it, expect } from '@jest/globals';
import { IAuthProvider } from '../interfaces/auth-provider.js';
import { IPaymentProvider } from '../interfaces/payment-provider.js';
import { IPricingStrategy } from '../interfaces/pricing-strategy.js';
import { validateInterfaceImplementation } from './utils/interface-validator';

/* eslint-disable @typescript-eslint/no-unused-vars */
// Disabling unused vars lint rule as we're implementing interfaces 
// without actually using the parameters in this test file

describe('Interface Definitions', () => {
  describe('IAuthProvider', () => {
    it('has the required method definitions', () => {
      // Define required method names for the IAuthProvider interface
      const requiredMethods = [
        'generateAuthUrl',
        'verifyToken',
        'generateToken'
      ];
      
      // Create a mock implementation to test the interface definition
      const mockAuthProvider: IAuthProvider = {
        generateAuthUrl: (_options?: Record<string, unknown>) => 'https://auth.example.com',
        verifyToken: async (_token, _resourceType, _resourceId) => ({ valid: true, userId: 'user-1' }),
        generateToken: (_userId?: string) => 'test-token',
        createSession: async (_sessionId, _options) => ({ 
          status: 'pending', 
          expires_in: 300
        }),
        checkSessionStatus: async (_sessionId) => ({ 
          status: 'authenticated', 
          user_id: 'user-1', 
          expires_in: 300 
        }),
        validateJWT: async (_jwt) => ({ 
          user_id: 'user-1', 
          name: 'Test User', 
          email: 'test@example.com',
          balance: 1000,
          currency: 'USD',
          available_credit: 0,
          custom_fields: {}
        })
      };
      
      // Validate that the mock implements required methods
      const validation = validateInterfaceImplementation(mockAuthProvider, requiredMethods);
      expect(validation.implementsAll).toBe(true);
      expect(validation.missingMethods).toHaveLength(0);
    });
  });
  
  describe('IPaymentProvider', () => {
    it('has the required method definitions', () => {
      // Define required method names for the IPaymentProvider interface
      const requiredMethods = [
        'verifyFunds',
        'processCharge',
        'preauthorize',
        'capturePreauthorized',
        'cancelPreauthorization'
      ];
      
      // Create a mock implementation to test the interface definition
      const mockPaymentProvider: IPaymentProvider = {
        verifyFunds: async (_userId, _amount, _metadata) => true,
        processCharge: async (_userId, _amount, _metadata) => 'charge-id-123',
        getBalance: async (_userId) => ({ 
          available: 1000, 
          pending: 0,
          currency: 'USD', 
          lastUpdated: new Date().toISOString() 
        }),
        verifyApiKey: async (_apiKey) => true,
        preauthorize: async (_userId, _amount, _metadata) => 'preauth-id-123',
        capturePreauthorized: async (_userId, _preauthId, _finalAmount, _metadata) => 'capture-id-123',
        cancelPreauthorization: async (_userId, _preauthId) => true
      };
      
      // Validate that the mock implements required methods
      const validation = validateInterfaceImplementation(mockPaymentProvider, requiredMethods);
      expect(validation.implementsAll).toBe(true);
      expect(validation.missingMethods).toHaveLength(0);
    });
  });
  
  describe('IPricingStrategy', () => {
    it('has the required method definitions', () => {
      // Define required method names for the IPricingStrategy interface
      const requiredMethods = [
        'calculatePrice',
        'getPricingInfo',
        'isApplicable'
      ];
      
      // Create a mock implementation to test the interface definition
      const mockPricingStrategy: IPricingStrategy = {
        calculatePrice: async (_options) => ({ 
          amount: 100, 
          currency: 'USD', 
          breakdown: { 
            baseAmount: 100, 
            discounts: [], 
            fees: [] 
          } 
        }),
        getPricingInfo: async (_resourceId, _resourceType) => ({ 
          basePrice: 100, 
          currency: 'USD', 
          pricingModel: 'flat' 
        }),
        isApplicable: async (_resourceId, _resourceType) => true
      };
      
      // Validate that the mock implements required methods
      const validation = validateInterfaceImplementation(mockPricingStrategy, requiredMethods);
      expect(validation.implementsAll).toBe(true);
      expect(validation.missingMethods).toHaveLength(0);
    });
  });
});
