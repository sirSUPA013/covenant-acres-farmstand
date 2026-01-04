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

    -- Indexes
    CREATE INDEX IF NOT EXISTS idx_orders_bake_slot ON orders(bake_slot_id);
    CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
    CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
    CREATE INDEX IF NOT EXISTS idx_bake_slots_date ON bake_slots(date);
    CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
  `);

  log('info', 'Database tables created/verified');
}

export function closeDatabase(): void {
  if (db) {
    db.close();
    db = null;
  }
}
