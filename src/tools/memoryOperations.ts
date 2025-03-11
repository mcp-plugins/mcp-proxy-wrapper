import { z } from 'zod';
import { historyService } from '../services/historyService.js';
import { OperationType } from '../types/index.js';

/**
 * @file Memory operations
 * @version 1.0.0
 * 
 * Implements calculator memory storage and recall
 */

/**
 * Store a value in memory
 */
export const memoryStoreTool = {
  name: "memory_store",
  schema: { value: z.number() },
  handler: async ({ value }: { value: number }) => {
    historyService.storeInMemory(value);
    
    return {
      content: [{ 
        type: "text", 
        text: `Value ${value} stored in memory` 
      }]
    };
  }
};

/**
 * Recall the value from memory
 */
export const memoryRecallTool = {
  name: "memory_recall",
  schema: {},
  handler: async () => {
    const value = historyService.recallFromMemory();
    
    if (value === null) {
      return {
        content: [{ 
          type: "text", 
          text: "No value stored in memory" 
        }]
      };
    }
    
    return {
      content: [{ 
        type: "text", 
        text: `Memory recall: ${value}` 
      }]
    };
  }
};

/**
 * Clear the memory
 */
export const memoryClearTool = {
  name: "memory_clear",
  schema: {},
  handler: async () => {
    historyService.clearMemory();
    
    return {
      content: [{ 
        type: "text", 
        text: "Memory cleared" 
      }]
    };
  }
}; 