# Development Guide

This guide covers how to make changes to the Covenant Acres Farmstand system. Follow these instructions carefully to avoid breaking the production app.

---

## Table of Contents

1. [Development Environment Setup](#development-environment-setup)
2. [Common Tasks](#common-tasks)
3. [Making Changes to the Desktop App](#making-changes-to-the-desktop-app)
4. [Making Changes to the Order Form](#making-changes-to-the-order-form)
5. [Database Changes](#database-changes)
6. [Building and Deploying](#building-and-deploying)
7. [Troubleshooting](#troubleshooting)
8. [Emergency Fixes](#emergency-fixes)

---

## Development Environment Setup

### Prerequisites

- Node.js 18+ (recommend using nvm for version management)
- Git
- VS Code (recommended) or any code editor
- Windows (for testing Electron app)

### Initial Setup

```bash
# Clone or navigate to project
cd C:\Users\Sam\Claude\CovenantAcresFarmstand

# Install root dependencies
npm install

# Install desktop-app dependencies
cd desktop-app
npm install

# Rebuild native modules (important!)
npm rebuild better-sqlite3

# Install order-form dependencies
cd ../order-form
npm install
```

### Running Locally

**Desktop App:**
```bash
cd desktop-app
npm run dev
```
This runs both the main process (TypeScript watch) and renderer (Vite dev server).

**Order Form:**
```bash
cd order-form
npm run dev
```
Opens at http://localhost:5173

---

## Common Tasks

### Task 1: Fix a Bug in the Desktop App UI

1. **Identify the page:** Look in `desktop-app/src/renderer/pages/`
2. **Find the component:** Each page is a single `.tsx` file
3. **Make your change**
4. **Test locally:** `npm run dev` auto-reloads
5. **Build and deliver:** See [Building and Deploying](#building-and-deploying)

### Task 2: Add a New Field to a Form

1. **Update the UI:** Add input field in the relevant page component
2. **Update the IPC handler:** `desktop-app/src/main/ipc-handlers.ts`
3. **Update the database:** Add column migration in `database.ts` (see [Database Changes](#database-changes))
4. **Test thoroughly**

### Task 3: Change How Data is Displayed

1. **Find the page:** `desktop-app/src/renderer/pages/`
2. **Modify the JSX** that renders the data
3. **Update CSS if needed:** `desktop-app/src/renderer/styles/global.css`

### Task 4: Add a New Page/Feature

1. **Create page file:** `desktop-app/src/renderer/pages/NewPage.tsx`
2. **Add route:** Edit `desktop-app/src/renderer/App.tsx`
3. **Add navigation:** Edit the sidebar in `App.tsx`
4. **Add IPC handlers:** If the page needs data from SQLite
5. **Update permissions:** `desktop-app/src/shared/permissions.ts`

---

## Making Changes to the Desktop App

### File Locations

| What | Where |
|------|-------|
| Page components | `desktop-app/src/renderer/pages/*.tsx` |
| Styles | `desktop-app/src/renderer/styles/global.css` |
| IPC handlers (API) | `desktop-app/src/main/ipc-handlers.ts` |
| Database setup | `desktop-app/src/main/database.ts` |
| Google Sheets sync | `desktop-app/src/main/sheets-sync.ts` |
| Preload (IPC bridge) | `desktop-app/src/main/preload.ts` |
| Permissions | `desktop-app/src/shared/permissions.ts` |

### Step-by-Step: Modifying a Page

**Example: Adding a "Notes" column to Orders table**

1. **Edit OrdersPage.tsx:**
```tsx
// Find the table header
<th>Notes</th>

// Find the table row
<td>{order.admin_notes || '-'}</td>
```

2. **If data isn't already fetched, edit ipc-handlers.ts:**
```typescript
// Find the getOrders handler
// Make sure admin_notes is included in SELECT
```

3. **Test:**
```bash
cd desktop-app
npm run dev
```

4. **Build for delivery** (see below)

### Step-by-Step: Adding New IPC Handler

**Example: Adding endpoint to get order count**

1. **Edit preload.ts** - expose the function:
```typescript
contextBridge.exposeInMainWorld('electronAPI', {
  // ... existing handlers
  getOrderCount: () => ipcRenderer.invoke('get-order-count'),
});
```

2. **Edit ipc-handlers.ts** - implement the handler:
```typescript
ipcMain.handle('get-order-count', async () => {
  const db = getDb();
  const result = db.prepare('SELECT COUNT(*) as count FROM orders').get();
  return result.count;
});
```

3. **Use in React:**
```tsx
const count = await window.electronAPI.getOrderCount();
```

---

## Making Changes to the Order Form

### File Locations

| What | Where |
|------|-------|
| Main logic | `order-form/src/main.ts` |
| Styles | `order-form/src/styles/main.css` |
| API endpoints | `order-form/src/api/*.ts` |
| Types | `order-form/src/types.ts` |
| HTML template | `order-form/index.html` |

### Step-by-Step: Modifying the Order Form

1. **Edit the file**
2. **Test locally:** `npm run dev`
3. **Commit and push to GitHub**
4. **Vercel auto-deploys** within ~1 minute

### API Endpoints

The order form uses serverless functions in `order-form/src/api/`:

- `get-bake-slots.ts` - Fetches available bake slots
- `get-flavors.ts` - Fetches active flavors
- `submit-order.ts` - Submits new order to Sheets
- `lookup-customer.ts` - Looks up returning customer

To modify what data the form sends/receives, edit these files.

---

## Database Changes

### Adding a New Column

SQLite doesn't support easy migrations, so we use ALTER TABLE in `database.ts`:

1. **Edit `desktop-app/src/main/database.ts`:**

Find the migrations section at the bottom of `initDatabase()`:

```typescript
// Add your migration
const tableColumns = db.prepare("PRAGMA table_info(your_table)").all() as Array<{ name: string }>;

if (!tableColumns.some(col => col.name === 'new_column')) {
  db.exec("ALTER TABLE your_table ADD COLUMN new_column TEXT");
  log('info', 'Added new_column to your_table');
}
```

2. **The migration runs automatically** on app startup

### Adding a New Table

Add the CREATE TABLE in the main `db.exec()` block:

```typescript
db.exec(`
  -- Your new table
  CREATE TABLE IF NOT EXISTS new_table (
    id TEXT PRIMARY KEY,
    field1 TEXT NOT NULL,
    field2 INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);
```

### Modifying Existing Data

**DANGER: Test on a copy of the database first!**

1. Get the production database from owners
2. Make a backup
3. Write and test your SQL
4. Apply to production

```bash
# Copy database to test
cp covenant-acres.db covenant-acres-test.db

# Test your changes
# Then apply to production
```

---

## Building and Deploying

### Desktop App

```bash
cd desktop-app

# Build TypeScript and React
npm run build

# Package as portable app
npm run package
```

Output: `dist-electron/win-unpacked/`

**Deliver to owners:**

1. Zip the `win-unpacked` folder
2. Upload to Google Drive
3. Text owners the link
4. They replace their existing app folder

### Order Form

**Automatic deployment:**

1. Commit your changes
2. Push to GitHub `main` branch
3. Vercel auto-deploys in ~1 minute

```bash
git add .
git commit -m "fix: description of change"
git push origin main
```

**Check deployment:**
- Vercel dashboard: https://vercel.com/sam-yandows-projects/order-form
- Or just visit https://covenantacresfarmstand.com/order

---

## Troubleshooting

### "Cannot find module 'better-sqlite3'"

```bash
cd desktop-app
npm rebuild better-sqlite3
```

### "NODE_MODULE_VERSION mismatch"

Node.js version changed. Rebuild native modules:

```bash
cd desktop-app
npm rebuild better-sqlite3
```

### App won't start / white screen

1. Check the terminal for errors
2. Open DevTools: Press F12 in the app
3. Check Console tab for JavaScript errors

### Database is corrupted

1. Get backup from owners (or use your copy)
2. Or restore from Google Sheets sync
3. Worst case: Create fresh database and re-sync

### Google Sheets sync fails

1. Check if credentials are configured in Settings
2. Check if Sheets ID is correct
3. Check service account has access to the spreadsheet
4. Check API quotas (unlikely for this volume)

### Order form not loading bake slots

1. Check Vercel function logs
2. Check Google Sheets API credentials
3. Check if BakeSlots sheet has data

---

## Emergency Fixes

### Scenario: Bug is breaking production

**Fast fix (< 30 min):**

1. Fix the bug locally
2. Test quickly
3. Build: `npm run build && npm run package`
4. Zip and upload to Google Drive
5. Call/text owners to update immediately

**While fixing, consider:**
- Can owners work around it temporarily?
- Is it data loss or just inconvenience?

### Scenario: Database corruption

1. **Don't panic** - Google Sheets has all the data
2. Get the corrupted database from owners
3. Try to recover: `sqlite3 covenant-acres.db ".recover" | sqlite3 recovered.db`
4. If recovery fails, create fresh database and sync from Sheets

### Scenario: Order form is down

1. Check Vercel status: https://www.vercel-status.com/
2. Check function logs in Vercel dashboard
3. If Vercel is up, check your deployment
4. Quick fix: Revert last commit and redeploy

### Scenario: Need to add developer access

If you need to log in to the owners' app:

1. **Option A:** Connect via TeamViewer and use their account
2. **Option B:** Add yourself as admin in their database:

```javascript
// Run in Node.js with their database file
const Database = require('better-sqlite3');
const crypto = require('crypto');
const db = new Database('covenant-acres.db');

const pin = '1234'; // Choose your PIN
const hash = crypto.createHash('sha256').update(pin).digest('hex');
const now = new Date().toISOString();

db.prepare(`
  INSERT INTO admin_users (id, name, pin_hash, is_active, is_developer, is_owner, created_at, updated_at)
  VALUES (?, ?, ?, 1, 1, 1, ?, ?)
`).run('dev-sam', 'Sam (Developer)', hash, now, now);

db.close();
```

Send the modified database back to owners.

---

## Code Conventions

### TypeScript

- Use strict typing (no `any` unless necessary)
- Interface names: PascalCase (e.g., `Order`, `Customer`)
- Function names: camelCase (e.g., `getOrders`, `updateStatus`)

### React

- Functional components with hooks
- State at top of component
- Effects after state
- Handlers before return
- JSX in return

### CSS

- All styles in `global.css`
- Use CSS variables for colors (defined at top of file)
- Class names: kebab-case (e.g., `.order-card`, `.btn-primary`)

### Database

- Table names: snake_case plural (e.g., `orders`, `bake_slots`)
- Column names: snake_case (e.g., `created_at`, `total_amount`)
- IDs: Text with prefix (e.g., `ord-abc123`, `cust-xyz789`)
- Timestamps: ISO 8601 strings (e.g., `2026-01-05T10:30:00.000Z`)

---

## Testing Checklist

Before delivering any update:

- [ ] Desktop app starts without errors
- [ ] Can log in with test PIN
- [ ] Key pages load (Orders, Config, Analytics)
- [ ] Can create a test order
- [ ] Can view/edit existing orders
- [ ] No console errors (F12 → Console)
- [ ] Order form loads (if changed)
- [ ] Order form can submit (test environment)

---

## Contact

If you're stuck or something is unclear:
- Re-read the relevant documentation file
- Check the code comments
- Review git history for context on changes

---

*Last updated: 2026-01-05*
