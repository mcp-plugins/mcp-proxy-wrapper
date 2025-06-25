/**
 * @file Transport Factory Tests
 * @version 1.0.0
 * 
 * Tests for the TransportFactory and related utilities
 */

import { describe, test, expect } from '@jest/globals';
import { TransportFactory, TransportConfigValidator, TransportHealthChecker } from '../utils/transport-factory.js';
import { ProxyConfigurationError } from '../utils/errors.js';

describe('TransportFactory', () => {
  describe('Transport Type Detection', () => {
    test('detects WebSocket URLs correctly', () => {
      expect(TransportFactory.detectTransportType('ws://localhost:8080')).toBe('websocket');
      expect(TransportFactory.detectTransportType('wss://api.example.com/mcp')).toBe('websocket');
    });

    test('detects HTTP/SSE URLs correctly', () => {
      expect(TransportFactory.detectTransportType('http://localhost:8080')).toBe('sse');
      expect(TransportFactory.detectTransportType('https://api.example.com/mcp')).toBe('sse');
    });

    test('detects STDIO commands correctly', () => {
      expect(TransportFactory.detectTransportType('node server.js')).toBe('stdio');
      expect(TransportFactory.detectTransportType('python3 /path/to/server.py')).toBe('stdio');
      expect(TransportFactory.detectTransportType('./my-server')).toBe('stdio');
    });

    test('returns null for unrecognizable formats', () => {
      expect(TransportFactory.detectTransportType('ftp://example.com')).toBeNull();
      expect(TransportFactory.detectTransportType('just-a-word')).toBeNull();
      expect(TransportFactory.detectTransportType('')).toBeNull();
    });
  });

  describe('Auto-Detection Configuration', () => {
    test('creates WebSocket config from URL', () => {
      const config = TransportFactory.createAutoDetectedConfig('wss://api.example.com/mcp');
      
      expect(config.transport).toBe('websocket');
      expect(config.url).toBe('wss://api.example.com/mcp');
    });

    test('creates SSE config from HTTP URL', () => {
      const config = TransportFactory.createAutoDetectedConfig('https://api.example.com/mcp');
      
      expect(config.transport).toBe('sse');
      expect(config.url).toBe('https://api.example.com/mcp');
    });

    test('creates STDIO config from command', () => {
      const config = TransportFactory.createAutoDetectedConfig('node server.js --port 8080');
      
      expect(config.transport).toBe('stdio');
      expect(config.command).toBe('node');
      expect(config.args).toEqual(['server.js', '--port', '8080']);
    });

    test('includes additional options', () => {
      const config = TransportFactory.createAutoDetectedConfig(
        'wss://api.example.com/mcp',
        { name: 'Test Server', timeout: 30000 }
      );
      
      expect(config.name).toBe('Test Server');
      expect(config.timeout).toBe(30000);
    });

    test('throws error for undetectable formats', () => {
      expect(() => {
        TransportFactory.createAutoDetectedConfig('ftp://invalid.com');
      }).toThrow(ProxyConfigurationError);
    });
  });

  describe('Transport Creation', () => {
    test('creates STDIO transport with valid config', async () => {
      const config = {
        transport: 'stdio' as const,
        command: 'echo',
        args: ['test'],
        name: 'Test Server'
      };

      const transport = await TransportFactory.createTransport(config);
      expect(transport).toBeDefined();
      expect(transport.constructor.name).toBe('StdioClientTransport');
    });

    test('creates SSE transport with valid config', async () => {
      const config = {
        transport: 'sse' as const,
        url: 'https://api.example.com/mcp',
        name: 'Test Server'
      };

      const transport = await TransportFactory.createTransport(config);
      expect(transport).toBeDefined();
      expect(transport.constructor.name).toBe('SSEClientTransport');
    });

    test('creates WebSocket transport with valid config', async () => {
      const config = {
        transport: 'websocket' as const,
        url: 'wss://api.example.com/mcp',
        name: 'Test Server'
      };

      const transport = await TransportFactory.createTransport(config);
      expect(transport).toBeDefined();
      expect(transport.constructor.name).toBe('WebSocketClientTransport');
    });

    test('throws error for unsupported transport', async () => {
      const config = {
        transport: 'invalid' as any,
        name: 'Test Server'
      };

      await expect(TransportFactory.createTransport(config)).rejects.toThrow(ProxyConfigurationError);
    });
  });
});

