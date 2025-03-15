# MCP Payment Wrapper: Extensible Hooks Design Plan

**Document Version**: 1.0  
**Date**: March 14, 2025  
**Author**: Codeium AI  
**Status**: Draft Proposal  

## Executive Summary

This document outlines a comprehensive plan for extending the MCP Payment Wrapper to allow third-party developers to implement custom payment and authentication backends. The proposed architecture uses a hook-based system that enables developers to plug in their own implementations for payment processing, authentication, and token verification while maintaining the wrapper's core functionality.

## Current Architecture

The current MCP Payment Wrapper uses:

1. **Proxy-based Method Interception**: Intercepts method calls to the underlying MCP server
2. **Mock Authentication**: Simulates JWT verification with `MockAuthService`
3. **Simulated Billing**: Simulates billing checks and transactions
4. **Hard-coded Logic**: Core payment and authentication flows are tightly coupled to implementation

## Proposed Extension Points

We propose extending the wrapper with the following hook points:

### 1. Authentication Provider Hook

Allow developers to implement the `IAuthService` interface to provide custom authentication mechanisms.

```typescript
// Example of plugging in a custom auth service
const customAuthService = new MyCustomAuthService({
  apiKey: process.env.API_KEY,
  serviceUrl: "https://auth.myservice.com"
});

const paymentServer = wrapWithPayments(server, { 
  apiKey: process.env.API_KEY,
  authProvider: customAuthService // <-- New option
});
```

### 2. Payment Provider Hook

Allow developers to implement the `PaymentProvider` interface to handle custom payment processing.

```typescript
// Example of plugging in a custom payment provider
const stripePaymentProvider = new StripePaymentProvider({
  apiKey: process.env.STRIPE_SECRET_KEY,
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET
});

const paymentServer = wrapWithPayments(server, { 
  apiKey: process.env.API_KEY,
  paymentProvider: stripePaymentProvider // <-- New option
});
```

### 3. Pricing Strategy Hook

Allow developers to implement custom pricing strategies for different operations.

```typescript
// Example of a custom pricing strategy
const perTokenPricingStrategy = new PerTokenPricingStrategy({
  baseRate: 0.001, // $0.001 per token
  bulkDiscountThreshold: 1000, // tokens
  bulkDiscountRate: 0.0008 // $0.0008 per token after threshold
});

const paymentServer = wrapWithPayments(server, { 
  apiKey: process.env.API_KEY,
  pricingStrategy: perTokenPricingStrategy // <-- New option
});
```

### 4. Resource-specific Hooks

Allow for custom handling of specific resource types (tools, prompts, resources).

```typescript
// Example of resource-specific handlers
const paymentServer = wrapWithPayments(server, { 
  apiKey: process.env.API_KEY,
  resourceHandlers: {
    premiumTools: {
      isApplicable: (resourceId) => resourceId.startsWith('premium_'),
      getPricing: (resourceId, context) => calculatePremiumPrice(resourceId, context),
      handleAccess: async (resourceId, userId) => checkPremiumAccess(resourceId, userId)
    }
  }
});
```

## Implementation Plan

### Phase 1: Interface Definition

1. **Refine Existing Interfaces**
   - Update `IAuthService` interface if needed
   - Update `PaymentProvider` interface if needed
   - Create a new `PricingStrategy` interface

2. **Create Plugin Manager**
   - Develop a plugin registry system
   - Implement hook management infrastructure
   - Define fallback behaviors

### Phase 2: Core Implementation

1. **Refactor Proxy Mechanism**
   - Abstract the method interception logic
   - Separate concerns between authentication, payment, and execution
   - Add hook injection points

2. **Implement Provider Selection Logic**
   - Create a provider resolution system
   - Handle provider prioritization
   - Implement fallback to default providers

3. **Update Configuration Options**
   - Extend `PaymentWrapperOptions` with new provider options
   - Add validation for custom provider implementations

### Phase 3: Default Implementations

1. **Default Authentication Provider**
   - Refactor `MockAuthService` as a default implementation
   - Ensure it meets the updated interface requirements
   - Make it extensible for custom logic

