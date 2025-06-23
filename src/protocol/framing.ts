/**
 * @file JSON-RPC Message Framing for MCP Protocol
 * @version 2.0.0
 * @status STABLE - Handles message serialization and parsing
 * 
 * Implements standardized JSON-RPC 2.0 message framing with length prefixes
 * for reliable communication across all transport types. This addresses the
 * O3 review recommendation for consistent binary framing.
 */

import { JsonRpcMessage, JsonRpcError, ProtocolError, TransportType } from '../interfaces/connection.js';

/**
 * Maximum allowed message size (10MB) to prevent DoS attacks
 */
const MAX_MESSAGE_SIZE = 10 * 1024 * 1024;

/**
 * Maximum header size (1KB) for Content-Length headers
 */
const MAX_HEADER_SIZE = 1024;

/**
 * Header separator for length-prefixed messages
 */
const HEADER_SEPARATOR = '\r\n\r\n';

/**
 * JSON-RPC message framer that handles serialization and parsing
 * with length prefixes for reliable stream-based communication
 */
export class MessageFramer {
  /**
   * Serialize a JSON-RPC message to a length-prefixed buffer
   * @param message The JSON-RPC message to serialize
   * @returns Buffer containing the framed message
   */
  static serialize(message: JsonRpcMessage): Buffer {
    try {
      // Validate message structure
      this.validateMessage(message);
      
      // Serialize to JSON
      const json = JSON.stringify(message);
      const length = Buffer.byteLength(json, 'utf8');
      
      // Check size limits
      if (length > MAX_MESSAGE_SIZE) {
        throw new Error(`Message size ${length} exceeds maximum allowed size ${MAX_MESSAGE_SIZE}`);
      }
      
      // Create length-prefixed frame
      const header = `Content-Length: ${length}${HEADER_SEPARATOR}`;
      const headerBuffer = Buffer.from(header, 'utf8');
      const bodyBuffer = Buffer.from(json, 'utf8');
      
      return Buffer.concat([headerBuffer, bodyBuffer]);
    } catch (error) {
      throw new ProtocolError(
        `Failed to serialize message: ${error instanceof Error ? error.message : String(error)}`,
        'unknown' as TransportType,
        message
      );
    }
  }
  
  /**
   * Parse length-prefixed messages from a buffer
   * @param buffer The buffer containing framed messages
   * @returns Array of parsed messages and remaining buffer
   */
  static parse(buffer: Buffer): { messages: JsonRpcMessage[]; remaining: Buffer } {
    const messages: JsonRpcMessage[] = [];
    let offset = 0;
    
    while (offset < buffer.length) {
      try {
        // Find header separator
        const headerEnd = buffer.indexOf(HEADER_SEPARATOR, offset);
        if (headerEnd === -1) {
          // Incomplete header, need more data
          break;
        }
        
        // Extract and parse header
        const headerLength = headerEnd - offset;
        if (headerLength > MAX_HEADER_SIZE) {
          throw new ProtocolError(
            `Header size ${headerLength} exceeds maximum allowed size ${MAX_HEADER_SIZE}`,
            'unknown' as TransportType
          );
        }
        
        const header = buffer.subarray(offset, headerEnd).toString('utf8');
        const contentLength = this.parseContentLength(header);
        
        // Check if we have the complete message body
        const bodyStart = headerEnd + HEADER_SEPARATOR.length;
        const bodyEnd = bodyStart + contentLength;
        
        if (bodyEnd > buffer.length) {
          // Incomplete body, need more data
          break;
        }
        
        // Extract and parse message body
        const body = buffer.subarray(bodyStart, bodyEnd).toString('utf8');
        const message = this.parseMessage(body);
        
        messages.push(message);
        offset = bodyEnd;
      } catch (error) {
        // Skip invalid message and continue parsing
        console.error('Failed to parse message:', error);
        offset += 1; // Skip one byte and try again
      }
    }
    
    // Return parsed messages and remaining buffer
    const remaining = offset < buffer.length ? buffer.subarray(offset) : Buffer.alloc(0);
    return { messages, remaining };
  }
  
