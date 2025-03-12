# MCP Payment Wrapper Backend API Specification

## Overview

This document outlines the API specification for the backend services supporting the MCP Payment Wrapper. The backend provides authentication, user validation, and billing functionality required for the payment wrapper to operate.

## Base URL

```
https://api.mcp-payments.com/v1
```

## Authentication

All API requests require authentication using a developer API key passed in the HTTP header:

```
X-API-Key: your_developer_api_key
```

## API Endpoints

### Authentication Service

#### Validate Developer API Key

Validates that a developer API key is active and authorized.

- **URL**: `/auth/validate-api-key`
- **Method**: `POST`
- **Headers**:
  - `X-API-Key`: Developer API key
- **Response**:
  - **Success (200 OK)**:
    ```json
    {
      "valid": true,
      "developerId": "dev_123456",
      "permissions": ["payment_processing", "user_validation"]
    }
    ```
  - **Error (401 Unauthorized)**:
    ```json
    {
      "valid": false,
      "error": "invalid_api_key",
      "message": "The provided API key is invalid or has been revoked"
    }
    ```

#### Verify User Token

Verifies a user JWT token and returns user information.

- **URL**: `/auth/verify-token`
- **Method**: `POST`
- **Headers**:
  - `X-API-Key`: Developer API key
- **Request Body**:
  ```json
  {
    "token": "user_jwt_token"
  }
  ```
- **Response**:
  - **Success (200 OK)**:
    ```json
    {
      "valid": true,
      "userId": "user_789012",
      "permissions": ["use_tools", "use_resources", "use_prompts"],
      "metadata": {
        "username": "example_user",
        "email": "user@example.com"
      }
    }
    ```
  - **Error (401 Unauthorized)**:
    ```json
    {
      "valid": false,
      "error": "invalid_token",
      "message": "The provided token is invalid, expired, or has been revoked"
    }
    ```

#### Generate User Token (For Admin/Testing)

Generates a JWT token for a user (primarily for testing or admin operations).

- **URL**: `/auth/generate-token`
- **Method**: `POST`
- **Headers**:
  - `X-API-Key`: Developer API key (requires admin permissions)
- **Request Body**:
  ```json
  {
    "userId": "user_789012",
    "expiresIn": "7d", // optional, defaults to 24h
    "permissions": ["use_tools", "use_resources"] // optional
  }
  ```
- **Response**:
  - **Success (200 OK)**:
    ```json
    {
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
      "expiresAt": "2023-12-31T23:59:59Z"
    }
    ```
  - **Error (403 Forbidden)**:
    ```json
    {
      "error": "insufficient_permissions",
      "message": "Your API key does not have permission to generate tokens"
    }
    ```

### Billing Service

#### Check User Funds

Checks if a user has sufficient funds for an operation.

- **URL**: `/billing/check-funds`
- **Method**: `POST`
- **Headers**:
  - `X-API-Key`: Developer API key
- **Request Body**:
  ```json
  {
    "userId": "user_789012",
    "operationType": "tool", // or "resource", "prompt"
    "operationId": "example_tool", // the specific tool/resource/prompt ID
    "estimatedCost": 0.05 // optional, for pre-validation
  }
  ```
- **Response**:
  - **Success (200 OK)**:
    ```json
    {
      "sufficientFunds": true,
      "balance": 10.25,
      "operationCost": 0.05,
      "estimatedRemainingOperations": 205
    }
    ```
  - **Insufficient Funds (402 Payment Required)**:
    ```json
    {
      "sufficientFunds": false,
      "balance": 0.03,
      "operationCost": 0.05,
      "error": "insufficient_funds",
      "message": "User has insufficient funds for this operation"
    }
    ```
  - **Error (400 Bad Request)**:
    ```json
    {
      "error": "invalid_operation_type",
      "message": "The provided operation type is not valid"
    }
    ```

#### Process Charge

Processes a charge for a completed operation.

