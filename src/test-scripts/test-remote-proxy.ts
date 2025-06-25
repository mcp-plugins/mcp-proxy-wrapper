#!/usr/bin/env tsx
/**
 * Test script for remote MCP server proxy
 * 
 * This script demonstrates how to proxy a remote MCP server
 * and add plugin functionality to it.
 */

import { createHttpServerProxy, createStdioServerProxy, LLMSummarizationPlugin } from '../index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

async function testStdioProxy() {
  console.log('🧪 Testing STDIO remote server proxy...');
  
  try {
    // Create a summarization plugin
    const summaryPlugin = new LLMSummarizationPlugin();
    summaryPlugin.updateConfig({
      options: {
        provider: 'mock', // Use mock for testing
        minContentLength: 50,
        summarizeTools: ['echo', 'test'] // Summarize these tools
      }
    });

    // Example: Proxy a fictional STDIO-based MCP server
    const proxyServer = await createStdioServerProxy(
      'node', // Command
      ['path/to/remote-mcp-server.js'], // Args
      {
        remoteServer: {
          transport: 'stdio',
          command: 'node',
          args: ['path/to/remote-mcp-server.js'],
          name: 'Example STDIO Server',
          version: '1.0.0'
        },
        plugins: [summaryPlugin],
        debug: true
      }
    );

    console.log('✅ STDIO proxy server created successfully');
    console.log('📡 Proxy server ready to accept connections');

    // Connect the proxy server to STDIO transport
    const transport = new StdioServerTransport();
    await proxyServer.connect(transport);

  } catch (error) {
    console.error('❌ STDIO proxy test failed:', error);
  }
}

async function testHttpProxy() {
  console.log('🧪 Testing HTTP/SSE remote server proxy...');
  
  try {
    // Create a summarization plugin
    const summaryPlugin = new LLMSummarizationPlugin();
    summaryPlugin.updateConfig({
      options: {
        provider: 'mock', // Use mock for testing
        minContentLength: 100,
        summarizeTools: ['search', 'analyze'] // Summarize these tools
      }
    });

    // Example: Proxy an HTTP/SSE-based MCP server
    const proxyServer = await createHttpServerProxy(
      'https://api.example.com/mcp', // Remote server URL
      {
        remoteServer: {
          transport: 'sse',
          url: 'https://api.example.com/mcp',
          name: 'Example HTTP Server',
          version: '1.0.0',
          headers: {
            'Authorization': 'Bearer your-api-key-here',
            'X-Client-Name': 'MCP-Proxy-Wrapper'
          }
        },
        plugins: [summaryPlugin],
        debug: true
      }
    );

    console.log('✅ HTTP proxy server created successfully');
    console.log('📡 Proxy server ready to accept connections');

    // Connect the proxy server to STDIO transport for testing
    const transport = new StdioServerTransport();
    await proxyServer.connect(transport);

  } catch (error) {
    console.error('❌ HTTP proxy test failed:', error);
  }
}

async function main() {
  console.log('🚀 Testing Remote MCP Server Proxy Functionality\n');

  // Test STDIO proxy
  await testStdioProxy();
  console.log('');

  // Test HTTP proxy  
  await testHttpProxy();
  console.log('');

  console.log('🎉 Remote proxy tests completed!');
  console.log('');
  console.log('📝 Usage Examples:');
  console.log('');
  console.log('// Connect to remote HTTP/SSE server:');
  console.log("const server = await createHttpServerProxy('https://api.example.com/mcp');");
  console.log('');
  console.log('// Connect to remote STDIO server:');
  console.log("const server = await createStdioServerProxy('node', ['server.js']);");
  console.log('');
  console.log('// Add plugins to enhance remote server:');
  console.log('const server = await createHttpServerProxy(url, {');
  console.log('  plugins: [new LLMSummarizationPlugin()],');
  console.log('  remoteServer: { name: "My Remote Server" }');
  console.log('});');
}

// Run the test if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}