  /**
   * Parse a single JSON message without framing
   * @param json The JSON string to parse
   * @returns Parsed JSON-RPC message
   */
  static parseMessage(json: string): JsonRpcMessage {
    try {
      if (json.length > MAX_MESSAGE_SIZE) {
        throw new Error(`Message size ${json.length} exceeds maximum allowed size ${MAX_MESSAGE_SIZE}`);
      }
      
      const message = JSON.parse(json) as JsonRpcMessage;
      this.validateMessage(message);
      return message;
    } catch (error) {
      throw new ProtocolError(
        `Failed to parse JSON message: ${error instanceof Error ? error.message : String(error)}`,
        'unknown' as TransportType,
        json
      );
    }
  }
  
  /**
   * Create a JSON-RPC request message
   * @param method The method name
   * @param params The method parameters
   * @param id The request ID
   * @returns JSON-RPC request message
   */
  static createRequest(method: string, params?: any, id?: string | number): JsonRpcMessage {
    const message: JsonRpcMessage = {
      jsonrpc: '2.0',
      method,
      id: id ?? this.generateId()
    };
    
    if (params !== undefined) {
      message.params = params;
    }
    
    return message;
  }
  
  /**
   * Create a JSON-RPC response message
   * @param result The response result
   * @param id The request ID
   * @returns JSON-RPC response message
   */
  static createResponse(result: any, id: string | number): JsonRpcMessage {
    return {
      jsonrpc: '2.0',
      result,
      id
    };
  }
  
  /**
   * Create a JSON-RPC error response message
   * @param error The error information
   * @param id The request ID
   * @returns JSON-RPC error response message
   */
  static createErrorResponse(error: JsonRpcError, id?: string | number | null): JsonRpcMessage {
    return {
      jsonrpc: '2.0',
      error,
      id: id ?? null
    };
  }
  
  /**
   * Create a JSON-RPC notification message
   * @param method The method name
   * @param params The method parameters
   * @returns JSON-RPC notification message
   */
  static createNotification(method: string, params?: any): JsonRpcMessage {
    const message: JsonRpcMessage = {
      jsonrpc: '2.0',
      method
    };
    
    if (params !== undefined) {
      message.params = params;
    }
    
    return message;
  }
  
  /**
   * Check if a message is a request
   * @param message The message to check
   * @returns True if the message is a request
   */
  static isRequest(message: JsonRpcMessage): boolean {
    return !!(message.method && (message.id !== undefined));
  }
  
  /**
   * Check if a message is a notification
   * @param message The message to check
   * @returns True if the message is a notification
   */
  static isNotification(message: JsonRpcMessage): boolean {
    return !!(message.method && message.id === undefined);
  }
  
  /**
   * Check if a message is a response
   * @param message The message to check
   * @returns True if the message is a response
   */
  static isResponse(message: JsonRpcMessage): boolean {
    return !message.method && (message.result !== undefined || message.error !== undefined);
  }
  
  /**
   * Check if a message is an error response
   * @param message The message to check
   * @returns True if the message is an error response
   */
  static isError(message: JsonRpcMessage): boolean {
    return !!message.error;
  }
  
  /**
   * Parse Content-Length header from a header string
   * @param header The header string
   * @returns The content length value
   */
  private static parseContentLength(header: string): number {
    const match = header.match(/^Content-Length:\s*(\d+)$/im);
    if (!match) {
      throw new Error('Invalid or missing Content-Length header');
    }
    
    const length = parseInt(match[1], 10);
    if (isNaN(length) || length < 0) {
      throw new Error(`Invalid Content-Length value: ${match[1]}`);
    }
    
    if (length > MAX_MESSAGE_SIZE) {
      throw new Error(`Content-Length ${length} exceeds maximum allowed size ${MAX_MESSAGE_SIZE}`);
    }
    
    return length;
  }
  
  /**
   * Validate a JSON-RPC message structure
   * @param message The message to validate
   */
  private static validateMessage(message: any): void {
    if (!message || typeof message !== 'object') {
      throw new Error('Message must be an object');
    }
    
    if (message.jsonrpc !== '2.0') {
      throw new Error('Message must have jsonrpc: "2.0"');
    }
    
    // Validate request/notification
    if (message.method) {
      if (typeof message.method !== 'string') {
        throw new Error('Method must be a string');
      }
      
      if (message.method.startsWith('rpc.')) {
        throw new Error('Method names starting with "rpc." are reserved');
      }
    }
    
    // Validate response
    if (!message.method) {
      if (message.result === undefined && message.error === undefined) {
        throw new Error('Response must have either result or error');
      }
      
      if (message.result !== undefined && message.error !== undefined) {
        throw new Error('Response cannot have both result and error');
      }
      
      if (message.error) {
        this.validateError(message.error);
      }
    }
    
    // Validate ID
    if (message.id !== undefined && message.id !== null) {
      const idType = typeof message.id;
      if (idType !== 'string' && idType !== 'number') {
        throw new Error('ID must be a string, number, or null');
      }
    }
  }
  
