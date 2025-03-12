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
 * 
 * ## Payment Tools
 * 
 * The wrapper adds the following payment-related tools:
 * 
 * - **payment_authenticate**: Initiates the authentication process
 * - **payment_check_auth_status**: Checks the status of authentication
 * - **payment_get_balance**: Gets the user's current balance
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
 */ 