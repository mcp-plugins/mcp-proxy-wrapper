/**
 * @file MCP Diagnostic Helper
 * 
 * This file contains helpers to diagnose issues with the MCP SDK.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export async function logMcpInterfaces() {
  console.log('=== MCP INTERFACE DIAGNOSTICS ===');

  try {
    // Create a new server instance
    const server = new McpServer({
      name: 'Diagnostic Server',
      version: '1.0.0'
    });

    // Log the server tool method signature
    console.log('Server instance:', server);
    console.log('Tool method type:', typeof server.tool);
    console.log('Tool method descriptor:', Object.getOwnPropertyDescriptor(Object.getPrototypeOf(server), 'tool'));
    
    // Log the available methods on the server
    console.log('Server methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(server)));
    
    // Check if callTool method exists
    console.log('Has callTool method:', typeof server.callTool === 'function');
    
    // Try to introspect the tool method implementation if possible
    try {
      console.log('Tool method source:', server.tool.toString());
    } catch (e) {
      console.log('Unable to access tool method source:', e.message);
    }
  } catch (error) {
    console.error('Error during diagnostics:', error);
  }

  console.log('=================================');
}

// Run the diagnostics when loaded directly
if (import.meta.url === process.argv[1]) {
  await logMcpInterfaces();
} 