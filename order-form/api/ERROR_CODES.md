# API Error Codes

This document describes the error codes returned by the order form API endpoints.

**Implementation:** See `lib/_errors.ts` for error code constants.

## Error Code Format

Error codes follow the pattern: `PREFIX-NUMBER` or `PREFIX-DESCRIPTION`

- **PREFIX**: Indicates the domain/module (ORD = Orders, DATA = Validation, SYNC = Google Sheets sync, etc.)
- **NUMBER/DESCRIPTION**: Specific error identifier

## Error Codes by Category

### Order Errors (ORD-xxx)

| Code | HTTP Status | Description | Resolution |
|------|-------------|-------------|------------|
| `ORD-001` | 500 | General order processing failure | Server-side error - check logs, retry later |
| `ORD-106` | 400 | Insufficient capacity for order | Reduce quantity or choose different bake slot |
| `ORD-SLOT_CLOSED` | 400 | Bake slot not found or closed | Select a valid, open bake slot |

### Validation Errors (DATA-xxx)

| Code | HTTP Status | Description | Resolution |
|------|-------------|-------------|------------|
| `DATA-403` | 400 | Invalid request data | Check request payload matches expected format |

**DATA-403 triggers:**
- Missing or invalid order ID, bake slot ID, or items
- Missing customer information (name, email, phone)
- Invalid email format
- Invalid phone number format
- Order items validation failed (invalid quantity, price, or flavor ID)
- Order total exceeds maximum allowed ($5,000)

### Sync Errors (SYNC-xxx)

| Code | HTTP Status | Description | Resolution |
|------|-------------|-------------|------------|
| `SYNC-203` | 500 | Failed to fetch bake slots from Google Sheets | Check Google Sheets configuration and connectivity |
| `SYNC-204` | 500 | Failed to fetch flavors from Google Sheets | Check Google Sheets configuration and connectivity |

### Location Errors (LOC-xxx)

| Code | HTTP Status | Description | Resolution |
|------|-------------|-------------|------------|
| `LOC-001` | 500 | Failed to fetch locations from Google Sheets | Check Google Sheets configuration and connectivity |

### History Errors (HIST-xxx)

| Code | HTTP Status | Description | Resolution |
|------|-------------|-------------|------------|
| `HIST-001` | 500 | Failed to fetch customer history | Check Google Sheets configuration and connectivity |

## Error Response Format

All API errors return JSON in this format:

```json
{
  "error": "Human-readable error message",
  "code": "ERROR-CODE",
  "details": "Optional additional details (only on 500 errors)"
}
```

## Client-Side Error Handling

```typescript
try {
  const response = await fetch('/api/orders', { ... });
  const data = await response.json();

  if (!response.ok) {
    switch (data.code) {
      case 'ORD-106':
        // Show "Not enough spots available" message
        break;
      case 'ORD-SLOT_CLOSED':
        // Prompt user to select different bake slot
        break;
      case 'DATA-403':
        // Show validation error to user
        break;
      default:
        // Generic error handling
    }
  }
} catch (err) {
  // Network error - show retry option
}
```

## Adding New Error Codes

When adding new error codes:

1. Use appropriate prefix for the domain
2. Use sequential numbers within each prefix
3. Document in this file
4. Include meaningful error message in response
5. Use appropriate HTTP status code (400 for client errors, 500 for server errors)
