[**MCP Payment Wrapper API Reference v1.0.0**](../README.md)

***

[MCP Payment Wrapper API Reference](../globals.md) / LoggerOptions

# Interface: LoggerOptions

Defined in: [utils/logger.ts:31](https://github.com/crazyrabbitLTC/mcp-payment-wrapper/blob/1ff06e57ea826fa74274a44578bd2a0ae2de8e57/src/utils/logger.ts#L31)

Options for configuring the logger

## Properties

### customLogger?

> `optional` **customLogger**: `Logger`

Defined in: [utils/logger.ts:50](https://github.com/crazyrabbitLTC/mcp-payment-wrapper/blob/1ff06e57ea826fa74274a44578bd2a0ae2de8e57/src/utils/logger.ts#L50)

Custom logger instance (for testing)

***

### level?

> `optional` **level**: `string`

Defined in: [utils/logger.ts:35](https://github.com/crazyrabbitLTC/mcp-payment-wrapper/blob/1ff06e57ea826fa74274a44578bd2a0ae2de8e57/src/utils/logger.ts#L35)

Log level (debug, info, warn, error)

***

### logFilePath?

> `optional` **logFilePath**: `string`

Defined in: [utils/logger.ts:45](https://github.com/crazyrabbitLTC/mcp-payment-wrapper/blob/1ff06e57ea826fa74274a44578bd2a0ae2de8e57/src/utils/logger.ts#L45)

Path to the log file

***

### stdioMode?

> `optional` **stdioMode**: `boolean`

Defined in: [utils/logger.ts:40](https://github.com/crazyrabbitLTC/mcp-payment-wrapper/blob/1ff06e57ea826fa74274a44578bd2a0ae2de8e57/src/utils/logger.ts#L40)

Whether the server is using stdio transport
