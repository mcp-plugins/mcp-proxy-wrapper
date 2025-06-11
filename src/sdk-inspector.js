/**
 * SDK Inspector - Examines the MCP SDK interfaces
 * Run with: node src/sdk-inspector.js
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { z } from 'zod';

// Utility for logging
function logSection(title) {
  console.log('\n' + '='.repeat(80));
  console.log(' ' + title);
  console.log('='.repeat(80));
}

// Utility for inspecting function signatures
function inspectFunction(fn, name) {
  console.log(`\n## Function: ${name}`);
  
  if (typeof fn !== 'function') {
    console.log('Not a function:', typeof fn);
    return;
  }
  
  try {
    console.log('Function name:', fn.name);
    console.log('Parameter count:', fn.length);
    
    // Get the function signature by converting to string
    const fnStr = fn.toString();
    const signatureMatch = fnStr.match(/function\s*[^(]*\(([^)]*)\)/);
    const arrowSignatureMatch = fnStr.match(/\(([^)]*)\)\s*=>/);
    
    const signature = signatureMatch || arrowSignatureMatch;
    if (signature && signature[1]) {
      console.log('Parameters:', signature[1].split(',').map(p => p.trim()).join(', '));
    } else {
      console.log('Signature:', fnStr.slice(0, 100) + (fnStr.length > 100 ? '...' : ''));
    }
  } catch (e) {
    console.log('Error inspecting function:', e.message);
  }
}

// Start the inspection
logSection('MCP SDK INSPECTION');

console.log('Node version:', process.version);
console.log('Module type:', import.meta.url ? 'ESM' : 'CommonJS');

// Create server and client instances
try {
  logSection('SERVER INSTANCE');
  
  const server = new McpServer({
    name: 'Test Server',
    version: '1.0.0'
  });
  
  console.log('\n## Server properties:');
  console.log(Object.keys(server));
  
  console.log('\n## Server methods:');
  const methods = Object.getOwnPropertyNames(Object.getPrototypeOf(server))
    .filter(name => typeof server[name] === 'function' && name !== 'constructor');
  
  console.log(methods.join(', '));
  
  // Inspect tool method
  inspectFunction(server.tool, 'server.tool');
  
  // Inspect callTool method
  inspectFunction(server.callTool, 'server.callTool');
  
  // Register a sample tool
  logSection('TOOL REGISTRATION');
  
  server.tool('echo', { message: z.string() }, async (args) => {
    return {
      content: [{ type: 'text', text: `Echo: ${args.message}` }]
    };
  });
  
  console.log('Tool registered successfully');
  
  // Try to call the tool
  logSection('TOOL CALL');
  
  try {
    const result = await server.callTool('echo', { message: 'Hello from inspection' });
    console.log('Tool call result:', JSON.stringify(result, null, 2));
    
    console.log('\nResult structure:');
    if (result) {
      console.log('Type:', typeof result);
      console.log('Keys:', Object.keys(result));
      if (result.content) {
        console.log('Content type:', Array.isArray(result.content) ? 'Array' : typeof result.content);
        console.log('Content length:', result.content.length);
        console.log('First content item:', result.content[0]);
      }
    }
  } catch (error) {
    console.error('Error calling tool:', error);
  }
  
  // Inspect a Client instance
  logSection('CLIENT INSTANCE');
  
  const client = new Client({
    name: 'Test Client',
    version: '1.0.0'
  }, {
    capabilities: {}
  });
  
  console.log('\n## Client properties:');
  console.log(Object.keys(client));
  
  console.log('\n## Client methods:');
  const clientMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(client))
    .filter(name => typeof client[name] === 'function' && name !== 'constructor');
  
  console.log(clientMethods.join(', '));
  
  // Inspect callTool method on client
  inspectFunction(client.callTool, 'client.callTool');
  
} catch (error) {
  console.error('Error during SDK inspection:', error);
}

logSection('INSPECTION COMPLETE'); 