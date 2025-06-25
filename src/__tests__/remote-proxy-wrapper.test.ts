/**
 * @file Remote Proxy Wrapper Tests
 * @version 1.0.0
 * 
 * Comprehensive tests for the remote MCP server proxy functionality
 */

import { describe, test, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { RemoteMcpServerProxy, createRemoteServerProxy, createHttpServerProxy, createStdioServerProxy } from '../remote-proxy-wrapper.js';
import { LLMSummarizationPlugin } from '../examples/plugins/llm-summarization.js';

// Mock the MCP SDK modules
jest.mock('@modelcontextprotocol/sdk/server/mcp.js');
jest.mock('@modelcontextprotocol/sdk/client/index.js');
jest.mock('@modelcontextprotocol/sdk/client/stdio.js');
jest.mock('@modelcontextprotocol/sdk/client/sse.js');
jest.mock('@modelcontextprotocol/sdk/client/websocket.js');

describe('Remote MCP Server Proxy', () => {
  let mockServer: any;
  let mockClient: any;
  let mockTransport: any;

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Mock MCP Server
    mockServer = {
      tool: jest.fn(),
      connect: jest.fn()
    };

    // Mock MCP Client
    mockClient = {
      connect: jest.fn(),
      close: jest.fn(),
      listTools: jest.fn(),
      callTool: jest.fn()
    };

    // Mock Transport
    mockTransport = {
      connect: jest.fn(),
      close: jest.fn()
    };

    // Setup module mocks
    const { McpServer } = require('@modelcontextprotocol/sdk/server/mcp.js');
    const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
    const { StdioClientTransport } = require('@modelcontextprotocol/sdk/client/stdio.js');
    const { SSEClientTransport } = require('@modelcontextprotocol/sdk/client/sse.js');

    McpServer.mockImplementation(() => mockServer);
    Client.mockImplementation(() => mockClient);
    StdioClientTransport.mockImplementation(() => mockTransport);
    SSEClientTransport.mockImplementation(() => mockTransport);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('RemoteMcpServerProxy Class', () => {
    test('creates proxy with valid configuration', () => {
      const config = {
        remoteServer: {
          transport: 'stdio' as const,
          command: 'node',
          args: ['server.js'],
          name: 'Test Server'
        }
      };

      const proxy = new RemoteMcpServerProxy(config);
      expect(proxy).toBeInstanceOf(RemoteMcpServerProxy);
      expect(proxy.isConnected()).toBe(false);
    });

    test('connects to STDIO remote server', async () => {
      mockClient.listTools.mockResolvedValue({
        tools: [
          { name: 'echo', description: 'Echo tool', inputSchema: {} },
          { name: 'test', description: 'Test tool', inputSchema: {} }
        ]
      });

      const config = {
        remoteServer: {
          transport: 'stdio' as const,
          command: 'node',
          args: ['server.js'],
          name: 'Test Server'
        }
      };

      const proxy = new RemoteMcpServerProxy(config);
      const proxyServer = await proxy.connect();

      expect(mockClient.connect).toHaveBeenCalledWith(mockTransport);
      expect(mockClient.listTools).toHaveBeenCalled();
      expect(mockServer.tool).toHaveBeenCalledTimes(2); // Two tools registered
      expect(proxy.isConnected()).toBe(true);
      expect(proxyServer).toBe(mockServer);
    });

    test('connects to SSE remote server', async () => {
      mockClient.listTools.mockResolvedValue({
        tools: [
          { name: 'search', description: 'Search tool', inputSchema: {} }
        ]
      });

      const config = {
        remoteServer: {
          transport: 'sse' as const,
          url: 'https://api.example.com/mcp',
          name: 'Remote API Server'
        }
      };

      const proxy = new RemoteMcpServerProxy(config);
      await proxy.connect();

      expect(mockClient.connect).toHaveBeenCalledWith(mockTransport);
      expect(mockClient.listTools).toHaveBeenCalled();
      expect(proxy.isConnected()).toBe(true);
    });

    test('handles tool calls with plugin enhancement', async () => {
      // Setup mock tools
      mockClient.listTools.mockResolvedValue({
        tools: [
          { name: 'test-tool', description: 'Test tool', inputSchema: {} }
        ]
      });

      // Setup mock tool call response
      mockClient.callTool.mockResolvedValue({
        content: [{ type: 'text', text: 'Original response from remote server' }],
        isError: false
      });

      // Create plugin
      const summaryPlugin = new LLMSummarizationPlugin();
      summaryPlugin.updateConfig({
        options: {
          provider: 'mock',
          minContentLength: 10,
          summarizeTools: ['test-tool']
        }
      });

      const config = {
        remoteServer: {
          transport: 'stdio' as const,
          command: 'node',
          args: ['server.js']
        },
        plugins: [summaryPlugin]
      };

      const proxy = new RemoteMcpServerProxy(config);
      await proxy.connect();

      // Get the registered tool handler from the mock
      const toolCall = mockServer.tool.mock.calls[0];
      expect(toolCall[0]).toBe('test-tool'); // Tool name
      
      const toolHandler = toolCall[2]; // Handler function
      expect(typeof toolHandler).toBe('function');

      // Call the tool handler
      const result = await toolHandler({ input: 'test' });

      expect(mockClient.callTool).toHaveBeenCalledWith({
        name: 'test-tool',
        arguments: { input: 'test' }
      });

      expect(result).toMatchObject({
        content: expect.any(Array),
        _meta: expect.objectContaining({
          requestId: expect.any(String),
          remoteServer: expect.any(String),
          transport: 'stdio'
        })
      });
    });

    test('handles connection errors gracefully', async () => {
      mockClient.connect.mockRejectedValue(new Error('Connection failed'));

      const config = {
        remoteServer: {
          transport: 'stdio' as const,
          command: 'invalid-command'
        }
      };

      const proxy = new RemoteMcpServerProxy(config);
      
      await expect(proxy.connect()).rejects.toThrow('Failed to connect to remote MCP server');
      expect(proxy.isConnected()).toBe(false);
    });

    test('disconnects cleanly', async () => {
      mockClient.listTools.mockResolvedValue({ tools: [] });

      const config = {
        remoteServer: {
          transport: 'stdio' as const,
          command: 'node',
          args: ['server.js']
        }
      };

      const proxy = new RemoteMcpServerProxy(config);
      await proxy.connect();
      
      expect(proxy.isConnected()).toBe(true);
      
      await proxy.disconnect();
      
      expect(mockClient.close).toHaveBeenCalled();
      expect(proxy.isConnected()).toBe(false);
    });
  });

  describe('Convenience Functions', () => {
    test('createRemoteServerProxy works with full config', async () => {
      mockClient.listTools.mockResolvedValue({ tools: [] });

      const config = {
        remoteServer: {
          transport: 'stdio' as const,
          command: 'node',
          args: ['server.js'],
          name: 'Test Server'
        }
      };

      const proxyServer = await createRemoteServerProxy(config);
      
      expect(proxyServer).toBe(mockServer);
      expect(mockClient.connect).toHaveBeenCalled();
    });

    test('createHttpServerProxy works with URL', async () => {
      mockClient.listTools.mockResolvedValue({ tools: [] });

      const proxyServer = await createHttpServerProxy('https://api.example.com/mcp');
      
      expect(proxyServer).toBe(mockServer);
      expect(mockClient.connect).toHaveBeenCalled();
    });

    test('createStdioServerProxy works with command and args', async () => {
      mockClient.listTools.mockResolvedValue({ tools: [] });

      const proxyServer = await createStdioServerProxy('node', ['server.js']);
      
      expect(proxyServer).toBe(mockServer);
      expect(mockClient.connect).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    test('throws error for unsupported transport', async () => {
      const config = {
        remoteServer: {
          transport: 'invalid' as any,
          name: 'Test Server'
        }
      };

      const proxy = new RemoteMcpServerProxy(config);
      
      await expect(proxy.connect()).rejects.toThrow('Unsupported transport type');
    });

    test('throws error for STDIO without command', async () => {
      const config = {
        remoteServer: {
          transport: 'stdio' as const,
          // Missing command
        }
      };

      const proxy = new RemoteMcpServerProxy(config);
      
      await expect(proxy.connect()).rejects.toThrow('STDIO transport requires a command');
    });

    test('throws error for SSE without URL', async () => {
      const config = {
        remoteServer: {
          transport: 'sse' as const,
          // Missing URL
        }
      };

      const proxy = new RemoteMcpServerProxy(config);
      
      await expect(proxy.connect()).rejects.toThrow('SSE transport requires a URL');
    });

    test('handles tool discovery errors', async () => {
      mockClient.listTools.mockRejectedValue(new Error('Tools list failed'));

      const config = {
        remoteServer: {
          transport: 'stdio' as const,
          command: 'node',
          args: ['server.js']
        }
      };

      const proxy = new RemoteMcpServerProxy(config);
      
      await expect(proxy.connect()).rejects.toThrow('Failed to discover remote tools');
    });

    test('handles remote tool call errors', async () => {
      mockClient.listTools.mockResolvedValue({
        tools: [{ name: 'failing-tool', description: 'Fails', inputSchema: {} }]
      });

      mockClient.callTool.mockRejectedValue(new Error('Remote tool failed'));

      const config = {
        remoteServer: {
          transport: 'stdio' as const,
          command: 'node',
          args: ['server.js']
        }
      };

      const proxy = new RemoteMcpServerProxy(config);
      await proxy.connect();

      // Get the tool handler
      const toolHandler = mockServer.tool.mock.calls[0][2];
      
      // Call should return error response, not throw
      const result = await toolHandler({ input: 'test' });
      
      expect(result).toMatchObject({
        content: expect.arrayContaining([
          expect.objectContaining({
            type: 'text',
            text: expect.stringContaining('Remote tool failed')
          })
        ]),
        isError: true
      });
    });
  });

  describe('Plugin Integration', () => {
    test('applies plugins to remote tool calls', async () => {
      mockClient.listTools.mockResolvedValue({
        tools: [{ name: 'long-response-tool', description: 'Returns long response', inputSchema: {} }]
      });

      mockClient.callTool.mockResolvedValue({
        content: [{ 
          type: 'text', 
          text: 'This is a very long response from the remote server that should be summarized by the plugin because it exceeds the minimum length threshold.' 
        }],
        isError: false
      });

      const summaryPlugin = new LLMSummarizationPlugin();
      summaryPlugin.updateConfig({
        options: {
          provider: 'mock',
          minContentLength: 50,
          summarizeTools: ['long-response-tool']
        }
      });

      const config = {
        remoteServer: {
          transport: 'stdio' as const,
          command: 'node',
          args: ['server.js']
        },
        plugins: [summaryPlugin]
      };

      const proxy = new RemoteMcpServerProxy(config);
      await proxy.connect();

      // Get and call the tool handler
      const toolHandler = mockServer.tool.mock.calls[0][2];
      const result = await toolHandler({ input: 'test' });

      // Should have plugin metadata indicating summarization
      expect(result._meta).toMatchObject({
        requestId: expect.any(String),
        remoteServer: expect.any(String),
        transport: 'stdio'
      });
    });
  });
});