/**
 * Simple test for enhanced proxy wrapper to verify basic functionality
 */

import { wrapWithEnhancedProxy, ExecutionMode, HealthStatus } from '../index.js';

// Mock MCP Server
class MockMcpServer {
  constructor() {
    this.tools = new Map();
  }
  
  tool(name, paramsSchemaOrCallback, callbackOrUndefined) {
    const isThreeArgVersion = callbackOrUndefined !== undefined;
    const callback = isThreeArgVersion ? callbackOrUndefined : paramsSchemaOrCallback;
    this.tools.set(name, callback);
    return this;
  }
  
  async callTool(name, args = {}, extra) {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool ${name} not found`);
    }
    return tool(args, extra);
  }
}

// Mock plugin
class MockPlugin {
  constructor() {
    this.name = 'MockPlugin';
    this.version = '1.0.0';
    this.isDisposed = false;
    this.description = 'Mock plugin for testing';
  }
  
  async dispose() {
    this.isDisposed = true;
  }
  
  async beforeToolCall(context) {
    if (context.toolName === 'short-circuit') {
      return {
        result: { 
          content: [{ type: 'text', text: 'Short-circuited by plugin' }],
          shortCircuited: true 
        },
        metadata: { shortCircuited: true }
      };
    }
  }
  
  async afterToolCall(context, result) {
    return {
      ...result,
      result: {
        ...result.result,
        content: result.result.content || [{ type: 'text', text: 'Processed by plugin' }]
      }
    };
  }
}

describe('Enhanced Proxy Wrapper v2.0 - Simple Tests', () => {
  let mockServer;
  
  beforeEach(() => {
    mockServer = new MockMcpServer();
  });
  
  test('should wrap a server successfully', async () => {
    const wrappedServer = await wrapWithEnhancedProxy(mockServer);
    expect(wrappedServer).toBeDefined();
    expect(wrappedServer._isProxyWrapped).toBe(true);
  });
  
  test('should prevent double wrapping', async () => {
    const wrappedServer1 = await wrapWithEnhancedProxy(mockServer);
    const wrappedServer2 = await wrapWithEnhancedProxy(wrappedServer1);
    expect(wrappedServer1).toBe(wrappedServer2);
  });
  
  test('should work with basic hooks', async () => {
    let beforeHookCalled = false;
    let afterHookCalled = false;
    
    const wrappedServer = await wrapWithEnhancedProxy(mockServer, {
      hooks: {
        beforeToolCall: async (context) => {
          beforeHookCalled = true;
          expect(context.toolName).toBe('test-tool');
        },
        afterToolCall: async (context, result) => {
          afterHookCalled = true;
          return result;
        }
      }
    });
    
    // Register a test tool
    wrappedServer.tool('test-tool', async (args) => {
      return { 
        content: [{ type: 'text', text: 'Hello World' }]
      };
    });
    
    // Call the tool
    const result = await mockServer.callTool('test-tool', { test: 'value' });
    
    expect(beforeHookCalled).toBe(true);
    expect(result.content[0].text).toBe('Hello World');
  });
  
  test('should work with plugins', async () => {
    const plugin = new MockPlugin();
    
    const wrappedServer = await wrapWithEnhancedProxy(mockServer, {
      plugins: [plugin]
    });
    
    // Register a test tool
    wrappedServer.tool('test-tool', async (args) => {
      return { 
        content: [{ type: 'text', text: 'Original response' }]
      };
    });
    
    // Call the tool
    const result = await mockServer.callTool('test-tool', { test: 'value' });
    
    expect(result.content[0].text).toBe('Processed by plugin');
  });
  
  test('should handle plugin disposal', async () => {
    const plugin = new MockPlugin();
    
    const wrappedServer = await wrapWithEnhancedProxy(mockServer, {
      plugins: [plugin],
      lifecycle: {
        autoDispose: true
      }
    });
    
    // Get the wrapper instance and dispose it
    const instance = wrappedServer._proxyWrapperInstance;
    expect(instance).toBeDefined();
    
    await instance.dispose();
    expect(plugin.isDisposed).toBe(true);
  });
  
  test('should support short-circuiting', async () => {
    const plugin = new MockPlugin();
    
    const wrappedServer = await wrapWithEnhancedProxy(mockServer, {
      plugins: [plugin]
    });
    
    // Register a tool that should be short-circuited
    wrappedServer.tool('short-circuit', async (args) => {
      return { 
        content: [{ type: 'text', text: 'Should not be called' }]
      };
    });
    
    // Call the tool
    const result = await mockServer.callTool('short-circuit', {});
    
    expect(result.shortCircuited).toBe(true);
    expect(result.content[0].text).toBe('Short-circuited by plugin');
  });
  
  test('should handle errors gracefully', async () => {
    const wrappedServer = await wrapWithEnhancedProxy(mockServer, {
      hooks: {
        beforeToolCall: async (context) => {
          throw new Error('Test hook error');
        }
      }
    });
    
    // Register a test tool
    wrappedServer.tool('error-test', async (args) => {
      return { 
        content: [{ type: 'text', text: 'Should not be called' }]
      };
    });
    
    // Call should return error response
    const result = await mockServer.callTool('error-test', {});
    
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain('Test hook error');
  });
  
  test('should respect execution configuration', async () => {
    const wrappedServer = await wrapWithEnhancedProxy(mockServer, {
      execution: {
        defaultMode: ExecutionMode.SERIAL,
        defaultTimeoutMs: 5000,
        enableRetries: true,
        maxRetries: 2
      },
      performance: {
        enabled: true,
        trackExecutionTime: true,
        samplingRate: 1.0
      }
    });
    
    expect(wrappedServer).toBeDefined();
    expect(wrappedServer._isProxyWrapped).toBe(true);
  });
});