# Covenant Acres Farmstand

Order management and production planning system for a micro bakery.

**Status:** Delivered to client (2026-01-05)
**Client:** Shane & Stephanie, Indiana
**Developer:** Sam

---

## Quick Links

| Document | Purpose |
|----------|---------|
| [PROJECT_STATUS.md](PROJECT_STATUS.md) | Current state, feature list, known issues |
| [ARCHITECTURE.md](ARCHITECTURE.md) | System design, database schema, data flows |
| [DEVELOPMENT.md](DEVELOPMENT.md) | How to make changes, troubleshooting |
| [DEV_NOTES.md](DEV_NOTES.md) | Developer credentials (don't share with client) |

---

## System Overview

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Order Form     │────▶│  Google Sheets  │◀────│  Desktop App    │
│  (Web/Vercel)   │     │  (Data Bridge)  │     │  (Windows)      │
└─────────────────┘     └─────────────────┘     └─────────────────┘
   Customers use           Syncs data            Owners manage
   to place orders         between systems       orders & recipes
```

---

## Quick Start (Development)

```bash
# 1. Install dependencies
cd ShaneStephanieBakery
npm install
cd desktop-app && npm install && npm rebuild better-sqlite3
cd ../order-form && npm install

# 2. Run desktop app
cd desktop-app
npm run dev

# 3. Run order form (separate terminal)
cd order-form
npm run dev
```

---

## Project Structure

```
ShaneStephanieBakery/
├── desktop-app/          # Electron admin app (Windows)
├── order-form/           # Web order form (Vercel)
├── demo/                 # Demo version with sample data
├── delivery/             # Client delivery package
├── docs/                 # Service account credentials
├── PROJECT_STATUS.md     # Current state and changelog
├── ARCHITECTURE.md       # Technical design docs
├── DEVELOPMENT.md        # How to make changes
└── DEV_NOTES.md          # Developer-only info
```

---

## Key Technologies

| Component | Stack |
|-----------|-------|
| Desktop App | Electron + React + TypeScript + SQLite |
| Order Form | Vanilla TypeScript + Vite + Vercel |
| Data Storage | Google Sheets (primary) + SQLite (local cache) |
| Styling | Plain CSS |

---

## Deployments

### Order Form
- **URL:** https://covenantacresfarmstand.com/order
- **Host:** Vercel
- **Deploys:** Automatically on push to `main`

### Desktop App
- **Delivery:** Manual via Google Drive
- **Build:** `cd desktop-app && npm run package`
- **Output:** `dist-electron/win-unpacked/`

---

## Remote Support Workflow

1. **App Updates:** Upload new build to Google Drive, text link to owners
2. **Database Issues:** Owners email `.db` file, fix locally, send back
3. **Real-time Help:** TeamViewer installed on owners' computer

---

## Common Tasks

| Task | See |
|------|-----|
| Fix a bug | [DEVELOPMENT.md](DEVELOPMENT.md#common-tasks) |
| Add a new feature | [DEVELOPMENT.md](DEVELOPMENT.md#task-4-add-a-new-pagefeature) |
| Modify database | [DEVELOPMENT.md](DEVELOPMENT.md#database-changes) |
| Deploy order form | [DEVELOPMENT.md](DEVELOPMENT.md#order-form-1) |
| Build desktop app | [DEVELOPMENT.md](DEVELOPMENT.md#desktop-app-1) |
| Emergency fix | [DEVELOPMENT.md](DEVELOPMENT.md#emergency-fixes) |

---

## Client Accounts

| PIN | User | Access |
|-----|------|--------|
| 2222 | Stephanie | Owner (full access) |
| 3333 | Shane | Admin |
| 4444 | Helper | Staff (limited) |

---

## Environment Variables

### Order Form (Vercel)

```
GOOGLE_SHEETS_ID=1TGN-McmkpGI-EhNL1lQwE3S-awintH6uYiTfI-DF4fA
GOOGLE_SERVICE_ACCOUNT_EMAIL=farmstand-sheets@covenant-acres-farmstand.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY=<from service account JSON>
```

### Desktop App

Configured in-app via Settings page (Google Sheets credentials).

---

## License

Private - Covenant Acres Farmstand

---

*Last updated: 2026-01-05*
