# Covenant Acres Farmstand - Demo Version

This folder contains a demonstration version of the Covenant Acres Farmstand bakery management system. It includes pre-populated data to showcase all features without affecting any real data.

## What's Included

### 1. Demo Database (`demo-database.db`)
A pre-populated SQLite database with 90 days of realistic bakery data:

- **4 Admin Users** with different access levels
- **3 Pickup Locations** (Saturday Market, Farm Pickup, Wednesday Market)
- **8 Bread Flavors** with full recipes and ingredient costs
- **18 Ingredients** in the ingredients library
- **22 Bake Slots** over 90 days (1-2 per week)
- **30 Fictional Customers** (popular characters from Disney, Marvel, Harry Potter, etc.)
- **400+ Orders** with various statuses and payment states
- **Extra Production Entries** showing waste, gifts, and walk-up sales
- **Audit Log** with sample activity
- **Pre-configured Settings** (business info, payment links, etc.)

### 2. Demo Order Form (`demo-order-form/`)
A standalone HTML/CSS/JS order form that demonstrates the customer ordering experience. No backend required - just open `index.html` in a browser.

### 3. Seed Script (`seed-demo-data.js`)
The script used to generate the demo data. You can re-run this to regenerate fresh demo data.

---

## Demo Login Credentials

| PIN  | User | Role | Access Level |
|------|------|------|--------------|
| 1111 | Sam Developer | Developer | Full access to all features |
| 2222 | Stephanie Owner | Owner | Full access except developer tools |
| 3333 | Shane Admin | Admin | Orders, customers, bake slots, flavors (view only), recipes (view only), analytics |
| 4444 | Helper Staff | Staff | Orders (manage), customers (view), bake slots (view), flavors (view), recipes (view) |

---

## Running the Demo

### Option A: Use Pre-Built Demo Database

1. **Copy the demo database** to replace the app's database:
   ```
   # Backup your real database first!
   cp desktop-app/bakery.db desktop-app/bakery.db.backup

   # Replace with demo database
   cp demo/demo-database.db desktop-app/bakery.db
   ```

2. **Start the desktop app**:
   ```
   cd desktop-app
   npm run dev
   ```

3. **Login** with any of the demo PINs above

### Option B: View Demo Order Form Only

1. **Open the demo order form** in any browser:
   ```
   demo/demo-order-form/index.html
   ```

   Or use a local server:
   ```
   cd demo/demo-order-form
   npx serve .
   ```

2. Walk through the ordering process - no backend required!

### Option C: Regenerate Demo Data

If you want fresh demo data:

1. **Run the seed script** from the desktop-app folder:
   ```
   cd desktop-app
   node ../demo/seed-demo-data.js
   ```

2. A new `demo-database.db` will be created in the demo folder

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

## Resetting to Production

To switch back to your real data:

```bash
# Restore your real database
cp desktop-app/bakery.db.backup desktop-app/bakery.db
```

---

## Notes

- The demo database is completely self-contained
- No Google Sheets sync is configured in the demo
- All email addresses use `.demo` domain (not real)
- The mock order form is fully functional but doesn't save data anywhere

---

## Screenshots

After running the demo, you can explore:

1. **Dashboard** - Overview of upcoming bake slots and recent orders
2. **Orders** - Filter, search, bulk update, and export orders
3. **Customers** - View customer history and manage credits
4. **Bake Slots** - Calendar view with capacity management
5. **Flavors** - Product catalog with pricing
6. **Recipes** - Full recipes with ingredient costs
7. **Analytics** - Revenue, profit margins, and trends
8. **Production** - Track extra loaves (sold, gifted, wasted)
9. **Settings** - Business configuration and payment links
10. **Users** - Role-based access control

---

*Demo created for Covenant Acres Farmstand management system*
