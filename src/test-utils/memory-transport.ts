/**
 * @file Memory Transport for Testing
 * @version 1.0.0
 * 
 * A simple in-memory transport implementation for testing MCP servers.
 */

import { Transport } from '@modelcontextprotocol/sdk/transport/index.js';

// Define the JSONRPCMessage type locally
type JSONRPCMessage = {
  jsonrpc: string;
  id?: string | number;
  method?: string;
  params?: any;
  result?: any;
  error?: {
    code: number;
    message: string;
    data?: any;
  };
};

/**
 * A simple in-memory transport for testing MCP servers
 */
export class MemoryTransport implements Transport {
  private messageHandler: ((message: JSONRPCMessage) => void) | null = null;
  private isConnected = false;
  private pairTransport: MemoryTransport | null = null;

  /**
   * Create a pair of connected memory transports
   * @returns A pair of connected memory transports
   */
  static createPair(): { serverTransport: MemoryTransport; clientTransport: MemoryTransport } {
    const serverTransport = new MemoryTransport();
    const clientTransport = new MemoryTransport();
    
    serverTransport.pairTransport = clientTransport;
    clientTransport.pairTransport = serverTransport;
    
    return { serverTransport, clientTransport };
  }

  /**
   * Start the transport
   */
  async start(): Promise<void> {
    this.isConnected = true;
  }

  /**
   * Close the transport
   */
  async close(): Promise<void> {
    this.isConnected = false;
    this.messageHandler = null;
  }

  /**
   * Send a message through the transport
   * @param message The message to send
   */
  async send(message: JSONRPCMessage): Promise<void> {
    if (!this.isConnected) {
      throw new Error('Transport is not connected');
    }
    
    if (!this.pairTransport) {
      throw new Error('Transport is not paired');
    }
    
    // Forward the message to the paired transport
    this.pairTransport.receiveMessage(message);
  }

  /**
   * Set the message handler for the transport
   * @param handler The handler function for incoming messages
   */
  onMessage(handler: (message: JSONRPCMessage) => void): void {
    this.messageHandler = handler;
  }

  /**
   * Receive a message from the paired transport
   * @param message The message to receive
   */
  private receiveMessage(message: JSONRPCMessage): void {
    if (!this.isConnected) {
      throw new Error('Transport is not connected');
    }
    
    if (this.messageHandler) {
      this.messageHandler(message);
    }
  }
} 