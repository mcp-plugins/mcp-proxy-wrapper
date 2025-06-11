/**
 * @file MCP Proxy Wrapper
 * @version 1.0.0
 * 
 * A simple proxy wrapper for MCP servers to add hooks before and after tool calls.
 */

// Basic console logger for the JavaScript version
function createLogger(options = {}) {
  const level = options.level || 'info';
  const levels = {
    debug: 0,
    info: 1,
    warn: 3,
    error: 4
  };
  
  const minLevel = levels[level] || 1;
  
  return {
    debug: (...args) => {
      if (minLevel <= levels.debug) {
        console.log('[DEBUG]', ...args);
      }
    },
    info: (...args) => {
      if (minLevel <= levels.info) {
        console.log('[INFO]', ...args);
      }
    },
    warn: (...args) => {
      if (minLevel <= levels.warn) {
        console.warn('[WARN]', ...args);
      }
    },
    error: (...args) => {
      if (minLevel <= levels.error) {
        console.error('[ERROR]', ...args);
      }
    }
  };
}

// Debug utility function for development
function debugInspect(obj, label) {
  if (process.env.DEBUG_MCP_PROXY) {
    console.log(`DEBUG ${label}: `, 
      JSON.stringify({
        type: typeof obj,
        keys: obj ? Object.keys(obj) : 'null',
        prototype: obj ? Object.getPrototypeOf(obj)?.constructor?.name : 'null',
        value: obj
      }, null, 2)
    );
  }
}

/**
 * Wraps an MCP server with hooks for before and after tool calls.
 * 
 * @param {object} server - An MCP server instance
 * @param {object} options - Options for the wrapper
 * @param {object} options.hooks - Hooks to run before or after tool calls
 * @param {function} options.hooks.beforeToolCall - Function to run before a tool call
 * @param {function} options.hooks.afterToolCall - Function to run after a tool call
 * @param {boolean} options.debug - Whether to log debug information
 * @returns {object} The original server with hooks added
 */
export function wrapWithProxy(server, options = {}) {
  const debug = options?.debug || false;
  const logger = createLogger({ level: debug ? 'debug' : 'info' });
  
  logger.debug('Initializing MCP Proxy Wrapper');
  debugInspect(server, 'Server Object');
  debugInspect(options, 'Options');
  
  // Store the original tool method
  const originalTool = server.tool;
  
  // Replace the tool method with our own
  server.tool = function(...args) {
    logger.debug(`Registering tool: ${args[0]}`);
    debugInspect(args, 'Tool Arguments');
    
    // Register the tool with the server
    return originalTool.apply(this, args);
  };
  
  // Store the original callTool method
  const originalCallTool = server.callTool;
  
  // Replace the callTool method with our own proxy
  server.callTool = async function(name, args) {
    logger.debug(`Tool call: ${name}`);
    debugInspect(args, 'Tool Call Arguments');
    
    try {
      // Create context object for hooks
      const context = {
        toolName: name,
        args: args || {},
        server: this
      };
      
      // Execute beforeToolCall hook if configured
      if (options?.hooks?.beforeToolCall) {
        try {
          debugInspect(options.hooks.beforeToolCall, 'beforeToolCall Hook');
          const beforeResult = await options.hooks.beforeToolCall(context);
          
          // If the hook returns a result, short-circuit and return it directly
          if (beforeResult) {
            logger.debug(`Short-circuiting tool call: ${name}`);
            return beforeResult.result;
          }
        } catch (error) {
          logger.error(`Error in beforeToolCall hook: ${error.message}`);
          
          // Return error as a tool result
          return {
            content: [
              {
                type: "text",
                text: `Error in beforeToolCall hook: ${error.message}\n${error.stack}`
              }
            ],
            isError: true
          };
        }
      }
      
      // Call the original method
      const result = await originalCallTool.call(this, name, context.args);
      debugInspect(result, 'Tool Call Result');
      
      // Execute afterToolCall hook if configured
      if (options?.hooks?.afterToolCall) {
        try {
          debugInspect(options.hooks.afterToolCall, 'afterToolCall Hook');
          const afterContext = {
            toolName: name,
            args: context.args,
            server: this
          };
          
          const afterResult = await options.hooks.afterToolCall(afterContext, { result });
          return afterResult.result;
        } catch (error) {
          logger.error(`Error in afterToolCall hook: ${error.message}`);
          
          // Return error as a tool result
          return {
            content: [
              {
                type: "text",
                text: `Error in afterToolCall hook: ${error.message}\n${error.stack}`
              }
            ],
            isError: true
          };
        }
      }
      
      return result;
    } catch (error) {
      logger.error(`Error in tool call: ${error.message}`);
      
      // Return error as a tool result
      return {
        content: [
          {
            type: "text",
            text: String(error)
          }
        ],
        isError: true
      };
    }
  };
  
  logger.debug('MCP Proxy Wrapper initialized');
  
  return server;
} 