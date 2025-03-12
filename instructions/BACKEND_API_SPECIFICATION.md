# MCP Payment Wrapper - Backend API Specification

## Overview

This document specifies the backend API endpoints that the MCP Payment Wrapper interacts with for authentication, payment processing, and transaction management.

## Base URLs

- Authentication Service: `https://auth.mcp-api.com`
- Payment Service: `https://payments.mcp-api.com`
- Transaction Service: `https://transactions.mcp-api.com`

## Authentication Endpoints

### 1. Verify JWT Token
- **Endpoint**: `POST /auth/verify`
- **Description**: Verifies a JWT token and checks resource access permissions
- **Request**:
  ```json
  {
    "token": "string",
    "resourceType": "tool" | "prompt" | "resource",
    "resourceId": "string"
  }
  ```
- **Response**:
  ```json
  {
    "valid": boolean,
    "userId": "string",
    "error": "string",
    "message": "string",
    "permissions": {
      "canAccess": boolean,
      "reasonCodes": string[],
      "errorMessage": "string"
    }
  }
  ```

### 2. Generate Authentication URL
- **Endpoint**: `POST /auth/generate-url`
- **Description**: Generates a URL for user authentication
- **Request**:
  ```json
  {
    "apiKey": "string",
    "returnUrl": "string",
    "userHint": "string"
  }
  ```
- **Response**:
  ```json
  {
    "authUrl": "string",
    "sessionId": "string",
    "expiresIn": number
  }
  ```

### 3. Check Session Status
- **Endpoint**: `GET /auth/session/:sessionId`
- **Description**: Checks the status of an authentication session
- **Response**:
  ```json
  {
    "status": "pending" | "authenticated" | "expired",
    "userId": "string",
    "name": "string",
    "email": "string",
    "jwt": "string",
    "authenticatedAt": "string",
    "expiresIn": number
  }
  ```

## Payment Endpoints

### 1. Verify Funds
- **Endpoint**: `POST /payments/verify-funds`
- **Description**: Verifies if a user has sufficient funds for an operation
- **Request**:
  ```json
  {
    "userId": "string",
    "amount": number,
    "currency": "string"
  }
  ```
- **Response**:
  ```json
  {
    "hasSufficientFunds": boolean,
    "currentBalance": number,
    "requiredAmount": number
  }
  ```

### 2. Process Charge
- **Endpoint**: `POST /payments/charge`
- **Description**: Processes a charge for a completed operation
- **Request**:
  ```json
  {
    "userId": "string",
    "amount": number,
    "currency": "string",
    "metadata": {
      "operationType": "tool" | "prompt" | "resource",
      "operationId": "string",
      "description": "string"
    }
  }
  ```
- **Response**:
  ```json
  {
    "transactionId": "string",
    "status": "success" | "failed",
    "timestamp": "string",
    "receiptUrl": "string"
  }
  ```

### 3. Get User Balance
- **Endpoint**: `GET /payments/balance/:userId`
- **Description**: Retrieves the current balance for a user
- **Response**:
  ```json
  {
    "balance": number,
    "currency": "string",
    "availableCredit": number,
    "lastUpdated": "string"
  }
  ```

## API Key Management

### 1. Verify API Key
- **Endpoint**: `POST /api-keys/verify`
- **Description**: Verifies the validity of a developer API key
- **Request**:
  ```json
  {
    "apiKey": "string"
  }
  ```
- **Response**:
  ```json
  {
    "valid": boolean,
    "developerId": "string",
    "permissions": string[],
    "error": "string"
  }
  ```

## Transaction Management

### 1. Store Transaction
- **Endpoint**: `POST /transactions`
- **Description**: Stores a payment transaction record
- **Request**:
  ```json
  {
    "transactionId": "string",
    "userId": "string",
    "amount": number,
    "currency": "string",
    "status": "success" | "failed" | "refunded",
    "metadata": {
      "operationType": "tool" | "prompt" | "resource",
      "operationId": "string",
      "description": "string"
    },
    "timestamp": "string"
  }
  ```
- **Response**:
  ```json
  {
    "stored": boolean,
    "error": "string"
  }
  ```

### 2. Get Transaction
- **Endpoint**: `GET /transactions/:transactionId`
- **Description**: Retrieves a specific transaction record
- **Response**:
  ```json
  {
    "transactionId": "string",
    "userId": "string",
    "amount": number,
    "currency": "string",
    "status": "success" | "failed" | "refunded",
    "metadata": object,
    "timestamp": "string",
    "receiptUrl": "string"
  }
  ```

### 3. List User Transactions
- **Endpoint**: `GET /transactions/user/:userId`
- **Description**: Retrieves all transactions for a user
- **Query Parameters**:
  - `limit`: number (default: 10)
  - `offset`: number (default: 0)
  - `status`: "success" | "failed" | "refunded"
- **Response**:
  ```json
  {
    "transactions": [
      {
        "transactionId": "string",
        "amount": number,
        "currency": "string",
        "status": "string",
        "timestamp": "string",
        "metadata": object
      }
    ],
    "total": number,
    "hasMore": boolean
  }
  ```

## Error Responses

All endpoints may return the following error responses:

```json
{
  "error": string,
  "message": string,
  "code": number,
  "details": object
}
```

Common error codes:
- 400: Bad Request
- 401: Unauthorized
- 403: Forbidden
- 404: Not Found
- 429: Too Many Requests
- 500: Internal Server Error

## Rate Limiting

All endpoints are rate limited with the following defaults:
- 100 requests per minute per API key
- 1000 requests per hour per API key
- Rate limit headers are included in responses:
  - `X-RateLimit-Limit`
  - `X-RateLimit-Remaining`
  - `X-RateLimit-Reset`

## Authentication

All endpoints except `/auth/generate-url` require authentication via one of:
1. Developer API key in `X-API-Key` header
2. JWT token in `Authorization: Bearer <token>` header

## Versioning

The API is versioned through the URL path:
- Current version: `/v1/`
- Example: `https://auth.mcp-api.com/v1/auth/verify`

## Testing

A sandbox environment is available for testing:
- Sandbox URLs use `.sandbox` subdomain
- Example: `https://auth.sandbox.mcp-api.com/v1/auth/verify`
- Test API keys and tokens are provided for sandbox use 