[**MCP Payment Wrapper API Reference v1.0.0**](../README.md)

***

[MCP Payment Wrapper API Reference](../globals.md) / IAuthService

# Interface: IAuthService

Defined in: [interfaces/auth-service.ts:179](https://github.com/crazyrabbitLTC/mcp-payment-wrapper/blob/1c90d0aade04e0c43ffa95bb3aed4728648d58d2/src/interfaces/auth-service.ts#L179)

Authentication Service Interface
Defines the methods for authentication and token verification

## Methods

### checkSessionStatus()?

> `optional` **checkSessionStatus**(`sessionId`): `Promise`\<[`SessionStatus`](SessionStatus.md)\>

Defined in: [interfaces/auth-service.ts:224](https://github.com/crazyrabbitLTC/mcp-payment-wrapper/blob/1c90d0aade04e0c43ffa95bb3aed4728648d58d2/src/interfaces/auth-service.ts#L224)

Checks the status of an authentication session

#### Parameters

##### sessionId

`string`

The session ID to check

#### Returns

`Promise`\<[`SessionStatus`](SessionStatus.md)\>

A promise resolving to the current session status

***

### createSession()?

> `optional` **createSession**(`sessionId`, `options`): `Promise`\<[`SessionStatus`](SessionStatus.md)\>

Defined in: [interfaces/auth-service.ts:217](https://github.com/crazyrabbitLTC/mcp-payment-wrapper/blob/1c90d0aade04e0c43ffa95bb3aed4728648d58d2/src/interfaces/auth-service.ts#L217)

Creates an authentication session

#### Parameters

##### sessionId

`string`

The unique session identifier

##### options

[`SessionOptions`](SessionOptions.md)

Session configuration options

#### Returns

`Promise`\<[`SessionStatus`](SessionStatus.md)\>

A promise resolving to the session status

***

### generateAuthUrl()

> **generateAuthUrl**(): `string`

Defined in: [interfaces/auth-service.ts:184](https://github.com/crazyrabbitLTC/mcp-payment-wrapper/blob/1c90d0aade04e0c43ffa95bb3aed4728648d58d2/src/interfaces/auth-service.ts#L184)

Generate an authentication URL for a user

#### Returns

`string`

URL for user authentication

***

### generateToken()

> **generateToken**(`userId`?): `string`

Defined in: [interfaces/auth-service.ts:209](https://github.com/crazyrabbitLTC/mcp-payment-wrapper/blob/1c90d0aade04e0c43ffa95bb3aed4728648d58d2/src/interfaces/auth-service.ts#L209)

Generates a user token (primarily for testing)

#### Parameters

##### userId?

`string`

Optional user ID to include in the token

#### Returns

`string`

A promise resolving to a token string

***

### validateJWT()?

> `optional` **validateJWT**(`jwt`): `Promise`\<`null` \| [`UserData`](UserData.md)\>

Defined in: [interfaces/auth-service.ts:231](https://github.com/crazyrabbitLTC/mcp-payment-wrapper/blob/1c90d0aade04e0c43ffa95bb3aed4728648d58d2/src/interfaces/auth-service.ts#L231)

Validates a JWT token and retrieves user data

#### Parameters

##### jwt

`string`

The JWT token to validate

#### Returns

`Promise`\<`null` \| [`UserData`](UserData.md)\>

A promise resolving to user data or null if invalid

***

### verifyToken()

#### Call Signature

> **verifyToken**(`token`, `resourceType`, `resourceId`): `Promise`\<`VerifyResponse`\>

Defined in: [interfaces/auth-service.ts:193](https://github.com/crazyrabbitLTC/mcp-payment-wrapper/blob/1c90d0aade04e0c43ffa95bb3aed4728648d58d2/src/interfaces/auth-service.ts#L193)

Verify a JWT token

##### Parameters

###### token

`string`

JWT token to verify

###### resourceType

Type of resource being accessed

`"prompt"` | `"resource"` | `"tool"`

###### resourceId

`string`

Identifier of the resource being accessed

##### Returns

`Promise`\<`VerifyResponse`\>

Verification response

#### Call Signature

> **verifyToken**(`token`, `resourceType`, `resourceId`): `Promise`\<`VerifyResponse`\>

Defined in: [interfaces/auth-service.ts:202](https://github.com/crazyrabbitLTC/mcp-payment-wrapper/blob/1c90d0aade04e0c43ffa95bb3aed4728648d58d2/src/interfaces/auth-service.ts#L202)

Verifies a user token for a specific resource

##### Parameters

###### token

`string`

The user token to verify

###### resourceType

The type of resource being accessed

`"prompt"` | `"resource"` | `"tool"`

###### resourceId

`string`

The ID of the resource being accessed

##### Returns

`Promise`\<`VerifyResponse`\>

A promise resolving to a verification result
