/**
 * Create Starter Database for Owner Handoff
 *
 * Creates a fresh database with:
 * - All tables and schema
 * - Pre-configured flavors with recipes
 * - Ingredients library
 * - Pickup locations
 * - Default settings
 * - NO test orders, customers, or users
 *
 * The owners will create their own admin account on first launch.
 *
 * Usage: node scripts/create-starter-database.js
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '..', 'bakery.db');

// Remove existing database if it exists
if (fs.existsSync(DB_PATH)) {
  console.log('Removing existing database...');
  fs.unlinkSync(DB_PATH);
}

console.log('Creating fresh starter database...');
const db = new Database(DB_PATH);

const now = new Date().toISOString();

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

  -- Bake Slot Locations (junction table for multi-location support)
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

// ============ HELPER FUNCTIONS ============
function generateId(prefix) {
  return `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

// ============ SEED LOCATIONS ============
console.log('Creating locations...');
const locations = [
  { id: 'loc-sat-market', name: "Saturday Farmer's Market", address: '' },
  { id: 'loc-farm', name: 'Farm Pickup', address: '' },
];

const insertLocation = db.prepare(`
  INSERT INTO locations (id, name, address, is_active, sort_order, created_at, updated_at)
  VALUES (?, ?, ?, 1, ?, ?, ?)
`);

locations.forEach((loc, i) => {
  insertLocation.run(loc.id, loc.name, loc.address, i, now, now);
});

// ============ SEED INGREDIENTS ============
console.log('Creating ingredients library...');
const ingredients = [
  { name: 'Bread Flour', unit: 'lb', packagePrice: 25.99, packageSize: 50, category: 'Flour' },
  { name: 'Whole Wheat Flour', unit: 'lb', packagePrice: 28.99, packageSize: 50, category: 'Flour' },
  { name: 'Sea Salt', unit: 'oz', packagePrice: 8.99, packageSize: 26, category: 'Seasoning' },
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
  { name: 'Rosemary (Fresh)', unit: 'sprig', packagePrice: 2.99, packageSize: 6, category: 'Herbs' },
  { name: 'Olive Oil', unit: 'oz', packagePrice: 12.99, packageSize: 34, category: 'Oil' },
  { name: 'Honey', unit: 'oz', packagePrice: 9.99, packageSize: 16, category: 'Sweetener' },
];

const insertIngredient = db.prepare(`
  INSERT INTO ingredients (id, name, unit, cost_per_unit, package_price, package_size, category, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

ingredients.forEach(ing => {
  const id = generateId('ing');
  const costPerUnit = ing.packagePrice / ing.packageSize;
  insertIngredient.run(id, ing.name, ing.unit, costPerUnit, ing.packagePrice, ing.packageSize, ing.category, now, now);
});

// ============ SEED FLAVORS AND RECIPES ============
console.log('Creating flavors and recipes...');
const flavors = [
  {
    name: 'Classic Sourdough',
    description: 'Traditional tangy sourdough with a crispy crust',
    price: 8.00,
    cost: 2.50,
  },
  {
    name: 'Garlic Cheddar',
    description: 'Savory sourdough loaded with roasted garlic and sharp cheddar',
    price: 10.00,
    cost: 3.75,
  },
  {
    name: 'Jalapeño Cheddar',
    description: 'Spicy kick with melted cheddar pockets throughout',
    price: 10.00,
    cost: 3.50,
  },
  {
    name: 'Cinnamon Raisin',
    description: 'Sweet swirls of cinnamon with plump raisins',
    price: 10.00,
    cost: 3.25,
  },
  {
    name: 'Double Chocolate',
    description: 'Rich chocolate dough with chocolate chip pockets',
    price: 12.00,
    cost: 4.25,
  },
  {
    name: 'Rosemary Olive Oil',
    description: 'Fragrant rosemary with rich olive oil crumb',
    price: 10.00,
    cost: 3.50,
  },
  {
    name: 'Honey Wheat',
    description: 'Wholesome whole wheat sweetened with local honey',
    price: 9.00,
    cost: 3.00,
  },
];

const insertFlavor = db.prepare(`
  INSERT INTO flavors (id, name, description, sizes, recipe_id, is_active, season, sort_order, estimated_cost, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, 1, 'year_round', ?, ?, ?, ?)
`);

const insertRecipe = db.prepare(`
  INSERT INTO recipes (id, name, flavor_id, base_ingredients, fold_ingredients, steps, yields_loaves, cost_per_loaf, created_at, updated_at)
  VALUES (?, ?, ?, '[]', '[]', '[]', 1, ?, ?, ?)
`);

flavors.forEach((f, i) => {
  const flavorId = generateId('flav');
  const recipeId = generateId('rec');
  const sizes = JSON.stringify([{ name: 'Regular Loaf', price: f.price }]);

  insertRecipe.run(recipeId, `${f.name} Recipe`, flavorId, f.cost, now, now);
  insertFlavor.run(flavorId, f.name, f.description, sizes, recipeId, i, f.cost, now, now);
});

// ============ SEED SETTINGS ============
console.log('Configuring default settings...');
db.prepare(`
  INSERT INTO settings (
    id, business_name, business_email, business_phone,
    default_cutoff_hours, require_payment_method,
    notification_email, enable_prepayment,
    venmo_username, cashapp_cashtag, zelle_email,
    bake_day_setup_minutes, bake_day_per_loaf_minutes,
    bake_day_cleanup_minutes, misc_production_per_loaf_minutes,
    created_at, updated_at
  ) VALUES (
    1, 'Covenant Acres Farmstand', '', '',
    48, 1,
    1, 1,
    '@CovenantAcres', '$CovenantAcres', 'pay@covenantacresin.com',
    60, 8, 45, 15, ?, ?
  )
`).run(now, now);

db.prepare(`
  INSERT INTO overhead_settings (id, packaging_per_loaf, utilities_per_loaf, created_at, updated_at)
  VALUES (1, 0.75, 0.35, ?, ?)
`).run(now, now);

// ============ SUMMARY ============
db.close();

const dbSize = fs.statSync(DB_PATH).size;

console.log('\n✓ Starter database created successfully!');
console.log(`\nLocation: ${DB_PATH}`);
console.log(`Size: ${(dbSize / 1024).toFixed(1)} KB`);
console.log('\nIncluded:');
console.log('  - 2 pickup locations (customize addresses in Settings)');
console.log('  - 16 ingredients in library');
console.log('  - 7 bread flavors with recipes');
console.log('  - Default business settings');
console.log('  - Payment links pre-configured');
console.log('\nNOT included (clean start):');
console.log('  - No admin users (owners will set up on first launch)');
console.log('  - No customers');
console.log('  - No orders');
console.log('  - No bake slots');
console.log('\nThe owners will be prompted to create their account when they first open the app.');
