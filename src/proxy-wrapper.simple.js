/**
 * @file Proxy Wrapper for MCP Server (JavaScript Version)
 * @version 1.0.0
 * 
 * This module provides a lightweight wrapper for an MCP Server that
 * allows intercepting and modifying tool calls.
 */

/**
 * Creates a logger with the specified options
 * @param {Object} options - Logger options
 * @returns {Object} - Logger object
 */
function createLogger(options = {}) {
  const level = options.level || 'info';
  const prefix = options.prefix || 'LOGGER';
  
  const isDebug = level === 'debug';
  
  return {
    info: (...args) => console.log(`[${prefix}] INFO:`, ...args),
    debug: (...args) => isDebug && console.log(`[${prefix}] DEBUG:`, ...args),
    error: (...args) => console.error(`[${prefix}] ERROR:`, ...args)
  };
}

/**
 * Wraps an MCP server with a proxy that allows intercepting tool calls
 * @param {Object} server - The MCP server to wrap
 * @param {Object} options - Options for the proxy wrapper
 * @returns {Object} - The wrapped server
 */
export function wrapWithProxy(server, options = {}) {
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
  server.tool = function(name, paramsSchemaOrCallback, callbackOrUndefined) {
    logger.debug(`Intercepting tool registration: ${name}`);
    
    // Determine if this is the 2-arg or 3-arg version
    const isThreeArgVersion = callbackOrUndefined !== undefined;
    const paramsSchema = isThreeArgVersion ? paramsSchemaOrCallback : {};
    const originalCallback = isThreeArgVersion ? callbackOrUndefined : paramsSchemaOrCallback;
    
    // Create a wrapped handler that executes hooks
    const wrappedCallback = async (args, extra) => {
      const requestId = Math.random().toString(36).substring(2, 15);
      const context = {
        toolName: name,
        args,
        extra,
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
        const result = await originalCallback(args, extra);
        
        // Execute post-call hook if defined
        if (hooks.afterToolCall) {
          logger.debug(`Executing afterToolCall hook for ${name}`, { requestId });
          
          try {
            const toolResult = {
              result,
              metadata: {
                ...context.metadata,
                completedAt: new Date().toISOString()
              }
            };
            
            const modifiedResult = await hooks.afterToolCall(context, toolResult);
            if (modifiedResult && modifiedResult.result) {
              return modifiedResult.result;
            }
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
    if (isThreeArgVersion) {
      return originalTool(name, paramsSchema, wrappedCallback);
    } else {
      return originalTool(name, wrappedCallback);
    }
  };
  
  logger.info('MCP Proxy Wrapper initialized successfully');
  
  return server;
} 