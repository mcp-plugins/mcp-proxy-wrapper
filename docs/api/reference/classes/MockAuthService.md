[**MCP Payment Wrapper API Reference v1.0.0**](../README.md)

***

[MCP Payment Wrapper API Reference](../globals.md) / MockAuthService

# Class: MockAuthService

Defined in: [services/mock-auth-service.ts:48](https://github.com/crazyrabbitLTC/mcp-payment-wrapper/blob/1ff06e57ea826fa74274a44578bd2a0ae2de8e57/src/services/mock-auth-service.ts#L48)

Mock Authentication Service
Provides a mock implementation of the authentication service for testing

## Implements

- [`IAuthService`](../interfaces/IAuthService.md)

## Constructors

### new MockAuthService()

> **new MockAuthService**(`config`): [`MockAuthService`](MockAuthService.md)

Defined in: [services/mock-auth-service.ts:56](https://github.com/crazyrabbitLTC/mcp-payment-wrapper/blob/1ff06e57ea826fa74274a44578bd2a0ae2de8e57/src/services/mock-auth-service.ts#L56)

#### Parameters

##### config

`AuthConfig`

#### Returns

[`MockAuthService`](MockAuthService.md)

## Methods

### checkSessionStatus()

> **checkSessionStatus**(`sessionId`): `Promise`\<[`SessionStatus`](../interfaces/SessionStatus.md)\>

Defined in: [services/mock-auth-service.ts:197](https://github.com/crazyrabbitLTC/mcp-payment-wrapper/blob/1ff06e57ea826fa74274a44578bd2a0ae2de8e57/src/services/mock-auth-service.ts#L197)

Checks the status of an authentication session

#### Parameters

##### sessionId

`string`

Session ID to check

#### Returns

`Promise`\<[`SessionStatus`](../interfaces/SessionStatus.md)\>

Session status or null if not found

#### Implementation of

[`IAuthService`](../interfaces/IAuthService.md).[`checkSessionStatus`](../interfaces/IAuthService.md#checksessionstatus)

***

### createSession()

> **createSession**(`sessionId`, `options`?): `Promise`\<[`SessionStatus`](../interfaces/SessionStatus.md)\>

Defined in: [services/mock-auth-service.ts:146](https://github.com/crazyrabbitLTC/mcp-payment-wrapper/blob/1ff06e57ea826fa74274a44578bd2a0ae2de8e57/src/services/mock-auth-service.ts#L146)

Creates a new authentication session

#### Parameters

##### sessionId

`string`

Unique session ID

##### options?

[`SessionOptions`](../interfaces/SessionOptions.md)

Session options

#### Returns

`Promise`\<[`SessionStatus`](../interfaces/SessionStatus.md)\>

#### Implementation of

[`IAuthService`](../interfaces/IAuthService.md).[`createSession`](../interfaces/IAuthService.md#createsession)

***

### generateAuthUrl()

> **generateAuthUrl**(): `string`

Defined in: [services/mock-auth-service.ts:67](https://github.com/crazyrabbitLTC/mcp-payment-wrapper/blob/1ff06e57ea826fa74274a44578bd2a0ae2de8e57/src/services/mock-auth-service.ts#L67)

Generate an authentication URL for a user

#### Returns

`string`

URL for user authentication

#### Implementation of

[`IAuthService`](../interfaces/IAuthService.md).[`generateAuthUrl`](../interfaces/IAuthService.md#generateauthurl)

***

### generateToken()

> **generateToken**(`userId`): `string`

Defined in: [services/mock-auth-service.ts:125](https://github.com/crazyrabbitLTC/mcp-payment-wrapper/blob/1ff06e57ea826fa74274a44578bd2a0ae2de8e57/src/services/mock-auth-service.ts#L125)

Generate a JWT token for testing
This method is not part of the IAuthService interface
It's provided for testing purposes only

#### Parameters

##### userId

`string` = `'test-user-123'`

User ID to include in the token

#### Returns

`string`

Generated JWT token

#### Implementation of

[`IAuthService`](../interfaces/IAuthService.md).[`generateToken`](../interfaces/IAuthService.md#generatetoken)

***

### validateJWT()

> **validateJWT**(`jwt`): `Promise`\<`null` \| [`UserData`](../interfaces/UserData.md)\>

Defined in: [services/mock-auth-service.ts:244](https://github.com/crazyrabbitLTC/mcp-payment-wrapper/blob/1ff06e57ea826fa74274a44578bd2a0ae2de8e57/src/services/mock-auth-service.ts#L244)

Validates a JWT token and returns user data

#### Parameters

##### jwt

`string`

JWT token to validate

#### Returns

`Promise`\<`null` \| [`UserData`](../interfaces/UserData.md)\>

User data if valid, null otherwise

#### Implementation of

[`IAuthService`](../interfaces/IAuthService.md).[`validateJWT`](../interfaces/IAuthService.md#validatejwt)

***

### verifyToken()

> **verifyToken**(`token`, `resourceType`, `resourceId`): `Promise`\<`VerifyResponse`\>

Defined in: [services/mock-auth-service.ts:79](https://github.com/crazyrabbitLTC/mcp-payment-wrapper/blob/1ff06e57ea826fa74274a44578bd2a0ae2de8e57/src/services/mock-auth-service.ts#L79)

Verify a JWT token

#### Parameters

##### token

`string`

JWT token to verify

##### resourceType

Type of resource being accessed

`"prompt"` | `"resource"` | `"tool"`

##### resourceId

`string`

Identifier of the resource being accessed

#### Returns

`Promise`\<`VerifyResponse`\>

Verification response

#### Implementation of

[`IAuthService`](../interfaces/IAuthService.md).[`verifyToken`](../interfaces/IAuthService.md#verifytoken)
