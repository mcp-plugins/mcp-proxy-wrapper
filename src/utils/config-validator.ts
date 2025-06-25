/**
 * @file Configuration Validation using Zod
 * @version 1.0.0
 * 
 * Zod schemas for validating remote proxy wrapper configurations.
 * Provides runtime type safety and detailed validation error messages.
 */

import { z } from 'zod';
import { ValidationError } from './errors.js';

/**
 * Schema for STDIO transport configuration
 */
export const STDIOTransportSchema = z.object({
  transport: z.literal('stdio'),
  command: z.string().min(1, 'Command cannot be empty'),
  args: z.array(z.string()).optional(),
  env: z.record(z.string()).optional(),
  cwd: z.string().optional(),
  timeout: z.number().positive().optional(),
  headers: z.record(z.string()).optional().describe('Headers not used for STDIO transport'),
  name: z.string().optional(),
  version: z.string().optional()
});

/**
 * Schema for SSE transport configuration
 */
export const SSETransportSchema = z.object({
  transport: z.literal('sse'),
  url: z.string().url('Must be a valid URL').refine(
    (url) => {
      try {
        const parsed = new URL(url);
        return ['http:', 'https:'].includes(parsed.protocol);
      } catch {
        return false;
      }
    },
    'SSE URLs must use http:// or https:// protocol'
  ),
  headers: z.record(z.string()).optional(),
  timeout: z.number().positive().optional(),
  command: z.string().optional().describe('Command not used for SSE transport'),
  args: z.array(z.string()).optional().describe('Args not used for SSE transport'),
  env: z.record(z.string()).optional().describe('Env not used for SSE transport'),
  cwd: z.string().optional().describe('CWD not used for SSE transport'),
  name: z.string().optional(),
  version: z.string().optional()
});

/**
 * Schema for WebSocket transport configuration
 */
export const WebSocketTransportSchema = z.object({
  transport: z.literal('websocket'),
  url: z.string().url('Must be a valid URL').refine(
    (url) => {
      try {
        const parsed = new URL(url);
        return ['ws:', 'wss:'].includes(parsed.protocol);
      } catch {
        return false;
      }
    },
    'WebSocket URLs must use ws:// or wss:// protocol'
  ),
  headers: z.record(z.string()).optional(),
  timeout: z.number().positive().optional(),
  command: z.string().optional().describe('Command not used for WebSocket transport'),
  args: z.array(z.string()).optional().describe('Args not used for WebSocket transport'),
  env: z.record(z.string()).optional().describe('Env not used for WebSocket transport'),
  cwd: z.string().optional().describe('CWD not used for WebSocket transport'),
  name: z.string().optional(),
  version: z.string().optional()
});

/**
 * Union schema for all transport configurations
 */
export const RemoteServerConfigSchema = z.discriminatedUnion('transport', [
  STDIOTransportSchema,
  SSETransportSchema,
  WebSocketTransportSchema
]);

/**
 * Schema for plugin configuration
 */
export const PluginConfigSchema = z.object({
  enabled: z.boolean().optional(),
  priority: z.number().optional(),
  options: z.record(z.unknown()).optional(),
  includeTools: z.array(z.string()).optional(),
  excludeTools: z.array(z.string()).optional(),
  debug: z.boolean().optional()
});

/**
 * Schema for plugin registration
 */
export const PluginRegistrationSchema = z.object({
  plugin: z.object({
    name: z.string(),
    version: z.string(),
    initialize: z.function().optional(),
    beforeToolCall: z.function().optional(),
    afterToolCall: z.function().optional(),
    onError: z.function().optional(),
    destroy: z.function().optional(),
    healthCheck: z.function().optional(),
    getStats: z.function().optional()
  }),
  config: PluginConfigSchema.optional()
});

/**
 * Schema for proxy wrapper hooks
 */
export const ProxyHooksSchema = z.object({
  beforeToolCall: z.function().optional(),
  afterToolCall: z.function().optional()
});

/**
 * Schema for proxy wrapper options
 */
export const ProxyWrapperOptionsSchema = z.object({
  metadata: z.record(z.unknown()).optional(),
  hooks: ProxyHooksSchema.optional(),
  plugins: z.array(z.union([
    z.object({
      name: z.string(),
      version: z.string()
    }),
    PluginRegistrationSchema
  ])).optional(),
  debug: z.boolean().optional(),
  pluginConfig: z.object({
    enabled: z.boolean().optional(),
    defaultTimeout: z.number().positive().optional(),
    maxPlugins: z.number().positive().optional(),
    enableHealthChecks: z.boolean().optional(),
    healthCheckInterval: z.number().positive().optional()
  }).optional()
});

/**
 * Schema for remote proxy wrapper options
 */
export const RemoteProxyWrapperOptionsSchema = ProxyWrapperOptionsSchema.extend({
  remoteServer: RemoteServerConfigSchema,
  proxyServerName: z.string().optional(),
  proxyServerVersion: z.string().optional()
});

/**
 * Configuration validator class
 */
