[**MCP Payment Wrapper API Reference v1.0.0**](../README.md)

***

[MCP Payment Wrapper API Reference](../globals.md) / UserData

# Interface: UserData

Defined in: [interfaces/auth-service.ts:152](https://github.com/crazyrabbitLTC/mcp-payment-wrapper/blob/1ff06e57ea826fa74274a44578bd2a0ae2de8e57/src/interfaces/auth-service.ts#L152)

User data returned after JWT validation

## Properties

### available\_credit

> **available\_credit**: `number`

Defined in: [interfaces/auth-service.ts:169](https://github.com/crazyrabbitLTC/mcp-payment-wrapper/blob/1ff06e57ea826fa74274a44578bd2a0ae2de8e57/src/interfaces/auth-service.ts#L169)

Available credit (if applicable)

***

### balance

> **balance**: `number`

Defined in: [interfaces/auth-service.ts:163](https://github.com/crazyrabbitLTC/mcp-payment-wrapper/blob/1ff06e57ea826fa74274a44578bd2a0ae2de8e57/src/interfaces/auth-service.ts#L163)

Current balance amount

***

### currency

> **currency**: `string`

Defined in: [interfaces/auth-service.ts:166](https://github.com/crazyrabbitLTC/mcp-payment-wrapper/blob/1ff06e57ea826fa74274a44578bd2a0ae2de8e57/src/interfaces/auth-service.ts#L166)

Currency code (e.g., USD)

***

### email

> **email**: `string`

Defined in: [interfaces/auth-service.ts:160](https://github.com/crazyrabbitLTC/mcp-payment-wrapper/blob/1ff06e57ea826fa74274a44578bd2a0ae2de8e57/src/interfaces/auth-service.ts#L160)

User's email address

***

### name

> **name**: `string`

Defined in: [interfaces/auth-service.ts:157](https://github.com/crazyrabbitLTC/mcp-payment-wrapper/blob/1ff06e57ea826fa74274a44578bd2a0ae2de8e57/src/interfaces/auth-service.ts#L157)

User's display name

***

### refreshedJwt?

> `optional` **refreshedJwt**: `string`

Defined in: [interfaces/auth-service.ts:172](https://github.com/crazyrabbitLTC/mcp-payment-wrapper/blob/1ff06e57ea826fa74274a44578bd2a0ae2de8e57/src/interfaces/auth-service.ts#L172)

Updated JWT token (only if token was refreshed)

***

### user\_id

> **user\_id**: `string`

Defined in: [interfaces/auth-service.ts:154](https://github.com/crazyrabbitLTC/mcp-payment-wrapper/blob/1ff06e57ea826fa74274a44578bd2a0ae2de8e57/src/interfaces/auth-service.ts#L154)

User's unique identifier
