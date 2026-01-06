/**
 * Demo Data Seed Script
 *
 * Generates 90 days of realistic bakery data for demonstration purposes.
 * Run this script to create a pre-populated demo-database.db file.
 *
 * Usage: node seed-demo-data.js
 */

const Database = require('better-sqlite3');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

// Output database path
const DB_PATH = path.join(__dirname, 'demo-database.db');

// Delete existing demo database if it exists
if (fs.existsSync(DB_PATH)) {
  fs.unlinkSync(DB_PATH);
  console.log('Removed existing demo database');
}

const db = new Database(DB_PATH);

// Helper functions
function hashPin(pin) {
  return crypto.createHash('sha256').update(pin).digest('hex');
}

function generateId(prefix) {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ============ CREATE TABLES ============
console.log('Creating tables...');

db.exec(`
  -- Admin Users
  CREATE TABLE IF NOT EXISTS admin_users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    pin_hash TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    is_developer INTEGER DEFAULT 0,
    is_owner INTEGER DEFAULT 0,
    permissions TEXT,
    last_login TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  -- Customers
  CREATE TABLE IF NOT EXISTS customers (
    id TEXT PRIMARY KEY,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    phone TEXT,
    credit_balance REAL DEFAULT 0,
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  -- Locations
  CREATE TABLE IF NOT EXISTS locations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    address TEXT,
    description TEXT,
    is_active INTEGER DEFAULT 1,
    sort_order INTEGER DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  -- Bake Slots
  CREATE TABLE IF NOT EXISTS bake_slots (
    id TEXT PRIMARY KEY,
    date TEXT NOT NULL,
    location_id TEXT,
    total_capacity INTEGER DEFAULT 24,
    current_orders INTEGER DEFAULT 0,
    cutoff_time TEXT,
    is_open INTEGER DEFAULT 1,
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (location_id) REFERENCES locations(id)
  );

  -- Bake Slot Locations (junction table)
  CREATE TABLE IF NOT EXISTS bake_slot_locations (
    id TEXT PRIMARY KEY,
    bake_slot_id TEXT NOT NULL,
    location_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (bake_slot_id) REFERENCES bake_slots(id) ON DELETE CASCADE,
    FOREIGN KEY (location_id) REFERENCES locations(id),
    UNIQUE(bake_slot_id, location_id)
  );

  -- Ingredients
  CREATE TABLE IF NOT EXISTS ingredients (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    unit TEXT NOT NULL,
    cost_per_unit REAL NOT NULL,
    package_price REAL,
    package_size REAL,
    package_unit TEXT,
    vendor TEXT,
    category TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  -- Recipes
  CREATE TABLE IF NOT EXISTS recipes (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    flavor_id TEXT,
    base_ingredients TEXT DEFAULT '[]',
    fold_ingredients TEXT DEFAULT '[]',
    lamination_ingredients TEXT DEFAULT '[]',
    steps TEXT DEFAULT '[]',
    yields_loaves INTEGER DEFAULT 1,
    loaf_size TEXT,
    notes TEXT,
    season TEXT,
    source TEXT,
    cost_per_loaf REAL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  -- Flavors
  CREATE TABLE IF NOT EXISTS flavors (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    sizes TEXT DEFAULT '[]',
    recipe_id TEXT,
    is_active INTEGER DEFAULT 1,
    season TEXT DEFAULT 'year_round',
    sort_order INTEGER DEFAULT 0,
    estimated_cost REAL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (recipe_id) REFERENCES recipes(id)
  );

  -- Orders
  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL,
    bake_slot_id TEXT NOT NULL,
    pickup_location_id TEXT,
    items TEXT NOT NULL,
    total_amount REAL NOT NULL,
    status TEXT DEFAULT 'submitted',
    payment_status TEXT DEFAULT 'pending',
    payment_method TEXT,
    notes TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (customer_id) REFERENCES customers(id),
    FOREIGN KEY (bake_slot_id) REFERENCES bake_slots(id),
    FOREIGN KEY (pickup_location_id) REFERENCES locations(id)
  );

  -- Extra Production
  CREATE TABLE IF NOT EXISTS extra_production (
    id TEXT PRIMARY KEY,
    bake_slot_id TEXT,
    production_date TEXT NOT NULL,
    flavor_id TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    disposition TEXT NOT NULL,
    sale_price REAL,
    total_revenue REAL,
    notes TEXT,
    created_by TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    FOREIGN KEY (bake_slot_id) REFERENCES bake_slots(id),
    FOREIGN KEY (flavor_id) REFERENCES flavors(id)
  );

  -- Overhead Settings
  CREATE TABLE IF NOT EXISTS overhead_settings (
    id INTEGER PRIMARY KEY,
    packaging_per_loaf REAL DEFAULT 0.50,
    utilities_per_loaf REAL DEFAULT 0.25,
    created_at TEXT,
    updated_at TEXT
  );

  -- Settings
  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY,
    business_name TEXT,
    business_email TEXT,
    business_phone TEXT,
    default_cutoff_hours INTEGER DEFAULT 24,
    require_payment_method INTEGER DEFAULT 1,
    notification_email INTEGER DEFAULT 1,
    notification_sms INTEGER DEFAULT 0,
    notification_emails TEXT,
    notification_phones TEXT,
    enable_prepayment INTEGER DEFAULT 1,
    venmo_username TEXT,
    cashapp_cashtag TEXT,
    paypal_username TEXT,
    zelle_email TEXT,
    bake_day_setup_minutes INTEGER DEFAULT 60,
    bake_day_per_loaf_minutes INTEGER DEFAULT 8,
    bake_day_cleanup_minutes INTEGER DEFAULT 45,
    misc_production_per_loaf_minutes INTEGER DEFAULT 15,
    created_at TEXT,
    updated_at TEXT
  );

  -- Audit Log
  CREATE TABLE IF NOT EXISTS audit_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id TEXT,
    user_name TEXT,
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id TEXT,
    details TEXT,
    created_at TEXT NOT NULL
  );
`);

// ============ SEED DATA ============
const now = new Date().toISOString();

// 1. Admin Users
console.log('Creating admin users...');
const adminUsers = [
  { id: 'admin-demo1', name: 'SJY', pin: '1111', isDev: 1, isOwner: 1 },
  { id: 'admin-demo2', name: 'Demo Owner', pin: '2222', isDev: 0, isOwner: 1 },
  { id: 'admin-demo3', name: 'Demo Admin', pin: '3333', isDev: 0, isOwner: 0, permissions: JSON.stringify({
    viewOrders: true, manageOrders: true, viewCustomers: true, manageCustomers: true,
    viewBakeSlots: true, manageBakeSlots: true, viewFlavors: true, manageFlavors: false,
    viewRecipes: true, manageRecipes: false, viewAnalytics: true, viewSettings: false,
    manageSettings: false, viewUsers: false, manageUsers: false, viewAuditLog: false
  })},
  { id: 'admin-demo4', name: 'Demo Staff', pin: '4444', isDev: 0, isOwner: 0, permissions: JSON.stringify({
    viewOrders: true, manageOrders: true, viewCustomers: true, manageCustomers: false,
    viewBakeSlots: true, manageBakeSlots: false, viewFlavors: true, manageFlavors: false,
    viewRecipes: true, manageRecipes: false, viewAnalytics: false, viewSettings: false,
    manageSettings: false, viewUsers: false, manageUsers: false, viewAuditLog: false
  })},
];

const insertAdmin = db.prepare(`
  INSERT INTO admin_users (id, name, pin_hash, is_active, is_developer, is_owner, permissions, created_at, updated_at)
  VALUES (?, ?, ?, 1, ?, ?, ?, ?, ?)
`);

adminUsers.forEach(u => {
  insertAdmin.run(u.id, u.name, hashPin(u.pin), u.isDev, u.isOwner, u.permissions || null, now, now);
});

// 2. Locations
console.log('Creating locations...');
const locations = [
  { id: 'loc-demo1', name: "Saturday Farmer's Market", address: '100 Main Street, Downtown' },
  { id: 'loc-demo2', name: 'Farm Pickup', address: '4521 Country Road' },
  { id: 'loc-demo3', name: 'Wednesday Market', address: '250 Oak Avenue, Community Center' },
];

const insertLocation = db.prepare(`
  INSERT INTO locations (id, name, address, is_active, sort_order, created_at, updated_at)
  VALUES (?, ?, ?, 1, ?, ?, ?)
`);

locations.forEach((loc, i) => {
  insertLocation.run(loc.id, loc.name, loc.address, i, now, now);
});

// 3. Ingredients
console.log('Creating ingredients...');
const ingredients = [
  { name: 'Bread Flour', unit: 'lb', packagePrice: 25.99, packageSize: 50, category: 'Flour' },
  { name: 'Whole Wheat Flour', unit: 'lb', packagePrice: 28.99, packageSize: 50, category: 'Flour' },
  { name: 'Sea Salt', unit: 'oz', packagePrice: 8.99, packageSize: 26, category: 'Seasoning' },
  { name: 'Active Dry Yeast', unit: 'oz', packagePrice: 6.99, packageSize: 4, category: 'Leavening' },
  { name: 'Sourdough Starter', unit: 'oz', packagePrice: 0, packageSize: 1, category: 'Leavening' },
  { name: 'Butter (Unsalted)', unit: 'oz', packagePrice: 5.99, packageSize: 16, category: 'Dairy' },
  { name: 'Cheddar Cheese', unit: 'oz', packagePrice: 7.99, packageSize: 16, category: 'Dairy' },
  { name: 'Garlic (Fresh)', unit: 'clove', packagePrice: 0.50, packageSize: 1, category: 'Produce' },
  { name: 'Jalapeños', unit: 'each', packagePrice: 0.30, packageSize: 1, category: 'Produce' },
  { name: 'Cinnamon', unit: 'oz', packagePrice: 7.99, packageSize: 4, category: 'Spice' },
  { name: 'Raisins', unit: 'oz', packagePrice: 5.99, packageSize: 15, category: 'Dried Fruit' },
  { name: 'Brown Sugar', unit: 'oz', packagePrice: 3.99, packageSize: 32, category: 'Sweetener' },
  { name: 'Cocoa Powder', unit: 'oz', packagePrice: 8.99, packageSize: 8, category: 'Baking' },
  { name: 'Chocolate Chips', unit: 'oz', packagePrice: 4.99, packageSize: 12, category: 'Baking' },
  { name: 'Pumpkin Puree', unit: 'oz', packagePrice: 3.49, packageSize: 15, category: 'Produce' },
  { name: 'Rosemary (Fresh)', unit: 'sprig', packagePrice: 2.99, packageSize: 6, category: 'Herbs' },
  { name: 'Olive Oil', unit: 'oz', packagePrice: 12.99, packageSize: 34, category: 'Oil' },
  { name: 'Honey', unit: 'oz', packagePrice: 9.99, packageSize: 16, category: 'Sweetener' },
];

const insertIngredient = db.prepare(`
  INSERT INTO ingredients (id, name, unit, cost_per_unit, package_price, package_size, category, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const ingredientMap = {};
ingredients.forEach(ing => {
  const id = generateId('ing');
  const costPerUnit = ing.packagePrice / ing.packageSize;
  insertIngredient.run(id, ing.name, ing.unit, costPerUnit, ing.packagePrice, ing.packageSize, ing.category, now, now);
  ingredientMap[ing.name] = { id, costPerUnit };
});

// 4. Flavors and Recipes
console.log('Creating flavors and recipes...');
const flavors = [
  {
    name: 'Classic Sourdough',
    description: 'Traditional tangy sourdough with a crispy crust',
    price: 8.00,
    cost: 2.50,
    season: 'year_round',
    baseIngredients: [
      { name: 'Bread Flour', quantity: 16, unit: 'oz' },
      { name: 'Sourdough Starter', quantity: 4, unit: 'oz' },
      { name: 'Sea Salt', quantity: 0.5, unit: 'oz' },
    ],
  },
  {
    name: 'Garlic Cheddar',
    description: 'Savory sourdough loaded with roasted garlic and sharp cheddar',
    price: 10.00,
    cost: 3.75,
    season: 'year_round',
    baseIngredients: [
      { name: 'Bread Flour', quantity: 16, unit: 'oz' },
      { name: 'Sourdough Starter', quantity: 4, unit: 'oz' },
      { name: 'Sea Salt', quantity: 0.5, unit: 'oz' },
    ],
    foldIngredients: [
      { name: 'Cheddar Cheese', quantity: 4, unit: 'oz' },
      { name: 'Garlic (Fresh)', quantity: 6, unit: 'clove' },
    ],
  },
  {
    name: 'Jalapeño Cheddar',
    description: 'Spicy kick with melted cheddar pockets throughout',
    price: 10.00,
    cost: 3.50,
    season: 'year_round',
    baseIngredients: [
      { name: 'Bread Flour', quantity: 16, unit: 'oz' },
      { name: 'Sourdough Starter', quantity: 4, unit: 'oz' },
      { name: 'Sea Salt', quantity: 0.5, unit: 'oz' },
    ],
    foldIngredients: [
      { name: 'Cheddar Cheese', quantity: 3, unit: 'oz' },
      { name: 'Jalapeños', quantity: 3, unit: 'each' },
    ],
  },
  {
    name: 'Cinnamon Raisin',
    description: 'Sweet swirls of cinnamon with plump raisins',
    price: 10.00,
    cost: 3.25,
    season: 'year_round',
    baseIngredients: [
      { name: 'Bread Flour', quantity: 14, unit: 'oz' },
      { name: 'Whole Wheat Flour', quantity: 2, unit: 'oz' },
      { name: 'Sourdough Starter', quantity: 4, unit: 'oz' },
      { name: 'Sea Salt', quantity: 0.4, unit: 'oz' },
      { name: 'Brown Sugar', quantity: 1, unit: 'oz' },
    ],
    foldIngredients: [
      { name: 'Cinnamon', quantity: 0.5, unit: 'oz' },
      { name: 'Raisins', quantity: 3, unit: 'oz' },
    ],
  },
  {
    name: 'Double Chocolate',
    description: 'Rich chocolate dough with chocolate chip pockets',
    price: 12.00,
    cost: 4.25,
    season: 'year_round',
    baseIngredients: [
      { name: 'Bread Flour', quantity: 14, unit: 'oz' },
      { name: 'Cocoa Powder', quantity: 1.5, unit: 'oz' },
      { name: 'Sourdough Starter', quantity: 4, unit: 'oz' },
      { name: 'Sea Salt', quantity: 0.4, unit: 'oz' },
      { name: 'Brown Sugar', quantity: 2, unit: 'oz' },
    ],
    foldIngredients: [
      { name: 'Chocolate Chips', quantity: 4, unit: 'oz' },
    ],
  },
  {
    name: 'Rosemary Olive Oil',
    description: 'Fragrant rosemary with rich olive oil crumb',
    price: 10.00,
    cost: 3.50,
    season: 'year_round',
    baseIngredients: [
      { name: 'Bread Flour', quantity: 16, unit: 'oz' },
      { name: 'Sourdough Starter', quantity: 4, unit: 'oz' },
      { name: 'Sea Salt', quantity: 0.5, unit: 'oz' },
      { name: 'Olive Oil', quantity: 1, unit: 'oz' },
    ],
    foldIngredients: [
      { name: 'Rosemary (Fresh)', quantity: 4, unit: 'sprig' },
    ],
  },
  {
    name: 'Honey Wheat',
    description: 'Wholesome whole wheat sweetened with local honey',
    price: 9.00,
    cost: 3.00,
    season: 'year_round',
    baseIngredients: [
      { name: 'Bread Flour', quantity: 10, unit: 'oz' },
      { name: 'Whole Wheat Flour', quantity: 6, unit: 'oz' },
      { name: 'Sourdough Starter', quantity: 4, unit: 'oz' },
      { name: 'Sea Salt', quantity: 0.5, unit: 'oz' },
      { name: 'Honey', quantity: 1.5, unit: 'oz' },
    ],
  },
  {
    name: 'Pumpkin Spice',
    description: 'Seasonal favorite with real pumpkin and warm spices',
    price: 12.00,
    cost: 4.00,
    season: 'fall',
    baseIngredients: [
      { name: 'Bread Flour', quantity: 14, unit: 'oz' },
      { name: 'Sourdough Starter', quantity: 4, unit: 'oz' },
      { name: 'Sea Salt', quantity: 0.4, unit: 'oz' },
      { name: 'Pumpkin Puree', quantity: 4, unit: 'oz' },
      { name: 'Cinnamon', quantity: 0.3, unit: 'oz' },
      { name: 'Brown Sugar', quantity: 1.5, unit: 'oz' },
    ],
  },
];

const insertFlavor = db.prepare(`
  INSERT INTO flavors (id, name, description, sizes, recipe_id, is_active, season, sort_order, estimated_cost, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?)
`);

const insertRecipe = db.prepare(`
  INSERT INTO recipes (id, name, flavor_id, base_ingredients, fold_ingredients, lamination_ingredients, steps, yields_loaves, cost_per_loaf, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)
`);

const flavorIds = [];
flavors.forEach((f, i) => {
  const flavorId = generateId('flav');
  const recipeId = generateId('rec');
  flavorIds.push({ id: flavorId, name: f.name, price: f.price });

  const sizes = JSON.stringify([{ name: 'Regular Loaf', price: f.price }]);
  const steps = JSON.stringify([
    'Mix base ingredients and autolyse for 30 minutes',
    'Add starter and salt, mix until combined',
    'Bulk ferment 4-6 hours with stretch and folds every 30 minutes',
    'Pre-shape and bench rest 20 minutes',
    'Final shape and place in banneton',
    'Cold retard overnight (8-12 hours)',
    'Bake at 475°F: 20 min covered, 20-25 min uncovered',
  ]);

  insertRecipe.run(
    recipeId,
    `${f.name} Recipe`,
    flavorId,
    JSON.stringify(f.baseIngredients || []),
    JSON.stringify(f.foldIngredients || []),
    JSON.stringify(f.laminationIngredients || []),
    steps,
    f.cost,
    now,
    now
  );

  insertFlavor.run(flavorId, f.name, f.description, sizes, recipeId, f.season, i, f.cost, now, now);
});

// 5. Fictional Customers
console.log('Creating customers...');
const fictionalCustomers = [
  // Disney
  { first: 'Mickey', last: 'Mouse', email: 'mickey@disney.demo' },
  { first: 'Minnie', last: 'Mouse', email: 'minnie@disney.demo' },
  { first: 'Donald', last: 'Duck', email: 'donald@disney.demo' },
  { first: 'Elsa', last: 'Arendelle', email: 'elsa@frozen.demo' },
  { first: 'Moana', last: 'Waialiki', email: 'moana@ocean.demo' },
  // Harry Potter
  { first: 'Harry', last: 'Potter', email: 'harry@hogwarts.demo' },
  { first: 'Hermione', last: 'Granger', email: 'hermione@hogwarts.demo' },
  { first: 'Ron', last: 'Weasley', email: 'ron@hogwarts.demo' },
  { first: 'Luna', last: 'Lovegood', email: 'luna@hogwarts.demo' },
  // Marvel
  { first: 'Tony', last: 'Stark', email: 'tony@starkindustries.demo' },
  { first: 'Steve', last: 'Rogers', email: 'steve@avengers.demo' },
  { first: 'Natasha', last: 'Romanoff', email: 'natasha@shield.demo' },
  { first: 'Peter', last: 'Parker', email: 'peter@dailybugle.demo' },
  // Star Wars
  { first: 'Luke', last: 'Skywalker', email: 'luke@rebellion.demo' },
  { first: 'Leia', last: 'Organa', email: 'leia@rebellion.demo' },
  { first: 'Han', last: 'Solo', email: 'han@falcon.demo' },
  // Classic Literature
  { first: 'Elizabeth', last: 'Bennet', email: 'lizzy@pemberley.demo' },
  { first: 'Jay', last: 'Gatsby', email: 'jay@westeggg.demo' },
  { first: 'Sherlock', last: 'Holmes', email: 'sherlock@bakerst.demo' },
  { first: 'Jane', last: 'Eyre', email: 'jane@thornfield.demo' },
  // TV Shows
  { first: 'Ted', last: 'Lasso', email: 'ted@afcrichmond.demo' },
  { first: 'Leslie', last: 'Knope', email: 'leslie@pawnee.demo' },
  { first: 'Michael', last: 'Scott', email: 'michael@dundermifflin.demo' },
  { first: 'Jim', last: 'Halpert', email: 'jim@dundermifflin.demo' },
  { first: 'Pam', last: 'Beesly', email: 'pam@dundermifflin.demo' },
  // More variety
  { first: 'Bruce', last: 'Wayne', email: 'bruce@wayne.demo' },
  { first: 'Clark', last: 'Kent', email: 'clark@dailyplanet.demo' },
  { first: 'Diana', last: 'Prince', email: 'diana@themyscira.demo' },
  { first: 'Frodo', last: 'Baggins', email: 'frodo@shire.demo' },
  { first: 'Gandalf', last: 'Grey', email: 'gandalf@middleearth.demo' },
];

const insertCustomer = db.prepare(`
  INSERT INTO customers (id, first_name, last_name, email, phone, credit_balance, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const customerIds = [];
fictionalCustomers.forEach(c => {
  const id = generateId('cust');
  const phone = `555-${randomInt(100, 999)}-${randomInt(1000, 9999)}`;
  const creditBalance = Math.random() < 0.1 ? randomInt(5, 20) : 0; // 10% have credit
  insertCustomer.run(id, c.first, c.last, c.email, phone, creditBalance, now, now);
  customerIds.push({ id, name: `${c.first} ${c.last}` });
});

// 6. Bake Slots (90 days, 1-2 per week)
console.log('Creating bake slots...');
const insertBakeSlot = db.prepare(`
  INSERT INTO bake_slots (id, date, location_id, total_capacity, current_orders, is_open, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertBakeSlotLocation = db.prepare(`
  INSERT INTO bake_slot_locations (id, bake_slot_id, location_id, created_at)
  VALUES (?, ?, ?, ?)
`);

const bakeSlotData = [];
const startDate = new Date();
startDate.setDate(startDate.getDate() - 90);

// Generate ~13 weeks of bake slots
for (let week = 0; week < 13; week++) {
  const weekStart = new Date(startDate);
  weekStart.setDate(weekStart.getDate() + (week * 7));

  // Saturday market (every week)
  const saturday = new Date(weekStart);
  saturday.setDate(saturday.getDate() + (6 - saturday.getDay()));

  const satSlotId = generateId('slot');
  const satCapacity = randomInt(20, 30);
  const satDate = saturday.toISOString().split('T')[0];
  const isPast = new Date(satDate) < new Date();

  insertBakeSlot.run(satSlotId, satDate, locations[0].id, satCapacity, 0, isPast ? 0 : 1, now, now);
  insertBakeSlotLocation.run(generateId('bsl'), satSlotId, locations[0].id, now);
  if (Math.random() < 0.3) {
    insertBakeSlotLocation.run(generateId('bsl'), satSlotId, locations[1].id, now);
  }
  bakeSlotData.push({ id: satSlotId, date: satDate, capacity: satCapacity, locationIds: [locations[0].id] });

  // Wednesday market (most weeks)
  if (Math.random() < 0.7) {
    const wednesday = new Date(weekStart);
    wednesday.setDate(wednesday.getDate() + (3 - wednesday.getDay() + 7) % 7);

    const wedSlotId = generateId('slot');
    const wedCapacity = randomInt(15, 24);
    const wedDate = wednesday.toISOString().split('T')[0];
    const wedIsPast = new Date(wedDate) < new Date();

    insertBakeSlot.run(wedSlotId, wedDate, locations[2].id, wedCapacity, 0, wedIsPast ? 0 : 1, now, now);
    insertBakeSlotLocation.run(generateId('bsl'), wedSlotId, locations[2].id, now);
    bakeSlotData.push({ id: wedSlotId, date: wedDate, capacity: wedCapacity, locationIds: [locations[2].id] });
  }
}

// 7. Orders
console.log('Creating orders...');
const insertOrder = db.prepare(`
  INSERT INTO orders (id, customer_id, bake_slot_id, pickup_location_id, items, total_amount, status, payment_status, payment_method, notes, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const updateBakeSlotOrders = db.prepare(`
  UPDATE bake_slots SET current_orders = current_orders + ? WHERE id = ?
`);

const orderStatuses = ['submitted', 'ready', 'picked_up', 'picked_up', 'picked_up', 'canceled', 'no_show'];
const paymentMethods = ['cash', 'venmo', 'cashapp', 'zelle', 'cash', 'venmo'];
const orderNotes = [
  '',
  '',
  '',
  'Please slice the bread',
  'Will pick up early',
  'First time customer!',
  'Regular weekly order',
  'For a birthday party',
  'Extra crispy crust please',
  '',
];

let totalOrders = 0;
bakeSlotData.forEach(slot => {
  const slotDate = new Date(slot.date);
  const isPast = slotDate < new Date();

  // Generate 60-90% capacity for past slots, less for future
  const fillRate = isPast ? randomInt(60, 95) / 100 : randomInt(20, 50) / 100;
  const numOrders = Math.floor(slot.capacity * fillRate);

  let slotOrderCount = 0;

  for (let i = 0; i < numOrders; i++) {
    const customer = randomChoice(customerIds);
    const numItems = randomInt(1, 3);
    const items = [];
    let total = 0;

    const usedFlavors = new Set();
    for (let j = 0; j < numItems; j++) {
      let flavor;
      do {
        flavor = randomChoice(flavorIds);
      } while (usedFlavors.has(flavor.id) && usedFlavors.size < flavorIds.length);
      usedFlavors.add(flavor.id);

      const qty = randomInt(1, 2);
      items.push({
        flavorId: flavor.id,
        flavorName: flavor.name,
        size: 'Regular Loaf',
        quantity: qty,
        unitPrice: flavor.price,
        totalPrice: flavor.price * qty,
      });
      total += flavor.price * qty;
      slotOrderCount += qty;
    }

    const orderId = generateId('ord');
    const status = isPast ? randomChoice(orderStatuses) : 'submitted';
    const isPaid = isPast && status !== 'canceled' && Math.random() < 0.85;
    const paymentStatus = isPaid ? 'paid' : 'pending';
    const paymentMethod = isPaid ? randomChoice(paymentMethods) : null;
    const notes = randomChoice(orderNotes);

    // Order created 1-7 days before the bake slot
    const orderDate = new Date(slotDate);
    orderDate.setDate(orderDate.getDate() - randomInt(1, 7));
    const orderCreatedAt = orderDate.toISOString();

    const pickupLocationId = randomChoice(slot.locationIds);

    insertOrder.run(
      orderId,
      customer.id,
      slot.id,
      pickupLocationId,
      JSON.stringify(items),
      total,
      status,
      paymentStatus,
      paymentMethod,
      notes || null,
      orderCreatedAt,
      orderCreatedAt
    );

    totalOrders++;
  }

  updateBakeSlotOrders.run(slotOrderCount, slot.id);
});

console.log(`Created ${totalOrders} orders`);

// 8. Extra Production
console.log('Creating extra production entries...');
const insertExtraProduction = db.prepare(`
  INSERT INTO extra_production (id, bake_slot_id, production_date, flavor_id, quantity, disposition, sale_price, total_revenue, notes, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const dispositions = ['sold', 'sold', 'sold', 'gifted', 'wasted', 'personal'];
const extraNotes = ['Walk-up sale', 'Neighbor gift', 'Overproofed', 'Family dinner', 'Market sample', ''];

// Add extra production for ~40% of past bake slots
bakeSlotData.forEach(slot => {
  const slotDate = new Date(slot.date);
  if (slotDate >= new Date()) return;

  if (Math.random() < 0.4) {
    const numEntries = randomInt(1, 3);
    for (let i = 0; i < numEntries; i++) {
      const flavor = randomChoice(flavorIds);
      const disposition = randomChoice(dispositions);
      const qty = randomInt(1, 3);
      const salePrice = disposition === 'sold' ? flavor.price : null;
      const revenue = disposition === 'sold' ? salePrice * qty : null;

      insertExtraProduction.run(
        generateId('ep'),
        slot.id,
        slot.date,
        flavor.id,
        qty,
        disposition,
        salePrice,
        revenue,
        randomChoice(extraNotes) || null,
        now,
        now
      );
    }
  }
});

// 9. Settings
console.log('Configuring settings...');
db.prepare(`
  INSERT INTO settings (
    id, business_name, business_email, business_phone,
    default_cutoff_hours, require_payment_method,
    notification_email, notification_sms, notification_emails,
    enable_prepayment, venmo_username, cashapp_cashtag, zelle_email,
    bake_day_setup_minutes, bake_day_per_loaf_minutes, bake_day_cleanup_minutes,
    misc_production_per_loaf_minutes, created_at, updated_at
  ) VALUES (
    1, 'Hillshire Sourdough', 'hello@hillshiresourdough.demo', '(555) 123-4567',
    48, 1,
    1, 0, 'hello@hillshiresourdough.demo',
    1, '@HillshireSourdough', '$HillshireSourdough', 'pay@hillshiresourdough.demo',
    60, 8, 45, 15, ?, ?
  )
`).run(now, now);

// 10. Overhead Settings
db.prepare(`
  INSERT INTO overhead_settings (id, packaging_per_loaf, utilities_per_loaf, created_at, updated_at)
  VALUES (1, 0.75, 0.35, ?, ?)
`).run(now, now);

// 11. Audit Log entries
console.log('Creating audit log entries...');
const insertAudit = db.prepare(`
  INSERT INTO audit_log (user_id, user_name, action, entity_type, entity_id, details, created_at)
  VALUES (?, ?, ?, ?, ?, ?, ?)
`);

const auditActions = [
  { action: 'LOGIN', entityType: 'admin_users', details: 'User logged in' },
  { action: 'ORDER_STATUS_CHANGED', entityType: 'orders', details: 'Status changed to picked_up' },
  { action: 'PAYMENT_RECEIVED', entityType: 'orders', details: 'Marked as paid via Venmo' },
  { action: 'BAKE_SLOT_CREATED', entityType: 'bake_slots', details: 'New bake slot created' },
  { action: 'SETTINGS_UPDATED', entityType: 'settings', details: 'Business settings updated' },
];

// Add some audit entries over the past 90 days
for (let i = 0; i < 50; i++) {
  const daysAgo = randomInt(0, 90);
  const auditDate = new Date();
  auditDate.setDate(auditDate.getDate() - daysAgo);

  const admin = randomChoice(adminUsers);
  const audit = randomChoice(auditActions);

  insertAudit.run(
    admin.id,
    admin.name,
    audit.action,
    audit.entityType,
    generateId('ent'),
    audit.details,
    auditDate.toISOString()
  );
}

// Close database
db.close();

console.log('\n✓ Demo database created successfully!');
console.log(`  Location: ${DB_PATH}`);
console.log('\nDemo Users:');
console.log('  PIN 1111 - SJY (developer - full access)');
console.log('  PIN 2222 - Demo Owner (owner access)');
console.log('  PIN 3333 - Demo Admin (admin access)');
console.log('  PIN 4444 - Demo Staff (limited access)');
console.log(`\nData Summary:`);
console.log(`  - ${locations.length} locations`);
console.log(`  - ${flavors.length} flavors with recipes`);
console.log(`  - ${ingredients.length} ingredients`);
console.log(`  - ${bakeSlotData.length} bake slots`);
console.log(`  - ${customerIds.length} customers`);
console.log(`  - ${totalOrders} orders`);
