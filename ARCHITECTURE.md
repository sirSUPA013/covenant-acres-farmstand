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
│  • Select pickup location first                                  │
│  • Select bake slot (filtered by location)                       │
│  • Choose flavors and quantities                                │
│  • Enter customer info (or look up existing)                    │
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
│  • Locations - Pickup locations                                 │
│  • Config - System settings                                     │
└─────────────────────────┬───────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│                  DESKTOP APP (Electron)                          │
│              Installed on Shane's Windows PC                     │
│                                                                  │
│  Pages:                                                         │
│  ├── Analytics    - Sales stats, profit margins, profit/hr      │
│  ├── Orders       - View, edit, filter, export orders           │
│  ├── Customers    - Database, history, credits                  │
│  ├── Production   - Extra bread tracking (walk-ins, waste)      │
│  ├── Config       - Bake slots, flavors, locations              │
│  ├── PrepSheet    - Print-ready production list                 │
│  ├── Recipes      - Recipes, ingredients, costs                 │
│  ├── Users        - Admin user management                       │
│  └── Settings     - Business info, payment links, sync          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Project Structure

```
ShaneStephanieBakery/
│
├── desktop-app/                    # Electron desktop application
│   ├── src/
│   │   ├── main/                   # Main process (Node.js)
│   │   │   ├── index.ts            # App entry, window creation
│   │   │   ├── database.ts         # SQLite setup, migrations, seeding
│   │   │   ├── ipc-handlers.ts     # IPC handlers (API for renderer)
│   │   │   ├── sheets-sync.ts      # Google Sheets sync logic
│   │   │   ├── logger.ts           # Logging utility
│   │   │   └── preload.ts          # Secure bridge to renderer
│   │   │
│   │   ├── renderer/               # Renderer process (React)
│   │   │   ├── App.tsx             # Main app component, routing
│   │   │   ├── main.tsx            # React entry point
│   │   │   ├── pages/              # Page components
│   │   │   │   ├── AnalyticsPage.tsx
│   │   │   │   ├── ConfigPage.tsx
│   │   │   │   ├── CustomersPage.tsx
│   │   │   │   ├── OrdersPage.tsx
│   │   │   │   ├── PrepSheetPage.tsx
│   │   │   │   ├── ProductionPage.tsx
│   │   │   │   ├── RecipesPage.tsx
│   │   │   │   ├── SettingsPage.tsx
│   │   │   │   └── UsersPage.tsx
│   │   │   ├── components/         # Shared components
│   │   │   │   └── LockScreen.tsx  # PIN authentication
│   │   │   └── styles/
│   │   │       └── global.css      # All styles
│   │   │
│   │   └── shared/                 # Shared between main/renderer
│   │       └── permissions.ts      # Role-based permissions
│   │
│   ├── scripts/                    # Utility scripts
│   │   ├── create-starter-database.js
│   │   └── prepare-for-handoff.js
│   │
│   ├── dist/                       # Built output (gitignored)
│   ├── dist-electron/              # Packaged app (gitignored)
│   ├── package.json
│   ├── tsconfig.json
│   ├── tsconfig.main.json
│   └── vite.config.ts
│
├── order-form/                     # Web order form (Vercel)
│   ├── src/
│   │   ├── main.ts                 # Order form logic
│   │   ├── types.ts                # TypeScript types
│   │   ├── api/                    # Serverless functions
│   │   │   ├── submit-order.ts
│   │   │   ├── get-bake-slots.ts
│   │   │   ├── get-flavors.ts
│   │   │   └── lookup-customer.ts
│   │   ├── styles/
│   │   │   └── main.css
│   │   └── utils/
│   │       └── sheets.ts           # Google Sheets client
│   │
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
│
├── demo/                           # Demo version with sample data
│   ├── demo-database.db
│   ├── seed-demo-data.js
│   ├── demo-order-form/            # Standalone mock order form
│   └── README.md
│
├── delivery/                       # Client delivery package
│   ├── Covenant Acres Farmstand/   # Packaged app
│   ├── covenant-acres.db           # Production database
│   ├── setup-database.bat
│   └── INSTALLATION-GUIDE.txt
│
├── docs/                           # Additional documentation
│   └── service-account-credentials.json (gitignored)
│
├── ARCHITECTURE.md                 # This file
├── PROJECT_STATUS.md               # Current project state
├── DEVELOPMENT.md                  # How to make changes
├── README.md                       # Quick start guide
├── DEV_NOTES.md                    # Developer-only notes (don't share)
├── TWILIO_SETUP.md                 # SMS setup instructions
└── package.json                    # Root workspace config
```