- **URL**: `/billing/process-charge`
- **Method**: `POST`
- **Headers**:
  - `X-API-Key`: Developer API key
- **Request Body**:
  ```json
  {
    "userId": "user_789012",
    "operationType": "tool", // or "resource", "prompt"
    "operationId": "example_tool",
    "cost": 0.05,
    "metadata": {
      "requestId": "req_abcdef123456",
      "executionTime": 1250 // ms
    }
  }
  ```
- **Response**:
  - **Success (200 OK)**:
    ```json
    {
      "success": true,
      "transactionId": "txn_123456789",
      "updatedBalance": 10.20,
      "receipt": {
        "timestamp": "2023-12-15T14:23:45Z",
        "amount": 0.05,
        "description": "Charge for tool: example_tool"
      }
    }
    ```
  - **Error (400 Bad Request)**:
    ```json
    {
      "success": false,
      "error": "invalid_cost",
      "message": "Cost must be greater than zero"
    }
    ```
  - **Error (402 Payment Required)**:
    ```json
    {
      "success": false,
      "error": "insufficient_funds",
      "message": "User has insufficient funds to process this charge"
    }
    ```

#### Get User Balance

Retrieves a user's current balance.

- **URL**: `/billing/balance/:userId`
- **Method**: `GET`
- **Headers**:
  - `X-API-Key`: Developer API key
- **URL Parameters**:
  - `userId`: The ID of the user
- **Response**:
  - **Success (200 OK)**:
    ```json
    {
      "userId": "user_789012",
      "balance": 10.25,
      "currency": "USD",
      "lastUpdated": "2023-12-15T14:23:45Z"
    }
    ```
  - **Error (404 Not Found)**:
    ```json
    {
      "error": "user_not_found",
      "message": "User with the provided ID could not be found"
    }
    ```

#### Get Usage History

Retrieves a user's usage history.

- **URL**: `/billing/usage/:userId`
- **Method**: `GET`
- **Headers**:
  - `X-API-Key`: Developer API key
- **URL Parameters**:
  - `userId`: The ID of the user
- **Query Parameters**:
  - `startDate`: ISO date string (optional)
  - `endDate`: ISO date string (optional)
  - `limit`: Number of records to return (optional, default 50)
  - `offset`: Pagination offset (optional, default 0)
- **Response**:
  - **Success (200 OK)**:
    ```json
    {
      "userId": "user_789012",
      "totalRecords": 120,
      "returnedRecords": 50,
      "usage": [
        {
          "transactionId": "txn_123456789",
          "timestamp": "2023-12-15T14:23:45Z",
          "operationType": "tool",
          "operationId": "example_tool",
          "cost": 0.05,
          "metadata": {
            "executionTime": 1250
          }
        },
        // Additional usage records...
      ]
    }
    ```
  - **Error (404 Not Found)**:
    ```json
    {
      "error": "user_not_found",
      "message": "User with the provided ID could not be found"
    }
    ```

### Developer Dashboard Endpoints

#### Get Developer Analytics

Retrieves usage analytics for a developer.

- **URL**: `/developer/analytics`
- **Method**: `GET`
- **Headers**:
  - `X-API-Key`: Developer API key
- **Query Parameters**:
  - `startDate`: ISO date string (optional)
  - `endDate`: ISO date string (optional)
  - `groupBy`: Group results by "day", "week", "month" (optional, default "day")
- **Response**:
  - **Success (200 OK)**:
    ```json
    {
      "totalUsers": 1250,
      "totalOperations": 78500,
      "totalRevenue": 3925.75,
      "analytics": [
        {
          "period": "2023-12-15",
          "operations": {
            "total": 1250,
            "byType": {
              "tool": 850,
              "resource": 300,
              "prompt": 100
            }
          },
          "revenue": 62.50,
          "activeUsers": 120
        },
        // Additional periods...
      ]
    }
    ```

#### Get Developer Settings

Retrieves current settings for a developer.

