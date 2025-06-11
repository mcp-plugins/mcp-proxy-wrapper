[**MCP Proxy Wrapper API Reference v1.0.0**](../README.md)

***

[MCP Proxy Wrapper API Reference](../globals.md) / ProxyWrapperOptions

# Interface: ProxyWrapperOptions

Defined in: [proxy-wrapper.ts:34](https://github.com/crazyrabbitLTC/mcp-proxy-wrapper/blob/main/src/proxy-wrapper.ts#L34)

## Properties

### hooks?

> `optional` **hooks**: `ProxyHooks`

Hook functions for intercepting tool calls

***

### metadata?

> `optional` **metadata**: `Record<string, any>`

Global metadata to add to all tool calls

***

### debug?

> `optional` **debug**: `boolean`

Enable debug logging

***

### plugins?

> `optional` **plugins**: `ProxyPlugin[]`

Array of plugins to register with the wrapper

***

### pluginConfig?

> `optional` **pluginConfig**: `Record<string, any>`

Configuration options for the plugin manager
