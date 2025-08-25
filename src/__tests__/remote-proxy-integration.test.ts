/**
 * @file Remote Proxy Integration Tests
 * @version 1.0.0
 * 
 * Integration tests for the remote MCP server proxy functionality
 * These tests focus on the actual functionality rather than mocking internals
 */

import { describe, test, expect } from '@jest/globals';
import { RemoteMcpServerProxy, createRemoteServerProxy, createHttpServerProxy, createStdioServerProxy } from '../remote-proxy-wrapper.js';
import { ValidationError } from '../utils/errors.js';

describe('Remote MCP Server Proxy Integration', () => {
  describe('Configuration Validation', () => {
    test('creates proxy with valid STDIO configuration', () => {
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

    test('creates proxy with valid SSE configuration', () => {
      const config = {
        remoteServer: {
          transport: 'sse' as const,
          url: 'https://api.example.com/mcp',
          name: 'Remote API Server'
        }
      };

      const proxy = new RemoteMcpServerProxy(config);
      expect(proxy).toBeInstanceOf(RemoteMcpServerProxy);
      expect(proxy.isConnected()).toBe(false);
    });

    test('creates proxy with valid WebSocket configuration', () => {
      const config = {
        remoteServer: {
          transport: 'websocket' as const,
          url: 'wss://api.example.com/mcp',
          name: 'WebSocket Server'
        }
      };

      const proxy = new RemoteMcpServerProxy(config);
      expect(proxy).toBeInstanceOf(RemoteMcpServerProxy);
      expect(proxy.isConnected()).toBe(false);
    });
  });

  describe('Error Handling', () => {
    test('throws error for unsupported transport', () => {
      const config = {
        remoteServer: {
          transport: 'invalid' as any,
          name: 'Test Server'
        }
      };

      expect(() => {
        new RemoteMcpServerProxy(config);
      }).toThrow(ValidationError);
    });

    test('throws error for STDIO without command', () => {
      const config = {
        remoteServer: {
          transport: 'stdio' as const,
          // Missing command
        }
      };

      expect(() => {
        new RemoteMcpServerProxy(config);
      }).toThrow(ValidationError);
    });

    test('throws error for SSE without URL', () => {
      const config = {
        remoteServer: {
          transport: 'sse' as const,
          // Missing URL
        }
      };

      expect(() => {
        new RemoteMcpServerProxy(config);
      }).toThrow(ValidationError);
    });

    test('throws error for WebSocket without URL', () => {
      const config = {
        remoteServer: {
          transport: 'websocket' as const,
          // Missing URL
        }
      };

      expect(() => {
        new RemoteMcpServerProxy(config);
      }).toThrow(ValidationError);
    });
  });

  describe('Convenience Functions', () => {
    test('createHttpServerProxy function exists and is callable', () => {
      // Just verify the function exists and is a function
      expect(typeof createHttpServerProxy).toBe('function');
    });

    test('createStdioServerProxy function exists and is callable', () => {
      expect(typeof createStdioServerProxy).toBe('function');
    });

    test('createRemoteServerProxy function exists and is callable', () => {
      expect(typeof createRemoteServerProxy).toBe('function');
    });
  });

  describe('Basic Operations', () => {
    test('proxy server instance is accessible', () => {
      const config = {
        remoteServer: {
          transport: 'stdio' as const,
          command: 'echo',
          args: ['test'],
          name: 'Test Server'
        }
      };

      const proxy = new RemoteMcpServerProxy(config);
      const proxyServer = proxy.getProxyServer();
      
      expect(proxyServer).toBeDefined();
      expect(typeof proxyServer.tool).toBe('function');
    });

    test('remote client instance is accessible', () => {
      const config = {
        remoteServer: {
          transport: 'stdio' as const,
          command: 'echo',
          args: ['test'],
          name: 'Test Server'
        }
      };

      const proxy = new RemoteMcpServerProxy(config);
      const remoteClient = proxy.getRemoteClient();
      
      expect(remoteClient).toBeDefined();
      expect(typeof remoteClient.connect).toBe('function');
    });

    test('remote tools map is initially empty', () => {
      const config = {
        remoteServer: {
          transport: 'stdio' as const,
          command: 'echo',
          args: ['test'],
          name: 'Test Server'
        }
      };

      const proxy = new RemoteMcpServerProxy(config);
      const remoteTools = proxy.getRemoteTools();
      
      expect(remoteTools).toBeInstanceOf(Map);
      expect(remoteTools.size).toBe(0);
    });
  });

  describe('Plugin Integration', () => {
    test('accepts plugins in configuration', () => {
      const mockPlugin = {
        name: 'test-plugin',
        version: '1.0.0',
        async afterToolCall(context: any, result: any) {
          return result;
        }
      };

      const config = {
        remoteServer: {
          transport: 'stdio' as const,
          command: 'echo',
          args: ['test'],
          name: 'Test Server'
        },
        plugins: [mockPlugin]
      };

      expect(() => {
        new RemoteMcpServerProxy(config);
      }).not.toThrow();
    });
  });
});