2. **Default Payment Provider**
   - Create a default `MockPaymentProvider` implementation
   - Ensure it handles all required payment operations
   - Add simulation options for testing

3. **Default Pricing Strategy**
   - Implement a simple, configurable pricing strategy
   - Support different pricing models (flat-rate, per-token, etc.)
   - Make it extensible for custom calculations

### Phase 4: Documentation and Examples

1. **Developer Guide**
   - Create comprehensive documentation for hook system
   - Document interface requirements
   - Provide examples of custom implementations

2. **Example Implementations**
   - Create sample Stripe payment provider
   - Create sample Auth0 authentication provider
   - Create sample usage-based pricing strategy

3. **Testing Framework**
   - Develop testing utilities for custom providers
   - Create validation tools
   - Document testing best practices

## Interface Definitions

### Authentication Provider

```typescript
export interface IAuthProvider {
  /**
   * Generate an authentication URL for a user
   */
  generateAuthUrl(options?: Record<string, unknown>): string;
  
  /**
   * Verify a JWT token for a specific resource
   */
  verifyToken(token: string, resourceType: 'tool' | 'prompt' | 'resource', resourceId: string): Promise<VerifyResponse>;
  
  /**
   * Generates a user token (primarily for testing)
   */
  generateToken(userId?: string): string;
  
  /**
   * Create an authentication session
   */
  createSession?(sessionId: string, options: SessionOptions): Promise<SessionStatus>;
  
  /**
   * Check the status of an authentication session
   */
  checkSessionStatus?(sessionId: string): Promise<SessionStatus>;
  
  /**
   * Validate a JWT token and extract user data
   */
  validateJWT?(jwt: string): Promise<UserData | null>;
}
```

### Payment Provider

```typescript
export interface IPaymentProvider {
  /**
   * Verify if a user has sufficient funds
   */
  verifyFunds(userId: string, amount: number, metadata?: PaymentMetadata): Promise<boolean>;
  
  /**
   * Process a payment for a completed operation
   */
  processCharge(userId: string, amount: number, metadata: PaymentMetadata): Promise<string>;
  
  /**
   * Get a user's current balance
   */
  getBalance(userId: string): Promise<UserBalance>;
  
  /**
   * Verify an API key
   */
  verifyApiKey(apiKey: string): Promise<boolean>;
  
  /**
   * Preauthorize a payment amount (optional)
   */
  preauthorize?(userId: string, amount: number, metadata: PaymentMetadata): Promise<string>;
  
  /**
   * Capture a preauthorized payment (optional)
   */
  capturePreauthorized?(userId: string, preauthId: string, finalAmount: number, metadata: PaymentMetadata): Promise<string>;
  
  /**
   * Cancel a preauthorized payment (optional)
   */
  cancelPreauthorization?(userId: string, preauthId: string): Promise<boolean>;
}

export interface PaymentMetadata {
  resourceType: 'tool' | 'prompt' | 'resource';
  resourceId: string;
  operationType: string;
  tokenCount?: number;
  processingTime?: number;
  customData?: Record<string, unknown>;
}

export interface UserBalance {
  available: number;
  pending: number;
  currency: string;
  lastUpdated: string;
}
```

### Pricing Strategy

```typescript
export interface IPricingStrategy {
  /**
   * Calculate the price for an operation
   */
  calculatePrice(options: PricingOptions): Promise<PricingResult>;
  
  /**
   * Get pricing information for a resource
   */
  getPricingInfo(resourceId: string, resourceType: 'tool' | 'prompt' | 'resource'): Promise<ResourcePricing>;
  
  /**
   * Check if this pricing strategy applies to a specific resource
   */
  isApplicable?(resourceId: string, resourceType: 'tool' | 'prompt' | 'resource'): Promise<boolean>;
  
  /**
   * Set custom pricing for a specific resource
   */
  setResourcePricing?(resourceId: string, resourceType: 'tool' | 'prompt' | 'resource', pricing: ResourcePricing): void;
  
  /**
   * Set default pricing for a resource type
   */
  setDefaultTypePricing?(resourceType: 'tool' | 'prompt' | 'resource', pricing: ResourcePricing): void;
}

export interface PricingOptions {
  resourceId: string;
  resourceType: 'tool' | 'prompt' | 'resource';
  userId: string;
  operationType: string;
  tokenCount?: number;
  processingTime?: number;
  metadata?: Record<string, unknown>;
}

export interface PricingResult {
  amount: number;
  currency: string;
  breakdown?: {
    baseAmount: number;
    discounts: { reason: string; amount: number }[];
    fees: { reason: string; amount: number }[];
  };
}

export interface ResourcePricing {
  basePrice: number;
  currency: string;
  pricingModel: 'flat' | 'per-token' | 'subscription' | 'custom';
  pricingDetails?: Record<string, unknown>;
}
```

