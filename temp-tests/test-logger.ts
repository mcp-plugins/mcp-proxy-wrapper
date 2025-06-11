/**
 * @file Test Logger for MCP Payment Wrapper
 * @version 1.0.0
 * @status STABLE - DO NOT MODIFY WITHOUT TESTS
 * @lastModified 2024-03-12
 * 
 * This module provides a test logger that captures MCP logging notifications
 * for verification in unit tests. It replaces the Winston memory transport.
 * 
 * Functionality:
 * - Log capture for testing
 * - Methods to verify log contents
 * - Compatible with MCP server interface
 */

/**
 * Test logger that captures logs for verification in tests
 */
export class TestLogger {
  /**
   * Array of captured log entries
   */
  logs: Array<{
    level: number;
    logger: string;
    data: string;
  }> = [];

  /**
   * Returns an object that can be used as a mock MCP server for logging
   */
  get logger() {
    return {
      loggingNotification: (log: { level: number; logger: string; data: string }) => {
        this.logs.push(log);
      }
    };
  }

  /**
   * Clears all captured logs
   */
  clear(): void {
    this.logs = [];
  }

  /**
   * Checks if logs contain a specific substring
   * 
   * @param substring The substring to search for
   * @param level Optional log level to filter by
   * @returns True if the substring is found in any log
   */
  contains(substring: string, level?: number): boolean {
    return this.logs.some(log => 
      log.data.includes(substring) && 
      (level === undefined || log.level === level)
    );
  }

  /**
   * Gets logs filtered by level
   * 
   * @param level The log level to filter by
   * @returns Array of logs with the specified level
   */
  getLogsByLevel(level: number): Array<{ level: number; logger: string; data: string }> {
    return this.logs.filter(log => log.level === level);
  }

  /**
   * Gets all captured logs
   * 
   * @returns Array of all logs
   */
  getAllLogs(): Array<{ level: number; logger: string; data: string }> {
    return [...this.logs];
  }
} 