---

## Database Schema

The SQLite database (`covenant-acres.db`) contains these tables:

### Core Business Tables

```sql
-- Orders placed by customers
orders (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,           -- FK to customers
  bake_slot_id TEXT NOT NULL,          -- FK to bake_slots
  pickup_location_id TEXT,             -- FK to locations (customer's chosen pickup)
  items TEXT NOT NULL,                 -- JSON array of {flavor_id, size, quantity, price}
  total_amount REAL NOT NULL,
  status TEXT NOT NULL,                -- submitted, ready, picked_up, canceled, no_show
  payment_status TEXT NOT NULL,        -- pending, paid
  payment_method TEXT,                 -- cash, venmo, cashapp, zelle
  customer_notes TEXT,
  admin_notes TEXT,
  credit_applied REAL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)

-- Customer database
customers (
  id TEXT PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT UNIQUE NOT NULL,
  phone TEXT NOT NULL,
  credit_balance REAL DEFAULT 0,       -- Store credit
  total_orders INTEGER DEFAULT 0,
  total_spent REAL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)

-- Available bake dates
bake_slots (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,                  -- YYYY-MM-DD
  location_id TEXT NOT NULL,           -- Legacy: primary location
  total_capacity INTEGER NOT NULL,     -- Max loaves
  current_orders INTEGER DEFAULT 0,    -- Current loaf count
  cutoff_time TEXT NOT NULL,           -- ISO timestamp
  is_open INTEGER DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)

-- Junction table: bake slot can have multiple pickup locations
bake_slot_locations (
  id TEXT PRIMARY KEY,
  bake_slot_id TEXT NOT NULL,          -- FK to bake_slots
  location_id TEXT NOT NULL,           -- FK to locations
  created_at TEXT NOT NULL,
  UNIQUE(bake_slot_id, location_id)
)

-- Pickup locations
locations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  address TEXT,
  description TEXT,
  is_active INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)
```

### Product Tables

```sql
-- Bread flavors/products
flavors (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  sizes TEXT NOT NULL,                 -- JSON: [{name, price}]
  recipe_id TEXT,                      -- FK to recipes
  is_active INTEGER DEFAULT 1,
  season TEXT DEFAULT 'year_round',    -- year_round, spring, summer, fall, winter
  sort_order INTEGER DEFAULT 0,
  estimated_cost REAL,                 -- Cost per loaf (from recipe)
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)

-- Recipes with ingredients
recipes (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  flavor_id TEXT,                      -- FK to flavors
  base_ingredients TEXT NOT NULL,      -- JSON array
  fold_ingredients TEXT,               -- JSON array
  lamination_ingredients TEXT,         -- JSON array
  steps TEXT NOT NULL,                 -- JSON array
  yields_loaves INTEGER DEFAULT 1,
  cost_per_loaf REAL,
  prep_time_minutes INTEGER,
  bake_time_minutes INTEGER,
  bake_temp TEXT,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)

-- Ingredient library for cost tracking
ingredients (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  unit TEXT NOT NULL,                  -- g, oz, each, tsp, etc.
  cost_per_unit REAL NOT NULL,
  package_price REAL,                  -- What you pay at store
  package_size REAL,                   -- Units per package
  package_unit TEXT,                   -- "50lb", "16oz", etc.
  vendor TEXT,
  category TEXT,                       -- base, sweetener, spice, misc
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)
```

