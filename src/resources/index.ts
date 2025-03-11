/**
 * @file Resource exports
 * @version 1.0.0
 * 
 * Export all calculator resources
 */

// History resources
export { 
  allHistoryTemplate, 
  recentHistoryTemplate, 
  operationHistoryTemplate,
  handleAllHistory,
  handleRecentHistory,
  handleOperationHistory
} from './history.js';

// Documentation resources
export {
  documentationTemplate,
  handleDocumentation
} from './documentation.js';

// Memory resources
export {
  memoryStateTemplate,
  handleMemoryState
} from './memory.js'; 