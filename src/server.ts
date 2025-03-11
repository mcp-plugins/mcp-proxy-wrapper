import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

// Import all tools
import * as tools from './tools/index.js';

// Import all resources
import * as resources from './resources/index.js';

// Import all prompts
import * as prompts from './prompts/index.js';

// Add missing imports
import { historyService } from './services/historyService.js';
import { formatCalculationsText } from './resources/history.js';
import { OperationType } from './types/index.js';
import { documentation } from './resources/documentation.js';

// Type for resource template variables
interface Variables extends Record<string, string | string[]> {}

// Type definitions for tool handlers
type RequestHandlerParams<T> = {
  [K in keyof T]: T[K];
}

/**
 * @file Main MCP Calculator server
 * @version 1.0.0
 * @status STABLE - DO NOT MODIFY WITHOUT TESTS
 * 
 * Main entry point for the calculator MCP server
 * 
 * IMPORTANT:
 * - All changes must be accompanied by tests
 * - Maintain backwards compatibility
 * 
 * Functionality:
 * - Exposes calculator operations as tools
 * - Provides access to calculation history and documentation
 * - Includes prompt templates for common calculator tasks
 */

async function main() {
  // Create the MCP server
  const server = new McpServer({
    name: "MCP Calculator",
    version: "1.0.0",
    description: "A calculator service that provides basic and advanced mathematical operations"
  });

  // Register basic operation tools using the correct pattern
  // Basic tools
  server.tool("add", { a: z.number(), b: z.number() }, async (args, extra) => {
    const result = args.a + args.b;
    historyService.addCalculation(OperationType.ADDITION, { a: args.a, b: args.b }, result);
    
    return {
      content: [{ 
        type: "text" as const, 
        text: `${args.a} + ${args.b} = ${result}`
      }]
    };
  });
  
  server.tool("subtract", { a: z.number(), b: z.number() }, async (args, extra) => {
    const result = args.a - args.b;
    historyService.addCalculation(OperationType.SUBTRACTION, { a: args.a, b: args.b }, result);
    
    return {
      content: [{ 
        type: "text" as const, 
        text: `${args.a} - ${args.b} = ${result}`
      }]
    };
  });
  
  server.tool("multiply", { a: z.number(), b: z.number() }, async (args, extra) => {
    const result = args.a * args.b;
    historyService.addCalculation(OperationType.MULTIPLICATION, { a: args.a, b: args.b }, result);
    
    return {
      content: [{ 
        type: "text" as const, 
        text: `${args.a} × ${args.b} = ${result}`
      }]
    };
  });
  
  server.tool("divide", { a: z.number(), b: z.number() }, async (args, extra) => {
    if (args.b === 0) {
      return {
        content: [{ 
          type: "text" as const, 
          text: "Error: Division by zero is not allowed"
        }]
      };
    }
    
    const result = args.a / args.b;
    historyService.addCalculation(OperationType.DIVISION, { a: args.a, b: args.b }, result);
    
    return {
      content: [{ 
        type: "text" as const, 
        text: `${args.a} ÷ ${args.b} = ${result}`
      }]
    };
  });
  
  // Advanced tools
  server.tool("power", { base: z.number(), exponent: z.number() }, async (args, extra) => {
    const result = Math.pow(args.base, args.exponent);
    historyService.addCalculation(OperationType.POWER, { base: args.base, exponent: args.exponent }, result);
    
    return {
      content: [{ 
        type: "text" as const, 
        text: `${args.base}^${args.exponent} = ${result}`
      }]
    };
  });
  
  server.tool("sqrt", { number: z.number().min(0) }, async (args, extra) => {
    const result = Math.sqrt(args.number);
    historyService.addCalculation(OperationType.SQUARE_ROOT, { number: args.number }, result);
    
    return {
      content: [{ 
        type: "text" as const, 
        text: `√${args.number} = ${result}`
      }]
    };
  });
  
  server.tool("modulo", { a: z.number(), b: z.number().refine(v => v !== 0) }, async (args, extra) => {
    const result = args.a % args.b;
    historyService.addCalculation(OperationType.MODULO, { a: args.a, b: args.b }, result);
    
    return {
      content: [{ 
        type: "text" as const, 
        text: `${args.a} % ${args.b} = ${result}`
      }]
    };
  });
  
  // Memory tools
  server.tool("memory_store", { value: z.number() }, async (args, extra) => {
    historyService.storeInMemory(args.value);
    
    return {
      content: [{ 
        type: "text" as const, 
        text: `Value ${args.value} stored in memory`
      }]
    };
  });
  
  server.tool("memory_recall", {}, async (args, extra) => {
    const value = historyService.recallFromMemory();
    
    if (value === null) {
      return {
        content: [{ 
          type: "text" as const, 
          text: "Memory is empty"
        }]
      };
    }
    
    return {
      content: [{ 
        type: "text" as const, 
        text: `Memory value: ${value}`
      }]
    };
  });
  
  server.tool("memory_clear", {}, async (args, extra) => {
    historyService.clearMemory();
    
    return {
      content: [{ 
        type: "text" as const, 
        text: "Memory cleared"
      }]
    };
  });

  // Register resources using resource templates from imported modules
  server.resource("history_all", resources.allHistoryTemplate, async (uri, extra) => {
    try {
      const calculations = historyService.getAllCalculations();
      const text = formatCalculationsText(calculations);
      
      return {
        contents: [{
          uri: uri.href,
          text
        }]
      };
    } catch (error) {
      return {
        contents: [{
          uri: uri.href,
          text: `Error: ${(error as Error).message}`
        }]
      };
    }
  });

  server.resource("history_recent", resources.recentHistoryTemplate, async (uri, extra) => {
    try {
      // Extract variables from URI
      const match = /\/recent\/(\d+)/.exec(uri.pathname);
      if (!match || !match[1]) {
        return {
          contents: [{
            uri: uri.href,
            text: "Error: Count parameter is required"
          }]
        };
      }
      
      // Get the count parameter and convert to number
      const count = parseInt(match[1], 10);
      
      if (isNaN(count) || count <= 0) {
        return {
          contents: [{
            uri: uri.href,
            text: "Error: Count must be a positive number"
          }]
        };
      }
      
      // Get recent calculations and format as text
      const calculations = historyService.getRecentCalculations(count);
      const text = formatCalculationsText(calculations);
      
      return {
        contents: [{
          uri: uri.href,
          text
        }]
      };
    } catch (error) {
      return {
        contents: [{
          uri: uri.href,
          text: `Error: ${(error as Error).message}`
        }]
      };
    }
  });

  server.resource("history_operation", resources.operationHistoryTemplate, async (uri, extra) => {
    try {
      // Extract variables from URI
      const match = /\/operation\/([^/]+)/.exec(uri.pathname);
      if (!match || !match[1]) {
        return {
          contents: [{
            uri: uri.href,
            text: "Error: Operation parameter is required"
          }]
        };
      }
      
      // Get the operation parameter
      const operation = decodeURIComponent(match[1]);
      
      // Get calculations by operation and format as text
      const calculations = historyService.getCalculationsByOperation(operation);
      const text = formatCalculationsText(calculations);
      
      return {
        contents: [{
          uri: uri.href,
          text
        }]
      };
    } catch (error) {
      return {
        contents: [{
          uri: uri.href,
          text: `Error: ${(error as Error).message}`
        }]
      };
    }
  });

  // Register documentation resource
  server.resource("documentation", resources.documentationTemplate, async (uri, extra) => {
    try {
      // Extract variables from URI
      const match = /\/documentation\/([^/]+)/.exec(uri.pathname);
      if (!match || !match[1]) {
        return {
          contents: [{
            uri: uri.href,
            text: "Error: Section parameter is required"
          }]
        };
      }
      
      // Get the section parameter
      const section = decodeURIComponent(match[1]);
      
      const docText = documentation[section as keyof typeof documentation] || 
        "Documentation section not found. Available sections: basic, advanced, memory, all";
      
      return {
        contents: [{
          uri: uri.href,
          text: docText
        }]
      };
    } catch (error) {
      return {
        contents: [{
          uri: uri.href,
          text: `Error: ${(error as Error).message}`
        }]
      };
    }
  });

  // Register memory state resource
  server.resource("memory_state", resources.memoryStateTemplate, async (uri, extra) => {
    try {
      const memoryState = historyService.getMemoryState();
      
      const text = `
# Calculator Memory State

Stored Value: ${memoryState.stored !== null ? memoryState.stored : 'None'}
Last Result: ${memoryState.lastResult !== null ? memoryState.lastResult : 'None'}

## Recent Operations
${memoryState.history.slice(-5).map((entry, index) => `${index + 1}. ${entry}`).join('\n')}
`;
      
      return {
        contents: [{
          uri: uri.href,
          text
        }]
      };
    } catch (error) {
      return {
        contents: [{
          uri: uri.href,
          text: `Error: ${(error as Error).message}`
        }]
      };
    }
  });

  // Register prompts
  server.prompt(prompts.basicCalculationPrompt.name, () => {
    return {
      messages: [
        {
          role: "assistant",
          content: {
            type: "text" as const,
            text: prompts.basicCalculationPrompt.template
          }
        }
      ]
    };
  });

  server.prompt(prompts.complexCalculationPrompt.name, () => {
    return {
      messages: [
        {
          role: "assistant",
          content: {
            type: "text" as const,
            text: prompts.complexCalculationPrompt.template
          }
        }
      ]
    };
  });

  server.prompt(prompts.multistepCalculationPrompt.name, () => {
    return {
      messages: [
        {
          role: "assistant",
          content: {
            type: "text" as const,
            text: prompts.multistepCalculationPrompt.template
          }
        }
      ]
    };
  });

  // Set up the transport (using stdio for simple demonstration)
  const transport = new StdioServerTransport();

  // Connect the server to the transport
  await server.connect(transport);
}

main().catch(err => {
  process.exit(1);
}); 