# Hillshire Sourdough - Demo Version

This folder contains a demonstration version of the bakery management system. It includes pre-populated data to showcase all features without affecting any real data.

## Quick Start

### Run Demo Admin Portal

Double-click `run-demo-admin.bat` or run from command line:

```
demo\run-demo-admin.bat
```

This copies the demo database and launches the admin portal.

### View Demo Order Form

Open in any browser:
```
demo\demo-order-form\index.html
```

---

## Demo Login Credentials

| PIN  | User | Role | Access Level |
|------|------|------|--------------|
| 1111 | SJY | Developer | Full access to all features |
| 2222 | Demo Owner | Owner | Full access except developer tools |
| 3333 | Demo Admin | Admin | Orders, customers, bake slots, flavors (view), recipes (view), analytics |
| 4444 | Demo Staff | Staff | Orders (manage), customers (view), bake slots (view), flavors (view), recipes (view) |

---

## What's Included

### 1. Demo Database (`demo-database.db`)
A pre-populated SQLite database with 90 days of realistic bakery data:

- **4 Admin Users** with different access levels
- **3 Pickup Locations** (Saturday Market, Farm Pickup, Wednesday Market)
- **8 Bread Flavors** with full recipes and ingredient costs
- **18 Ingredients** in the ingredients library
- **24 Bake Slots** over 90 days (1-2 per week)
- **30 Fictional Customers** (popular characters from Disney, Marvel, Harry Potter, etc.)
- **370+ Orders** with various statuses and payment states
- **Extra Production Entries** showing waste, gifts, and walk-up sales
- **Audit Log** with sample activity
- **Pre-configured Settings** (business info, payment links, etc.)

### 2. Demo Order Form (`demo-order-form/`)
A standalone HTML/CSS/JS order form demonstrating the customer ordering experience. No backend required.

### 3. Seed Script (`seed-demo-data.js`)
The script used to generate the demo data. Re-run to regenerate fresh demo data:

```
node demo/seed-demo-data.js
```

---

## Demo Data Details

### Customers (Fictional Characters)

The demo includes 30 fictional customers from popular media:

**Disney:** Mickey Mouse, Minnie Mouse, Donald Duck, Elsa Arendelle, Moana Waialiki

**Harry Potter:** Harry Potter, Hermione Granger, Ron Weasley, Luna Lovegood

**Marvel:** Tony Stark, Steve Rogers, Natasha Romanoff, Peter Parker

**Star Wars:** Luke Skywalker, Leia Organa, Han Solo

**Classic Literature:** Elizabeth Bennet, Jay Gatsby, Sherlock Holmes, Jane Eyre

**TV Shows:** Ted Lasso, Leslie Knope, Michael Scott, Jim Halpert, Pam Beesly

**DC Comics:** Bruce Wayne, Clark Kent, Diana Prince

**Lord of the Rings:** Frodo Baggins, Gandalf Grey

### Bread Flavors

| Flavor | Price | Description |
|--------|-------|-------------|
| Classic Sourdough | $8.00 | Traditional tangy sourdough |
| Garlic Cheddar | $10.00 | Roasted garlic and sharp cheddar |
| Jalapeño Cheddar | $10.00 | Spicy with melted cheddar pockets |
| Cinnamon Raisin | $10.00 | Sweet cinnamon swirls with raisins |
| Double Chocolate | $12.00 | Chocolate dough with chocolate chips |
| Rosemary Olive Oil | $10.00 | Fragrant rosemary with olive oil |
| Honey Wheat | $9.00 | Whole wheat with local honey |
| Pumpkin Spice | $12.00 | Seasonal with real pumpkin |

### Order Distribution

The demo data includes a realistic mix of:

- **Order Statuses:** submitted, ready, picked_up, canceled, no_show
- **Payment Statuses:** paid (~85%), pending (~15%)
- **Payment Methods:** cash, venmo, cashapp, zelle
- **Order Sizes:** 1-3 different bread types per order, 1-2 loaves each

---

## Notes

- The demo database is completely self-contained
- No Google Sheets sync is configured in the demo
- All email addresses use `.demo` domain (not real)
- The mock order form is fully functional but doesn't save data anywhere

---

*Demo version of the bakery management system*
