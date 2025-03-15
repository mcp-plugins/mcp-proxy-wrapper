[**MCP Payment Wrapper API Reference v1.0.0**](../README.md)

***

[MCP Payment Wrapper API Reference](../globals.md) / SessionStatus

# Interface: SessionStatus

Defined in: [interfaces/auth-service.ts:123](https://github.com/crazyrabbitLTC/mcp-payment-wrapper/blob/1c90d0aade04e0c43ffa95bb3aed4728648d58d2/src/interfaces/auth-service.ts#L123)

Session status information

## Properties

### authenticated\_at?

> `optional` **authenticated\_at**: `string`

Defined in: [interfaces/auth-service.ts:140](https://github.com/crazyrabbitLTC/mcp-payment-wrapper/blob/1c90d0aade04e0c43ffa95bb3aed4728648d58d2/src/interfaces/auth-service.ts#L140)

Timestamp of authentication

***

### email?

> `optional` **email**: `string`

Defined in: [interfaces/auth-service.ts:134](https://github.com/crazyrabbitLTC/mcp-payment-wrapper/blob/1c90d0aade04e0c43ffa95bb3aed4728648d58d2/src/interfaces/auth-service.ts#L134)

User's email if available

***

### error?

> `optional` **error**: `string`

Defined in: [interfaces/auth-service.ts:146](https://github.com/crazyrabbitLTC/mcp-payment-wrapper/blob/1c90d0aade04e0c43ffa95bb3aed4728648d58d2/src/interfaces/auth-service.ts#L146)

Error message if status is 'error'

***

### expires\_in

> **expires\_in**: `number`

Defined in: [interfaces/auth-service.ts:143](https://github.com/crazyrabbitLTC/mcp-payment-wrapper/blob/1c90d0aade04e0c43ffa95bb3aed4728648d58d2/src/interfaces/auth-service.ts#L143)

Seconds until this session expires

***

### jwt?

> `optional` **jwt**: `string`

Defined in: [interfaces/auth-service.ts:137](https://github.com/crazyrabbitLTC/mcp-payment-wrapper/blob/1c90d0aade04e0c43ffa95bb3aed4728648d58d2/src/interfaces/auth-service.ts#L137)

JWT token if authenticated

***

### name?

> `optional` **name**: `string`

Defined in: [interfaces/auth-service.ts:131](https://github.com/crazyrabbitLTC/mcp-payment-wrapper/blob/1c90d0aade04e0c43ffa95bb3aed4728648d58d2/src/interfaces/auth-service.ts#L131)

User's name if available

***

### status

> **status**: `"error"` \| `"pending"` \| `"expired"` \| `"authenticated"`

Defined in: [interfaces/auth-service.ts:125](https://github.com/crazyrabbitLTC/mcp-payment-wrapper/blob/1c90d0aade04e0c43ffa95bb3aed4728648d58d2/src/interfaces/auth-service.ts#L125)

Current status of the authentication session

***

### user\_id?

> `optional` **user\_id**: `string`

Defined in: [interfaces/auth-service.ts:128](https://github.com/crazyrabbitLTC/mcp-payment-wrapper/blob/1c90d0aade04e0c43ffa95bb3aed4728648d58d2/src/interfaces/auth-service.ts#L128)

User ID if authenticated