### Production & Analytics

```sql
-- Extra bread made (not from orders)
extra_production (
  id TEXT PRIMARY KEY,
  bake_slot_id TEXT,                   -- FK to bake_slots (optional)
  production_date TEXT NOT NULL,
  flavor_id TEXT NOT NULL,             -- FK to flavors
  quantity INTEGER NOT NULL,
  disposition TEXT NOT NULL,           -- sold, gifted, wasted, personal
  sale_price REAL,                     -- If sold
  total_revenue REAL,                  -- quantity * sale_price
  notes TEXT,
  created_by TEXT,                     -- FK to admin_users
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)

-- Overhead costs for profit calculation
overhead_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  packaging_per_loaf REAL DEFAULT 0.50,
  utilities_per_loaf REAL DEFAULT 0.12,
  updated_at TEXT NOT NULL
)
```

### Admin & Settings

```sql
-- Admin users (owners, staff)
admin_users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  pin_hash TEXT NOT NULL,              -- SHA-256 hash
  is_active INTEGER DEFAULT 1,
  is_developer INTEGER DEFAULT 0,      -- Hidden developer access
  is_owner INTEGER DEFAULT 0,          -- Full business access
  permissions TEXT,                    -- JSON: {orders, customers, config, etc.}
  last_login TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)

-- Business settings
settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  business_name TEXT,
  business_email TEXT,
  business_phone TEXT,
  default_cutoff_hours INTEGER DEFAULT 48,
  require_payment_method INTEGER DEFAULT 0,
  enable_prepayment INTEGER DEFAULT 0,
  venmo_username TEXT,
  cashapp_cashtag TEXT,
  paypal_username TEXT,
  zelle_email TEXT,
  -- Time estimates for profit/hr
  bake_day_setup_minutes INTEGER DEFAULT 60,
  bake_day_per_loaf_minutes INTEGER DEFAULT 8,
  bake_day_cleanup_minutes INTEGER DEFAULT 45,
  misc_production_per_loaf_minutes INTEGER DEFAULT 15,
  -- Google Sheets
  google_sheets_id TEXT,
  google_credentials TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
)

-- Activity log
audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,
  user_name TEXT,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  details TEXT,                        -- JSON with change details
  created_at TEXT NOT NULL
)
```

---

## Key Data Flows

### Order Submission Flow

```
1. Customer loads order form
   └── GET /api/get-bake-slots → Sheets API
   └── GET /api/get-flavors → Sheets API

2. Customer selects location
   └── UI filters bake slots by location

3. Customer selects bake slot
   └── UI shows available flavors

4. Customer fills form & submits
   └── POST /api/submit-order
       ├── Validate data
       ├── Write to Orders sheet
       ├── Write/update Customers sheet
       ├── Update BakeSlots capacity
       └── Return confirmation

5. Desktop app syncs
   └── Pulls new order from Sheets
   └── Stores in local SQLite
```

### Desktop App Data Flow

```
┌─────────────────────────────────────────────────┐
│                 RENDERER (React)                 │
│                                                  │
│   window.electronAPI.getOrders()                │
│   window.electronAPI.updateOrderStatus(...)     │
│   window.electronAPI.syncWithSheets()           │
└──────────────────────┬──────────────────────────┘
                       │ IPC
                       ▼
┌─────────────────────────────────────────────────┐
│                 MAIN PROCESS                     │
│                                                  │
│   ipc-handlers.ts                               │
│   ├── Reads/writes SQLite (database.ts)        │
│   └── Syncs with Sheets (sheets-sync.ts)       │
└──────────────────────┬──────────────────────────┘
                       │
          ┌────────────┴────────────┐
          ▼                         ▼
    ┌──────────┐             ┌──────────────┐
    │  SQLite  │             │ Google Sheets │
    │  (local) │◄───sync────►│   (cloud)    │
    └──────────┘             └──────────────┘
```

