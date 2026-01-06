# Covenant Acres Farmstand - Order & Production System

**Client:** Shane & Stephanie
**Bakery:** Covenant Acres Farmstand
**Domains:** covenantacresfarmstand.com, covenantacresin.com
**Date:** 2026-01-03

---

## Project Overview

A web-based system for managing bread orders and production for a micro bakery, consisting of four main components:

1. **Customer Order Form** - Public-facing, mobile-friendly order form
2. **Admin Dashboard** - Order management, customer database, communications
3. **Production System** - Recipes, ingredient costs, bake day prep sheets
4. **Analytics & Financials** - Sales stats, order history, payment tracking

---

## Branding (from covenantacresin.com)

| Element | Value |
|---------|-------|
| **Primary Green** | RGB(77, 99, 39) - earthy sage |
| **Accent Green** | RGB(107, 142, 35) - brighter accent |
| **Heading Font** | Cinzel (serif) - elegant, classical |
| **Body Font** | Source Sans Pro (sans-serif) - clean, readable |
| **Style** | Rustic-elegant, farmstead aesthetic, generous whitespace |

---

## Component 1: Customer Order Form

**Access:** Public via covenantacresfarmstand.com (or covenantacresin.com)

### Features
- Mobile-friendly, matches existing brand aesthetic
- Display available flavors, sizes, prices (configured by admin)
- Select pickup date from **designated bake days only** (typically 2/week)
- Select pickup location (from 4 preset locations)
- Real-time availability - caps enforced per bake day
- Guest checkout OR create account (saves info for repeat orders)
- Customer chooses notification preference (email or SMS)
- Order confirmation with Venmo/CashApp/Zelle payment links
- Customers can modify/cancel orders before cutoff

### Order Flow
1. Customer sees list of available **Date + Location** options (set by admin)
2. Selects a date/location combo
3. Sees available flavors and quantities for that specific slot
4. Completes order with their info

### Capacity Logic
- Admin creates "bake slots" = Date + Location (e.g., "Saturday Jan 11 @ Farmer's Market")
- Each slot has its own total loaf cap (e.g., 24)
- Each flavor can have its own cap per slot
- When flavor cap reached → flavor disappears from that slot
- When total cap reached → slot closes entirely

### Order Lifecycle States
```
Submitted → Cutoff Passed → In Production → Ready → Picked Up
                ↓                              ↓
            Canceled                       No-Show
```

