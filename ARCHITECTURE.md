# Architecture

## System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                         CUSTOMERS                                │
│                    (any device with browser)                     │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ORDER FORM (Web)                              │
│         covenantacresfarmstand.com/order                         │
│                                                                  │
│  • Select bake slot (date + location)                           │
│  • Choose flavors and quantities                                │
│  • Enter customer info                                          │
│  • Submit order                                                 │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                    GOOGLE SHEETS                                 │
│                   (Data Bridge)                                  │
│                                                                  │
│  Sheets:                                                        │
│  • Orders - All customer orders                                 │
│  • Customers - Customer database                                │
│  • BakeSlots - Available dates/locations/caps                   │
│  • Flavors - Menu items with prices                             │
│  • Recipes - Ingredients and instructions                       │
│  • Ingredients - Cost tracking                                  │
│  • Config - System settings                                     │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                  DESKTOP APP (Electron)                          │
│              Installed on Shane's Windows PC                     │
│                                                                  │
│  Modules:                                                       │
│  ├── Orders      - View, edit, filter, manage orders            │
│  ├── Config      - Bake slots, flavors, locations, caps         │
│  ├── Customers   - Database, history, broadcast messaging       │
│  ├── Production  - Recipes, prep sheets, cost tracking          │
│  ├── Analytics   - Sales stats, financials                      │
│  └── Sync        - Google Sheets sync + offline cache           │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow

### Order Submission
1. Customer visits order form
2. Form fetches available bake slots from Sheets
3. Customer selects slot, sees available flavors (respecting caps)
4. Customer submits order
5. Order written to Sheets + confirmation email/SMS sent
6. Desktop app syncs and shows new order

### Offline Mode
1. Desktop app caches all Sheets data to local SQLite
2. When offline, reads/writes to SQLite
3. When online, syncs changes bidirectionally
4. Conflict resolution: last-write-wins with timestamp

## Key Design Decisions

### Why Google Sheets as Database?
- Free tier is sufficient for micro bakery volume
- Shane/Stephanie already familiar with Sheets
- Easy to inspect/debug data directly
- Natural backup (Google's infrastructure)
- Simple API for both web and desktop

### Why Electron for Desktop?
- Cross-platform (works on Windows, can support Mac later)
- Full offline capability
- Can package as standalone installer
- TypeScript throughout = shared code with web

### Why Hybrid Architecture?
- Order form must be public (can't run from local PC)
- Admin features need offline access (kitchen, market)
- Sheets bridges both worlds seamlessly

## Module Responsibilities

### order-form/
- Static site, no backend
- Reads bake slots and flavors from Sheets (via API)
- Writes orders to Sheets
- Sends confirmation via serverless function

### desktop-app/
- Main process: Sheets sync, SQLite management, IPC
- Renderer: React UI for all admin features
- Preload: Secure bridge between main and renderer

### shared/
- TypeScript types (Order, Customer, BakeSlot, etc.)
- Validation functions
- Date/time utilities
- Error codes and messages

## Error Handling Strategy

### Error Codes
All errors have codes for easy troubleshooting:
- `ORD-xxx`: Order-related errors
- `SYNC-xxx`: Sync/connectivity errors
- `AUTH-xxx`: Google auth errors
- `DATA-xxx`: Data validation errors

### Logging
- All errors logged to `logs/error.log`
- Includes timestamp, error code, context, stack trace
- Log rotation: keep last 7 days
- "Send Error Report" bundles logs for support

### User-Facing Messages
- Friendly messages shown to user
- Error code displayed for reference
- Suggested actions when possible

## Security Considerations

- Google OAuth for Sheets access (no stored credentials)
- Tokens stored in OS secure storage (keychain/credential manager)
- Customer PII only in Sheets (not cached locally long-term)
- SMS opt-in tracked for compliance
