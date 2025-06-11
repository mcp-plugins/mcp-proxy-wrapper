/**
 * @file Memory Transport for Testing
 * @version 1.0.0
 * 
 * This file implements an in-memory transport for MCP testing.
 */

import { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { JSONRPCMessage } from '@modelcontextprotocol/sdk/types.js';

export class MemoryTransport implements Transport {
  private otherSide?: MemoryTransport;
  
  onclose?: () => void;
  onerror?: (error: Error) => void;
  onmessage?: (message: JSONRPCMessage) => void;
  
  static createPair(): { serverTransport: MemoryTransport; clientTransport: MemoryTransport } {
    const serverTransport = new MemoryTransport();
    const clientTransport = new MemoryTransport();
    
    serverTransport.otherSide = clientTransport;
    clientTransport.otherSide = serverTransport;
    
    return { serverTransport, clientTransport };
  }
  
  async start(): Promise<void> {
    // No setup needed for memory transport
  }
  
  async send(message: JSONRPCMessage): Promise<void> {
    if (!this.otherSide) {
      throw new Error('Transport not connected');
    }
    
    // Use process.nextTick to simulate async network
    process.nextTick(() => {
      this.otherSide?.onmessage?.(message);
    });
  }
  
  async close(): Promise<void> {
    this.onclose?.();
    this.otherSide?.onclose?.();
  }
} 