### Credits & Adjustments
- **Our fault** (oven disaster, wrong loaf, can't fulfill): Customer gets credit + optional admin "sorry" bonus
- **Customer no-show**: They forfeit the loaf, even if prepaid
- **Admin override**: Can adjust any situation case-by-case
- Simple adjustment system: issue credits, mark comps, track loss vs goodwill

---

## Component 2: Admin Dashboard

**Access:** Shane & Stephanie (password protected)

### Order Management
- View all orders with filters (by date, status, customer, flavor)
- Edit orders (change flavor, quantity, notes, payment status)
- Mark orders as complete/picked up
- Archive old orders
- Works offline (syncs when back online)

### Notifications
**Full control over automated messages:**
- Configure which events trigger notifications (order placed, cutoff approaching, ready for pickup, etc.)
- Toggle each trigger on/off independently
- Edit message templates
- Set quiet hours (no notifications between X and Y time)

**Admin alerts:**
- Choose: instant, digest (daily summary), or off - per event type
- Email and/or SMS

**Customer notifications:**
- Customer chooses email, SMS, or both at signup
- Only receive messages for triggers admin has enabled

**Manual push:**
- Send one-off messages to individual customers
- Broadcast to all customers or filtered segments (from customer database)

### Customer Database
- Running list of all customers
- View customer order history
- Search/filter customers
- Customer info: First name, last name, email, phone

### Broadcast Messaging
- Send notes/announcements/ads to all customers or filtered segments
- Choose delivery method (email, SMS, or both)

### Configuration (Order Form Customizer)
- **Bake Slots:** Create Date + Location combos, set total capacity per slot
- **Flavors:** Add/edit/remove, set per-flavor caps per slot, prices
- **Sizes:** Configure available sizes and pricing
- **Pickup Locations:** Manage location list (currently 4)
- **Cutoff Rules:** Default auto-cutoff time + manual override option
- **Credits:** Issue credits to customers, view credit balances

---

## Component 3: Production System

### Recipe Management
- Add/edit/delete recipes
- Recipe structure (based on your existing format):
  - Flavor name
  - Base ingredients with quantities (starter, water, flour, salt, sugar, etc.)
  - Fold/mix-in ingredients (cheese, jalapeño, cranberries, etc.)
  - Lamination add-ins (butter, sugar, spices)
  - Detailed process instructions (steps, timing, temperatures)
- Seasonal recipe collections (Fall, Winter, Christmas, etc.)
- Link recipes to menu flavors

### Baking Process Instructions
- Enter and edit step-by-step baking instructions
- Include timing and temperatures
- Attach to recipes

### Ingredient Cost Tracking
- Enter ingredient costs (e.g., flour $0.50/cup, yeast $0.10/packet)
- System calculates cost-per-loaf by flavor
- View profit margin per item

### Bake Day Prep Sheet
- Select a bake day → generate prep sheet from orders
- Shows all ingredients needed, **broken down BY FLAVOR** (not combined)
- Includes process instructions for each flavor
- **Print-friendly layout** for kitchen use

---

## Component 4: Analytics & Financials

### Sales Statistics
- Loaves sold by flavor (popularity tracking)
- Sales by time period (weekly, monthly)
- Which flavors sell out fastest
- Customer order frequency

### Financial Tracking
- Order history with:
  - Order details
  - Customer info
  - Payment method (cash, Venmo, CashApp, Zelle)
  - Payment status (paid, pending)
- Revenue summary
- Cost vs. revenue by flavor (profit margins)

---

## Recipe Import

**Source files provided:**
- Base Artisan Loaf Recipes (Plain, Garlic Cheddar, Jalapeño Cheddar)
- 2025 Fall Loaves (Pumpkin Spice)
- 2025-26 Winter Loaves (Double Chocolate variations)
- 2025 Christmas Loaves (Orange Cranberry, Snickerdoodle, Gingerbread, Maple Pecan)
- Sourdough Waffles

These will be imported into the recipe system with ability to add more.

---

## Technical Approach (V1)

### Hybrid Architecture

**Part 1: Customer Order Form (Web-Hosted)**
- Static website hosted free (Vercel, Netlify, or GitHub Pages)
- **Primary URL:** covenantacresfarmstand.com/order (customers learn this one)
- **Secondary:** covenantacresin.com/order redirects to primary
- Accessible via QR codes, social media links, website
- Writes orders directly to Google Sheets
- Branded to match covenantacresin.com aesthetic

**Part 2: Admin & Production App (Installed on Shane's PC)**
- Desktop application installed on their Windows computer
- Reads/writes to same Google Sheets as order form
- Works offline - caches data locally, syncs when internet available
- Transferred via flash drive with step-by-step installation guide

### Delivery via Flash Drive
```
Flash Drive Contents:
├── INSTALL_GUIDE.pdf       # Step-by-step with screenshots
├── CovenantAcres-Setup.exe # Installer (double-click)
├── recipes/                # Recipe files to import
└── TROUBLESHOOTING.pdf     # Common issues & solutions

After Installation (on their PC):
C:\CovenantAcres\
├── CovenantAcres.exe       # Desktop shortcut created
├── data\                   # Local cache (syncs to Sheets)
├── recipes\                # Their recipe library
└── logs\                   # Error logs for troubleshooting
```

### Technical Details

| Aspect | Approach |
|--------|----------|
| **Order Form Hosting** | Free tier (Vercel/Netlify/GitHub Pages) |
| **Data Storage** | Google Sheets (bridge between web & local) |
| **Local App** | Electron or similar (runs on Windows, no install needed) |
| **Offline Mode** | Local SQLite cache, syncs to Sheets when online |
| **Payments** | Display Venmo/CashApp/Zelle links, track status in app |
| **Notifications** | Email (free) + SMS (~$1-2/month at expected volume) |
| **Domain** | Primary: covenantacresfarmstand.com/order (FREE hosting) |
| **Secondary** | covenantacresin.com/order redirects to primary |
| **Branding** | Match existing covenantacresin.com aesthetic |

### Error Handling & Support

- All errors logged to `logs/error.log` with timestamps
- User-friendly error messages ("Something went wrong - see error #12")
- Error log includes context for remote troubleshooting
- Shane can zip and send logs folder to Sam when issues arise
- App includes "Send Error Report" button (zips logs + system info)

### Installation Instructions (for Shane/Stephanie)
Delivered as PDF with screenshots - written for non-technical users:

1. Plug in flash drive Sam gave you
2. Open the flash drive folder
3. Double-click "CovenantAcres-Setup.exe"
4. Click "Install" when prompted
5. Desktop shortcut appears - double-click to open app
6. First run: sign in with your Google account (connects to Sheets)
7. Done!

### Getting Updates from Sam
1. Plug in flash drive with update
2. Double-click the new installer
3. It updates automatically

### Sending Files to Sam for Troubleshooting
1. Open the app
2. Click "Help" → "Send Error Report"
3. App zips logs + data and opens email
4. Or: Go to C:\CovenantAcres\logs, zip the folder, email to Sam

---

## Data & Compliance

- SMS opt-in: explicit consent checkbox when customer chooses SMS
- CSV export: ability to export orders and customer list
- Data architecture supports future prepay integration
- Customer data retained until manually removed or customer requests deletion

---

## Out of Scope (V2+)

- Direct payment processing (Stripe/Square integration) - architecture ready
- Inventory tracking (just cost tracking for now)
- Delivery service (pickup locations only)
- Multiple admin permission levels (shared admin access for now)
- Customer-facing order history (account just saves their info)

---

## Success Criteria

- [ ] Customer clicks link → sees branded menu → places order → gets confirmation
- [ ] Order appears in admin dashboard with all details
- [ ] Stephanie can configure bake days (typically 2/week), caps, flavors, prices
- [ ] Caps auto-enforce: flavor disappears when sold out, day closes when full
- [ ] Bake day prep sheet generates with ingredients by flavor + instructions
- [ ] Prep sheet prints cleanly for kitchen
- [ ] System works offline for order management
- [ ] Repeat customers can save their info via account
- [ ] Customer database with broadcast messaging capability
- [ ] Sales stats and financial tracking with payment method visibility
- [ ] Recipes with detailed instructions can be added/edited

---

---

## Scope Approved

**Date:** 2026-01-03
**Approved by:** Shane (client), Sam (developer)

All decisions finalized:
- Primary URL: covenantacresfarmstand.com/order
- SMS notifications: Yes, with full admin control
- Architecture: Hybrid (web order form + desktop admin app)
- Hosting: Free (Vercel/Netlify)
- Data: Google Sheets bridge
- Delivery: Flash drive with installer + PDF guide
