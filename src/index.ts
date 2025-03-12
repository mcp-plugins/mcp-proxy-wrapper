/**
 * @file Public API for the MCP Payment Wrapper
 * @version 1.0.0
 * @status STABLE - DO NOT MODIFY WITHOUT TESTS
 * @lastModified 2024-03-12
 * 
 * This file exports the public API for the MCP Payment Wrapper package.
 * It provides a wrapper for an MCP Server that adds payment functionality.
 */

// Export the main wrapper function and types
export { wrapWithPayments, PaymentWrapperOptions } from './payment-wrapper.js';

// Export logger utilities that may be useful for consumers
export { createLogger, LoggerOptions, MemoryTransport } from './utils/logger.js'; 