export class ConfigValidator {
  /**
   * Validate remote server configuration
   */
  static validateRemoteServerConfig(config: unknown) {
    try {
      return RemoteServerConfigSchema.parse(config);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError(
          `Invalid remote server configuration: ${error.issues.map(i => i.message).join(', ')}`,
          'remoteServer',
          'valid remote server configuration',
          config,
          { zodIssues: error.issues }
        );
      }
      throw error;
    }
  }

  /**
   * Validate remote proxy wrapper options
   */
  static validateRemoteProxyWrapperOptions(options: unknown) {
    try {
      return RemoteProxyWrapperOptionsSchema.parse(options);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError(
          `Invalid proxy wrapper options: ${error.issues.map(i => i.message).join(', ')}`,
          'options',
          'valid proxy wrapper options',
          options,
          { zodIssues: error.issues }
        );
      }
      throw error;
    }
  }

  /**
   * Validate plugin configuration
   */
  static validatePluginConfig(config: unknown) {
    try {
      return PluginConfigSchema.parse(config);
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError(
          `Invalid plugin configuration: ${error.issues.map(i => i.message).join(', ')}`,
          'pluginConfig',
          'valid plugin configuration',
          config,
          { zodIssues: error.issues }
        );
      }
      throw error;
    }
  }

  /**
   * Safely validate with detailed error information
   */
  static safeValidateRemoteServerConfig(config: unknown): {
    success: true;
    data: z.infer<typeof RemoteServerConfigSchema>;
  } | {
    success: false;
    error: ValidationError;
  } {
    try {
      const data = ConfigValidator.validateRemoteServerConfig(config);
      return { success: true, data };
    } catch (error) {
      return { 
        success: false, 
        error: error instanceof ValidationError ? error : new ValidationError(
          'Unexpected validation error',
          'config',
          'valid configuration',
          config
        )
      };
    }
  }

  /**
   * Get schema documentation
   */
  static getSchemaDocumentation() {
    return {
      remoteServer: {
        description: 'Configuration for connecting to a remote MCP server',
        transportTypes: [
          {
            type: 'stdio',
            required: ['transport', 'command'],
            optional: ['args', 'env', 'cwd', 'timeout', 'name', 'version'],
            description: 'Connect to a server via standard input/output (subprocess)'
          },
          {
            type: 'sse',
            required: ['transport', 'url'],
            optional: ['headers', 'timeout', 'name', 'version'],
            description: 'Connect to a server via Server-Sent Events over HTTP/HTTPS'
          },
          {
            type: 'websocket',
            required: ['transport', 'url'],
            optional: ['headers', 'timeout', 'name', 'version'],
            description: 'Connect to a server via WebSocket (ws:// or wss://)'
          }
        ]
      },
      proxyWrapper: {
        description: 'Options for configuring the proxy wrapper',
        properties: {
          metadata: 'Additional metadata to include with tool calls',
          hooks: 'Hook functions for before/after tool call processing',
          plugins: 'Array of plugins to enhance tool functionality',
          debug: 'Enable debug logging',
          pluginConfig: 'Global plugin configuration settings'
        }
      }
    };
  }

  /**
   * Validate and provide helpful error messages for common misconfigurations
   */
  static validateWithHelpfulErrors(config: unknown) {
    const result = ConfigValidator.safeValidateRemoteServerConfig(config);
    
    if (!result.success) {
      const error = result.error;
      const suggestions: string[] = [];

      // Check for common mistakes
      if (typeof config === 'object' && config !== null) {
        const configObj = config as Record<string, unknown>;
        
        // Missing transport
        if (!configObj.transport) {
          suggestions.push('Add a "transport" field with value "stdio", "sse", or "websocket"');
        }
        
        // Wrong transport value
        if (configObj.transport && !['stdio', 'sse', 'websocket'].includes(configObj.transport as string)) {
          suggestions.push(`Transport "${configObj.transport}" is not supported. Use "stdio", "sse", or "websocket"`);
        }
        
        // STDIO without command
        if (configObj.transport === 'stdio' && !configObj.command) {
          suggestions.push('STDIO transport requires a "command" field');
        }
        
        // URL transports without URL
        if ((configObj.transport === 'sse' || configObj.transport === 'websocket') && !configObj.url) {
          suggestions.push(`${configObj.transport?.toString().toUpperCase()} transport requires a "url" field`);
        }
        
        // WebSocket with wrong protocol
        if (configObj.transport === 'websocket' && typeof configObj.url === 'string') {
          try {
            const url = new URL(configObj.url);
            if (!['ws:', 'wss:'].includes(url.protocol)) {
              suggestions.push('WebSocket URLs must use ws:// or wss:// protocol');
            }
          } catch {
            suggestions.push('WebSocket transport requires a valid URL');
          }
        }
      }

      // Create enhanced error with suggestions
      const enhancedError = new ValidationError(
        error.message + (suggestions.length > 0 ? `\n\nSuggestions:\n- ${suggestions.join('\n- ')}` : ''),
        error.field,
        error.expected,
        error.received,
        { ...error.context, suggestions }
      );

      throw enhancedError;
    }

    return result.data;
  }
}

// Export types for external use
export type ValidatedRemoteServerConfig = z.infer<typeof RemoteServerConfigSchema>;
export type ValidatedProxyWrapperOptions = z.infer<typeof ProxyWrapperOptionsSchema>;
export type ValidatedRemoteProxyWrapperOptions = z.infer<typeof RemoteProxyWrapperOptionsSchema>;