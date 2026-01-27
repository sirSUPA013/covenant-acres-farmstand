/**
 * SQLite Database for Local Cache
 * Provides offline capability by caching data locally
 */

import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import { app } from 'electron';
import { log } from './logger';

let db: Database.Database | null = null;
let isPortableMode = false;

export function getDb(): Database.Database {
  if (!db) throw new Error('Database not initialized');
  return db;
}

export function isPortable(): boolean {
  return isPortableMode;
}

export async function initDatabase(): Promise<void> {
  // Check for portable mode: look for data/covenant-acres.db next to the executable
  const exeDir = path.dirname(app.getPath('exe'));
  const portableDbPath = path.join(exeDir, 'data', 'covenant-acres.db');

  let dbPath: string;
  if (fs.existsSync(portableDbPath)) {
    dbPath = portableDbPath;
    isPortableMode = true;
    log('info', 'Running in PORTABLE/DEMO mode');
  } else {
    dbPath = path.join(app.getPath('userData'), 'covenant-acres.db');
  }

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
      notification_emails TEXT DEFAULT '[]',
      notification_phones TEXT DEFAULT '[]',
      sms_provider TEXT,
      sms_api_key TEXT,
      email_provider TEXT,
      email_api_key TEXT,
      google_sheets_id TEXT,
      google_credentials TEXT,
      quiet_hours_start TEXT DEFAULT '21:00',
      quiet_hours_end TEXT DEFAULT '08:00',
      bake_day_setup_minutes INTEGER DEFAULT 60,
      bake_day_per_loaf_minutes INTEGER DEFAULT 8,
      bake_day_cleanup_minutes INTEGER DEFAULT 45,
      misc_production_per_loaf_minutes INTEGER DEFAULT 15,
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

    -- Extra Production (bread made without orders)
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
      FOREIGN KEY (flavor_id) REFERENCES flavors(id),
      FOREIGN KEY (created_by) REFERENCES admin_users(id)
    );

    -- Bake Slot Locations (junction table - one bake day can have multiple pickup locations)
    CREATE TABLE IF NOT EXISTS bake_slot_locations (
      id TEXT PRIMARY KEY,
      bake_slot_id TEXT NOT NULL,
      location_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (bake_slot_id) REFERENCES bake_slots(id) ON DELETE CASCADE,
      FOREIGN KEY (location_id) REFERENCES locations(id),
      UNIQUE(bake_slot_id, location_id)
    );

    -- Prep Sheets (track bake day planning with draft/complete workflow)
    CREATE TABLE IF NOT EXISTS prep_sheets (
      id TEXT PRIMARY KEY,
      bake_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      notes TEXT,
      completed_at TEXT,
      completed_by TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (completed_by) REFERENCES admin_users(id)
    );

    -- Prep Sheet Items (line items on a prep sheet - both from orders and extras)
    CREATE TABLE IF NOT EXISTS prep_sheet_items (
      id TEXT PRIMARY KEY,
      prep_sheet_id TEXT NOT NULL,
      order_id TEXT,
      flavor_id TEXT NOT NULL,
      planned_quantity INTEGER NOT NULL,
      actual_quantity INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (prep_sheet_id) REFERENCES prep_sheets(id) ON DELETE CASCADE,
      FOREIGN KEY (order_id) REFERENCES orders(id),
      FOREIGN KEY (flavor_id) REFERENCES flavors(id)
    );

    -- Production (tracks individual loaf line items after baking)
    CREATE TABLE IF NOT EXISTS production (
      id TEXT PRIMARY KEY,
      prep_sheet_id TEXT NOT NULL,
      order_id TEXT,
      flavor_id TEXT NOT NULL,
      quantity INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      sale_price REAL,
      notes TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      FOREIGN KEY (prep_sheet_id) REFERENCES prep_sheets(id),
      FOREIGN KEY (order_id) REFERENCES orders(id),
      FOREIGN KEY (flavor_id) REFERENCES flavors(id)
    );

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_orders_bake_slot ON orders(bake_slot_id);
    CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
    CREATE INDEX IF NOT EXISTS idx_bake_slots_date ON bake_slots(date);
    CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
    CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at);
    CREATE INDEX IF NOT EXISTS idx_extra_production_date ON extra_production(production_date);
    CREATE INDEX IF NOT EXISTS idx_extra_production_slot ON extra_production(bake_slot_id);
    CREATE INDEX IF NOT EXISTS idx_extra_production_disposition ON extra_production(disposition);
    CREATE INDEX IF NOT EXISTS idx_extra_production_flavor ON extra_production(flavor_id);
    CREATE INDEX IF NOT EXISTS idx_bake_slot_locations_slot ON bake_slot_locations(bake_slot_id);
    CREATE INDEX IF NOT EXISTS idx_bake_slot_locations_location ON bake_slot_locations(location_id);
    CREATE INDEX IF NOT EXISTS idx_prep_sheets_bake_date ON prep_sheets(bake_date);
    CREATE INDEX IF NOT EXISTS idx_prep_sheets_status ON prep_sheets(status);
    CREATE INDEX IF NOT EXISTS idx_prep_sheet_items_prep_sheet ON prep_sheet_items(prep_sheet_id);
    CREATE INDEX IF NOT EXISTS idx_prep_sheet_items_order ON prep_sheet_items(order_id);
    CREATE INDEX IF NOT EXISTS idx_prep_sheet_items_flavor ON prep_sheet_items(flavor_id);
    CREATE INDEX IF NOT EXISTS idx_production_prep_sheet ON production(prep_sheet_id);
    CREATE INDEX IF NOT EXISTS idx_production_order ON production(order_id);
    CREATE INDEX IF NOT EXISTS idx_production_flavor ON production(flavor_id);
    CREATE INDEX IF NOT EXISTS idx_production_status ON production(status);
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

  if (!ingredientColumns.some(col => col.name === 'density_g_per_ml')) {
    db.exec("ALTER TABLE ingredients ADD COLUMN density_g_per_ml REAL");
    log('info', 'Added density_g_per_ml column to ingredients');

    // Populate density for common ingredients
    const densityValues: Record<string, number> = {
      // Flours and powders (approximate, sifted)
      'Flour': 0.53,           // ~125g per cup
      'Cocoa Powder': 0.42,    // ~100g per cup
      'Garlic Powder': 0.51,   // ~120g per cup
      'Cinnamon': 0.53,        // ~125g per cup
      'Ginger': 0.42,          // ~100g per cup
      // Sugars
      'Cane Sugar': 0.85,      // ~200g per cup
      'Brown Sugar': 0.83,     // ~195g per cup (packed)
      'Salt': 1.22,            // ~288g per cup (table salt)
      // Liquids
      'Maple Syrup': 1.37,     // denser than water
      'Molasses': 1.41,        // denser than water
      'Orange Juice': 1.04,    // close to water
      'Vanilla Extract': 0.88, // similar to alcohol
      // Fats
      'Butter': 0.91,          // ~215g per cup, slightly less than water
      // Misc
      'Chocolate Morsels': 0.64, // ~150g per cup (loose)
      'Pecans': 0.42,          // ~100g per cup (chopped)
      'Fresh Cranberries': 0.42, // ~100g per cup
      'Cheddar Cheese': 0.47,  // ~110g per cup (shredded)
      'Jalapenos (jarred)': 0.85, // similar to water with solids
    };

    for (const [name, density] of Object.entries(densityValues)) {
      db.prepare("UPDATE ingredients SET density_g_per_ml = ? WHERE name = ?").run(density, name);
    }
    log('info', 'Populated density values for common ingredients');
  }

  // Always ensure density values are populated for ingredients that don't have them
  const defaultDensities: Record<string, number> = {
    'Flour': 0.53, 'Cocoa Powder': 0.42, 'Garlic Powder': 0.51, 'Cinnamon': 0.53,
    'Ginger': 0.42, 'Cane Sugar': 0.85, 'Brown Sugar': 0.83, 'Salt': 1.22,
    'Maple Syrup': 1.37, 'Molasses': 1.41, 'Orange Juice': 1.04, 'Vanilla Extract': 0.88,
    'Butter': 0.91, 'Chocolate Morsels': 0.64, 'Pecans': 0.42, 'Fresh Cranberries': 0.42,
    'Cheddar Cheese': 0.47, 'Jalapenos (jarred)': 0.85,
  };
  let densitiesUpdated = 0;
  for (const [name, density] of Object.entries(defaultDensities)) {
    const result = db.prepare("UPDATE ingredients SET density_g_per_ml = ? WHERE name = ? AND density_g_per_ml IS NULL").run(density, name);
    if (result.changes > 0) densitiesUpdated++;
  }
  if (densitiesUpdated > 0) {
    log('info', `Populated missing density values for ${densitiesUpdated} ingredients`);
  }

  // Migration for contents_size (for package types like cans, jars)
  if (!ingredientColumns.some(col => col.name === 'contents_size')) {
    db.exec("ALTER TABLE ingredients ADD COLUMN contents_size REAL DEFAULT 0");
    log('info', 'Added contents_size column to ingredients');
  }

  // Migrations for settings table - payment links
  const settingsColumns = db.prepare("PRAGMA table_info(settings)").all() as Array<{ name: string }>;

  if (!settingsColumns.some(col => col.name === 'enable_prepayment')) {
    db.exec("ALTER TABLE settings ADD COLUMN enable_prepayment INTEGER DEFAULT 0");
    log('info', 'Added enable_prepayment column to settings');
  }

  if (!settingsColumns.some(col => col.name === 'venmo_username')) {
    db.exec("ALTER TABLE settings ADD COLUMN venmo_username TEXT");
    log('info', 'Added venmo_username column to settings');
  }

  if (!settingsColumns.some(col => col.name === 'cashapp_cashtag')) {
    db.exec("ALTER TABLE settings ADD COLUMN cashapp_cashtag TEXT");
    log('info', 'Added cashapp_cashtag column to settings');
  }

  if (!settingsColumns.some(col => col.name === 'paypal_username')) {
    db.exec("ALTER TABLE settings ADD COLUMN paypal_username TEXT");
    log('info', 'Added paypal_username column to settings');
  }

  if (!settingsColumns.some(col => col.name === 'zelle_email')) {
    db.exec("ALTER TABLE settings ADD COLUMN zelle_email TEXT");
    log('info', 'Added zelle_email column to settings');
  }

  // Migration: Add time estimate columns to settings
  if (!settingsColumns.some(col => col.name === 'bake_day_setup_minutes')) {
    db.exec("ALTER TABLE settings ADD COLUMN bake_day_setup_minutes INTEGER DEFAULT 60");
    log('info', 'Added bake_day_setup_minutes column to settings');
  }
  if (!settingsColumns.some(col => col.name === 'bake_day_per_loaf_minutes')) {
    db.exec("ALTER TABLE settings ADD COLUMN bake_day_per_loaf_minutes INTEGER DEFAULT 8");
    log('info', 'Added bake_day_per_loaf_minutes column to settings');
  }
  if (!settingsColumns.some(col => col.name === 'bake_day_cleanup_minutes')) {
    db.exec("ALTER TABLE settings ADD COLUMN bake_day_cleanup_minutes INTEGER DEFAULT 45");
    log('info', 'Added bake_day_cleanup_minutes column to settings');
  }
  if (!settingsColumns.some(col => col.name === 'misc_production_per_loaf_minutes')) {
    db.exec("ALTER TABLE settings ADD COLUMN misc_production_per_loaf_minutes INTEGER DEFAULT 15");
    log('info', 'Added misc_production_per_loaf_minutes column to settings');
  }

  // Migration: Add pickup_location_id to orders table
  const orderColumns = db.prepare("PRAGMA table_info(orders)").all() as Array<{ name: string }>;
  if (!orderColumns.some(col => col.name === 'pickup_location_id')) {
    db.exec("ALTER TABLE orders ADD COLUMN pickup_location_id TEXT REFERENCES locations(id)");
    log('info', 'Added pickup_location_id column to orders');
  }

  // Migration: Migrate existing bake_slots.location_id to bake_slot_locations junction table
  const existingSlotsWithLocation = db.prepare(`
    SELECT id, location_id FROM bake_slots WHERE location_id IS NOT NULL AND location_id != ''
  `).all() as Array<{ id: string; location_id: string }>;

  for (const slot of existingSlotsWithLocation) {
    // Check if already migrated
    const existing = db.prepare(`
      SELECT COUNT(*) as count FROM bake_slot_locations WHERE bake_slot_id = ? AND location_id = ?
    `).get(slot.id, slot.location_id) as { count: number };

    if (existing.count === 0) {
      const junctionId = `bsl-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
      db.prepare(`
        INSERT INTO bake_slot_locations (id, bake_slot_id, location_id, created_at)
        VALUES (?, ?, ?, ?)
      `).run(junctionId, slot.id, slot.location_id, new Date().toISOString());
      log('info', 'Migrated bake slot location to junction table', { slotId: slot.id, locationId: slot.location_id });
    }
  }

  // Migration: Populate base_unit and density for recipe ingredients that are missing them
  // This ensures cost calculations work correctly for existing recipes
  interface RecipeIngredient {
    ingredient_id?: string;
    name: string;
    quantity: number;
    unit: string;
    base_unit?: string;
    cost_per_unit?: number;
    density_g_per_ml?: number;
    phase?: string;
  }

  const recipesToFix = db.prepare(`
    SELECT id, base_ingredients, fold_ingredients, lamination_ingredients
    FROM recipes
  `).all() as Array<{ id: string; base_ingredients: string; fold_ingredients: string | null; lamination_ingredients: string | null }>;

  // Build a map of ingredient IDs to their units and densities
  const ingredientData = new Map<string, { unit: string; density: number | null }>();
  const libIngredients = db.prepare("SELECT id, unit, density_g_per_ml FROM ingredients").all() as Array<{ id: string; unit: string; density_g_per_ml: number | null }>;
  for (const ing of libIngredients) {
    ingredientData.set(ing.id, { unit: ing.unit, density: ing.density_g_per_ml });
  }

  let recipesUpdated = 0;
  for (const recipe of recipesToFix) {
    let needsUpdate = false;

    const processIngredients = (jsonStr: string | null): string | null => {
      if (!jsonStr) return null;
      try {
        const ingredients = JSON.parse(jsonStr) as RecipeIngredient[];
        let modified = false;
        for (const ing of ingredients) {
          if (ing.ingredient_id) {
            const libData = ingredientData.get(ing.ingredient_id);
            if (libData) {
              // Populate base_unit if missing
              if (!ing.base_unit) {
                ing.base_unit = libData.unit;
                modified = true;
              }
              // Populate density if missing and available
              if (ing.density_g_per_ml === undefined && libData.density !== null) {
                ing.density_g_per_ml = libData.density;
                modified = true;
              }
            }
          }
        }
        if (modified) {
          needsUpdate = true;
          return JSON.stringify(ingredients);
        }
        return jsonStr;
      } catch {
        return jsonStr;
      }
    };

    const newBase = processIngredients(recipe.base_ingredients);
    const newFold = processIngredients(recipe.fold_ingredients);
    const newLamination = processIngredients(recipe.lamination_ingredients);

    if (needsUpdate) {
      db.prepare(`
        UPDATE recipes SET base_ingredients = ?, fold_ingredients = ?, lamination_ingredients = ?, updated_at = ?
        WHERE id = ?
      `).run(newBase, newFold, newLamination, new Date().toISOString(), recipe.id);
      recipesUpdated++;
    }
  }
  if (recipesUpdated > 0) {
    log('info', `Migrated ${recipesUpdated} recipes to include base_unit and density for ingredients`);
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
      // Base ingredients (density in g/ml)
      { name: 'Flour', unit: 'g', package_price: 18.71, package_size: 9072, package_unit: '20lb', vendor: 'Costco', category: 'base', density: 0.53 },
      { name: 'Salt', unit: 'g', package_price: 7.05, package_size: 2116, package_unit: '4.7lb', vendor: 'Costco', category: 'base', density: 1.22 },
      // Sweeteners
      { name: 'Cane Sugar', unit: 'g', package_price: 12.83, package_size: 4536, package_unit: '10lb', vendor: 'Costco', category: 'sweetener', density: 0.85 },
      { name: 'Brown Sugar', unit: 'g', package_price: 4.11, package_size: 680, package_unit: '24oz', vendor: 'Walmart', category: 'sweetener', density: 0.83 },
      { name: 'Maple Syrup', unit: 'g', package_price: 12.00, package_size: 950, package_unit: '32oz', vendor: 'Costco', category: 'sweetener', density: 1.37 },
      // Spices
      { name: 'Cinnamon', unit: 'g', package_price: 5.34, package_size: 303, package_unit: '10.7oz', vendor: 'Costco', category: 'spice', density: 0.53 },
      { name: 'Garlic Powder', unit: 'g', package_price: 9.08, package_size: 624, package_unit: '22oz', vendor: 'Costco', category: 'spice', density: 0.51 },
      { name: 'Cocoa Powder', unit: 'g', package_price: 6.61, package_size: 227, package_unit: '8oz', vendor: 'Walmart', category: 'spice', density: 0.42 },
      { name: 'Ginger', unit: 'g', package_price: 4.67, package_size: 45, package_unit: '1.6oz', vendor: 'Walmart', category: 'spice', density: 0.42 },
      // Misc
      { name: 'Jalapenos (jarred)', unit: 'g', package_price: 2.55, package_size: 340, package_unit: '12oz', vendor: 'Walmart', category: 'misc', density: 0.85 },
      { name: 'Cheddar Cheese', unit: 'g', package_price: 10.87, package_size: 1134, package_unit: '2.5lb', vendor: 'Costco', category: 'misc', density: 0.47 },
      { name: 'Pecans', unit: 'g', package_price: 13.90, package_size: 907, package_unit: '2lb', vendor: 'Costco', category: 'misc', density: 0.42 },
      { name: 'Orange', unit: 'each', package_price: 1.04, package_size: 1, package_unit: '1 each', vendor: 'Walmart', category: 'misc', density: null },
      { name: 'Orange Juice', unit: 'g', package_price: 4.69, package_size: 1361, package_unit: '46oz', vendor: 'Walmart', category: 'misc', density: 1.04 },
      { name: 'Fresh Cranberries', unit: 'g', package_price: 1.04, package_size: 340, package_unit: '12oz', vendor: 'Walmart', category: 'misc', density: 0.42 },
      { name: 'Butter', unit: 'g', package_price: 14.97, package_size: 907, package_unit: '2lb', vendor: 'Costco', category: 'misc', density: 0.91 },
      { name: 'Vanilla Extract', unit: 'tsp', package_price: 10.68, package_size: 96, package_unit: '16oz', vendor: 'Costco', category: 'misc', density: 0.88 },
      { name: 'Chocolate Morsels', unit: 'g', package_price: 16.04, package_size: 2041, package_unit: '72oz', vendor: 'Costco', category: 'misc', density: 0.64 },
      { name: 'Molasses', unit: 'g', package_price: 8.00, package_size: 680, package_unit: '24oz', vendor: 'Azure', category: 'sweetener', density: 1.41 },
    ];

    const insertStmt = db.prepare(`
      INSERT INTO ingredients (id, name, unit, cost_per_unit, package_price, package_size, package_unit, vendor, category, density_g_per_ml, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const ing of seedIngredients) {
      const id = `ing-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
      const costPerUnit = ing.package_price / ing.package_size;
      insertStmt.run(id, ing.name, ing.unit, costPerUnit, ing.package_price, ing.package_size, ing.package_unit, ing.vendor, ing.category, ing.density, now, now);
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
