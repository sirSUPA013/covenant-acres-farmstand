# Covenant Acres Farmstand - Order & Production System

A hybrid order management and production planning system for a micro bakery.

## Overview

- **Customer Order Form**: Web-based, hosted at covenantacresfarmstand.com/order
- **Admin Desktop App**: Windows application for order management, recipes, and production planning
- **Data Bridge**: Google Sheets for syncing between web and desktop

## Project Structure

```
ShaneStephanieBakery/
├── order-form/          # Web order form (deployed to Vercel/Netlify)
├── desktop-app/         # Electron desktop application
├── shared/              # Shared types and utilities
├── docs/                # Installation guides, troubleshooting
├── recipes/             # Recipe files for import
└── tests/               # Test files
```

## Tech Stack

| Component | Technology |
|-----------|------------|
| Order Form | HTML/CSS/TypeScript, hosted on Vercel |
| Desktop App | Electron + TypeScript |
| Data Storage | Google Sheets API |
| Local Cache | SQLite |
| Notifications | Email (Resend) + SMS (Twilio) |

## Development Setup

```bash
# Install dependencies
npm install

# Run order form locally
npm run dev:order-form

# Run desktop app locally
npm run dev:desktop

# Run tests
npm test

# Build for production
npm run build
```

## Deployment

### Order Form
Automatically deploys to Vercel on push to main branch.

### Desktop App
```bash
npm run package
```
Creates installer in `desktop-app/dist/`.

## For Shane & Stephanie

See `docs/INSTALL_GUIDE.pdf` for installation instructions.

## License

Private - Covenant Acres Farmstand
