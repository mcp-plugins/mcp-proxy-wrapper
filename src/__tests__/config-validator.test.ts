/**
 * @file Configuration Validator Tests
 * @version 1.0.0
 * 
 * Tests for Zod-based configuration validation
 */

import { describe, test, expect } from '@jest/globals';
import { ConfigValidator } from '../utils/config-validator.js';
import { ValidationError } from '../utils/errors.js';

describe('ConfigValidator', () => {
  describe('Remote Server Configuration Validation', () => {
    describe('STDIO Transport', () => {
      test('validates correct STDIO configuration', () => {
        const config = {
          transport: 'stdio',
          command: 'node',
          args: ['server.js'],
          env: { NODE_ENV: 'production' },
          cwd: '/app',
          name: 'Test Server'
        };

        expect(() => {
          ConfigValidator.validateRemoteServerConfig(config);
        }).not.toThrow();
      });

      test('validates minimal STDIO configuration', () => {
        const config = {
          transport: 'stdio',
          command: 'echo'
        };

        expect(() => {
          ConfigValidator.validateRemoteServerConfig(config);
        }).not.toThrow();
      });

      test('throws error for STDIO without command', () => {
        const config = {
          transport: 'stdio'
        };

        expect(() => {
          ConfigValidator.validateRemoteServerConfig(config);
        }).toThrow(ValidationError);
      });

      test('throws error for empty command', () => {
        const config = {
          transport: 'stdio',
          command: ''
        };

        expect(() => {
          ConfigValidator.validateRemoteServerConfig(config);
        }).toThrow(ValidationError);
      });
    });

    describe('SSE Transport', () => {
      test('validates correct SSE configuration', () => {
        const config = {
          transport: 'sse',
          url: 'https://api.example.com/mcp',
          headers: { 'Authorization': 'Bearer token' },
          timeout: 30000,
          name: 'API Server'
        };

        expect(() => {
          ConfigValidator.validateRemoteServerConfig(config);
        }).not.toThrow();
      });

      test('validates HTTP URLs', () => {
        const config = {
          transport: 'sse',
          url: 'http://localhost:8080/mcp'
        };

        expect(() => {
          ConfigValidator.validateRemoteServerConfig(config);
        }).not.toThrow();
      });

      test('throws error for SSE without URL', () => {
        const config = {
          transport: 'sse'
        };

        expect(() => {
          ConfigValidator.validateRemoteServerConfig(config);
        }).toThrow(ValidationError);
      });

      test('throws error for invalid URL', () => {
        const config = {
          transport: 'sse',
          url: 'not-a-url'
        };

        expect(() => {
          ConfigValidator.validateRemoteServerConfig(config);
        }).toThrow(ValidationError);
      });

      test('throws error for WebSocket URL in SSE config', () => {
        const config = {
          transport: 'sse',
          url: 'ws://localhost:8080'
        };

        expect(() => {
          ConfigValidator.validateRemoteServerConfig(config);
        }).toThrow(ValidationError);
      });
    });

    describe('WebSocket Transport', () => {
      test('validates correct WebSocket configuration', () => {
        const config = {
          transport: 'websocket',
          url: 'wss://api.example.com/mcp',
          headers: { 'Origin': 'https://example.com' },
          timeout: 30000,
          name: 'WebSocket Server'
        };

        expect(() => {
          ConfigValidator.validateRemoteServerConfig(config);
        }).not.toThrow();
      });

      test('validates ws:// URLs', () => {
        const config = {
          transport: 'websocket',
          url: 'ws://localhost:8080/mcp'
        };

        expect(() => {
          ConfigValidator.validateRemoteServerConfig(config);
        }).not.toThrow();
      });

      test('throws error for WebSocket without URL', () => {
        const config = {
          transport: 'websocket'
        };

        expect(() => {
          ConfigValidator.validateRemoteServerConfig(config);
        }).toThrow(ValidationError);
      });

      test('throws error for HTTP URL in WebSocket config', () => {
        const config = {
          transport: 'websocket',
          url: 'https://api.example.com/mcp'
        };

        expect(() => {
          ConfigValidator.validateRemoteServerConfig(config);
        }).toThrow(ValidationError);
      });
    });

    describe('General Configuration', () => {
      test('throws error for missing transport', () => {
        const config = {
          command: 'node'
        };

        expect(() => {
          ConfigValidator.validateRemoteServerConfig(config);
        }).toThrow(ValidationError);
      });

      test('throws error for invalid transport', () => {
        const config = {
          transport: 'invalid',
          command: 'node'
        };

        expect(() => {
          ConfigValidator.validateRemoteServerConfig(config);
        }).toThrow(ValidationError);
      });

      test('throws error for negative timeout', () => {
        const config = {
          transport: 'stdio',
          command: 'node',
          timeout: -1
        };

        expect(() => {
          ConfigValidator.validateRemoteServerConfig(config);
        }).toThrow(ValidationError);
      });
    });
  });

  describe('Helpful Error Messages', () => {
    test('provides suggestions for missing transport', () => {
      const config = {
        command: 'node'
      };

      expect(() => {
        ConfigValidator.validateWithHelpfulErrors(config);
      }).toThrow(/Add a "transport" field/);
    });

    test('provides suggestions for invalid transport', () => {
      const config = {
        transport: 'invalid',
        command: 'node'
      };

      expect(() => {
        ConfigValidator.validateWithHelpfulErrors(config);
      }).toThrow(/Transport "invalid" is not supported/);
    });

    test('provides suggestions for STDIO without command', () => {
      const config = {
        transport: 'stdio'
      };

      expect(() => {
        ConfigValidator.validateWithHelpfulErrors(config);
      }).toThrow(/STDIO transport requires a "command" field/);
    });

    test('provides suggestions for SSE without URL', () => {
      const config = {
        transport: 'sse'
      };

      expect(() => {
        ConfigValidator.validateWithHelpfulErrors(config);
      }).toThrow(/SSE transport requires a "url" field/);
    });

    test('provides suggestions for WebSocket with wrong protocol', () => {
      const config = {
        transport: 'websocket',
        url: 'https://example.com'
      };

      expect(() => {
        ConfigValidator.validateWithHelpfulErrors(config);
      }).toThrow(/WebSocket URLs must use ws:\/\/ or wss:\/\/ protocol/);
    });
  });

  describe('Safe Validation', () => {
    test('returns success for valid configuration', () => {
      const config = {
        transport: 'stdio',
        command: 'node',
        args: ['server.js']
      };

      const result = ConfigValidator.safeValidateRemoteServerConfig(config);
      
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.transport).toBe('stdio');
        expect(result.data.command).toBe('node');
      }
    });

    test('returns error for invalid configuration', () => {
      const config = {
        transport: 'stdio'
        // Missing command
      };

      const result = ConfigValidator.safeValidateRemoteServerConfig(config);
      
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error).toBeInstanceOf(ValidationError);
      }
    });
  });

  describe('Plugin Configuration Validation', () => {
    test('validates correct plugin configuration', () => {
      const config = {
        enabled: true,
        priority: 100,
        options: { key: 'value' },
        includeTools: ['tool1', 'tool2'],
        excludeTools: ['tool3'],
        debug: false
      };

      expect(() => {
        ConfigValidator.validatePluginConfig(config);
      }).not.toThrow();
    });

    test('validates minimal plugin configuration', () => {
      const config = {};

      expect(() => {
        ConfigValidator.validatePluginConfig(config);
      }).not.toThrow();
    });

    test('throws error for invalid plugin configuration', () => {
      const config = {
        enabled: 'not-a-boolean',
        priority: -1
      };

      expect(() => {
        ConfigValidator.validatePluginConfig(config);
      }).toThrow(ValidationError);
    });
  });

  describe('Schema Documentation', () => {
    test('provides schema documentation', () => {
      const docs = ConfigValidator.getSchemaDocumentation();
      
      expect(docs).toBeDefined();
      expect(docs.remoteServer).toBeDefined();
      expect(docs.remoteServer.transportTypes).toHaveLength(3);
      expect(docs.proxyWrapper).toBeDefined();
    });

    test('includes all transport types in documentation', () => {
      const docs = ConfigValidator.getSchemaDocumentation();
      const transportTypes = docs.remoteServer.transportTypes.map(t => t.type);
      
      expect(transportTypes).toEqual(['stdio', 'sse', 'websocket']);
    });
  });
});