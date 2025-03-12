# MCP Authentication Backend Service Interface Specification

## Overview
This document specifies the interface for the MCP Authentication Backend Service. This service will be responsible for JWT token generation and validation for the MCP Payment Wrapper.

## Endpoints

### 1. User Authentication Endpoint

**Purpose:** Generate a JWT token for an unauthenticated user when they access the authentication URL.

**URL Format:** `https://{base-auth-url}/authenticate/{uuid}`

**Method:** `GET`

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expiresAt": "2023-06-30T12:00:00Z",
  "userId": "user-123456"
}
```

**Error Response:**
```json
{
  "error": "invalid_request",
  "message": "Invalid or expired authentication request"
}
```

### 2. Token Verification Endpoint

**Purpose:** Verify a JWT token and check if the user has permission to access the requested resource.

**URL:** `https://{base-auth-url}/verify`

**Method:** `POST`

**Request Body:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "apiKey": "dev-api-key-12345",
  "resourceType": "tool|prompt|resource",
  "resourceId": "resource-identifier"
}
```

**Response (Success):**
```json
{
  "valid": true,
  "userId": "user-123456",
  "permissions": {
    "canAccess": true,
    "reasonCodes": ["sufficient_funds", "authorized_resource"]
  }
}
```

**Response (Invalid Token):**
```json
{
  "valid": false,
  "error": "invalid_token",
  "message": "Token is invalid or expired"
}
```

**Response (Insufficient Permissions):**
```json
{
  "valid": true,
  "userId": "user-123456",
  "permissions": {
    "canAccess": false,
    "reasonCodes": ["insufficient_funds"],
    "errorMessage": "Insufficient funds to access this resource"
  }
}
```

## JWT Token Structure

The JWT token should contain the following claims:

```json
{
  "sub": "user-123456",              // Subject (user ID)
  "iss": "mcp-auth-service",         // Issuer
  "iat": 1683475200,                 // Issued at (timestamp)
  "exp": 1683478800,                 // Expiration (timestamp)
  "apiKey": "dev-api-key-12345",     // Developer API key
  "mcpServerId": "server-unique-id"  // Unique identifier for the MCP server instance
}
```

## Error Response Format

All error responses should follow this standard format:

```json
{
  "error": "error_code",
  "message": "Human-readable error message",
  "details": {                        // Optional additional details
    "field1": "value1",
    "field2": "value2"
  }
}
```

Common error codes:
- `invalid_request`: The request was malformed or missing required parameters
- `invalid_token`: The provided JWT token is invalid or expired
- `invalid_api_key`: The provided API key is invalid
- `authentication_required`: Authentication is required to access this resource
- `insufficient_permissions`: The user doesn't have permission to access this resource
- `server_error`: An error occurred on the server

## Client Implementation Guidelines

1. The wrapper should include the JWT token in all requests to protected resources.
2. If a request receives an "authentication_required" error, the client should:
   - Generate a UUID
   - Construct an authentication URL with the UUID
   - Return an error to the LLM with the authentication URL
3. The wrapper should never store the UUID or JWT token locally (stateless operation).
4. JWT token verification should be performed for every protected resource access.

This specification will be implemented by the actual backend service in the future. For now, a mock implementation will be created for testing purposes. 