## Example Usage

### Basic Usage (No Custom Providers)

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server';
import { wrapWithPayments } from '@modelcontextprotocol/payment-wrapper';

const server = new McpServer({ 
  name: "My MCP Server",
  version: "1.0.0"
});

// Uses default mock implementations
const paymentServer = wrapWithPayments(server, { 
  apiKey: 'YOUR_API_KEY',
  logLevel: 'info' // Optional: 'debug', 'info', 'warn', 'error'
});
```

### Custom Auth Provider

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server';
import { wrapWithPayments } from '@modelcontextprotocol/payment-wrapper';
import { IAuthProvider } from '@modelcontextprotocol/payment-wrapper/hooks/interfaces/auth-provider';

// Implement your custom auth provider
class Auth0Provider implements IAuthProvider {
  constructor(private config: { domain: string; clientId: string; clientSecret: string }) {}
  
  generateAuthUrl(options?: Record<string, unknown>): string {
    // Implementation
  }
  
  async verifyToken(token: string, resourceType: 'tool' | 'prompt' | 'resource', resourceId: string): Promise<VerifyResponse> {
    // Implementation
  }
  
  generateToken(userId?: string): string {
    // Implementation
  }
  
  // Implement optional methods if needed
}

const server = new McpServer({ 
  name: "My MCP Server",
  version: "1.0.0"
});

const auth0Provider = new Auth0Provider({
  domain: 'your-domain.auth0.com',
  clientId: 'your-client-id',
  clientSecret: 'your-client-secret'
});

const paymentServer = wrapWithPayments(server, { 
  apiKey: 'YOUR_API_KEY',
  authProvider: auth0Provider
});
```

### Custom Payment Provider

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server';
import { wrapWithPayments } from '@modelcontextprotocol/payment-wrapper';
import { IPaymentProvider, PaymentMetadata, UserBalance } from '@modelcontextprotocol/payment-wrapper/hooks/interfaces/payment-provider';

// Implement your custom payment provider
class StripePaymentProvider implements IPaymentProvider {
  constructor(private config: { secretKey: string; webhookSecret: string }) {}
  
  async verifyFunds(userId: string, amount: number, metadata?: PaymentMetadata): Promise<boolean> {
    // Implementation
  }
  
  async processCharge(userId: string, amount: number, metadata: PaymentMetadata): Promise<string> {
    // Implementation
  }
  
  async getBalance(userId: string): Promise<UserBalance> {
    // Implementation
  }
  
  async verifyApiKey(apiKey: string): Promise<boolean> {
    // Implementation
  }
  
  // Implement optional methods if needed
}

const server = new McpServer({ 
  name: "My MCP Server",
  version: "1.0.0"
});

const stripeProvider = new StripePaymentProvider({
  secretKey: 'sk_test_your_key',
  webhookSecret: 'whsec_your_secret'
});

const paymentServer = wrapWithPayments(server, { 
  apiKey: 'YOUR_API_KEY',
  paymentProvider: stripeProvider
});
```

### Complete Custom Configuration

```typescript
import { McpServer } from '@modelcontextprotocol/sdk/server';
import { wrapWithPayments } from '@modelcontextprotocol/payment-wrapper';
import { IAuthProvider } from '@modelcontextprotocol/payment-wrapper/hooks/interfaces/auth-provider';
import { IPaymentProvider } from '@modelcontextprotocol/payment-wrapper/hooks/interfaces/payment-provider';
import { IPricingStrategy } from '@modelcontextprotocol/payment-wrapper/hooks/interfaces/pricing-strategy';

