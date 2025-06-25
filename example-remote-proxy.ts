#!/usr/bin/env tsx
/**
 * Simple example showing how remote MCP server proxy would work
 * 
 * This demonstrates the concept without all the complex plugin integration
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

async function createSimpleRemoteProxy() {
  console.log('🚀 Creating simple remote MCP server proxy...');

  // 1. Create a proxy server (what your clients will connect to)
  const proxyServer = new McpServer({
    name: 'Remote Proxy Server',
    version: '1.0.0'
  });

  // 2. Create a client to connect to the remote server
  const remoteClient = new Client({
    name: 'Proxy Client',
    version: '1.0.0'
  }, {
    capabilities: {}
  });

  try {
    // 3. Connect to remote server (example: STDIO)
    console.log('📡 Connecting to remote MCP server...');
    
    // For STDIO remote server:
    const stdioTransport = new StdioClientTransport({
      command: 'node',
      args: ['path/to/your/remote-mcp-server.js'],
      env: process.env as Record<string, string>
    });
    
    // For HTTP/SSE remote server:
    // const sseTransport = new SSEClientTransport(new URL('https://api.example.com/mcp'), {});
    
    await remoteClient.connect(stdioTransport);
    
    // 4. Discover tools from remote server
    console.log('🔍 Discovering remote tools...');
    const toolsResponse = await remoteClient.listTools();
    console.log(`✅ Found ${toolsResponse.tools?.length || 0} remote tools`);

    // 5. Create proxy tools that enhance remote tools
    if (toolsResponse.tools) {
      for (const tool of toolsResponse.tools) {
        console.log(`🔧 Setting up proxy for tool: ${tool.name}`);
        
        // Register enhanced tool on proxy server
        proxyServer.tool(
          tool.name,
          tool.description || `Proxied: ${tool.name}`,
          tool.inputSchema || {},
          async (args: any) => {
            console.log(`🔄 Proxying call to remote tool: ${tool.name}`);
            
            // Add pre-processing here (logging, validation, etc.)
            const startTime = Date.now();
            
            try {
              // Call remote tool
              const result = await remoteClient.callTool({
                name: tool.name,
                arguments: args
              });

              // Add post-processing here (summarization, caching, etc.)
              const duration = Date.now() - startTime;
              console.log(`✅ Remote tool ${tool.name} completed in ${duration}ms`);

              // Return enhanced result
              return {
                ...result,
                _meta: {
                  ...result._meta,
                  proxied: true,
                  duration,
                  remoteServer: 'example-remote-server',
                  processedAt: new Date().toISOString()
                }
              };
              
            } catch (error) {
              console.error(`❌ Remote tool ${tool.name} failed:`, error);
              return {
                content: [{
                  type: 'text',
                  text: `Error calling remote tool: ${error instanceof Error ? error.message : String(error)}`
                }],
                isError: true
              };
            }
          }
        );
      }
    }

    // 6. Your proxy server is now ready!
    console.log('🎉 Remote proxy server is ready!');
    console.log('📝 Key benefits:');
    console.log('   - All remote tools are now enhanced with logging and metadata');
    console.log('   - You can add authentication, rate limiting, caching, etc.');
    console.log('   - No changes needed to the remote server');
    console.log('   - Clients connect to your proxy, proxy connects to remote server');

    // 7. Connect proxy server to your transport (STDIO in this example)
    const transport = new StdioServerTransport();
    await proxyServer.connect(transport);

  } catch (error) {
    console.error('❌ Failed to set up remote proxy:', error);
  }
}

async function demonstrateHttpProxy() {
  console.log('\n🌐 HTTP/SSE Remote Server Proxy Example:');
  console.log('');
  console.log('// Connect to remote HTTP/SSE MCP server:');
  console.log('const remoteClient = new Client(...)');
  console.log('const transport = new SSEClientTransport(new URL("https://api.example.com/mcp"));');
  console.log('await remoteClient.connect(transport);');
  console.log('');
  console.log('// Discover and proxy tools:');
  console.log('const tools = await remoteClient.listTools();');
  console.log('for (const tool of tools.tools) {');
  console.log('  proxyServer.tool(tool.name, enhancedHandler);');
  console.log('}');
  console.log('');
  console.log('✨ Result: Your proxy server now enhances the remote HTTP server!');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  console.log('🎯 MCP Remote Server Proxy Concept Demo\n');
  
  demonstrateHttpProxy();
  
  console.log('\n📚 Usage in your app:');
  console.log('import { createHttpServerProxy, LLMSummarizationPlugin } from "mcp-proxy-wrapper";');
  console.log('');
  console.log('const proxyServer = await createHttpServerProxy("https://api.example.com/mcp", {');
  console.log('  plugins: [new LLMSummarizationPlugin()],');
  console.log('  remoteServer: { name: "My Remote API" }');
  console.log('});');
  console.log('');
  console.log('// Now your remote server has AI summarization!');
}