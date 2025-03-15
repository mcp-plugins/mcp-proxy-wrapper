/**
 * @file Default Payment Provider Tests
 * @version 1.0.0
 * 
 * Tests for the DefaultPaymentProvider implementation
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { DefaultPaymentProvider } from '../providers/default-payment-provider.js';
import { IPaymentProvider, PaymentMetadata } from '../interfaces/payment-provider.js';
import { validateInterfaceImplementation } from './utils/interface-validator.js';

describe('DefaultPaymentProvider', () => {
  let paymentProvider: IPaymentProvider;
  const testApiKey = 'test-payment-api-key';
  
  beforeEach(() => {
    // Create a fresh instance for each test
    paymentProvider = new DefaultPaymentProvider({
      apiKey: testApiKey,
      providerConfig: {
        debugMode: true
      }
    });
  });
  
  it('implements the IPaymentProvider interface', () => {
    const requiredMethods = [
      'verifyFunds',
      'processCharge',
      'getBalance',
      'verifyApiKey',
      'preauthorize',
      'capturePreauthorized',
      'cancelPreauthorization'
    ];
    
    const validation = validateInterfaceImplementation(paymentProvider, requiredMethods);
    expect(validation.implementsAll).toBe(true);
    expect(validation.missingMethods).toHaveLength(0);
  });
  
  it('verifies a valid API key', async () => {
    const result = await paymentProvider.verifyApiKey(testApiKey);
    expect(result).toBe(true);
  });
  
  it('rejects an invalid API key', async () => {
    const result = await paymentProvider.verifyApiKey('invalid-api-key');
    expect(result).toBe(false);
  });
  
  it('verifies funds for a user with sufficient balance', async () => {
    const userId = 'test-user';
    const amount = 1000; // $10.00
    
    const result = await paymentProvider.verifyFunds(userId, amount);
    expect(result).toBe(true);
  });
  
  it('rejects funds verification for user with insufficient balance', async () => {
    const userId = 'test-user';
    const amount = 10000; // $100.00
    
    const result = await paymentProvider.verifyFunds(userId, amount);
    expect(result).toBe(false);
  });
  
  it('processes a charge successfully', async () => {
    const userId = 'test-user';
    const amount = 1000; // $10.00
    const metadata: PaymentMetadata = {
      resourceType: 'tool',
      resourceId: 'test-tool',
      operationType: 'execution'
    };
    
    const transactionId = await paymentProvider.processCharge(userId, amount, metadata);
    expect(transactionId).toBeDefined();
    expect(typeof transactionId).toBe('string');
    expect(transactionId.startsWith('txn_')).toBe(true);
  });
  
  it('throws an error when charging with insufficient funds', async () => {
    const userId = 'test-user';
    const amount = 10000; // $100.00
    const metadata: PaymentMetadata = {
      resourceType: 'tool',
      resourceId: 'test-tool',
      operationType: 'execution'
    };
    
    await expect(paymentProvider.processCharge(userId, amount, metadata))
      .rejects.toThrow('Insufficient funds');
  });
  
  it('gets the balance for a user', async () => {
    const userId = 'test-user';
    
    const balance = await paymentProvider.getBalance(userId);
    
    expect(balance).toBeDefined();
    expect(balance.available).toBeGreaterThanOrEqual(0);
    expect(balance.currency).toBe('USD');
    expect(balance.lastUpdated).toBeDefined();
  });
  
  it('preauthorizes a payment successfully', async () => {
    const userId = 'test-user';
    const amount = 1000; // $10.00
    const metadata: PaymentMetadata = {
      resourceType: 'tool',
      resourceId: 'test-tool',
      operationType: 'execution'
    };
    
    const preauthId = await paymentProvider.preauthorize!(userId, amount, metadata);
    expect(preauthId).toBeDefined();
    expect(preauthId).not.toBeNull();
    expect(typeof preauthId).toBe('string');
    
    // Now we can safely assert on preauthId as we've verified it's not null
    if (preauthId) {
      expect(preauthId.startsWith('preauth_')).toBe(true);
    }
  });
  
  it('throws an error when preauthorizing with insufficient funds', async () => {
    const userId = 'test-user';
    const amount = 10000; // $100.00
    const metadata: PaymentMetadata = {
      resourceType: 'tool',
      resourceId: 'test-tool',
      operationType: 'execution'
    };
    
    await expect(paymentProvider.preauthorize!(userId, amount, metadata))
      .rejects.toThrow('Insufficient funds for preauthorization');
  });
  
  it('captures a preauthorized payment successfully', async () => {
    const userId = 'test-user';
    const amount = 1000; // $10.00
    const metadata: PaymentMetadata = {
      resourceType: 'tool',
      resourceId: 'test-tool',
      operationType: 'execution'
    };
    
    // Preauthorize first
    const preauthId = await paymentProvider.preauthorize!(userId, amount, metadata);
    expect(preauthId).toBeDefined();
    expect(preauthId).not.toBeNull();
    
    if (!preauthId) {
      // Skip the test if preauthorization is not supported
      return;
    }
    
    // Capture the preauthorized amount
    const transactionId = await paymentProvider.capturePreauthorized!(
      userId, 
      preauthId, 
      amount, 
      metadata
    );
    
    expect(transactionId).toBeDefined();
    expect(typeof transactionId).toBe('string');
    expect(transactionId.startsWith('txn_')).toBe(true);
  });
  
  it('cancels a preauthorization successfully', async () => {
    const userId = 'test-user';
    const amount = 1000; // $10.00
    const metadata: PaymentMetadata = {
      resourceType: 'tool',
      resourceId: 'test-tool',
      operationType: 'execution'
    };
    
    // Preauthorize first
    const preauthId = await paymentProvider.preauthorize!(userId, amount, metadata);
    expect(preauthId).toBeDefined();
    expect(preauthId).not.toBeNull();
    
    if (!preauthId) {
      // Skip the test if preauthorization is not supported
      return;
    }
    
    // Cancel the preauthorization
    const result = await paymentProvider.cancelPreauthorization!(userId, preauthId);
    
    expect(result).toBe(true);
  });
  
  // Special cases for test overrides
  it('always approves funds for special test account', async () => {
    const userId = 'test-override-always-has-funds';
    const amount = 999999999; // Unreasonably high amount
    
    const result = await paymentProvider.verifyFunds(userId, amount);
    expect(result).toBe(true);
  });
  
  it('always rejects funds for negative test account', async () => {
    const userId = 'test-override-never-has-funds';
    const amount = 1; // Minimal amount
    
    const result = await paymentProvider.verifyFunds(userId, amount);
    expect(result).toBe(false);
  });
});
