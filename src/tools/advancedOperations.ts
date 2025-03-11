import { z } from 'zod';
import { historyService } from '../services/historyService.js';
import { OperationType } from '../types/index.js';

/**
 * @file Advanced calculator operations
 * @version 1.0.0
 * 
 * Implements power, square root, and modulo operations
 */

/**
 * Calculate the power of a number
 */
export const powerTool = {
  name: "power",
  schema: { base: z.number(), exponent: z.number() },
  handler: async ({ base, exponent }: { base: number, exponent: number }) => {
    const result = Math.pow(base, exponent);
    historyService.addCalculation(OperationType.POWER, { base, exponent }, result);
    
    return {
      content: [{ 
        type: "text", 
        text: `${base}^${exponent} = ${result}` 
      }]
    };
  }
};

/**
 * Calculate the square root of a number
 */
export const squareRootTool = {
  name: "sqrt",
  schema: { 
    number: z.number().refine(val => val >= 0, {
      message: "Cannot calculate square root of a negative number"
    })
  },
  handler: async ({ number }: { number: number }) => {
    if (number < 0) {
      return {
        content: [{ 
          type: "text", 
          text: "Error: Cannot calculate square root of a negative number" 
        }]
      };
    }
    
    const result = Math.sqrt(number);
    historyService.addCalculation(OperationType.SQUARE_ROOT, { number }, result);
    
    return {
      content: [{ 
        type: "text", 
        text: `√${number} = ${result}` 
      }]
    };
  }
};

/**
 * Calculate the modulo (remainder after division)
 */
export const moduloTool = {
  name: "modulo",
  schema: { 
    a: z.number(),
    b: z.number().refine(val => val !== 0, {
      message: "Modulo by zero is not allowed"
    })
  },
  handler: async ({ a, b }: { a: number, b: number }) => {
    if (b === 0) {
      return {
        content: [{ 
          type: "text", 
          text: "Error: Modulo by zero is not allowed" 
        }]
      };
    }
    
    const result = a % b;
    historyService.addCalculation(OperationType.MODULO, { a, b }, result);
    
    return {
      content: [{ 
        type: "text", 
        text: `${a} % ${b} = ${result}` 
      }]
    };
  }
}; 