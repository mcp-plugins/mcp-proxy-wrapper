/**
 * A simplified version of the proxy wrapper for testing purposes.
 * This file implements the core functionality of the proxy wrapper
 * without TypeScript types or complex error handling.
 */

/**
 * Wraps an MCP server with proxy functionality.
 * @param {object} server - The MCP server to wrap
 * @param {object} options - Configuration options
 * @returns {object} - The wrapped server
 */
export function wrapWithProxy(server, options = {}) {
  const { hooks = {}, debug = false } = options;
  const { beforeToolCall, afterToolCall, errorHook } = hooks;
  
  // Save the original tool method
  const originalTool = server.tool;
  
  // Override the tool method to wrap handlers with proxy functionality
  server.tool = function(name, schema, handler) {
    if (debug) console.log(`[Proxy Wrapper] Registering tool: ${name}`);
    
    // Create a wrapped handler
    const wrappedHandler = async (args, extra) => {
      // Create context object
      const context = {
        toolName: name,
        args,
        extra,
        metadata: options.metadata || {}
      };
      
      try {
        // Call before hook if provided
        if (beforeToolCall) {
          if (debug) console.log(`[Proxy Wrapper] Calling beforeToolCall for ${name}`);
          const beforeResult = await beforeToolCall(context);
          
          // If the before hook returns a result, short-circuit and return it
          if (beforeResult && beforeResult.result) {
            if (debug) console.log(`[Proxy Wrapper] Short-circuiting ${name} with result from beforeToolCall`);
            return beforeResult.result;
          }
        }
        
        // Call the original handler
        if (debug) console.log(`[Proxy Wrapper] Calling original handler for ${name}`);
        const result = await handler(args, extra);
        
        // Call after hook if provided
        if (afterToolCall) {
          if (debug) console.log(`[Proxy Wrapper] Calling afterToolCall for ${name}`);
          const afterResult = await afterToolCall(context, { result });
          
          // Return the result from the after hook if provided
          if (afterResult && afterResult.result) {
            return afterResult.result;
          }
        }
        
        return result;
      } catch (error) {
        // Call error hook if provided
        if (errorHook) {
          if (debug) console.log(`[Proxy Wrapper] Calling errorHook for ${name}`);
          return errorHook(context, error);
        }
        
        // Re-throw the error if no error hook is provided
        throw error;
      }
    };
    
    // Register the tool with the wrapped handler
    return originalTool.call(server, name, schema, wrappedHandler);
  };
  
  if (debug) console.log(`[Proxy Wrapper] Server wrapped successfully`);
  return server;
} 