/**
 * @file Proxy Behavior Tests for Payment Wrapper
 * @version 1.0.0
 * 
 * These tests focus specifically on verifying that the proxy correctly
 * represents the original server in all aspects, including method forwarding,
 * property access, and prototype chain behavior.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { wrapWithPayments } from './payment-wrapper.js';
import { TestLogger, createTestOptions } from './utils/test-helpers.js';

// Setup test logger for capturing logs
let testLogger: TestLogger;

beforeEach(() => {
  // Create a fresh logger instance for each test
  testLogger = new TestLogger();
});

afterEach(() => {
  // Clear logs between tests
  testLogger.clear();
});

// Define a type for our extended server
interface ExtendedMcpServer extends McpServer {
  name?: string;
  version?: string;
  description?: string;
  customProperty?: string;
  customMethod?: (arg: string) => string;
  contextMethod?: () => string | undefined;
  dynamicProperty?: string;
  complexArgMethod?: (
    str: string,
    num: number,
    bool: boolean,
    obj: object,
    arr: any[],
    func: Function
  ) => any;
  methodA?: () => ExtendedMcpServer;
  methodB?: () => ExtendedMcpServer;
  methodC?: () => string;
  readonlyProp?: string;
  nonConfigurableProp?: string;
  enumerableProp?: string;
  nonEnumerableProp?: string;
  deletableProp?: string;
  [key: string]: any;
  [key: symbol]: any;
}

// Helper function to create a test server with some methods and properties
function createTestServer(): ExtendedMcpServer {
  const server = new McpServer({
    name: "Test Server",
    version: "1.0.0",
    description: "Test server for proxy behavior"
  }) as ExtendedMcpServer;
  
  // Add custom properties
  server.customProperty = "custom value";
  
  // Add a custom method
  server.customMethod = function(arg: string) {
    return `Custom method called with: ${arg}`;
  };
  
  // Add a method that uses 'this'
  server.contextMethod = function() {
    return this.name;
  };
  
  // Add a getter/setter
  Object.defineProperty(server, 'dynamicProperty', {
    get: function() {
      return this._dynamicValue || "default";
    },
    set: function(value) {
      this._dynamicValue = value;
    },
    enumerable: true,
    configurable: true
  });
  
  return server;
}

describe('Proxy Method Forwarding', () => {
  test('forwards custom methods', () => {
    const server = createTestServer();
    const wrappedServer = wrapWithPayments(server, createTestOptions(testLogger)) as ExtendedMcpServer;
    
    // Call a custom method on the wrapped server
    const result = wrappedServer.customMethod!("test");
    
    // Verify the method was called correctly
    expect(result).toBe("Custom method called with: test");
  });
  
  test('preserves method context (this)', () => {
    const server = createTestServer();
    server.name = "Test Server"; // Ensure name is set
    
    const wrappedServer = wrapWithPayments(server, createTestOptions(testLogger)) as ExtendedMcpServer;
    
    // Call a method that uses 'this'
    const result = wrappedServer.contextMethod!();
    
    // Verify the context was preserved
    expect(result).toBe("Test Server");
  });
  
  test('handles methods with various argument types', () => {
    const server = createTestServer();
    
    // Add a method that takes various argument types
    server.complexArgMethod = function(
      str: string,
      num: number,
      bool: boolean,
      obj: object,
      arr: any[],
      func: Function
    ) {
      return {
        str,
        num,
        bool,
        obj,
        arrLength: arr.length,
        funcResult: func(42)
      };
    };
    
    const wrappedServer = wrapWithPayments(server, createTestOptions(testLogger)) as ExtendedMcpServer;
    
    // Call the method with various argument types
    const result = wrappedServer.complexArgMethod!(
      "string",
      123,
      true,
      { key: "value" },
      [1, 2, 3],
      (x: number) => x * 2
    );
    
    // Verify all arguments were passed correctly
    expect(result).toEqual({
      str: "string",
      num: 123,
      bool: true,
      obj: { key: "value" },
      arrLength: 3,
      funcResult: 84
    });
  });
  
  test('handles method chaining', () => {
    const server = createTestServer();
    
    // Add methods that support chaining
    server.methodA = function() {
      return this;
    };
    
    server.methodB = function() {
      return this;
    };
    
    server.methodC = function() {
      return "result";
    };
    
    const wrappedServer = wrapWithPayments(server, createTestOptions(testLogger)) as ExtendedMcpServer;
    
    // Test method chaining
    const result = wrappedServer.methodA!().methodB!().methodC!();
    
    // Verify chaining worked
    expect(result).toBe("result");
  });
});

describe('Proxy Property Access', () => {
  test('allows access to custom properties', () => {
    const server = createTestServer();
    const wrappedServer = wrapWithPayments(server, createTestOptions(testLogger)) as ExtendedMcpServer;
    
    // Access a custom property
    expect(wrappedServer.customProperty).toBe("custom value");
  });
  
  test('handles property changes', () => {
    const server = createTestServer();
    const wrappedServer = wrapWithPayments(server, createTestOptions(testLogger)) as ExtendedMcpServer;
    
    // Change a property on the wrapped server
    wrappedServer.customProperty = "new value";
    
    // Verify the change affected the original server
    expect(server.customProperty).toBe("new value");
    
    // And that the wrapped server reflects the change
    expect(wrappedServer.customProperty).toBe("new value");
  });
  
  test('handles getters and setters', () => {
    const server = createTestServer();
    const wrappedServer = wrapWithPayments(server, createTestOptions(testLogger)) as ExtendedMcpServer;
    
    // Test the default value
    expect(wrappedServer.dynamicProperty).toBe("default");
    
    // Set the property
    wrappedServer.dynamicProperty = "new dynamic value";
    
    // Verify the getter returns the new value
    expect(wrappedServer.dynamicProperty).toBe("new dynamic value");
    
    // Verify the original server was affected
    expect(server.dynamicProperty).toBe("new dynamic value");
  });
  
  test('handles property descriptors', () => {
    const server = createTestServer();
    
    // Add a property with a descriptor
    Object.defineProperty(server, 'readonlyProp', {
      value: "readonly value",
      writable: false,
      enumerable: true,
      configurable: false
    });
    
    const wrappedServer = wrapWithPayments(server, createTestOptions(testLogger)) as ExtendedMcpServer;
    
    // Verify the property is accessible
    expect(wrappedServer.readonlyProp).toBe("readonly value");
    
    // Verify the property is read-only
    expect(() => {
      wrappedServer.readonlyProp = "new value";
    }).toThrow();
  });
});

describe('Proxy Prototype Chain', () => {
  test('maintains instanceof relationship with McpServer', () => {
    const server = createTestServer();
    const wrappedServer = wrapWithPayments(server, createTestOptions(testLogger));
    
    // Verify the wrapped server is still an instance of McpServer
    expect(wrappedServer).toBeInstanceOf(McpServer);
  });
  
  test('handles inheritance correctly', () => {
    // Create a class that extends McpServer
    class ExtendedServer extends McpServer {
      extendedMethod() {
        return "extended method";
      }
    }
    
    // Create an instance of the extended server
    const extendedServer = new ExtendedServer({
      name: "Extended Server",
      version: "1.0.0",
      description: "Extended server for testing"
    });
    
    const wrappedServer = wrapWithPayments(extendedServer, createTestOptions(testLogger));
    
    // Verify the wrapped server is an instance of ExtendedServer
    expect(wrappedServer).toBeInstanceOf(ExtendedServer);
    
    // Call the extended method
    const result = (wrappedServer as any).extendedMethod();
    
    // Verify the method was accessible
    expect(result).toBe("extended method");
  });
});

describe('Proxy Special Cases', () => {
  test('handles Symbol properties', () => {
    const server = createTestServer();
    
    // Create a Symbol property
    const testSymbol = Symbol('test');
    server[testSymbol] = "symbol value";
    
    const wrappedServer = wrapWithPayments(server, createTestOptions(testLogger)) as ExtendedMcpServer;
    
    // Access the Symbol property
    expect(wrappedServer[testSymbol]).toBe("symbol value");
  });
  
  test('handles non-configurable properties', () => {
    const server = createTestServer();
    
    // Add a non-configurable property
    Object.defineProperty(server, 'nonConfigurableProp', {
      value: "non-configurable value",
      writable: true,
      enumerable: true,
      configurable: false
    });
    
    const wrappedServer = wrapWithPayments(server, createTestOptions(testLogger)) as ExtendedMcpServer;
    
    // Verify the property is accessible
    expect(wrappedServer.nonConfigurableProp).toBe("non-configurable value");
    
    // Change the property
    wrappedServer.nonConfigurableProp = "new value";
    
    // Verify the change was applied
    expect(wrappedServer.nonConfigurableProp).toBe("new value");
    expect(server.nonConfigurableProp).toBe("new value");
  });
  
  test('handles property enumeration', () => {
    const server = createTestServer();
    
    // Add some properties with different enumerable settings
    Object.defineProperty(server, 'enumerableProp', {
      value: "enumerable value",
      enumerable: true
    });
    
    Object.defineProperty(server, 'nonEnumerableProp', {
      value: "non-enumerable value",
      enumerable: false
    });
    
    const wrappedServer = wrapWithPayments(server, createTestOptions(testLogger)) as ExtendedMcpServer;
    
    // Get all enumerable properties
    const props = Object.keys(wrappedServer);
    
    // Verify enumerable property is included
    expect(props).toContain('enumerableProp');
    
    // Verify non-enumerable property is not included
    expect(props).not.toContain('nonEnumerableProp');
    
    // But it should still be accessible directly
    expect(wrappedServer.nonEnumerableProp).toBe("non-enumerable value");
  });
  
  test('handles property deletion', () => {
    const server = createTestServer();
    
    // Add a property that can be deleted
    server.deletableProp = "deletable value";
    
    const wrappedServer = wrapWithPayments(server, createTestOptions(testLogger)) as ExtendedMcpServer;
    
    // Verify the property exists
    expect(wrappedServer.deletableProp).toBe("deletable value");
    
    // Delete the property
    delete wrappedServer.deletableProp;
    
    // Verify the property was deleted
    expect(wrappedServer.deletableProp).toBeUndefined();
    expect(server.deletableProp).toBeUndefined();
  });
});

describe('Proxy Method Existence', () => {
  test('has tool method', () => {
    const server = createTestServer();
    const wrappedServer = wrapWithPayments(server, createTestOptions(testLogger));
    
    // Verify the tool method exists
    expect(typeof wrappedServer.tool).toBe('function');
  });
  
  test('has resource method', () => {
    const server = createTestServer();
    const wrappedServer = wrapWithPayments(server, createTestOptions(testLogger));
    
    // Verify the resource method exists
    expect(typeof wrappedServer.resource).toBe('function');
  });
  
  test('has prompt method', () => {
    const server = createTestServer();
    const wrappedServer = wrapWithPayments(server, createTestOptions(testLogger));
    
    // Verify the prompt method exists
    expect(typeof wrappedServer.prompt).toBe('function');
  });
}); 