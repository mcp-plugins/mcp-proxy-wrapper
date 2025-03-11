import { z } from 'zod';
import { historyService } from '../services/historyService.js';
import { OperationType } from '../types/index.js';

/**
 * @file Basic calculator operations
 * @version 1.0.0
 * 
 * Implements the four basic arithmetic operations
 */

/**
 * Add two numbers
 */
export const addTool = {
  name: "add",
  schema: { a: z.number(), b: z.number() },
  handler: async ({ a, b }: { a: number, b: number }) => {
    const result = a + b;
    historyService.addCalculation(OperationType.ADDITION, { a, b }, result);
    
    return {
      content: [{ 
        type: "text" as const,
        text: `${a} + ${b} = ${result}`
      }]
    };
  }
};

/**
 * Subtract two numbers
 */
export const subtractTool = {
  name: "subtract",
  schema: { a: z.number(), b: z.number() },
  handler: async ({ a, b }: { a: number, b: number }) => {
    const result = a - b;
    historyService.addCalculation(OperationType.SUBTRACTION, { a, b }, result);
    
    return {
      content: [{ 
        type: "text" as const,
        text: `${a} - ${b} = ${result}`
      }]
    };
  }
};

/**
 * Multiply two numbers
 */
export const multiplyTool = {
  name: "multiply",
  schema: { a: z.number(), b: z.number() },
  handler: async ({ a, b }: { a: number, b: number }) => {
    const result = a * b;
    historyService.addCalculation(OperationType.MULTIPLICATION, { a, b }, result);
    
    return {
      content: [{ 
        type: "text" as const,
        text: `${a} × ${b} = ${result}`
      }]
    };
  }
};

/**
 * Divide two numbers
 */
export const divideTool = {
  name: "divide",
  schema: { a: z.number(), b: z.number() },
  handler: async ({ a, b }: { a: number, b: number }) => {
    if (b === 0) {
      throw new Error("Division by zero is not allowed");
    }
    
    const result = a / b;
    historyService.addCalculation(OperationType.DIVISION, { a, b }, result);
    
    return {
      content: [{ 
        type: "text" as const,
        text: `${a} ÷ ${b} = ${result}`
      }]
    };
  }
};