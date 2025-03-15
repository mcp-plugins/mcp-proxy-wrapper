[**MCP Payment Wrapper API Reference v1.0.0**](../README.md)

***

[MCP Payment Wrapper API Reference](../globals.md) / PaymentWrapperOptions

# Interface: PaymentWrapperOptions

Defined in: [payment-wrapper.ts:34](https://github.com/crazyrabbitLTC/mcp-payment-wrapper/blob/1ff06e57ea826fa74274a44578bd2a0ae2de8e57/src/payment-wrapper.ts#L34)

## Properties

### \_testOverrideFundsCheck?

> `optional` **\_testOverrideFundsCheck**: `boolean`

Defined in: [payment-wrapper.ts:66](https://github.com/crazyrabbitLTC/mcp-payment-wrapper/blob/1ff06e57ea826fa74274a44578bd2a0ae2de8e57/src/payment-wrapper.ts#L66)

Optional override for the funds check result (for testing)

#### Default

```ts
undefined
```

***

### apiKey

> **apiKey**: `string`

Defined in: [payment-wrapper.ts:38](https://github.com/crazyrabbitLTC/mcp-payment-wrapper/blob/1ff06e57ea826fa74274a44578bd2a0ae2de8e57/src/payment-wrapper.ts#L38)

Developer API key used for authentication

***

### baseAuthUrl?

> `optional` **baseAuthUrl**: `string`

Defined in: [payment-wrapper.ts:60](https://github.com/crazyrabbitLTC/mcp-payment-wrapper/blob/1ff06e57ea826fa74274a44578bd2a0ae2de8e57/src/payment-wrapper.ts#L60)

Optional base URL for the authentication service

#### Default

```ts
"https://auth.mcp-api.com"
```

***

### debugMode?

> `optional` **debugMode**: `boolean`

Defined in: [payment-wrapper.ts:49](https://github.com/crazyrabbitLTC/mcp-payment-wrapper/blob/1ff06e57ea826fa74274a44578bd2a0ae2de8e57/src/payment-wrapper.ts#L49)

Optional flag to enable additional debug logging

***

### loggerOptions?

> `optional` **loggerOptions**: [`LoggerOptions`](LoggerOptions.md)

Defined in: [payment-wrapper.ts:54](https://github.com/crazyrabbitLTC/mcp-payment-wrapper/blob/1ff06e57ea826fa74274a44578bd2a0ae2de8e57/src/payment-wrapper.ts#L54)

Optional configuration for the logger

***

### userToken?

> `optional` **userToken**: `string`

Defined in: [payment-wrapper.ts:44](https://github.com/crazyrabbitLTC/mcp-payment-wrapper/blob/1ff06e57ea826fa74274a44578bd2a0ae2de8e57/src/payment-wrapper.ts#L44)

User JWT token for identifying and authenticating the end user
If not provided, the wrapper will return authentication-required responses
