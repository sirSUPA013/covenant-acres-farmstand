/**
 * Prepare Database for Owner Handoff
 *
 * This script cleans the database for delivery to the bakery owners:
 * - Removes all test orders
 * - Removes all test customers
 * - Removes all extra production entries
 * - Clears audit log
 * - Removes past bake slots (keeps future ones if any)
 * - Keeps: users, flavors, recipes, ingredients, locations, settings
 *
 * Usage: node scripts/prepare-for-handoff.js
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const DB_PATH = path.join(__dirname, '..', 'bakery.db');
const BACKUP_PATH = path.join(__dirname, '..', `bakery-backup-${Date.now()}.db`);

// Check if database exists
if (!fs.existsSync(DB_PATH)) {
  console.error('Database not found at:', DB_PATH);
  console.log('Run the app first to create the database.');
  process.exit(1);
}

// Create backup first
console.log('Creating backup...');
fs.copyFileSync(DB_PATH, BACKUP_PATH);
console.log(`Backup saved to: ${BACKUP_PATH}`);

const db = new Database(DB_PATH);

console.log('\n=== Current Database Stats ===');

// Show current counts
const tables = [
  { name: 'orders', label: 'Orders' },
  { name: 'customers', label: 'Customers' },
  { name: 'extra_production', label: 'Extra Production' },
  { name: 'bake_slots', label: 'Bake Slots' },
  { name: 'audit_log', label: 'Audit Log' },
  { name: 'admin_users', label: 'Admin Users' },
  { name: 'flavors', label: 'Flavors' },
  { name: 'recipes', label: 'Recipes' },
  { name: 'ingredients', label: 'Ingredients' },
  { name: 'locations', label: 'Locations' },
];

tables.forEach(t => {
  try {
    const count = db.prepare(`SELECT COUNT(*) as count FROM ${t.name}`).get();
    console.log(`  ${t.label}: ${count.count}`);
  } catch (e) {
    console.log(`  ${t.label}: (table not found)`);
  }
});

console.log('\n=== Cleaning Database ===');

// Remove test data
console.log('Removing orders...');
db.prepare('DELETE FROM orders').run();

console.log('Removing customers...');
db.prepare('DELETE FROM customers').run();

console.log('Removing extra production entries...');
try {
  db.prepare('DELETE FROM extra_production').run();
} catch (e) {
  console.log('  (table not found, skipping)');
}

console.log('Clearing audit log...');
try {
  db.prepare('DELETE FROM audit_log').run();
} catch (e) {
  console.log('  (table not found, skipping)');
}

console.log('Removing past bake slots...');
const today = new Date().toISOString().split('T')[0];
db.prepare('DELETE FROM bake_slots WHERE date < ?').run(today);

// Also clean up bake_slot_locations for deleted slots
console.log('Cleaning bake slot locations...');
try {
  db.prepare(`
    DELETE FROM bake_slot_locations
    WHERE bake_slot_id NOT IN (SELECT id FROM bake_slots)
  `).run();
} catch (e) {
  console.log('  (table not found, skipping)');
}

// Reset current_orders count on remaining bake slots
console.log('Resetting bake slot order counts...');
db.prepare('UPDATE bake_slots SET current_orders = 0').run();

// Remove developer account, keep only owner accounts
console.log('Cleaning admin users (keeping owners only)...');
const devUsers = db.prepare('SELECT id, name FROM admin_users WHERE is_developer = 1').all();
if (devUsers.length > 0) {
  console.log('  Removing developer accounts:');
  devUsers.forEach(u => console.log(`    - ${u.name}`));
  db.prepare('DELETE FROM admin_users WHERE is_developer = 1').run();
}

// Show remaining users
const remainingUsers = db.prepare('SELECT name, is_owner FROM admin_users WHERE is_active = 1').all();
console.log('  Remaining users:');
remainingUsers.forEach(u => {
  console.log(`    - ${u.name} (${u.is_owner ? 'Owner' : 'Staff'})`);
});

console.log('\n=== Final Database Stats ===');

tables.forEach(t => {
  try {
    const count = db.prepare(`SELECT COUNT(*) as count FROM ${t.name}`).get();
    console.log(`  ${t.label}: ${count.count}`);
  } catch (e) {
    console.log(`  ${t.label}: (table not found)`);
  }
});

// Vacuum to reduce file size
console.log('\nOptimizing database file...');
db.prepare('VACUUM').run();

db.close();

const originalSize = fs.statSync(BACKUP_PATH).size;
const newSize = fs.statSync(DB_PATH).size;

console.log(`\nDatabase size: ${(originalSize / 1024).toFixed(1)} KB → ${(newSize / 1024).toFixed(1)} KB`);
console.log('\n✓ Database prepared for handoff!');
console.log(`\nBackup location: ${BACKUP_PATH}`);
console.log('You can delete the backup after verifying the cleaned database.');
