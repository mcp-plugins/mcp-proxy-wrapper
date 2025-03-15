[**MCP Payment Wrapper API Reference v1.0.0**](../README.md)

***

[MCP Payment Wrapper API Reference](../globals.md) / SessionOptions

# Interface: SessionOptions

Defined in: [interfaces/auth-service.ts:106](https://github.com/crazyrabbitLTC/mcp-payment-wrapper/blob/1ff06e57ea826fa74274a44578bd2a0ae2de8e57/src/interfaces/auth-service.ts#L106)

Session options for creating an authentication session

## Properties

### created\_at?

> `optional` **created\_at**: `string`

Defined in: [interfaces/auth-service.ts:114](https://github.com/crazyrabbitLTC/mcp-payment-wrapper/blob/1ff06e57ea826fa74274a44578bd2a0ae2de8e57/src/interfaces/auth-service.ts#L114)

Creation timestamp in ISO format

***

### expires\_at?

> `optional` **expires\_at**: `string`

Defined in: [interfaces/auth-service.ts:117](https://github.com/crazyrabbitLTC/mcp-payment-wrapper/blob/1ff06e57ea826fa74274a44578bd2a0ae2de8e57/src/interfaces/auth-service.ts#L117)

Expiration timestamp in ISO format

***

### return\_url?

> `optional` **return\_url**: `string`

Defined in: [interfaces/auth-service.ts:108](https://github.com/crazyrabbitLTC/mcp-payment-wrapper/blob/1ff06e57ea826fa74274a44578bd2a0ae2de8e57/src/interfaces/auth-service.ts#L108)

URL to redirect after authentication

***

### user\_hint?

> `optional` **user\_hint**: `string`

Defined in: [interfaces/auth-service.ts:111](https://github.com/crazyrabbitLTC/mcp-payment-wrapper/blob/1ff06e57ea826fa74274a44578bd2a0ae2de8e57/src/interfaces/auth-service.ts#L111)

Email or username to pre-fill in the auth form