// Custom implementations (as shown in previous examples)
const auth0Provider = new Auth0Provider({
  domain: 'your-domain.auth0.com',
  clientId: 'your-client-id',
  clientSecret: 'your-client-secret'
});

const stripeProvider = new StripePaymentProvider({
  secretKey: 'sk_test_your_key',
  webhookSecret: 'whsec_your_secret'
});

const pricingStrategy = new UsageBasedPricingStrategy({
  baseRatePerToken: 0.001,
  premiumToolMultiplier: 2.5,
  volumeDiscounts: [
    { threshold: 1000, discount: 0.1 },
    { threshold: 10000, discount: 0.2 },
    { threshold: 100000, discount: 0.3 }
  ]
});

const paymentServer = wrapWithPayments(server, { 
  apiKey: 'YOUR_API_KEY',
  authProvider: auth0Provider,
  paymentProvider: stripeProvider,
  pricingStrategy: pricingStrategy,
  logLevel: 'debug'
});
```

## Technical Considerations

### 1. Backward Compatibility

The hook system should maintain backward compatibility with existing implementations:

- Default to mock providers when custom ones aren't specified
- Ensure existing workflow continues to work without modification
- Allow gradual adoption of custom providers

### 2. Error Handling

Robust error handling for custom providers:

- Validate custom providers implement required methods
- Catch and handle errors from custom provider implementations
- Provide clear error messages for implementation issues

### 3. Performance

Minimize performance overhead:

- Lazy instantiation of providers
- Caching of verification results where appropriate
- Efficient provider resolution

### 4. Security

Maintain security standards:

- Validate all inputs before passing to custom providers
- Ensure proper authentication of API calls
- Prevent potential token leakage or manipulation

### 5. Testing

Comprehensive testing strategy:

- Unit tests for each hook point
- Integration tests with example providers
- Test utilities for provider implementation validation

## Migration Path

For existing users:

1. **No Changes Required**: Existing code will continue to work with default providers
2. **Opt-in Extension**: Users can gradually adopt custom providers as needed
3. **Gradual Rollout**: Implement and test one provider type at a time

## Implementation Timeline

1. **Phase 1** (2 weeks): Interface refinement and plugin infrastructure
2. **Phase 2** (3 weeks): Core implementation and provider resolution
3. **Phase 3** (2 weeks): Default provider implementations
4. **Phase 4** (1 week): Documentation and examples
5. **Testing & Review** (2 weeks): Comprehensive testing and bug fixes

## Conclusion

The extensible hook system for the MCP Payment Wrapper has been successfully implemented with the following components:

1. **Interface Definitions**: Clear interfaces have been defined for authentication providers, payment providers, and pricing strategies in their respective files under `src/hooks/interfaces/`.

2. **Default Implementations**: Working default implementations for each provider type have been created in `src/hooks/providers/`.

3. **Comprehensive Testing**: A suite of tests has been implemented to verify the functionality of each provider and ensure proper error handling.

4. **Extensibility**: The architecture now allows third-party developers to implement their own providers by following the defined interfaces.

### Current Status

As of March 14, 2025, the payment wrapper is fully functional with its extensible hook system. All tests are passing and previous issues with hanging processes during testing have been resolved.

### Next Steps

1. **Documentation Enhancement**: Create detailed developer guides for implementing custom providers.

2. **Example Implementations**: Build real-world examples of custom providers (Stripe, Auth0, etc.).

3. **Performance Optimization**: Profile and optimize the performance of provider resolution and execution.

4. **Monitoring and Telemetry**: Add detailed logging and monitoring capabilities for production deployments.

The MCP Payment Wrapper provides a robust foundation for integrating payment functionality with Model Context Protocol servers, with the flexibility to adapt to various authentication systems, payment processors, and pricing models as the ecosystem evolves.
