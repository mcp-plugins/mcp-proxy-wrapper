/**
 * @file Proxy Wrapper for MCP Server
 * @version 1.0.0
 * @status STABLE - DO NOT MODIFY WITHOUT TESTS
 * @lastModified 2024-03-17
 * 
 * This module provides a lightweight wrapper for an MCP Server that
 * allows intercepting and modifying tool calls.
 * 
 * IMPORTANT:
 * - All changes must be accompanied by tests
 * - Do not modify the interface without updating documentation
 * 
 * Functionality:
 * - Instance wrapping of an existing MCP server
 * - Pre-call hook execution
 * - Post-call hook execution
 * - Tool call interception
 * - Error handling and logging
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createLogger, Logger } from './utils/logger.js';
import { v4 as uuidv4 } from 'uuid';
import { ProxyHooks, ProxyWrapperOptions, ToolCallContext, ToolCallResult } from './interfaces/proxy-hooks.js';

// Define types for the tool handler and schema
type ToolSchema = Record<string, any>;
type ToolHandler = (args: any, extra: any) => Promise<any>;

/**
 * Wraps an MCP server with a proxy that allows intercepting tool calls
 * @param server The MCP server to wrap
 * @param options Options for the proxy wrapper
 * @returns A new MCP server with the proxy functionality
 */
export function wrapWithProxy(
  server: McpServer,
  options?: ProxyWrapperOptions
): McpServer {
  const logger = createLogger({
    level: options?.debug ? 'debug' : 'info',
    prefix: 'MCP-PROXY'
  });
  
  const hooks = options?.hooks || {};
  const globalMetadata = options?.metadata || {};
  
  logger.info('Initializing MCP Proxy Wrapper');
  logger.debug('Options:', options);
  
  // Create a proxy around the server's tool method
  const originalTool = server.tool.bind(server);
  
  // Override the tool method to intercept tool registrations
  server.tool = function(name: string, schema: ToolSchema, handler: ToolHandler) {
    logger.debug(`Intercepting tool registration: ${name}`);
    
    // Create a wrapped handler that executes hooks
    const wrappedHandler = async (args: any, extra: any) => {
      const requestId = uuidv4();
      const context: ToolCallContext = {
        toolName: name,
        args,
        metadata: { 
          ...globalMetadata,
          requestId,
          timestamp: new Date().toISOString()
        }
      };
      
      logger.debug(`Tool call: ${name}`, { requestId, args });
      
      try {
        // Execute pre-call hook if defined
        if (hooks.beforeToolCall) {
          logger.debug(`Executing beforeToolCall hook for ${name}`, { requestId });
          
          try {
            const hookResult = await hooks.beforeToolCall(context);
            
            // If the hook returns a result, short-circuit the tool call
            if (hookResult) {
              logger.debug(`Short-circuiting tool call for ${name} with hook result`, { requestId });
              return hookResult.result;
            }
          } catch (error) {
            logger.error(`Error in beforeToolCall hook for ${name}:`, error);
            throw new Error(`Hook error: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
        
        // Call the original handler
        logger.debug(`Calling original handler for ${name}`, { requestId });
        const result = await handler(args, extra);
        
        // Execute post-call hook if defined
        if (hooks.afterToolCall) {
          logger.debug(`Executing afterToolCall hook for ${name}`, { requestId });
          
          try {
            const toolResult: ToolCallResult = {
              result,
              metadata: {
                ...context.metadata,
                completedAt: new Date().toISOString()
              }
            };
            
            const modifiedResult = await hooks.afterToolCall(context, toolResult);
            return modifiedResult.result;
          } catch (error) {
            logger.error(`Error in afterToolCall hook for ${name}:`, error);
            throw new Error(`Hook error: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
        
        return result;
      } catch (error) {
        logger.error(`Error processing tool call ${name}:`, error);
        
        // Return a proper error response
        return {
          isError: true,
          content: [
            {
              type: "text",
              text: `Error: ${error instanceof Error ? error.message : String(error)}`
            }
          ]
        };
      }
    };
    
    // Register the tool with the wrapped handler
    return originalTool(name, schema, wrappedHandler);
  };
  
  logger.info('MCP Proxy Wrapper initialized successfully');
  
  return server;
}

/**
 * Options for the proxy wrapper
 */
export { ProxyWrapperOptions } from './interfaces/proxy-hooks.js'; 