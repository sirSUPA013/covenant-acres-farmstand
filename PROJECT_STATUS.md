# Project Status

## Current State: DELIVERED TO CLIENT

**Project:** Covenant Acres Farmstand - Order & Production System
**Started:** 2026-01-03
**Delivered:** 2026-01-05
**Client:** Shane & Stephanie (Covenant Acres Farmstand, Indiana)
**Developer:** Sam

---

## Delivery Summary

### What Was Delivered

| Component | Location | Status |
|-----------|----------|--------|
| Desktop App | `CovenantAcres-Setup.zip` → Google Drive | Ready for install |
| Order Form | https://covenantacresfarmstand.com/order | Deployed on Vercel |
| Database | Included in setup zip | Pre-configured with accounts |
| Documentation | `delivery/INSTALLATION-GUIDE.txt` | Included in zip |

### Client Accounts (Pre-configured)

| PIN | User | Role | Access Level |
|-----|------|------|--------------|
| 2222 | Stephanie Owner | Owner | Full access to all features |
| 3333 | Shane Admin | Admin | Orders, customers, bake slots, analytics |
| 4444 | Helper Staff | Staff | Limited order management |

### Pre-loaded Data

- **3 Pickup Locations**: Saturday Market, Farm Pickup, Wednesday Market
- **8 Bread Flavors**: Classic Sourdough, Garlic Cheddar, Jalapeño Cheddar, Cinnamon Raisin, Double Chocolate, Rosemary Olive Oil, Honey Wheat, Pumpkin Spice
- **8 Recipes**: Linked to each flavor (empty templates for owners to fill in)
- **18 Ingredients**: Common baking ingredients with cost tracking
- **Business Settings**: Payment links, cutoff hours, notification preferences

### Removed Before Delivery

- 404 test orders
- 30 fictional test customers
- 22 test bake slots
- Developer account (Sam)
- Audit log entries

---

## Remote Support Setup

### How Updates Are Delivered
1. Sam builds new version
2. Uploads to Google Drive
3. Texts owners with download link
4. Owners replace app folder (data is stored separately, preserved)

### How Database Issues Are Handled
1. Owners email `covenant-acres.db` file to Sam
2. Sam diagnoses/fixes locally
3. Sam sends back fixed database
4. Owners run setup-database.bat to install

### Real-Time Support
- TeamViewer installed on owners' computer
- Sam connects remotely when needed
- Owners provide ID/password via text

---

## Feature Inventory

### Desktop App Features

| Feature | Page | Status | Notes |
|---------|------|--------|-------|
| Order Management | OrdersPage | ✅ Complete | List, filter, view, edit, CSV export |
| Order Editing | OrdersPage | ✅ Complete | Edit items, notes, bake slot, recalculate totals |
| Payment Tracking | OrdersPage | ✅ Complete | Status updates, method enforcement |
| Customer Management | CustomersPage | ✅ Complete | Credits, history, notes |
| Bake Slot Management | ConfigPage | ✅ Complete | Create, edit, close, capacity |
| Multi-Location Bake Slots | ConfigPage | ✅ Complete | One bake day → multiple pickup locations |
| Flavor Management | ConfigPage | ✅ Complete | Add, edit, prices, seasons |
| Location Management | ConfigPage | ✅ Complete | Pickup locations |
| Recipe Management | RecipesPage | ✅ Complete | Ingredients, costs, instructions |
| Ingredient Library | RecipesPage | ✅ Complete | Cost tracking, vendor info |
| Prep Sheet | PrepSheetPage | ✅ Complete | Print-ready production list |
| Extra Production | ProductionPage | ✅ Complete | Walk-ins, gifts, waste tracking |
| Analytics | AnalyticsPage | ✅ Complete | Revenue, profit margins, profit/hr |
| User Management | UsersPage | ✅ Complete | Add/edit users, permissions |
| Settings | SettingsPage | ✅ Complete | Business info, payment links, Google Sheets |
| Google Sheets Sync | SettingsPage | ✅ Complete | Bidirectional sync |
| Lock Screen | LockScreen | ✅ Complete | PIN-based authentication |