---

## IPC API Reference

All communication between renderer and main process goes through `window.electronAPI`:

### Orders
- `getOrders(filters?)` - Get all orders, optionally filtered
- `getOrderById(id)` - Get single order with customer details
- `updateOrderStatus(id, status)` - Change order status
- `updatePaymentStatus(id, status, method?)` - Update payment
- `updateOrder(id, updates)` - Full order update

### Customers
- `getCustomers()` - Get all customers
- `getCustomerById(id)` - Get customer with order history
- `updateCustomerCredit(id, amount, reason)` - Adjust credit

### Bake Slots
- `getBakeSlots()` - Get all bake slots
- `createBakeSlot(data)` - Create new bake slot
- `updateBakeSlot(id, data)` - Update bake slot
- `deleteBakeSlot(id)` - Delete bake slot

### Flavors
- `getFlavors()` - Get all flavors
- `createFlavor(data)` - Create flavor
- `updateFlavor(id, data)` - Update flavor

### Locations
- `getLocations()` - Get all locations
- `createLocation(data)` - Create location
- `updateLocation(id, data)` - Update location

### Recipes & Ingredients
- `getRecipes()` - Get all recipes
- `getRecipeById(id)` - Get recipe with ingredients
- `updateRecipe(id, data)` - Update recipe
- `getIngredients()` - Get ingredient library
- `createIngredient(data)` - Add ingredient
- `updateIngredient(id, data)` - Update ingredient

### Extra Production
- `getExtraProduction(filters?)` - Get extra production entries
- `createExtraProduction(data)` - Log extra production
- `updateExtraProduction(id, data)` - Update entry
- `deleteExtraProduction(id)` - Delete entry

### Admin & Settings
- `getSettings()` - Get business settings
- `updateSettings(data)` - Update settings
- `getAdminUsers()` - Get admin users
- `createAdminUser(data)` - Create user
- `updateAdminUser(id, data)` - Update user
- `verifyPin(pin)` - Authenticate user

### Sync
- `syncWithSheets()` - Trigger full sync
- `getSyncStatus()` - Get last sync time/status

---

## Security Model

### Authentication
- PIN-based login (4-6 digits)
- PINs stored as SHA-256 hash
- Session persists until app close or manual logout
- Lock screen after inactivity (configurable)

### Authorization (Role-Based)
```typescript
// permissions.ts
const ROLE_PERMISSIONS = {
  developer: ['*'],  // All permissions
  owner: ['orders', 'customers', 'config', 'recipes', 'analytics', 'users', 'settings'],
  admin: ['orders', 'customers', 'config', 'recipes:view', 'analytics'],
  staff: ['orders:manage', 'customers:view', 'config:view']
};
```

### Data Protection
- Customer PII in Google Sheets (not long-term cached)
- Local SQLite for performance/offline only
- No passwords stored (PINs only)
- Audit log tracks all changes

---

## Error Handling

### Error Codes
- `ORD-xxx`: Order errors (validation, not found, etc.)
- `SYNC-xxx`: Sync/connectivity errors
- `AUTH-xxx`: Authentication errors
- `DATA-xxx`: Data validation errors
- `DB-xxx`: Database errors

### Logging
- Location: `%APPDATA%\Covenant Acres Farmstand\logs\`
- Files: `app.log`, `error.log`
- Includes: timestamp, level, message, context

---

## Deployment

### Order Form (Vercel)
- Auto-deploys on push to `main` branch
- Environment variables in Vercel dashboard
- Domain: covenantacresfarmstand.com

### Desktop App (Manual)
1. Build: `cd desktop-app && npm run package`
2. Output: `dist-electron/win-unpacked/`
3. Deliver via Google Drive zip

---

*Last updated: 2026-01-05*