- **URL**: `/developer/settings`
- **Method**: `GET`
- **Headers**:
  - `X-API-Key`: Developer API key
- **Response**:
  - **Success (200 OK)**:
    ```json
    {
      "developerId": "dev_123456",
      "pricing": {
        "tool": 0.05,
        "resource": 0.02,
        "prompt": 0.10
      },
      "webhooks": {
        "lowBalanceAlert": "https://example.com/webhooks/low-balance",
        "chargeProcessed": "https://example.com/webhooks/charge"
      },
      "notificationSettings": {
        "lowBalanceThreshold": 5.00,
        "dailyUsageSummary": true,
        "notifyOnError": true
      }
    }
    ```

#### Update Developer Settings

Updates settings for a developer.

- **URL**: `/developer/settings`
- **Method**: `PUT`
- **Headers**:
  - `X-API-Key`: Developer API key
- **Request Body**:
  ```json
  {
    "pricing": {
      "tool": 0.06,
      "resource": 0.03,
      "prompt": 0.12
    },
    "webhooks": {
      "lowBalanceAlert": "https://example.com/webhooks/low-balance-new",
      "chargeProcessed": "https://example.com/webhooks/charge-new"
    },
    "notificationSettings": {
      "lowBalanceThreshold": 10.00,
      "dailyUsageSummary": false,
      "notifyOnError": true
    }
  }
  ```
- **Response**:
  - **Success (200 OK)**:
    ```json
    {
      "success": true,
      "message": "Settings updated successfully",
      "updatedSettings": {
        // The complete updated settings object
      }
    }
    ```
  - **Error (400 Bad Request)**:
    ```json
    {
      "error": "invalid_pricing",
      "message": "Pricing values must be greater than zero"
    }
    ```

## Error Responses

All API endpoints use standard HTTP status codes and return error responses in a consistent format:

```json
{
  "error": "error_code",
  "message": "Human-readable error message",
  "details": {
    // Optional additional error details
  }
}
```

### Common Error Codes

- `invalid_api_key`: The provided API key is invalid or has expired
- `invalid_token`: The provided user token is invalid or has expired
- `insufficient_funds`: The user has insufficient funds for the operation
- `user_not_found`: The specified user could not be found
- `invalid_request`: The request format is invalid or missing required parameters
- `service_unavailable`: The service is temporarily unavailable
- `rate_limited`: The client has sent too many requests in a given time period

## Rate Limiting

API endpoints are rate-limited to protect the service from abuse. Rate limits are applied per API key.

- **Headers in Response**:
  - `X-RateLimit-Limit`: The maximum number of requests allowed in the current time window
  - `X-RateLimit-Remaining`: The number of requests remaining in the current time window
  - `X-RateLimit-Reset`: The time at which the current rate limit window resets in UTC epoch seconds

When a rate limit is exceeded, the API responds with a 429 Too Many Requests status code:

```json
{
  "error": "rate_limited",
  "message": "Too many requests, please try again later",
  "details": {
    "rateLimitReset": 1687436400
  }
}
```

## Webhooks

The API can send webhooks to notify your application of important events. Configure webhook URLs in the developer settings.

### Event Types

- `charge.processed`: Triggered when a charge is successfully processed
- `user.low_balance`: Triggered when a user's balance falls below the configured threshold
- `api_key.expiring`: Triggered when a developer API key is about to expire

### Webhook Payload

```json
{
  "event": "charge.processed",
  "timestamp": "2023-12-15T14:23:45Z",
  "data": {
    // Event-specific data
  }
}
```

## Implementation Notes

- All timestamps are in ISO 8601 format (UTC)
- Currency values are in USD
- API versioning is included in the URL path (/v1/...)
- Responses are in JSON format
- Requests with a body should use the `application/json` content type
- HTTPS is required for all API calls

This API specification provides the foundation for the backend services required by the MCP Payment Wrapper. Implementing these endpoints will allow the payment wrapper to authenticate users, verify funds, and process charges for MCP operations.
