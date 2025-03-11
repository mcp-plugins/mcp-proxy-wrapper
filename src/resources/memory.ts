import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import { historyService } from '../services/historyService.js';

/**
 * @file Memory state resource
 * @version 1.0.0
 * 
 * Resource for accessing calculator memory state
 */

// Template for getting memory state
export const memoryStateTemplate = new ResourceTemplate(
  "calculator://memory", 
  { list: undefined }
);

/**
 * Handler for memory state resource
 */
export async function handleMemoryState(uri: URL) {
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
} 