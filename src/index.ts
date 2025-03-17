/**
 * @file MCP Payment Wrapper Entry Point
 * @version 1.1.0
 * @status STABLE - DO NOT MODIFY WITHOUT TESTS
 * @lastModified 2024-03-15
 * 
 * Main entry point for the MCP Payment Wrapper package.
 * Exports the wrapWithPayments function and related types.
 * 
 * IMPORTANT:
 * - All changes must be accompanied by tests
 * - Do not modify the interface without updating documentation
 * 
 * Functionality:
 * - Main export for the payment wrapper
 * - Type definitions
 * - Utility exports
 * - Hook interfaces and implementations
 */

// Export main function and types
export { wrapWithPayments, PaymentWrapperOptions } from './payment-wrapper.js';

// Export interfaces
export { 
  IAuthService, 
  SessionOptions, 
  SessionStatus, 
  UserData 
} from './interfaces/auth-service.js';

// Export services
export { MockAuthService } from './services/mock-auth-service.js';

// Export utilities
export { createLogger, LoggerOptions } from './utils/logger.js';

// Export hook interfaces
export {
  IAuthProvider,
  AuthProviderOptions
} from './hooks/interfaces/auth-provider.js';

export {
  IPaymentProvider,
  PaymentProviderOptions,
  PaymentMetadata,
  UserBalance
} from './hooks/interfaces/payment-provider.js';

export {
  IPricingStrategy,
  PricingStrategyOptions,
  PricingOptions,
  PricingResult,
  ResourcePricing
} from './hooks/interfaces/pricing-strategy.js';

// Export default hook implementations
export { DefaultAuthProvider } from './hooks/providers/default-auth-provider.js';
export { DefaultPaymentProvider } from './hooks/providers/default-payment-provider.js';
export { DefaultPricingStrategy } from './hooks/providers/default-pricing-strategy.js';

/**
 * @description
 * 
 * The MCP Payment Wrapper adds payment functionality to an existing MCP server.
 * It validates API keys, user JWT tokens, and manages billing checks.
 * 
 * ## Features
 * 
 * - **Instance Wrapping**: Accepts an instance of an existing MCP server
 * - **Developer API Key Verification**: Validates developer API keys
 * - **User JWT Verification**: Authenticates users with JWT tokens
 * - **Billing Checks**: Verifies user has sufficient funds
 * - **Payment Tools**: Provides authentication and balance tools
 * - **Extensible Hooks**: Supports custom authentication, payment, and pricing implementations
 * 
 * ## Payment Tools
 * 
 * The wrapper adds the following payment-related tools:
 * 
 * - **payment_authenticate**: Initiates the authentication process
 * - **payment_check_auth_status**: Checks the status of authentication
 * - **payment_get_balance**: Gets the user's current balance
 * 
 * ## Hook System
 * 
 * The wrapper provides a flexible hook system that allows you to customize:
 * 
 * - **Authentication**: Implement your own authentication provider
 * - **Payment Processing**: Implement your own payment provider
 * - **Pricing**: Implement your own pricing strategy
 * 
 * ## Usage Example
 * 
 * ```typescript
 * import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
 * import { wrapWithPayments } from '@modelcontextprotocol/payment-wrapper';
 * 
 * // Create your MCP server
 * const server = new McpServer({ 
 *   name: "My MCP Server",
 *   version: "1.0.0"
 * });
 * 
 * // Wrap with payment functionality
 * const paymentServer = wrapWithPayments(server, { 
 *   apiKey: 'YOUR_API_KEY',
 *   baseAuthUrl: 'https://auth.yourservice.com'
 * });
 * 
 * // Use the wrapped server as normal
 * // It now has payment tools and verification
 * ```
 * 
 * ## Custom Hooks Example
 * 
 * ```typescript
 * import { 
 *   McpServer 
 * } from '@modelcontextprotocol/sdk/server/mcp.js';
 * import { 
 *   wrapWithPayments,
 *   IAuthProvider,
 *   IPaymentProvider,
 *   IPricingStrategy
 * } from '@modelcontextprotocol/payment-wrapper';
 * 
 * // Create your custom hook implementations
 * class MyAuthProvider implements IAuthProvider { /* ... */ }
 * class MyPaymentProvider implements IPaymentProvider { /* ... */ }
 * class MyPricingStrategy implements IPricingStrategy { /* ... */ }
 * 
 * // Create your MCP server
 * const server = new McpServer({ 
 *   name: "My MCP Server",
 *   version: "1.0.0"
 * });
 * 
 * // Wrap with payment functionality using custom hooks
 * const paymentServer = wrapWithPayments(server, { 
 *   apiKey: 'YOUR_API_KEY',
 *   authProvider: new MyAuthProvider(),
 *   paymentProvider: new MyPaymentProvider(),
 *   pricingStrategy: new MyPricingStrategy()
 * });
 * ```
 */ 