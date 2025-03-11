export interface Calculation {
  id: string;
  operation: string;
  inputs: Record<string, number>;
  result: number;
  timestamp: Date;
}

export interface MemoryState {
  stored: number | null;
  lastResult: number | null;
  history: string[];
}

export enum OperationType {
  ADDITION = 'addition',
  SUBTRACTION = 'subtraction',
  MULTIPLICATION = 'multiplication',
  DIVISION = 'division',
  POWER = 'power',
  SQUARE_ROOT = 'square_root',
  MODULO = 'modulo',
  MEMORY_STORE = 'memory_store',
  MEMORY_RECALL = 'memory_recall',
  MEMORY_CLEAR = 'memory_clear'
} 