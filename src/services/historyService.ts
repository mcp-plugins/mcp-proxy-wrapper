import { Calculation, MemoryState } from '../types/index.js';
import crypto from 'crypto';

/**
 * @file HistoryService
 * @version 1.0.0
 * 
 * Service for tracking calculation history and memory state
 */
export class HistoryService {
  private calculations: Calculation[] = [];
  private memoryState: MemoryState = {
    stored: null,
    lastResult: null,
    history: []
  };

  /**
   * Add a calculation to history
   */
  addCalculation(operation: string, inputs: Record<string, number>, result: number): Calculation {
    const calculation: Calculation = {
      id: crypto.randomUUID(),
      operation,
      inputs,
      result,
      timestamp: new Date()
    };
    
    this.calculations.push(calculation);
    this.memoryState.lastResult = result;
    this.memoryState.history.push(`${operation}: ${JSON.stringify(inputs)} = ${result}`);
    
    return calculation;
  }

  /**
   * Get all calculations
   */
  getAllCalculations(): Calculation[] {
    return [...this.calculations];
  }

  /**
   * Get calculations by operation type
   */
  getCalculationsByOperation(operation: string): Calculation[] {
    return this.calculations.filter(calc => calc.operation === operation);
  }

  /**
   * Get the most recent calculations
   */
  getRecentCalculations(count: number): Calculation[] {
    return [...this.calculations]
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, count);
  }

  /**
   * Store a value in memory
   */
  storeInMemory(value: number): void {
    this.memoryState.stored = value;
    this.addCalculation('memory_store', { value }, value);
  }

  /**
   * Recall the value from memory
   */
  recallFromMemory(): number | null {
    const value = this.memoryState.stored;
    if (value !== null) {
      this.addCalculation('memory_recall', {}, value);
    }
    return value;
  }

  /**
   * Clear the memory
   */
  clearMemory(): void {
    this.memoryState.stored = null;
    this.addCalculation('memory_clear', {}, 0);
  }

  /**
   * Get the current memory state
   */
  getMemoryState(): MemoryState {
    return { ...this.memoryState };
  }

  /**
   * Get the last calculation result
   */
  getLastResult(): number | null {
    return this.memoryState.lastResult;
  }
}

// Singleton instance
export const historyService = new HistoryService(); 