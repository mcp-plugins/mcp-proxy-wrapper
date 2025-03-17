/**
 * @file improved-proxy-wrapper.js
 * @version 1.0.0
 * 
 * An improved version of the proxy wrapper that can intercept tools registered
 * before wrapping by re-registering them with wrapped handlers.
 * 
 * Note: This version attempts to access the _tools property, but it may not be
 * accessible in the current MCP SDK. In that case, it falls back to only
 * intercepting tools registered after wrapping.
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
  
  // Create a wrapper function for tool handlers
  const wrapHandler = (name, handler) => {
    return async (args, extra) => {
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
  };
  
  // Save the original tool method
  const originalTool = server.tool;
  
  // Try to access existing tools
  try {
    // Get existing tools and re-register them with wrapped handlers
    if (server._tools && server._tools instanceof Map) {
      if (debug) console.log(`[Proxy Wrapper] Re-registering ${server._tools.size} existing tools`);
      
      // Iterate through existing tools
      server._tools.forEach((toolInfo, name) => {
        if (debug) console.log(`[Proxy Wrapper] Re-registering existing tool: ${name}`);
        
        // Extract the original handler and schema
        const { handler, schema } = toolInfo;
        
        // Create a wrapped handler
        const wrappedHandler = wrapHandler(name, handler);
        
        // Replace the original handler with the wrapped one
        toolInfo.handler = wrappedHandler;
      });
    } else {
      if (debug) console.log(`[Proxy Wrapper] Could not access existing tools, only new tools will be wrapped`);
    }
  } catch (error) {
    if (debug) console.log(`[Proxy Wrapper] Error accessing existing tools: ${error.message}`);
    console.log(`[Proxy Wrapper] Only tools registered after wrapping will be intercepted`);
  }
  
  // Override the tool method to wrap handlers with proxy functionality
  server.tool = function(name, schema, handler) {
    if (debug) console.log(`[Proxy Wrapper] Registering new tool: ${name}`);
    
    // Create a wrapped handler
    const wrappedHandler = wrapHandler(name, handler);
    
    // Register the tool with the wrapped handler
    return originalTool.call(server, name, schema, wrappedHandler);
  };
  
  if (debug) console.log(`[Proxy Wrapper] Server wrapped successfully`);
  return server;
} 