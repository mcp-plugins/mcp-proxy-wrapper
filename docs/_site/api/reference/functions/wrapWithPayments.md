[**MCP Payment Wrapper API Reference v1.0.0**](../README.md)

***

[MCP Payment Wrapper API Reference](../globals.md) / wrapWithPayments

# Function: wrapWithPayments()

> **wrapWithPayments**(`server`, `options`): `McpServer`

Defined in: [payment-wrapper.ts:87](https://github.com/crazyrabbitLTC/mcp-payment-wrapper/blob/1ff06e57ea826fa74274a44578bd2a0ae2de8e57/src/payment-wrapper.ts#L87)

Create a payment-enabled wrapper around an existing McpServer instance.
The wrapper validates API keys and user tokens, and simulates billing checks
before forwarding calls to the underlying MCP server.

## Parameters

### server

`McpServer`

The existing McpServer instance to wrap

### options

[`PaymentWrapperOptions`](../interfaces/PaymentWrapperOptions.md)

The options for the payment wrapper

## Returns

`McpServer`

A proxy McpServer instance with payment functionality
