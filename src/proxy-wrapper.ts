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
import { createLogger } from './utils/logger.js';
import { v4 as uuidv4 } from 'uuid';
import { ProxyWrapperOptions, ToolCallContext, ToolCallResult } from './interfaces/proxy-hooks.js';
import { DefaultPluginManager } from './utils/plugin-manager.js';

// Define types for the request handler extra
type RequestHandlerExtra = any;

/**
 * Wraps an MCP server with a proxy that allows intercepting tool calls
 * @param server The MCP server to wrap
 * @param options Options for the proxy wrapper
 * @returns A new MCP server with the proxy functionality
 */
export async function wrapWithProxy(
  server: McpServer,
  options?: ProxyWrapperOptions
): Promise<McpServer> {
  // Check if server is already wrapped to prevent double wrapping
  if ((server as any)._isProxyWrapped) {
    return server;
  }
  const logger = createLogger({
    level: options?.debug ? 'debug' : 'info',
    prefix: 'MCP-PROXY'
  });
  
  // TypeScript version with plugin support
  
  const hooks = options?.hooks || {};
  const globalMetadata = options?.metadata || {};
  
  // Initialize plugin manager if plugins are provided
  let pluginManager: DefaultPluginManager | null = null;
  if (options?.plugins && options.plugins.length > 0) {
    const pluginInstances = options.plugins.map(p => 'plugin' in p ? p.plugin : p);
    logger.info('Initializing plugin manager with plugins:', pluginInstances.map(p => p.name));
    pluginManager = new DefaultPluginManager('1.0.0', options.pluginConfig || {});
    
    // Register and initialize plugins
    for (const pluginOrReg of options.plugins) {
      const plugin = 'plugin' in pluginOrReg ? pluginOrReg.plugin : pluginOrReg;
      const config = 'plugin' in pluginOrReg ? pluginOrReg.config : undefined;
      await pluginManager.register(plugin, config);
    }
    
    await pluginManager.initializeAll();
  }
  
  logger.info('Initializing MCP Proxy Wrapper');
  logger.debug('Options:', options);
  
  // Create a proxy around the server's tool method
  const originalTool = server.tool.bind(server);
  
  // Override the tool method to intercept tool registrations
  // We need to use any here because the SDK types don't match the runtime behavior
  const toolMethod: any = function(name: string, paramsSchemaOrCallback: any, callbackOrUndefined?: any) {
    logger.debug(`Intercepting tool registration: ${name}`);
    
    // Determine if this is the 2-arg or 3-arg version
    const isThreeArgVersion = callbackOrUndefined !== undefined;
    const paramsSchema = isThreeArgVersion ? paramsSchemaOrCallback : {};
    const originalCallback = isThreeArgVersion ? callbackOrUndefined : paramsSchemaOrCallback;
    
    // Create a wrapped handler that executes hooks
    const wrappedCallback = async (argsOrExtra: any, extra?: RequestHandlerExtra) => {
      // Handle both 1-arg and 2-arg callback signatures
      const args = isThreeArgVersion ? argsOrExtra : {};
      const actualExtra = isThreeArgVersion ? extra : argsOrExtra;
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
        // Execute plugin before hooks first
        logger.debug(`Checking plugin manager beforeToolCall for ${name}`, { hasPluginManager: !!pluginManager, requestId });
        if (pluginManager) {
          logger.info(`Executing plugin beforeToolCall hooks for ${name}`, { requestId });
          
          try {
            const pluginShortCircuit = await pluginManager.executeBeforeHooks(context);
            if (pluginShortCircuit) {
              logger.info(`Plugin short-circuited tool call for ${name}`, { requestId });
              return pluginShortCircuit.result;
            }
            logger.info(`Plugin beforeToolCall hooks completed for ${name}`, { requestId });
          } catch (error) {
            logger.error(`Error in plugin beforeToolCall hooks for ${name}:`, error);
            throw new Error(`Plugin error: ${error instanceof Error ? error.message : String(error)}`);
          }
        } else {
          logger.debug(`No plugin manager available for beforeToolCall ${name}`, { requestId });
        }

        // Execute user-defined pre-call hook after plugins
        if (hooks.beforeToolCall) {
          logger.debug(`Executing user beforeToolCall hook for ${name}`, { requestId });
          
          try {
            const hookResult = await hooks.beforeToolCall(context);
            
            // If the hook returns a result, short-circuit the tool call
            if (hookResult) {
              logger.debug(`Short-circuiting tool call for ${name} with user hook result`, { requestId });
              return hookResult.result;
            }
          } catch (error) {
            logger.error(`Error in user beforeToolCall hook for ${name}:`, error);
            throw new Error(`Hook error: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
        
        // Call the original handler with potentially modified args from hooks
        logger.debug(`Calling original handler for ${name}`, { requestId });
        const result = isThreeArgVersion 
          ? await originalCallback(context.args, actualExtra)
          : await originalCallback(actualExtra);
        
        let toolResult: ToolCallResult = {
          result,
          metadata: {
            ...context.metadata,
            completedAt: new Date().toISOString()
          }
        };
        
        // Execute user-defined post-call hook first
        if (hooks.afterToolCall) {
          logger.debug(`Executing afterToolCall hook for ${name}`, { requestId });
          
          try {
            toolResult = await hooks.afterToolCall(context, toolResult);
          } catch (error) {
            logger.error(`Error in afterToolCall hook for ${name}:`, error);
            throw new Error(`Hook error: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
        
        // Execute plugin after hooks
        logger.debug(`Checking plugin manager for ${name}`, { hasPluginManager: !!pluginManager, requestId });
        if (pluginManager) {
          logger.info(`Executing plugin afterToolCall hooks for ${name}`, { requestId });
          
          try {
            toolResult = await pluginManager.executeAfterHooks(context, toolResult);
            logger.info(`Plugin hooks completed for ${name}`, { requestId });
          } catch (error) {
            logger.error(`Error in plugin afterToolCall hooks for ${name}:`, error);
            throw new Error(`Plugin error: ${error instanceof Error ? error.message : String(error)}`);
          }
        } else {
          logger.debug(`No plugin manager available for ${name}`, { requestId });
        }
        
        // Merge metadata from proxy wrapper and plugins into MCP standard _meta field
        const finalResult = {
          ...toolResult.result,
          _meta: {
            ...toolResult.metadata,
            ...toolResult.result._meta
          }
        };
        
        logger.debug(`Returning final result for ${name}`, { 
          requestId, 
          hasMetadata: !!finalResult._meta,
          metadataKeys: finalResult._meta ? Object.keys(finalResult._meta) : []
        });
        
        return finalResult;
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
    if (isThreeArgVersion) {
      return originalTool(name, paramsSchema, wrappedCallback);
    } else {
      return originalTool(name, wrappedCallback);
    }
  };
  
  // Replace the original method
  server.tool = toolMethod;
  
  // Mark server as wrapped to prevent double wrapping
  (server as any)._isProxyWrapped = true;
  
  logger.info('MCP Proxy Wrapper initialized successfully');
  
  return server;
}

/**
 * Options for the proxy wrapper
 */
export { ProxyWrapperOptions } from './interfaces/proxy-hooks.js'; 