### Order Form Features

| Feature | Status | Notes |
|---------|--------|-------|
| Location Selection | ✅ Complete | Customer picks pickup location first |
| Bake Slot Selection | ✅ Complete | Shows available dates for chosen location |
| Flavor Selection | ✅ Complete | Quantities, prices, descriptions |
| Customer Info | ✅ Complete | Name, email, phone, notes |
| Order Lookup | ✅ Complete | Returning customers can find previous orders |
| Order Confirmation | ✅ Complete | Summary page with payment instructions |
| Mobile Responsive | ✅ Complete | Works on all screen sizes |

---

## Known Limitations

### Not Implemented (Out of Scope for v1)

1. **Automated Notifications**: Email/SMS to customers requires Twilio setup (see TWILIO_SETUP.md)
2. **Online Payments**: Currently cash/Venmo/CashApp/Zelle only (no Stripe integration)
3. **Customer Accounts**: No login system for customers (order lookup by email instead)
4. **Inventory Management**: No automatic ingredient inventory tracking
5. **Multi-device Sync**: Desktop app is single-computer only

### Known Issues

1. **Windows Security Warning**: App isn't code-signed ($300/year), so Windows shows "unknown publisher" warning on first run
2. **better-sqlite3 Rebuild**: When updating Node.js version, need to run `npm rebuild better-sqlite3`
3. **Google Sheets Rate Limits**: Heavy sync operations may hit API limits (unlikely for micro bakery volume)

---

## Technical Debt

### Should Address Eventually

1. **Test Coverage**: No automated tests currently
2. **Error Boundaries**: React error boundaries not implemented
3. **Database Migrations**: Manual ALTER TABLE statements in database.ts (works, but fragile)
4. **Logging**: Basic logging exists, but no log rotation or remote error reporting

### Nice to Have

1. **Auto-Update**: Electron auto-updater would simplify updates
2. **Code Signing**: Would eliminate Windows security warning
3. **Backup Automation**: Scheduled database backups to Google Drive

---

## File Locations (For Future Development)

### Source Code
```
ShaneStephanieBakery/
├── desktop-app/src/
│   ├── main/              # Electron main process
│   │   ├── index.ts       # App entry point
│   │   ├── database.ts    # SQLite setup & migrations
│   │   ├── ipc-handlers.ts # IPC API handlers
│   │   ├── sheets-sync.ts # Google Sheets sync
│   │   └── logger.ts      # Logging utility
│   ├── renderer/          # React UI
│   │   ├── pages/         # All page components
│   │   └── components/    # Shared components
│   └── shared/            # Shared utilities
├── order-form/src/
│   ├── main.ts            # Order form logic
│   ├── api/               # Serverless API endpoints
│   └── styles/            # CSS
└── shared/                # Shared types (if applicable)
```

### Databases
- **Production**: `%APPDATA%\Covenant Acres Farmstand\covenant-acres.db`
- **Demo**: `demo/demo-database.db`
- **Starter**: `delivery/covenant-acres.db`

### Deployments
- **Order Form**: Vercel (auto-deploys from main branch)
- **Desktop App**: Manual packaging with electron-builder

---

## Changelog

### 2026-01-05 (Delivery)
- Created production database with owner accounts
- Packaged desktop app (portable, no installer)
- Created delivery package with setup scripts
- Added TeamViewer remote support to installation guide

### 2026-01-05 (Pre-delivery)
- Added Extra Production tracking
- Added profit/hour analytics
- Added order editing in admin portal
- Added CSV export for orders
- Fixed payment method enforcement
- Created demo version with fictional data

### 2026-01-04
- Added location-first order flow
- Added order history lookup for returning customers
- Added multi-location bake slots
- Fixed foreign key constraint issues

### 2026-01-03
- Project started
- Initial architecture and structure
- Core order management functionality

---

*Last updated: 2026-01-05*
