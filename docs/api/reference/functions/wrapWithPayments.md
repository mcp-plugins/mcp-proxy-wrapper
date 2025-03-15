[**MCP Payment Wrapper API Reference v1.0.0**](../README.md)

***

[MCP Payment Wrapper API Reference](../globals.md) / wrapWithPayments

# Function: wrapWithPayments()

> **wrapWithPayments**(`server`, `options`): `McpServer`

Defined in: [payment-wrapper.ts:87](https://github.com/crazyrabbitLTC/mcp-payment-wrapper/blob/1c90d0aade04e0c43ffa95bb3aed4728648d58d2/src/payment-wrapper.ts#L87)

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