  /**
   * Validate a JSON-RPC error object
   * @param error The error object to validate
   */
  private static validateError(error: any): void {
    if (!error || typeof error !== 'object') {
      throw new Error('Error must be an object');
    }
    
    if (typeof error.code !== 'number') {
      throw new Error('Error code must be a number');
    }
    
    if (typeof error.message !== 'string') {
      throw new Error('Error message must be a string');
    }
  }
  
  /**
   * Generate a unique request ID
   * @returns A unique string ID
   */
  private static generateId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}

/**
 * Streaming message parser for handling partial message data
 * This is particularly useful for STDIO and WebSocket transports
 */
export class StreamingMessageParser {
  private buffer = Buffer.alloc(0);
  private maxBufferSize = MAX_MESSAGE_SIZE * 2; // Allow buffering multiple messages
  
  /**
   * Add data to the parser buffer and return any complete messages
   * @param data The data to add
   * @returns Array of complete messages
   */
  addData(data: Buffer): JsonRpcMessage[] {
    // Append new data to buffer
    this.buffer = Buffer.concat([this.buffer, data]);
    
    // Check buffer size limits
    if (this.buffer.length > this.maxBufferSize) {
      throw new ProtocolError(
        `Buffer size ${this.buffer.length} exceeds maximum allowed size ${this.maxBufferSize}`,
        'unknown' as TransportType
      );
    }
    
    // Parse complete messages
    const { messages, remaining } = MessageFramer.parse(this.buffer);
    this.buffer = remaining;
    
    return messages;
  }
  
  /**
   * Clear the internal buffer
   */
  clear(): void {
    this.buffer = Buffer.alloc(0);
  }
  
  /**
   * Get the current buffer size
   */
  getBufferSize(): number {
    return this.buffer.length;
  }
  
  /**
   * Check if the buffer has data
   */
  hasData(): boolean {
    return this.buffer.length > 0;
  }
}

/**
 * Standard JSON-RPC error codes
 */
export const JsonRpcErrorCodes = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  
  // Custom error codes (application-specific)
  TRANSPORT_ERROR: -32000,
  TIMEOUT_ERROR: -32001,
  CONNECTION_ERROR: -32002,
  AUTHENTICATION_ERROR: -32003,
  AUTHORIZATION_ERROR: -32004,
  RATE_LIMIT_ERROR: -32005,
  PLUGIN_ERROR: -32006
} as const;

/**
 * Helper functions for creating standard error responses
 */
export const JsonRpcErrors = {
  parseError(data?: any): JsonRpcError {
    return {
      code: JsonRpcErrorCodes.PARSE_ERROR,
      message: 'Parse error',
      data
    };
  },
  
  invalidRequest(data?: any): JsonRpcError {
    return {
      code: JsonRpcErrorCodes.INVALID_REQUEST,
      message: 'Invalid Request',
      data
    };
  },
  
  methodNotFound(method: string): JsonRpcError {
    return {
      code: JsonRpcErrorCodes.METHOD_NOT_FOUND,
      message: 'Method not found',
      data: { method }
    };
  },
  
  invalidParams(params?: any): JsonRpcError {
    return {
      code: JsonRpcErrorCodes.INVALID_PARAMS,
      message: 'Invalid params',
      data: params
    };
  },
  
  internalError(message?: string, data?: any): JsonRpcError {
    return {
      code: JsonRpcErrorCodes.INTERNAL_ERROR,
      message: message ?? 'Internal error',
      data
    };
  },
  
  transportError(message: string, data?: any): JsonRpcError {
    return {
      code: JsonRpcErrorCodes.TRANSPORT_ERROR,
      message,
      data
    };
  },
  
  timeoutError(timeoutMs: number): JsonRpcError {
    return {
      code: JsonRpcErrorCodes.TIMEOUT_ERROR,
      message: `Request timed out after ${timeoutMs}ms`,
      data: { timeoutMs }
    };
  },
  
  connectionError(message: string, data?: any): JsonRpcError {
    return {
      code: JsonRpcErrorCodes.CONNECTION_ERROR,
      message,
      data
    };
  }
};