# Sky IQ Client API Documentation

## Overview

The Sky IQ Client API allows external voice agent platforms to access client data in a secure, isolated manner. Each client receives a unique API key that provides access only to their own data.

## Authentication

All API requests require authentication via API key in the header:

```
X-API-Key: skyiq_<client_id>_<timestamp>_<random>
```

## Base URL

```
https://your-domain.com/api/client
```

## API Endpoints

### 1. Business Information
**GET** `/business`

Retrieve client's business information for voice agent customization.

**Response:**
```json
{
  "success": true,
  "data": {
    "businessName": "Acme Corp",
    "businessEmail": "contact@acme.com",
    "businessPhone": "+1234567890",
    "businessAddress": "123 Main St, City, State",
    "description": "We provide excellent services...",
    "links": ["https://acme.com", "https://social.com/acme"],
    "servicePlan": "both",
    "website": "https://acme.com",
    "files": [
      {
        "name": "company_brochure.pdf",
        "type": "application/pdf",
        "url": "https://storage.url/file.pdf"
      }
    ],
    "leadSources": [
      {
        "name": "Contact Form",
        "type": "web",
        "url": "https://acme.com/contact"
      }
    ]
  },
  "clientId": 123,
  "lastUpdated": "2023-12-01T10:00:00Z"
}
```

### 2. Call Data
**GET** `/calls?limit=50&offset=0`

Retrieve client's call history for voice agent training.

**Query Parameters:**
- `limit` (optional): Number of calls to return (default: 50)
- `offset` (optional): Number of calls to skip (default: 0)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "phoneNumber": "+1234567890",
      "contactName": "John Doe",
      "duration": 180,
      "status": "completed",
      "direction": "inbound",
      "summary": "Customer inquiry about pricing",
      "transcript": "Full conversation transcript...",
      "notes": "Follow up needed",
      "createdAt": "2023-12-01T09:00:00Z",
      "isFromTwilio": true
    }
  ],
  "pagination": {
    "total": 150,
    "limit": 50,
    "offset": 0,
    "hasMore": true
  },
  "clientId": 123
}
```

### 3. Call Patterns Analysis
**GET** `/call-patterns?days=30`

Get call analytics and patterns for voice agent optimization.

**Query Parameters:**
- `days` (optional): Number of days to analyze (default: 30)

**Response:**
```json
{
  "success": true,
  "data": {
    "totalCalls": 45,
    "averageDuration": 120,
    "statusBreakdown": {
      "completed": 35,
      "missed": 8,
      "failed": 2
    },
    "directionBreakdown": {
      "inbound": 30,
      "outbound": 15
    },
    "commonContacts": {
      "John Doe": 3,
      "Jane Smith": 2
    },
    "busyHours": {
      "9": 5,
      "10": 8,
      "14": 12
    },
    "successfulExamples": [
      {
        "summary": "Product demo successfully completed",
        "duration": 300,
        "notes": "Customer interested in premium plan"
      }
    ]
  },
  "dateRange": {
    "from": "2023-11-01T00:00:00Z",
    "to": "2023-12-01T00:00:00Z",
    "days": 30
  },
  "clientId": 123
}
```

### 4. Leads Data
**GET** `/leads`

Retrieve client's leads for voice agent context.

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "name": "Jane Smith",
      "phoneNumber": "+9876543210",
      "email": "jane@example.com",
      "company": "Smith Industries",
      "notes": "Interested in our premium service",
      "createdAt": "2023-12-01T08:00:00Z"
    }
  ],
  "total": 25,
  "clientId": 123
}
```

### 5. Client Profile
**GET** `/profile`

Get comprehensive client profile for voice agent personalization.

**Response:**
```json
{
  "success": true,
  "data": {
    "client": {
      "id": 123,
      "businessName": "Acme Corp",
      "email": "owner@acme.com",
      "phone": "+1234567890",
      "website": "https://acme.com",
      "servicePlan": "both",
      "joinedDate": "2023-01-15T00:00:00Z"
    },
    "business": {
      "description": "Leading provider of business solutions",
      "address": "123 Main St, City, State",
      "email": "contact@acme.com",
      "phone": "+1234567890"
    },
    "activity": {
      "totalCalls": 150,
      "totalLeads": 25,
      "recentCallsCount": 12,
      "lastCallDate": "2023-12-01T09:00:00Z"
    },
    "preferences": {
      "servicePlan": "both",
      "autoLogging": true
    }
  },
  "generatedAt": "2023-12-01T10:00:00Z"
}
```

### 6. Health Check
**GET** `/health`

Verify API connection and client authentication.

**Response:**
```json
{
  "success": true,
  "message": "Client API is operational",
  "clientId": 123,
  "timestamp": "2023-12-01T10:00:00Z"
}
```

## Error Responses

All endpoints return consistent error responses:

```json
{
  "error": "error_code",
  "message": "Human readable error message"
}
```

Common HTTP status codes:
- `401`: Invalid or missing API key
- `404`: Resource not found
- `500`: Internal server error

## API Key Management

### Generate API Key (Admin)
**POST** `/api/users/{userId}/api-key/generate`

Generate a new API key for a client.

### Get API Key Info (Admin)
**GET** `/api/users/{userId}/api-key/info`

Check API key status for a client.

### Revoke API Key (Admin)
**DELETE** `/api/users/{userId}/api-key`

Revoke a client's API key.

### List All API Keys (Admin)
**GET** `/api/api-keys/status`

Get API key status for all clients.

## Usage Examples

### Using with curl

```bash
# Get client business info
curl -H "X-API-Key: skyiq_123_1234567890_abc123" \
     https://your-domain.com/api/client/business

# Get recent calls
curl -H "X-API-Key: skyiq_123_1234567890_abc123" \
     "https://your-domain.com/api/client/calls?limit=10"

# Get call patterns for last 7 days
curl -H "X-API-Key: skyiq_123_1234567890_abc123" \
     "https://your-domain.com/api/client/call-patterns?days=7"
```

### Using with JavaScript

```javascript
const apiKey = 'skyiq_123_1234567890_abc123';
const baseUrl = 'https://your-domain.com/api/client';

async function getClientData() {
  const response = await fetch(`${baseUrl}/profile`, {
    headers: {
      'X-API-Key': apiKey
    }
  });
  
  const data = await response.json();
  return data;
}
```

### Using with Python

```python
import requests

api_key = 'skyiq_123_1234567890_abc123'
base_url = 'https://your-domain.com/api/client'

headers = {'X-API-Key': api_key}

def get_call_patterns(days=30):
    response = requests.get(
        f'{base_url}/call-patterns',
        headers=headers,
        params={'days': days}
    )
    return response.json()
```

## Security Notes

1. **API Key Security**: Store API keys securely and never expose them in client-side code
2. **HTTPS Only**: All API requests must use HTTPS
3. **Rate Limiting**: API requests are rate-limited per client
4. **Data Isolation**: Each API key only accesses data for its specific client
5. **Key Rotation**: API keys can be regenerated/revoked at any time

## Integration with Voice Agents

This API is designed to integrate with voice agent platforms by providing:

1. **Business Context**: Use `/business` and `/profile` to customize agent personality and knowledge
2. **Historical Data**: Use `/calls` and `/call-patterns` to train agent responses
3. **Lead Information**: Use `/leads` to provide context about prospects
4. **Real-time Updates**: Data is updated in real-time as clients use the Sky IQ platform

## Support

For API key generation, troubleshooting, or additional endpoints, contact Sky IQ support.