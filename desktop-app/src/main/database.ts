/**
 * SQLite Database for Local Cache
 * Provides offline capability by caching data locally
 */

import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';
import { log } from './logger';

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) throw new Error('Database not initialized');
  return db;
}

export async function initDatabase(): Promise<void> {
  const dbPath = path.join(app.getPath('userData'), 'covenant-acres.db');
  log('info', `Initializing database at ${dbPath}`);

  db = new Database(dbPath);

  // Enable WAL mode for better performance
  db.pragma('journal_mode = WAL');

  // Create tables
  db.exec(`
    -- Orders
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      customer_id TEXT NOT NULL,
      bake_slot_id TEXT NOT NULL,
      items TEXT NOT NULL,
      total_amount REAL NOT NULL,
      status TEXT NOT NULL,
      payment_method TEXT,
      payment_status TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      cutoff_at TEXT,
      customer_notes TEXT,
      admin_notes TEXT,
      credit_applied REAL DEFAULT 0,
      adjustment_reason TEXT,
      synced_at TEXT,
      FOREIGN KEY (customer_id) REFERENCES customers(id),
      FOREIGN KEY (bake_slot_id) REFERENCES bake_slots(id)
    );

    -- Customers
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      first_name TEXT NOT NULL,
      last_name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      phone TEXT NOT NULL,
      notification_pref TEXT NOT NULL,
      sms_opt_in INTEGER DEFAULT 0,
      sms_opt_in_date TEXT,
      has_account INTEGER DEFAULT 0,
      password_hash TEXT,
      credit_balance REAL DEFAULT 0,
      total_orders INTEGER DEFAULT 0,
      total_spent REAL DEFAULT 0,
      first_order_date TEXT,
      last_order_date TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      synced_at TEXT
    );

    -- Bake Slots
    CREATE TABLE IF NOT EXISTS bake_slots (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      location_id TEXT NOT NULL,
      total_capacity INTEGER NOT NULL,
      current_orders INTEGER DEFAULT 0,
      cutoff_time TEXT NOT NULL,
      is_open INTEGER DEFAULT 1,
      manually_closed_by TEXT,
      manually_closed_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      synced_at TEXT,
      FOREIGN KEY (location_id) REFERENCES locations(id)
    );

    -- Flavor Caps (per bake slot)
    CREATE TABLE IF NOT EXISTS flavor_caps (
      id TEXT PRIMARY KEY,
      bake_slot_id TEXT NOT NULL,
      flavor_id TEXT NOT NULL,
      max_quantity INTEGER NOT NULL,
      current_quantity INTEGER DEFAULT 0,
      FOREIGN KEY (bake_slot_id) REFERENCES bake_slots(id),
      FOREIGN KEY (flavor_id) REFERENCES flavors(id)
    );

    -- Flavors
    CREATE TABLE IF NOT EXISTS flavors (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      sizes TEXT NOT NULL,
      recipe_id TEXT,
      is_active INTEGER DEFAULT 1,
      season TEXT DEFAULT 'year_round',
      sort_order INTEGER DEFAULT 0,
      image_url TEXT,
      estimated_cost REAL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      synced_at TEXT,
      FOREIGN KEY (recipe_id) REFERENCES recipes(id)
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
      updated_at TEXT NOT NULL,
      synced_at TEXT
    );

    -- Recipes
    CREATE TABLE IF NOT EXISTS recipes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      flavor_id TEXT,
      base_ingredients TEXT NOT NULL,
      fold_ingredients TEXT,
      lamination_ingredients TEXT,
      steps TEXT NOT NULL,
      yields_loaves INTEGER DEFAULT 1,
      loaf_size TEXT,
      total_cost REAL,
      cost_per_loaf REAL,
      notes TEXT,
      season TEXT,
      source TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      synced_at TEXT
    );

    -- Ingredients (for cost tracking)
    CREATE TABLE IF NOT EXISTS ingredients (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      unit TEXT NOT NULL,
      cost_per_unit REAL NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      synced_at TEXT
    );

    -- Overhead Settings (packaging, utilities per loaf)
    CREATE TABLE IF NOT EXISTS overhead_settings (
      id INTEGER PRIMARY KEY DEFAULT 1,
      packaging_per_loaf REAL DEFAULT 0.50,
      utilities_per_loaf REAL DEFAULT 0.12,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    -- Recipe Ingredients (links recipes to ingredient library)
    CREATE TABLE IF NOT EXISTS recipe_ingredients (
      id TEXT PRIMARY KEY,
      recipe_id TEXT NOT NULL,
      ingredient_id TEXT NOT NULL,
      quantity REAL NOT NULL,
      unit TEXT NOT NULL,
      phase TEXT DEFAULT 'base',
      FOREIGN KEY (recipe_id) REFERENCES recipes(id),
      FOREIGN KEY (ingredient_id) REFERENCES ingredients(id)
    );

    -- Notification Log
    CREATE TABLE IF NOT EXISTS notification_log (
      id TEXT PRIMARY KEY,
      trigger_type TEXT NOT NULL,
      channel TEXT NOT NULL,
      recipient_type TEXT NOT NULL,
      recipient_id TEXT NOT NULL,
      recipient_contact TEXT NOT NULL,
      subject TEXT,
      body TEXT NOT NULL,
      status TEXT NOT NULL,
      error_message TEXT,
      sent_at TEXT NOT NULL
    );

    -- Config
    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    -- Settings
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY DEFAULT 1,
      business_name TEXT DEFAULT 'Covenant Acres Farmstand',
      business_email TEXT,
      business_phone TEXT,
      default_cutoff_hours INTEGER DEFAULT 48,
      require_payment_method INTEGER DEFAULT 0,
      notification_email INTEGER DEFAULT 1,
      notification_sms INTEGER DEFAULT 0,
      sms_provider TEXT,
      sms_api_key TEXT,
      email_provider TEXT,
      email_api_key TEXT,
      google_sheets_id TEXT,
      google_credentials TEXT,
      quiet_hours_start TEXT DEFAULT '21:00',
      quiet_hours_end TEXT DEFAULT '08:00',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    -- Sync Log
    CREATE TABLE IF NOT EXISTS sync_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      direction TEXT NOT NULL,
      table_name TEXT NOT NULL,
      record_id TEXT NOT NULL,
      action TEXT NOT NULL,
      status TEXT NOT NULL,
      error_message TEXT,
      timestamp TEXT NOT NULL
    );

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

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_orders_bake_slot ON orders(bake_slot_id);
    CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
    CREATE INDEX IF NOT EXISTS idx_bake_slots_date ON bake_slots(date);
    CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
    CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at);
  `);

  // Migrations for admin_users table
  const columns = db.prepare("PRAGMA table_info(admin_users)").all() as Array<{ name: string }>;

  // Add permissions column if missing
  if (!columns.some(col => col.name === 'permissions')) {
    db.exec("ALTER TABLE admin_users ADD COLUMN permissions TEXT");
    log('info', 'Added permissions column to admin_users');
  }

  // Add is_developer column if missing
  if (!columns.some(col => col.name === 'is_developer')) {
    db.exec("ALTER TABLE admin_users ADD COLUMN is_developer INTEGER DEFAULT 0");
    log('info', 'Added is_developer column to admin_users');
  }

  // Migrations for recipes table
  const recipeColumns = db.prepare("PRAGMA table_info(recipes)").all() as Array<{ name: string }>;

  if (!recipeColumns.some(col => col.name === 'prep_time_minutes')) {
    db.exec("ALTER TABLE recipes ADD COLUMN prep_time_minutes INTEGER");
    log('info', 'Added prep_time_minutes column to recipes');
  }

  if (!recipeColumns.some(col => col.name === 'bake_time_minutes')) {
    db.exec("ALTER TABLE recipes ADD COLUMN bake_time_minutes INTEGER");
    log('info', 'Added bake_time_minutes column to recipes');
  }

  if (!recipeColumns.some(col => col.name === 'bake_temp')) {
    db.exec("ALTER TABLE recipes ADD COLUMN bake_temp TEXT");
    log('info', 'Added bake_temp column to recipes');
  }

  if (!recipeColumns.some(col => col.name === 'prep_instructions')) {
    db.exec("ALTER TABLE recipes ADD COLUMN prep_instructions TEXT");
    log('info', 'Added prep_instructions column to recipes');
  }

  if (!recipeColumns.some(col => col.name === 'bake_instructions')) {
    db.exec("ALTER TABLE recipes ADD COLUMN bake_instructions TEXT");
    log('info', 'Added bake_instructions column to recipes');
  }

  // Migrations for ingredients table
  const ingredientColumns = db.prepare("PRAGMA table_info(ingredients)").all() as Array<{ name: string }>;

  if (!ingredientColumns.some(col => col.name === 'package_price')) {
    db.exec("ALTER TABLE ingredients ADD COLUMN package_price REAL");
    log('info', 'Added package_price column to ingredients');
  }

  if (!ingredientColumns.some(col => col.name === 'package_size')) {
    db.exec("ALTER TABLE ingredients ADD COLUMN package_size REAL");
    log('info', 'Added package_size column to ingredients');
  }

  if (!ingredientColumns.some(col => col.name === 'package_unit')) {
    db.exec("ALTER TABLE ingredients ADD COLUMN package_unit TEXT");
    log('info', 'Added package_unit column to ingredients');
  }

  if (!ingredientColumns.some(col => col.name === 'vendor')) {
    db.exec("ALTER TABLE ingredients ADD COLUMN vendor TEXT");
    log('info', 'Added vendor column to ingredients');
  }

  if (!ingredientColumns.some(col => col.name === 'category')) {
    db.exec("ALTER TABLE ingredients ADD COLUMN category TEXT");
    log('info', 'Added category column to ingredients');
  }

  // Initialize overhead_settings if empty
  const overheadCount = db.prepare("SELECT COUNT(*) as count FROM overhead_settings").get() as { count: number };
  if (overheadCount.count === 0) {
    db.prepare("INSERT INTO overhead_settings (id, packaging_per_loaf, utilities_per_loaf, updated_at) VALUES (1, 0.50, 0.12, ?)").run(new Date().toISOString());
    log('info', 'Initialized overhead_settings with defaults');
  }

  // Seed ingredients if empty (from Stephanie's data)
  const ingredientCount = db.prepare("SELECT COUNT(*) as count FROM ingredients").get() as { count: number };
  if (ingredientCount.count === 0) {
    const now = new Date().toISOString();
    const seedIngredients = [
      // Base ingredients
      { name: 'Flour', unit: 'g', package_price: 18.71, package_size: 9072, package_unit: '20lb', vendor: 'Costco', category: 'base' },
      { name: 'Salt', unit: 'g', package_price: 7.05, package_size: 2116, package_unit: '4.7lb', vendor: 'Costco', category: 'base' },
      // Sweeteners
      { name: 'Cane Sugar', unit: 'g', package_price: 12.83, package_size: 4536, package_unit: '10lb', vendor: 'Costco', category: 'sweetener' },
      { name: 'Brown Sugar', unit: 'g', package_price: 4.11, package_size: 680, package_unit: '24oz', vendor: 'Walmart', category: 'sweetener' },
      { name: 'Maple Syrup', unit: 'g', package_price: 12.00, package_size: 950, package_unit: '32oz', vendor: 'Costco', category: 'sweetener' },
      // Spices
      { name: 'Cinnamon', unit: 'g', package_price: 5.34, package_size: 303, package_unit: '10.7oz', vendor: 'Costco', category: 'spice' },
      { name: 'Garlic Powder', unit: 'g', package_price: 9.08, package_size: 624, package_unit: '22oz', vendor: 'Costco', category: 'spice' },
      { name: 'Cocoa Powder', unit: 'g', package_price: 6.61, package_size: 227, package_unit: '8oz', vendor: 'Walmart', category: 'spice' },
      { name: 'Ginger', unit: 'g', package_price: 4.67, package_size: 45, package_unit: '1.6oz', vendor: 'Walmart', category: 'spice' },
      // Misc
      { name: 'Jalapenos (jarred)', unit: 'g', package_price: 2.55, package_size: 340, package_unit: '12oz', vendor: 'Walmart', category: 'misc' },
      { name: 'Cheddar Cheese', unit: 'g', package_price: 10.87, package_size: 1134, package_unit: '2.5lb', vendor: 'Costco', category: 'misc' },
      { name: 'Pecans', unit: 'g', package_price: 13.90, package_size: 907, package_unit: '2lb', vendor: 'Costco', category: 'misc' },
      { name: 'Orange', unit: 'each', package_price: 1.04, package_size: 1, package_unit: '1 each', vendor: 'Walmart', category: 'misc' },
      { name: 'Orange Juice', unit: 'g', package_price: 4.69, package_size: 1361, package_unit: '46oz', vendor: 'Walmart', category: 'misc' },
      { name: 'Fresh Cranberries', unit: 'g', package_price: 1.04, package_size: 340, package_unit: '12oz', vendor: 'Walmart', category: 'misc' },
      { name: 'Butter', unit: 'g', package_price: 14.97, package_size: 907, package_unit: '2lb', vendor: 'Costco', category: 'misc' },
      { name: 'Vanilla Extract', unit: 'tsp', package_price: 10.68, package_size: 96, package_unit: '16oz', vendor: 'Costco', category: 'misc' },
      { name: 'Chocolate Morsels', unit: 'g', package_price: 16.04, package_size: 2041, package_unit: '72oz', vendor: 'Costco', category: 'misc' },
      { name: 'Molasses', unit: 'g', package_price: 8.00, package_size: 680, package_unit: '24oz', vendor: 'Azure', category: 'sweetener' },
    ];

    const insertStmt = db.prepare(`
      INSERT INTO ingredients (id, name, unit, cost_per_unit, package_price, package_size, package_unit, vendor, category, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const ing of seedIngredients) {
      const id = `ing-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
      const costPerUnit = ing.package_price / ing.package_size;
      insertStmt.run(id, ing.name, ing.unit, costPerUnit, ing.package_price, ing.package_size, ing.package_unit, ing.vendor, ing.category, now, now);
    }
    log('info', `Seeded ${seedIngredients.length} ingredients from Stephanie's data`);
  }

  // Create blank recipes for flavors that don't have one
  const flavorsWithoutRecipes = db.prepare(`
    SELECT id, name FROM flavors WHERE recipe_id IS NULL OR recipe_id = ''
  `).all() as Array<{ id: string; name: string }>;

  for (const flavor of flavorsWithoutRecipes) {
    const recipeId = `rec-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO recipes (id, name, flavor_id, base_ingredients, fold_ingredients, lamination_ingredients, steps, yields_loaves, created_at, updated_at)
      VALUES (?, ?, ?, '[]', '[]', '[]', '[]', 1, ?, ?)
    `).run(recipeId, `${flavor.name} Recipe`, flavor.id, now, now);

    db.prepare(`UPDATE flavors SET recipe_id = ? WHERE id = ?`).run(recipeId, flavor.id);

    log('info', 'Created blank recipe for flavor', { flavorId: flavor.id, recipeId });
  }

  log('info', 'Database tables created/verified');
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}
