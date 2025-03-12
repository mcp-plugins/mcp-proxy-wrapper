/**
 * @file Example usage of the MCP Payment Wrapper
 * @version 1.0.0
 * 
 * This file demonstrates how to use the payment wrapper to add
 * payment functionality to an existing MCP server.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
// When using the published package, import would be:
// import { wrapWithPayments } from '@modelcontextprotocol/payment-wrapper';
// For local development, we use:
import { wrapWithPayments } from './payment-wrapper.js';

async function main() {
  // Create a simple demo MCP server
  const demoServer = new McpServer({
    name: "Demo MCP Server",
    version: "1.0.0",
    description: "A simple demo MCP server"
  });

  // Register a simple tool for demonstration
  demoServer.tool("greet", { name: z.string() }, async (args, extra) => {
    return {
      content: [{ 
        type: "text" as const, 
        text: `Hello, ${args.name}!` 
      }]
    };
  });

  // Register a more expensive tool for demonstration
  demoServer.tool("complex_analysis", { data: z.string() }, async (args, extra) => {
    return {
      content: [{ 
        type: "text" as const, 
        text: `Complex analysis complete: ${args.data.length} characters processed.` 
      }]
    };
  });

  // Wrap the demo server with payment functionality
  // In a real application, these values would come from environment variables or configuration
  const paymentsEnabledServer = wrapWithPayments(demoServer, {
    apiKey: 'demo-api-key-123',
    userToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTEyMyIsIm5hbWUiOiJKb2huIERvZSIsImlhdCI6MTUxNjIzOTAyMn0.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c',
    debugMode: true
  });
  
  // With the proxy approach, we don't need to register tools again
  // The wrapper will automatically intercept calls to the original server's tools
  
  // Set up the transport
  const transport = new StdioServerTransport();
  
  // Connect the payments-enabled server to the transport
  console.log('Starting payments-enabled MCP server...');
  await paymentsEnabledServer.connect(transport);
}

// Start the example
main().catch(err => {
  console.error('Error starting the server:', err);
  process.exit(1);
}); 