describe('TransportConfigValidator', () => {
  describe('STDIO Validation', () => {
    test('validates correct STDIO config', () => {
      const config = {
        transport: 'stdio' as const,
        command: 'node',
        args: ['server.js']
      };

      expect(() => {
        TransportConfigValidator.validateSTDIOConfig(config);
      }).not.toThrow();
    });

    test('throws error for missing command', () => {
      const config = {
        transport: 'stdio' as const
      };

      expect(() => {
        TransportConfigValidator.validateSTDIOConfig(config);
      }).toThrow(ProxyConfigurationError);
    });

    test('throws error for wrong transport type', () => {
      const config = {
        transport: 'sse' as const,
        command: 'node'
      };

      expect(() => {
        TransportConfigValidator.validateSTDIOConfig(config);
      }).toThrow(ProxyConfigurationError);
    });
  });

  describe('SSE Validation', () => {
    test('validates correct SSE config', () => {
      const config = {
        transport: 'sse' as const,
        url: 'https://api.example.com/mcp'
      };

      expect(() => {
        TransportConfigValidator.validateSSEConfig(config);
      }).not.toThrow();
    });

    test('throws error for missing URL', () => {
      const config = {
        transport: 'sse' as const
      };

      expect(() => {
        TransportConfigValidator.validateSSEConfig(config);
      }).toThrow(ProxyConfigurationError);
    });

    test('throws error for invalid URL', () => {
      const config = {
        transport: 'sse' as const,
        url: 'not-a-valid-url'
      };

      expect(() => {
        TransportConfigValidator.validateSSEConfig(config);
      }).toThrow(ProxyConfigurationError);
    });
  });

  describe('WebSocket Validation', () => {
    test('validates correct WebSocket config', () => {
      const config = {
        transport: 'websocket' as const,
        url: 'wss://api.example.com/mcp'
      };

      expect(() => {
        TransportConfigValidator.validateWebSocketConfig(config);
      }).not.toThrow();
    });

    test('accepts ws:// protocol', () => {
      const config = {
        transport: 'websocket' as const,
        url: 'ws://localhost:8080'
      };

      expect(() => {
        TransportConfigValidator.validateWebSocketConfig(config);
      }).not.toThrow();
    });

    test('throws error for HTTP URL', () => {
      const config = {
        transport: 'websocket' as const,
        url: 'https://api.example.com/mcp'
      };

      expect(() => {
        TransportConfigValidator.validateWebSocketConfig(config);
      }).toThrow(ProxyConfigurationError);
    });

    test('throws error for missing URL', () => {
      const config = {
        transport: 'websocket' as const
      };

      expect(() => {
        TransportConfigValidator.validateWebSocketConfig(config);
      }).toThrow(ProxyConfigurationError);
    });
  });
});

describe('TransportHealthChecker', () => {
  describe('Configuration Health Checks', () => {
    test('reports healthy for valid STDIO config', async () => {
      const config = {
        transport: 'stdio' as const,
        command: 'echo',
        args: ['test']
      };

      const result = await TransportHealthChecker.checkHealth(config);
      expect(result.healthy).toBe(true);
      expect(result.latency).toBeGreaterThanOrEqual(0);
    });

    test('reports unhealthy for invalid STDIO config', async () => {
      const config = {
        transport: 'stdio' as const
        // Missing command
      };

      const result = await TransportHealthChecker.checkHealth(config);
      expect(result.healthy).toBe(false);
      expect(result.error).toContain('STDIO transport requires a command');
    });

    test('reports unhealthy for invalid SSE config', async () => {
      const config = {
        transport: 'sse' as const,
        url: 'invalid-url'
      };

      const result = await TransportHealthChecker.checkHealth(config);
      expect(result.healthy).toBe(false);
      expect(result.error).toBeDefined();
    });

    test('reports unhealthy for unsupported transport', async () => {
      const config = {
        transport: 'invalid' as any
      };

      const result = await TransportHealthChecker.checkHealth(config);
      expect(result.healthy).toBe(false);
      expect(result.error).toContain('Unsupported transport');
    });
  });
});