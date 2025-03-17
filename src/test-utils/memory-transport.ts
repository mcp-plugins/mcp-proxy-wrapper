/**
 * @file Memory Transport for Testing
 * @version 1.0.0
 * 
 * A simple in-memory transport implementation for testing MCP servers.
 */

// Define the Transport interface locally to avoid import issues
interface Transport {
  start(): Promise<void>;
  close(): Promise<void>;
  send(message: JSONRPCMessage): Promise<void>;
  onMessage(handler: (message: JSONRPCMessage) => void): void;
}

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
    
    // In a real transport, this would send the message to the other side
    // For testing, we can just log it or process it internally
    console.debug('Transport message sent:', message);
  }

  /**
   * Set the message handler for the transport
   * @param handler The handler function for incoming messages
   */
  onMessage(handler: (message: JSONRPCMessage) => void): void {
    this.messageHandler = handler;
  }

  /**
   * Simulate receiving a message from the other side
   * @param message The message to receive
   */
  simulateReceive(message: JSONRPCMessage): void {
    if (!this.isConnected) {
      throw new Error('Transport is not connected');
    }
    
    if (this.messageHandler) {
      this.messageHandler(message);
    }
  }
} 