import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { historyService } from '../services/historyService.js';
import { Calculation } from '../types/index.js';

/**
 * @file History resource
 * @version 1.0.0
 * 
 * Resource for accessing calculation history
 */

// Template for getting all history
export const allHistoryTemplate = new ResourceTemplate(
  "calculator://history/all", 
  { list: undefined }
);

// Template for getting recent history with count parameter
export const recentHistoryTemplate = new ResourceTemplate(
  "calculator://history/recent/{count}", 
  { list: undefined }
);

// Template for getting history by operation type
export const operationHistoryTemplate = new ResourceTemplate(
  "calculator://history/operation/{operation}", 
  { list: undefined }
);

/**
 * Format calculations as text
 */
export function formatCalculationsText(calculations: Calculation[]): string {
  if (calculations.length === 0) {
    return "No calculations found.";
  }
  
  return calculations
    .map(calc => {
      const inputs = Object.entries(calc.inputs)
        .map(([key, value]) => `${key}: ${value}`)
        .join(', ');
        
      return `[${calc.timestamp.toISOString()}] ${calc.operation}(${inputs}) = ${calc.result}`;
    })
    .join('\n');
}

/**
 * Handler for all history resource
 */
export async function handleAllHistory(uri: URL) {
  const calculations = historyService.getAllCalculations();
  const text = formatCalculationsText(calculations);
  
  return {
    contents: [{
      uri: uri.href,
      text
    }]
  };
}

/**
 * Handler for recent history resource
 */
export async function handleRecentHistory(uri: URL, variables: { count: string }) {
  const count = parseInt(variables.count, 10);
  
  if (isNaN(count) || count <= 0) {
    return {
      contents: [{
        uri: uri.href,
        text: "Error: Count must be a positive number"
      }]
    };
  }
  
  const calculations = historyService.getRecentCalculations(count);
  const text = formatCalculationsText(calculations);
  
  return {
    contents: [{
      uri: uri.href,
      text
    }]
  };
}

/**
 * Handler for operation history resource
 */
export async function handleOperationHistory(uri: URL, variables: { operation: string }) {
  const { operation } = variables;
  const calculations = historyService.getCalculationsByOperation(operation);
  const text = formatCalculationsText(calculations);
  
  return {
    contents: [{
      uri: uri.href,
      text
    }]
  };
} 