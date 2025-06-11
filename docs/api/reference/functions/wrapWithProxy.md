[**MCP Proxy Wrapper API Reference v1.0.0**](../README.md)

***

[MCP Proxy Wrapper API Reference](../globals.md) / wrapWithProxy

# Function: wrapWithProxy()

> **wrapWithProxy**(`server`, `options`): `McpServer`

Defined in: [proxy-wrapper.ts:37](https://github.com/crazyrabbitLTC/mcp-proxy-wrapper/blob/main/src/proxy-wrapper.ts#L37)

Create a proxy wrapper around an existing McpServer instance.
The wrapper allows intercepting and modifying tool calls through hooks and plugins
before forwarding calls to the underlying MCP server.

## Parameters

### server

`McpServer`

The existing McpServer instance to wrap

### options

[`ProxyWrapperOptions`](../interfaces/ProxyWrapperOptions.md)

The options for the proxy wrapper

## Returns

`McpServer`

A proxy McpServer instance with hook and plugin functionality
