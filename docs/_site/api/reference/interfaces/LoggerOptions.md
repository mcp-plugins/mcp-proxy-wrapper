[**MCP Payment Wrapper API Reference v1.0.0**](../README.md)

***

[MCP Payment Wrapper API Reference](../globals.md) / LoggerOptions

# Interface: LoggerOptions

Defined in: [utils/logger.ts:32](https://github.com/crazyrabbitLTC/mcp-payment-wrapper/blob/1c90d0aade04e0c43ffa95bb3aed4728648d58d2/src/utils/logger.ts#L32)

Options for configuring the logger

## Properties

### customLogger?

> `optional` **customLogger**: `Logger`

Defined in: [utils/logger.ts:51](https://github.com/crazyrabbitLTC/mcp-payment-wrapper/blob/1c90d0aade04e0c43ffa95bb3aed4728648d58d2/src/utils/logger.ts#L51)

Custom logger instance (for testing)

***

### level?

> `optional` **level**: `string`

Defined in: [utils/logger.ts:36](https://github.com/crazyrabbitLTC/mcp-payment-wrapper/blob/1c90d0aade04e0c43ffa95bb3aed4728648d58d2/src/utils/logger.ts#L36)

Log level (debug, info, warn, error)

***

### logFilePath?

> `optional` **logFilePath**: `string`

Defined in: [utils/logger.ts:46](https://github.com/crazyrabbitLTC/mcp-payment-wrapper/blob/1c90d0aade04e0c43ffa95bb3aed4728648d58d2/src/utils/logger.ts#L46)

Path to the log file

***

### stdioMode?

> `optional` **stdioMode**: `boolean`

Defined in: [utils/logger.ts:41](https://github.com/crazyrabbitLTC/mcp-payment-wrapper/blob/1c90d0aade04e0c43ffa95bb3aed4728648d58d2/src/utils/logger.ts#L41)

Whether the server is using stdio transport
