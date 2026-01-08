/**
 * IPC Handlers
 * Handles communication between main and renderer processes
 */

import { ipcMain, shell, app } from 'electron';
import crypto from 'crypto';
import { getDb } from './database';
import { syncAll, getSyncStatus, signIn, signOut, isAuthenticated, setConfig } from './sheets-sync';
import { log, createErrorReport, getLogPath } from './logger';
import { UserPermissions, UserRole, parsePermissions, getUserRole, FULL_PERMISSIONS, DEFAULT_PERMISSIONS } from '../shared/permissions';

// Simple hash function for PINs
function hashPin(pin: string): string {
  return crypto.createHash('sha256').update(pin).digest('hex');
}

// Check if a PIN is already in use (excludeId allows updating own PIN)
function isPinTaken(pin: string, excludeId?: string): boolean {
  const db = getDb();
  const pinHash = hashPin(pin);
  const query = excludeId
    ? 'SELECT COUNT(*) as count FROM admin_users WHERE pin_hash = ? AND id != ? AND is_active = 1'
    : 'SELECT COUNT(*) as count FROM admin_users WHERE pin_hash = ? AND is_active = 1';
  const params = excludeId ? [pinHash, excludeId] : [pinHash];
  const result = db.prepare(query).get(...params) as { count: number };
  return result.count > 0;
}

// Current logged-in user (in-memory session)
let currentUser: {
  id: string;
  name: string;
  role: UserRole;
  isDeveloper: boolean;
  isOwner: boolean;
  permissions: UserPermissions;
} | null = null;

export function getCurrentUser() {
  return currentUser;
}

// Field whitelists for SQL UPDATE operations (prevents SQL injection via field names)
const ALLOWED_ORDER_FIELDS = new Set([
  'status', 'payment_status', 'payment_method', 'admin_notes', 'credit_applied',
  'total_amount', 'bake_slot_id', 'items', 'pickup_location_id'
]);

const ALLOWED_CUSTOMER_FIELDS = new Set([
  'first_name', 'last_name', 'email', 'phone', 'notes', 'credit_balance', 'sms_opt_in'
]);

const ALLOWED_BAKE_SLOT_FIELDS = new Set([
  'date', 'total_capacity', 'current_orders', 'is_published', 'notes', 'location_id'
]);

const ALLOWED_LOCATION_FIELDS = new Set([
  'name', 'address', 'description', 'is_active', 'sort_order'
]);

// Recipe fields use camelCase in API but snake_case in DB
const ALLOWED_RECIPE_FIELDS = new Set([
  'name', 'flavorId', 'baseIngredients', 'foldIngredients', 'laminationIngredients',
  'steps', 'yieldsLoaves', 'loafSize', 'notes', 'season', 'source'
]);

// Helper to filter and validate fields for UPDATE operations
function filterAllowedFields(data: Record<string, unknown>, allowedFields: Set<string>): {
  fields: string[];
  values: unknown[];
} {
  const fields: string[] = [];
  const values: unknown[] = [];

  for (const [key, value] of Object.entries(data)) {
    if (allowedFields.has(key)) {
      fields.push(key);
      values.push(value);
    }
  }

  return { fields, values };
}

export function logAudit(action: string, entityType?: string | null, entityId?: string | null, details?: string) {
  const db = getDb();
  db.prepare(`
    INSERT INTO audit_log (user_id, user_name, action, entity_type, entity_id, details, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    currentUser?.id || null,
    currentUser?.name || 'System',
    action,
    entityType || null,
    entityId || null,
    details || null,
    new Date().toISOString()
  );
}

export function setupIpcHandlers(): void {
  // Orders
  ipcMain.handle('orders:getAll', async (_event, filters) => {
    const db = getDb();
    let query = `
      SELECT o.*, c.first_name, c.last_name, c.email, c.phone,
             b.date as bake_date,
             COALESCE(pl.name, l.name) as location_name
      FROM orders o
      LEFT JOIN customers c ON o.customer_id = c.id
      LEFT JOIN bake_slots b ON o.bake_slot_id = b.id
      LEFT JOIN locations l ON b.location_id = l.id
      LEFT JOIN locations pl ON o.pickup_location_id = pl.id
      WHERE 1=1
    `;
    const params: unknown[] = [];

    if (filters?.status) {
      query += ' AND o.status = ?';
      params.push(filters.status);
    }
    if (filters?.bakeSlotId) {
      query += ' AND o.bake_slot_id = ?';
      params.push(filters.bakeSlotId);
    }
    if (filters?.dateFrom) {
      query += ' AND b.date >= ?';
      params.push(filters.dateFrom);
    }
    if (filters?.dateTo) {
      query += ' AND b.date <= ?';
      params.push(filters.dateTo);
    }

    query += ' ORDER BY o.created_at DESC';

    return db.prepare(query).all(...params);
  });

  ipcMain.handle('orders:get', async (_event, id) => {
    const db = getDb();
    return db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  });

  ipcMain.handle('orders:update', async (_event, id, data) => {
    const db = getDb();

    // Check if status is changing - need to adjust bake_slots.current_orders
    if (data.status) {
      const order = db.prepare('SELECT status, bake_slot_id, items FROM orders WHERE id = ?').get(id) as {
        status: string;
        bake_slot_id: string;
        items: string;
      } | undefined;

      if (order && order.status !== data.status) {
        // Calculate total loaves in order
        let loafCount = 0;
        try {
          const items = JSON.parse(order.items) as Array<{ quantity: number }>;
          loafCount = items.reduce((sum, item) => sum + (item.quantity || 0), 0);
        } catch {
          loafCount = 1; // Fallback
        }

        // If canceling, decrement current_orders
        if (data.status === 'canceled' && order.status !== 'canceled') {
          db.prepare(
            'UPDATE bake_slots SET current_orders = MAX(0, current_orders - ?) WHERE id = ?'
          ).run(loafCount, order.bake_slot_id);
          log('info', 'Decremented bake slot count for canceled order', {
            orderId: id,
            bakeSlotId: order.bake_slot_id,
            loafCount,
          });
        }
        // If un-canceling, increment current_orders
        else if (order.status === 'canceled' && data.status !== 'canceled') {
          db.prepare(
            'UPDATE bake_slots SET current_orders = current_orders + ? WHERE id = ?'
          ).run(loafCount, order.bake_slot_id);
          log('info', 'Incremented bake slot count for un-canceled order', {
            orderId: id,
            bakeSlotId: order.bake_slot_id,
            loafCount,
          });
        }
      }
    }

    const { fields, values } = filterAllowedFields(data, ALLOWED_ORDER_FIELDS);
    if (fields.length === 0) {
      log('warn', 'Order update attempted with no valid fields', { id, attempted: Object.keys(data) });
      return;
    }
    const fieldsSql = fields.map((k) => `${k} = ?`).join(', ');

    db.prepare(`UPDATE orders SET ${fieldsSql}, updated_at = ? WHERE id = ?`).run(...values, new Date().toISOString(), id);
    log('info', 'Order updated', { id, changes: fields });
  });

  ipcMain.handle('orders:bulkUpdate', async (_event, ids: string[], data) => {
    const db = getDb();
    const { fields, values } = filterAllowedFields(data, ALLOWED_ORDER_FIELDS);
    if (fields.length === 0) {
      log('warn', 'Bulk order update attempted with no valid fields', { attempted: Object.keys(data) });
      return;
    }
    const fieldsSql = fields.map((k) => `${k} = ?`).join(', ');
    const now = new Date().toISOString();

    const stmt = db.prepare(`UPDATE orders SET ${fieldsSql}, updated_at = ? WHERE id = ?`);
    const updateMany = db.transaction((orderIds: string[]) => {
      for (const id of orderIds) {
        // If status is changing, adjust bake_slots.current_orders
        if (data.status) {
          const order = db.prepare('SELECT status, bake_slot_id, items FROM orders WHERE id = ?').get(id) as {
            status: string;
            bake_slot_id: string;
            items: string;
          } | undefined;

          if (order && order.status !== data.status) {
            let loafCount = 0;
            try {
              const items = JSON.parse(order.items) as Array<{ quantity: number }>;
              loafCount = items.reduce((sum, item) => sum + (item.quantity || 0), 0);
            } catch {
              loafCount = 1;
            }

            if (data.status === 'canceled' && order.status !== 'canceled') {
              db.prepare(
                'UPDATE bake_slots SET current_orders = MAX(0, current_orders - ?) WHERE id = ?'
              ).run(loafCount, order.bake_slot_id);
            } else if (order.status === 'canceled' && data.status !== 'canceled') {
              db.prepare(
                'UPDATE bake_slots SET current_orders = current_orders + ? WHERE id = ?'
              ).run(loafCount, order.bake_slot_id);
            }
          }
        }

        stmt.run(...values, now, id);
      }
    });

    updateMany(ids);
    log('info', 'Bulk order update', { count: ids.length, changes: fields });
  });

  // Customers
  ipcMain.handle('customers:getAll', async (_event, filters) => {
    const db = getDb();
    let query = 'SELECT * FROM customers WHERE 1=1';
    const params: unknown[] = [];

    if (filters?.search) {
      query += ' AND (first_name LIKE ? OR last_name LIKE ? OR email LIKE ? OR phone LIKE ?)';
      const term = `%${filters.search}%`;
      params.push(term, term, term, term);
    }

    query += ' ORDER BY last_name, first_name';

    return db.prepare(query).all(...params);
  });

  ipcMain.handle('customers:get', async (_event, id) => {
    const db = getDb();
    return db.prepare('SELECT * FROM customers WHERE id = ?').get(id);
  });

  ipcMain.handle('customers:update', async (_event, id, data) => {
    const db = getDb();
    const { fields, values } = filterAllowedFields(data, ALLOWED_CUSTOMER_FIELDS);
    if (fields.length === 0) {
      log('warn', 'Customer update attempted with no valid fields', { id, attempted: Object.keys(data) });
      return;
    }
    const fieldsSql = fields.map((k) => `${k} = ?`).join(', ');

    db.prepare(`UPDATE customers SET ${fieldsSql}, updated_at = ? WHERE id = ?`).run(...values, new Date().toISOString(), id);
    log('info', 'Customer updated', { id, changes: fields });
  });

  ipcMain.handle('customers:issueCredit', async (_event, id, amount, reason) => {
    const db = getDb();
    const now = new Date().toISOString();

    db.prepare(
      `UPDATE customers SET credit_balance = credit_balance + ?, updated_at = ? WHERE id = ?`
    ).run(amount, now, id);

    log('info', 'Credit issued', { customerId: id, amount, reason });
  });

  // Bake Slots
  ipcMain.handle('bakeSlots:getAll', async (_event, filters) => {
    const db = getDb();
    let query = `
      SELECT b.*
      FROM bake_slots b
      WHERE 1=1
    `;
    const params: unknown[] = [];

    if (filters?.upcoming) {
      query += " AND b.date >= date('now')";
    }
    if (filters?.locationId) {
      // Filter by location using junction table
      query += ` AND b.id IN (
        SELECT bake_slot_id FROM bake_slot_locations WHERE location_id = ?
      )`;
      params.push(filters.locationId);
    }

    query += ' ORDER BY b.date ASC';

    const slots = db.prepare(query).all(...params) as Array<Record<string, unknown>>;

    // For each slot, get its locations from the junction table
    const getLocationsStmt = db.prepare(`
      SELECT l.id, l.name
      FROM bake_slot_locations bsl
      JOIN locations l ON bsl.location_id = l.id
      WHERE bsl.bake_slot_id = ?
      ORDER BY l.name
    `);

    return slots.map(slot => {
      const locations = getLocationsStmt.all(slot.id) as Array<{ id: string; name: string }>;
      return {
        ...slot,
        locations,
        // For backward compatibility, also include first location as location_name
        location_name: locations.length > 0 ? locations.map(l => l.name).join(', ') : 'No locations',
      };
    });
  });

  // Get bake slots available at a specific location (for order form)
  ipcMain.handle('bakeSlots:getByLocation', async (_event, locationId: string) => {
    const db = getDb();
    const slots = db.prepare(`
      SELECT b.*
      FROM bake_slots b
      JOIN bake_slot_locations bsl ON b.id = bsl.bake_slot_id
      WHERE bsl.location_id = ?
        AND b.is_open = 1
        AND b.date >= date('now')
        AND (b.cutoff_time IS NULL OR b.cutoff_time >= datetime('now'))
      ORDER BY b.date ASC
    `).all(locationId) as Array<Record<string, unknown>>;

    return slots.map(slot => {
      const total = (slot.total_capacity as number) || 0;
      const current = (slot.current_orders as number) || 0;
      return {
        id: slot.id,
        date: slot.date,
        spotsRemaining: Math.max(0, total - current),
        isOpen: total - current > 0,
      };
    });
  });

  ipcMain.handle('bakeSlots:create', async (_event, data) => {
    const db = getDb();
    const id = `slot-${Date.now().toString(36)}`;
    const now = new Date().toISOString();

    // Create the bake slot (location_id kept for backward compatibility but can be null)
    const firstLocationId = data.locationIds?.[0] || data.locationId || null;
    db.prepare(
      `INSERT INTO bake_slots (id, date, location_id, total_capacity, cutoff_time, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(id, data.date, firstLocationId, data.totalCapacity, data.cutoffTime, now, now);

    // Insert location associations into junction table
    const locationIds = data.locationIds || (data.locationId ? [data.locationId] : []);
    const insertLocationStmt = db.prepare(`
      INSERT INTO bake_slot_locations (id, bake_slot_id, location_id, created_at)
      VALUES (?, ?, ?, ?)
    `);

    for (const locationId of locationIds) {
      const junctionId = `bsl-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
      insertLocationStmt.run(junctionId, id, locationId, now);
    }

    log('info', 'Bake slot created', { id, date: data.date, locationCount: locationIds.length });
    return id;
  });

  ipcMain.handle('bakeSlots:update', async (_event, id, data) => {
    const db = getDb();
    const now = new Date().toISOString();

    // Handle locationIds separately if provided
    if (data.locationIds) {
      // Remove existing location associations
      db.prepare('DELETE FROM bake_slot_locations WHERE bake_slot_id = ?').run(id);

      // Insert new location associations
      const insertLocationStmt = db.prepare(`
        INSERT INTO bake_slot_locations (id, bake_slot_id, location_id, created_at)
        VALUES (?, ?, ?, ?)
      `);

      for (const locationId of data.locationIds) {
        const junctionId = `bsl-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
        insertLocationStmt.run(junctionId, id, locationId, now);
      }

      // Update legacy location_id field for backward compatibility
      if (data.locationIds.length > 0) {
        db.prepare('UPDATE bake_slots SET location_id = ? WHERE id = ?').run(data.locationIds[0], id);
      }

      // Remove locationIds from data so it's not included in the UPDATE below
      delete data.locationIds;
    }

    // Update other fields if any remain (with field whitelist for security)
    const { fields, values } = filterAllowedFields(data, ALLOWED_BAKE_SLOT_FIELDS);
    if (fields.length > 0) {
      const fieldsSql = fields.map((k) => `${k} = ?`).join(', ');
      db.prepare(`UPDATE bake_slots SET ${fieldsSql}, updated_at = ? WHERE id = ?`).run(...values, now, id);
    }

    log('info', 'Bake slot updated', { id, changes: fields });
  });

  ipcMain.handle('bakeSlots:delete', async (_event, id) => {
    const db = getDb();
    // Junction table entries will be deleted automatically due to ON DELETE CASCADE
    db.prepare('DELETE FROM bake_slots WHERE id = ?').run(id);
    log('info', 'Bake slot deleted', { id });
  });

  // Flavors
  ipcMain.handle('flavors:getAll', async () => {
    const db = getDb();
    return db.prepare('SELECT * FROM flavors ORDER BY sort_order, name').all();
  });

  ipcMain.handle('flavors:create', async (_event, data) => {
    const db = getDb();
    const flavorId = `flav-${Date.now().toString(36)}`;
    const recipeId = `rec-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
    const now = new Date().toISOString();

    // Create the blank recipe first
    db.prepare(
      `INSERT INTO recipes (id, name, flavor_id, base_ingredients, fold_ingredients, lamination_ingredients, steps, yields_loaves, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      recipeId,
      `${data.name} Recipe`,
      flavorId,
      '[]',
      '[]',
      '[]',
      '[]',
      1,
      now,
      now
    );

    // Create the flavor with recipe_id
    db.prepare(
      `INSERT INTO flavors (id, name, description, sizes, recipe_id, is_active, season, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      flavorId,
      data.name,
      data.description || '',
      JSON.stringify(data.sizes || [{ name: 'Regular', price: 10 }]),
      recipeId,
      data.isActive !== false ? 1 : 0,
      data.season || 'year_round',
      data.sortOrder || 0,
      now,
      now
    );

    log('info', 'Flavor created with recipe', { flavorId, recipeId, name: data.name });
    return { id: flavorId, recipeId };
  });

  ipcMain.handle('flavors:update', async (_event, id, data) => {
    const db = getDb();
    const updates: string[] = [];
    const values: unknown[] = [];

    Object.entries(data).forEach(([key, value]) => {
      if (key === 'sizes') {
        updates.push('sizes = ?');
        values.push(JSON.stringify(value));
      } else if (key === 'isActive') {
        updates.push('is_active = ?');
        values.push(value ? 1 : 0);
      } else {
        updates.push(`${key} = ?`);
        values.push(value);
      }
    });

    values.push(new Date().toISOString(), id);
    db.prepare(`UPDATE flavors SET ${updates.join(', ')}, updated_at = ? WHERE id = ?`).run(
      ...values
    );
    log('info', 'Flavor updated', { id });
  });

  ipcMain.handle('flavors:get', async (_event, id) => {
    const db = getDb();
    return db.prepare('SELECT * FROM flavors WHERE id = ?').get(id);
  });

  ipcMain.handle('flavors:delete', async (_event, id) => {
    const db = getDb();
    // Get the flavor to find its recipe_id
    const flavor = db.prepare('SELECT recipe_id FROM flavors WHERE id = ?').get(id) as { recipe_id: string } | undefined;

    // Delete the flavor
    db.prepare('DELETE FROM flavors WHERE id = ?').run(id);

    // Delete the associated recipe if it exists
    if (flavor?.recipe_id) {
      db.prepare('DELETE FROM recipes WHERE id = ?').run(flavor.recipe_id);
      log('info', 'Flavor and recipe deleted', { flavorId: id, recipeId: flavor.recipe_id });
    } else {
      log('info', 'Flavor deleted', { id });
    }
  });

  ipcMain.handle('flavors:duplicate', async (_event, id) => {
    const db = getDb();
    const now = new Date().toISOString();

    // Get the source flavor
    const sourceFlavor = db.prepare('SELECT * FROM flavors WHERE id = ?').get(id) as Record<string, unknown> | undefined;
    if (!sourceFlavor) {
      return { success: false, error: 'Flavor not found' };
    }

    // Generate new IDs
    const newFlavorId = `flav-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
    const newRecipeId = `rec-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;

    // Generate unique name
    let baseName = `${sourceFlavor.name} (Copy)`;
    let copyNum = 1;
    while (db.prepare('SELECT COUNT(*) as count FROM flavors WHERE name = ?').get(baseName) as { count: number }) {
      if ((db.prepare('SELECT COUNT(*) as count FROM flavors WHERE name = ?').get(baseName) as { count: number }).count === 0) break;
      copyNum++;
      baseName = `${sourceFlavor.name} (Copy ${copyNum})`;
    }

    // Get and duplicate the recipe if it exists
    if (sourceFlavor.recipe_id) {
      const sourceRecipe = db.prepare('SELECT * FROM recipes WHERE id = ?').get(sourceFlavor.recipe_id as string) as Record<string, unknown> | undefined;
      if (sourceRecipe) {
        db.prepare(`
          INSERT INTO recipes (id, name, flavor_id, base_ingredients, fold_ingredients, lamination_ingredients,
            steps, yields_loaves, loaf_size, total_cost, cost_per_loaf, notes, season, source,
            prep_time_minutes, bake_time_minutes, bake_temp, prep_instructions, bake_instructions,
            created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          newRecipeId,
          `${baseName} Recipe`,
          newFlavorId,
          sourceRecipe.base_ingredients || '[]',
          sourceRecipe.fold_ingredients || '[]',
          sourceRecipe.lamination_ingredients || '[]',
          sourceRecipe.steps || '[]',
          sourceRecipe.yields_loaves || 1,
          sourceRecipe.loaf_size || '',
          sourceRecipe.total_cost || null,
          sourceRecipe.cost_per_loaf || null,
          sourceRecipe.notes || '',
          sourceRecipe.season || null,
          sourceRecipe.source || null,
          sourceRecipe.prep_time_minutes || null,
          sourceRecipe.bake_time_minutes || null,
          sourceRecipe.bake_temp || null,
          sourceRecipe.prep_instructions || null,
          sourceRecipe.bake_instructions || null,
          now,
          now
        );
      }
    }

    // Create the new flavor
    db.prepare(`
      INSERT INTO flavors (id, name, description, sizes, recipe_id, is_active, season, sort_order, image_url, estimated_cost, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      newFlavorId,
      baseName,
      sourceFlavor.description || '',
      sourceFlavor.sizes || '[]',
      sourceFlavor.recipe_id ? newRecipeId : null,
      sourceFlavor.is_active,
      sourceFlavor.season || 'year_round',
      (sourceFlavor.sort_order as number || 0) + 1,
      sourceFlavor.image_url || null,
      sourceFlavor.estimated_cost || null,
      now,
      now
    );

    logAudit('FLAVOR_DUPLICATED', 'flavors', newFlavorId, `Duplicated from ${sourceFlavor.name}`);
    log('info', 'Flavor duplicated', { sourceId: id, newFlavorId, newRecipeId, name: baseName });

    return { success: true, id: newFlavorId, name: baseName };
  });

  // Locations
  ipcMain.handle('locations:getAll', async () => {
    const db = getDb();
    return db.prepare('SELECT * FROM locations ORDER BY sort_order, name').all();
  });

  ipcMain.handle('locations:create', async (_event, data) => {
    const db = getDb();
    const id = `loc-${Date.now().toString(36)}`;
    const now = new Date().toISOString();

    db.prepare(
      `INSERT INTO locations (id, name, address, description, is_active, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(id, data.name, data.address || '', data.description || '', 1, data.sortOrder || 0, now, now);

    log('info', 'Location created', { id, name: data.name });
    return id;
  });

  ipcMain.handle('locations:update', async (_event, id, data) => {
    const db = getDb();
    const { fields, values } = filterAllowedFields(data, ALLOWED_LOCATION_FIELDS);
    if (fields.length === 0) {
      log('warn', 'Location update attempted with no valid fields', { id, attempted: Object.keys(data) });
      return;
    }
    const fieldsSql = fields.map((k) => `${k} = ?`).join(', ');

    db.prepare(`UPDATE locations SET ${fieldsSql}, updated_at = ? WHERE id = ?`).run(...values, new Date().toISOString(), id);
    log('info', 'Location updated', { id, changes: fields });
  });

  ipcMain.handle('locations:delete', async (_event, id) => {
    const db = getDb();
    db.prepare('DELETE FROM locations WHERE id = ?').run(id);
    log('info', 'Location deleted', { id });
  });

  // Recipes
  ipcMain.handle('recipes:getAll', async () => {
    const db = getDb();
    return db
      .prepare(
        `
      SELECT r.*, f.name as flavor_name
      FROM recipes r
      LEFT JOIN flavors f ON r.flavor_id = f.id OR f.recipe_id = r.id
      ORDER BY r.name
    `
      )
      .all();
  });

  ipcMain.handle('recipes:get', async (_event, id) => {
    const db = getDb();
    return db.prepare('SELECT * FROM recipes WHERE id = ?').get(id);
  });

  ipcMain.handle('recipes:create', async (_event, data) => {
    const db = getDb();
    const id = `rec-${Date.now().toString(36)}`;
    const now = new Date().toISOString();

    db.prepare(
      `INSERT INTO recipes (id, name, flavor_id, base_ingredients, fold_ingredients, lamination_ingredients,
       steps, yields_loaves, loaf_size, notes, season, source, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      data.name,
      data.flavorId || null,
      JSON.stringify(data.baseIngredients),
      JSON.stringify(data.foldIngredients || []),
      JSON.stringify(data.laminationIngredients || []),
      JSON.stringify(data.steps),
      data.yieldsLoaves || 1,
      data.loafSize || '',
      data.notes || '',
      data.season || null,
      data.source || null,
      now,
      now
    );

    log('info', 'Recipe created', { id, name: data.name });
    return id;
  });

  ipcMain.handle('recipes:update', async (_event, id, data) => {
    const db = getDb();
    const updates: string[] = [];
    const values: unknown[] = [];
    const JSON_FIELDS = ['baseIngredients', 'foldIngredients', 'laminationIngredients', 'steps'];

    // Filter to only allowed fields for security
    Object.entries(data).forEach(([key, value]) => {
      if (!ALLOWED_RECIPE_FIELDS.has(key)) {
        log('warn', 'Recipe update attempted with disallowed field', { id, field: key });
        return;
      }
      const dbField = key.replace(/([A-Z])/g, '_$1').toLowerCase();
      if (JSON_FIELDS.includes(key)) {
        updates.push(`${dbField} = ?`);
        values.push(JSON.stringify(value));
      } else {
        updates.push(`${dbField} = ?`);
        values.push(value);
      }
    });

    if (updates.length === 0) {
      log('warn', 'Recipe update attempted with no valid fields', { id, attempted: Object.keys(data) });
      return;
    }

    values.push(new Date().toISOString(), id);
    db.prepare(`UPDATE recipes SET ${updates.join(', ')}, updated_at = ? WHERE id = ?`).run(
      ...values
    );
    log('info', 'Recipe updated', { id, changes: updates.length });
  });

  ipcMain.handle('recipes:delete', async (_event, id) => {
    const db = getDb();
    db.prepare('DELETE FROM recipes WHERE id = ?').run(id);
    log('info', 'Recipe deleted', { id });
  });

  // Overhead Settings
  ipcMain.handle('overhead:get', async () => {
    const db = getDb();
    return db.prepare('SELECT * FROM overhead_settings WHERE id = 1').get();
  });

  ipcMain.handle('overhead:update', async (_event, data) => {
    const db = getDb();
    db.prepare(`
      UPDATE overhead_settings
      SET packaging_per_loaf = ?, utilities_per_loaf = ?, updated_at = ?
      WHERE id = 1
    `).run(data.packagingPerLoaf, data.utilitiesPerLoaf, new Date().toISOString());
    log('info', 'Overhead settings updated', data);
  });

  // Ingredients Library
  ipcMain.handle('ingredients:getAll', async () => {
    const db = getDb();
    return db.prepare('SELECT * FROM ingredients ORDER BY category, name').all();
  });

  ipcMain.handle('ingredients:get', async (_event, id) => {
    const db = getDb();
    return db.prepare('SELECT * FROM ingredients WHERE id = ?').get(id);
  });

  ipcMain.handle('ingredients:create', async (_event, data) => {
    const db = getDb();

    // Validate package size to prevent division by zero
    if (!data.packageSize || data.packageSize <= 0) {
      log('error', 'Ingredient creation failed: invalid package size', { packageSize: data.packageSize });
      throw new Error('Package size must be greater than zero');
    }

    const id = `ing-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
    const now = new Date().toISOString();
    const costPerUnit = data.packagePrice / data.packageSize;

    db.prepare(`
      INSERT INTO ingredients (id, name, unit, cost_per_unit, package_price, package_size, package_unit, vendor, category, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, data.name, data.unit, costPerUnit, data.packagePrice, data.packageSize, data.packageUnit || null, data.vendor || null, data.category || null, now, now);

    log('info', 'Ingredient created', { id, name: data.name });
    return { id };
  });

  ipcMain.handle('ingredients:update', async (_event, id, data) => {
    const db = getDb();

    // Validate package size to prevent division by zero
    if (!data.packageSize || data.packageSize <= 0) {
      log('error', 'Ingredient update failed: invalid package size', { id, packageSize: data.packageSize });
      throw new Error('Package size must be greater than zero');
    }

    const costPerUnit = data.packagePrice / data.packageSize;

    db.prepare(`
      UPDATE ingredients
      SET name = ?, unit = ?, cost_per_unit = ?, package_price = ?, package_size = ?,
          package_unit = ?, vendor = ?, category = ?, updated_at = ?
      WHERE id = ?
    `).run(data.name, data.unit, costPerUnit, data.packagePrice, data.packageSize, data.packageUnit || null, data.vendor || null, data.category || null, new Date().toISOString(), id);

    log('info', 'Ingredient updated', { id, name: data.name });
  });

  ipcMain.handle('ingredients:delete', async (_event, id) => {
    const db = getDb();
    db.prepare('DELETE FROM ingredients WHERE id = ?').run(id);
    log('info', 'Ingredient deleted', { id });
  });

  // Profit Analytics
  ipcMain.handle('analytics:profitByFlavor', async () => {
    const db = getDb();
    const overhead = db.prepare('SELECT * FROM overhead_settings WHERE id = 1').get() as { packaging_per_loaf: number; utilities_per_loaf: number } | undefined;
    const overheadPerLoaf = (overhead?.packaging_per_loaf || 0) + (overhead?.utilities_per_loaf || 0);

    // Get flavors with their prices and costs
    const flavors = db.prepare(`
      SELECT f.id, f.name, f.sizes, f.estimated_cost,
             r.cost_per_loaf as recipe_cost
      FROM flavors f
      LEFT JOIN recipes r ON f.recipe_id = r.id
      WHERE f.is_active = 1
      ORDER BY f.name
    `).all() as Array<{
      id: string;
      name: string;
      sizes: string;
      estimated_cost: number | null;
      recipe_cost: number | null;
    }>;

    return flavors.map(f => {
      const sizes = JSON.parse(f.sizes || '[]') as Array<{ name: string; price: number }>;
      const price = sizes[0]?.price || 0;
      const cost = f.estimated_cost || f.recipe_cost || 0;
      const totalCost = cost + overheadPerLoaf;
      const profit = price - totalCost;
      const margin = price > 0 ? (profit / price) * 100 : 0;

      return {
        id: f.id,
        name: f.name,
        price,
        cost: totalCost,
        profit,
        margin,
      };
    });
  });

  ipcMain.handle('analytics:profitByBakeSlot', async (_event, filters) => {
    const db = getDb();
    const overhead = db.prepare('SELECT * FROM overhead_settings WHERE id = 1').get() as { packaging_per_loaf: number; utilities_per_loaf: number } | undefined;
    const overheadPerLoaf = (overhead?.packaging_per_loaf || 0) + (overhead?.utilities_per_loaf || 0);

    // Get flavor costs map
    const flavorCosts = new Map<string, number>();
    const flavors = db.prepare('SELECT id, estimated_cost FROM flavors').all() as Array<{ id: string; estimated_cost: number | null }>;
    flavors.forEach(f => {
      flavorCosts.set(f.id, (f.estimated_cost || 0) + overheadPerLoaf);
    });

    // Build query
    let query = `
      SELECT b.id, b.date, l.name as location_name,
             GROUP_CONCAT(o.id) as order_ids,
             GROUP_CONCAT(o.items) as all_items,
             SUM(o.total_amount) as revenue
      FROM bake_slots b
      LEFT JOIN locations l ON b.location_id = l.id
      LEFT JOIN orders o ON o.bake_slot_id = b.id AND o.status NOT IN ('canceled', 'no_show') AND o.payment_status = 'paid'
      WHERE 1=1
    `;
    const params: unknown[] = [];

    if (filters?.dateFrom) {
      query += ' AND b.date >= ?';
      params.push(filters.dateFrom);
    }
    if (filters?.dateTo) {
      query += ' AND b.date <= ?';
      params.push(filters.dateTo);
    }

    query += ' GROUP BY b.id ORDER BY b.date DESC';

    const slots = db.prepare(query).all(...params) as Array<{
      id: string;
      date: string;
      location_name: string;
      order_ids: string | null;
      all_items: string | null;
      revenue: number | null;
    }>;

    return slots.map(slot => {
      let totalLoaves = 0;
      let totalCogs = 0;

      if (slot.all_items) {
        // Parse all order items and calculate COGS
        const itemsArrays = slot.all_items.split(',').filter(Boolean);
        itemsArrays.forEach(itemsJson => {
          try {
            const items = JSON.parse(itemsJson) as Array<{ flavorId: string; quantity: number }>;
            items.forEach(item => {
              const flavorCost = flavorCosts.get(item.flavorId) || 0;
              totalLoaves += item.quantity;
              totalCogs += flavorCost * item.quantity;
            });
          } catch {
            // Skip malformed items
          }
        });
      }

      const revenue = slot.revenue || 0;
      const profit = revenue - totalCogs;

      return {
        id: slot.id,
        date: slot.date,
        locationName: slot.location_name,
        loaves: totalLoaves,
        revenue,
        cogs: totalCogs,
        profit,
      };
    });
  });

  // Profit per hour calculation
  ipcMain.handle('analytics:profitPerHour', async (_event, filters) => {
    const db = getDb();

    // Get time settings
    const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get() as {
      bake_day_setup_minutes: number | null;
      bake_day_per_loaf_minutes: number | null;
      bake_day_cleanup_minutes: number | null;
      misc_production_per_loaf_minutes: number | null;
    } | undefined;

    const bakeDaySetup = settings?.bake_day_setup_minutes ?? 60;
    const bakeDayPerLoaf = settings?.bake_day_per_loaf_minutes ?? 8;
    const bakeDayCleanup = settings?.bake_day_cleanup_minutes ?? 45;
    const miscPerLoaf = settings?.misc_production_per_loaf_minutes ?? 15;

    // Get overhead costs
    const overhead = db.prepare('SELECT * FROM overhead_settings WHERE id = 1').get() as { packaging_per_loaf: number; utilities_per_loaf: number } | undefined;
    const overheadPerLoaf = (overhead?.packaging_per_loaf || 0) + (overhead?.utilities_per_loaf || 0);

    // Get flavor costs
    const flavorCosts = new Map<string, number>();
    const flavors = db.prepare('SELECT id, estimated_cost FROM flavors').all() as Array<{ id: string; estimated_cost: number | null }>;
    flavors.forEach(f => {
      flavorCosts.set(f.id, (f.estimated_cost || 0) + overheadPerLoaf);
    });

    // Build date filter
    let dateFilter = '';
    const params: unknown[] = [];
    if (filters?.startDate) {
      dateFilter += ' AND b.date >= ?';
      params.push(filters.startDate);
    }
    if (filters?.endDate) {
      dateFilter += ' AND b.date <= ?';
      params.push(filters.endDate);
    }

    // Get bake slots with orders
    const bakeSlots = db.prepare(`
      SELECT b.id, b.date, COUNT(DISTINCT o.id) as order_count,
             GROUP_CONCAT(o.items) as all_items,
             SUM(o.total_amount) as revenue
      FROM bake_slots b
      LEFT JOIN orders o ON o.bake_slot_id = b.id AND o.status NOT IN ('canceled', 'no_show') AND o.payment_status = 'paid'
      WHERE 1=1 ${dateFilter}
      GROUP BY b.id
      HAVING order_count > 0
    `).all(...params) as Array<{
      id: string;
      date: string;
      order_count: number;
      all_items: string | null;
      revenue: number | null;
    }>;

    let totalBakeSlots = bakeSlots.length;
    let totalBakeSlotLoaves = 0;
    let totalBakeSlotRevenue = 0;
    let totalBakeSlotCogs = 0;

    for (const slot of bakeSlots) {
      totalBakeSlotRevenue += slot.revenue || 0;
      if (slot.all_items) {
        const itemsArrays = slot.all_items.split(',').filter(Boolean);
        itemsArrays.forEach(itemsJson => {
          try {
            const items = JSON.parse(itemsJson) as Array<{ flavorId: string; quantity: number }>;
            items.forEach(item => {
              totalBakeSlotLoaves += item.quantity;
              totalBakeSlotCogs += (flavorCosts.get(item.flavorId) || 0) * item.quantity;
            });
          } catch { /* skip */ }
        });
      }
    }

    // Get extra production (misc batches)
    let extraDateFilter = '';
    const extraParams: unknown[] = [];
    if (filters?.startDate) {
      extraDateFilter += ' AND production_date >= ?';
      extraParams.push(filters.startDate);
    }
    if (filters?.endDate) {
      extraDateFilter += ' AND production_date <= ?';
      extraParams.push(filters.endDate);
    }

    const extraProduction = db.prepare(`
      SELECT ep.disposition, ep.flavor_id, SUM(ep.quantity) as total_qty, SUM(ep.total_revenue) as revenue
      FROM extra_production ep
      WHERE 1=1 ${extraDateFilter}
      GROUP BY ep.disposition, ep.flavor_id
    `).all(...extraParams) as Array<{
      disposition: string;
      flavor_id: string;
      total_qty: number;
      revenue: number | null;
    }>;

    let extraLoaves = 0;
    let extraRevenue = 0;
    let extraCogs = 0;

    for (const row of extraProduction) {
      extraLoaves += row.total_qty;
      extraCogs += (flavorCosts.get(row.flavor_id) || 0) * row.total_qty;
      if (row.disposition === 'sold') {
        extraRevenue += row.revenue || 0;
      }
    }

    // Calculate total time
    // Bake day time: (setup + cleanup) per day + (per_loaf * loaves)
    const bakeSlotTimeMinutes = totalBakeSlots * (bakeDaySetup + bakeDayCleanup) + (totalBakeSlotLoaves * bakeDayPerLoaf);
    // Extra production time: per_loaf * loaves
    const extraTimeMinutes = extraLoaves * miscPerLoaf;
    const totalTimeMinutes = bakeSlotTimeMinutes + extraTimeMinutes;
    const totalTimeHours = totalTimeMinutes / 60;

    // Calculate profit
    const totalRevenue = totalBakeSlotRevenue + extraRevenue;
    const totalCogs = totalBakeSlotCogs + extraCogs;
    const totalProfit = totalRevenue - totalCogs;
    const profitPerHour = totalTimeHours > 0 ? totalProfit / totalTimeHours : 0;

    return {
      bakeSlots: {
        count: totalBakeSlots,
        loaves: totalBakeSlotLoaves,
        revenue: totalBakeSlotRevenue,
        cogs: totalBakeSlotCogs,
        profit: totalBakeSlotRevenue - totalBakeSlotCogs,
        timeMinutes: bakeSlotTimeMinutes,
      },
      extraProduction: {
        loaves: extraLoaves,
        revenue: extraRevenue,
        cogs: extraCogs,
        profit: extraRevenue - extraCogs,
        timeMinutes: extraTimeMinutes,
      },
      totals: {
        loaves: totalBakeSlotLoaves + extraLoaves,
        revenue: totalRevenue,
        cogs: totalCogs,
        profit: totalProfit,
        timeMinutes: totalTimeMinutes,
        timeHours: totalTimeHours,
        profitPerHour,
      },
      timeSettings: {
        bakeDaySetupMinutes: bakeDaySetup,
        bakeDayPerLoafMinutes: bakeDayPerLoaf,
        bakeDayCleanupMinutes: bakeDayCleanup,
        miscProductionPerLoafMinutes: miscPerLoaf,
      },
    };
  });

  // Prep Sheet
  ipcMain.handle('prepSheet:generate', async (_event, bakeSlotId) => {
    const db = getDb();

    // Get bake slot info
    const slot = db.prepare(`
      SELECT b.*, l.name as location_name
      FROM bake_slots b
      LEFT JOIN locations l ON b.location_id = l.id
      WHERE b.id = ?
    `).get(bakeSlotId) as Record<string, unknown>;

    if (!slot) throw new Error('Bake slot not found');

    // Get orders for this slot
    const orders = db.prepare(`
      SELECT * FROM orders WHERE bake_slot_id = ? AND status NOT IN ('canceled', 'no_show')
    `).all(bakeSlotId) as Record<string, unknown>[];

    // Aggregate items by flavor
    const flavorTotals = new Map<string, { name: string; quantity: number }>();

    orders.forEach((order) => {
      const items = JSON.parse(order.items as string) as Array<{
        flavorId: string;
        flavorName: string;
        quantity: number;
      }>;
      items.forEach((item) => {
        const current = flavorTotals.get(item.flavorId) || { name: item.flavorName, quantity: 0 };
        current.quantity += item.quantity;
        flavorTotals.set(item.flavorId, current);
      });
    });

    // Get recipes for each flavor
    const prepItems = [];

    for (const [flavorId, { name, quantity }] of flavorTotals) {
      const recipe = db.prepare(`
        SELECT r.* FROM recipes r
        JOIN flavors f ON f.recipe_id = r.id
        WHERE f.id = ?
      `).get(flavorId) as Record<string, unknown> | undefined;

      if (recipe) {
        const baseIngredients = JSON.parse(recipe.base_ingredients as string);
        const foldIngredients = JSON.parse(recipe.fold_ingredients as string || '[]');
        const laminationIngredients = JSON.parse(recipe.lamination_ingredients as string || '[]');
        const steps = JSON.parse(recipe.steps as string);

        // Scale ingredients by quantity
        const scaleIngredients = (ingredients: Array<{ name: string; quantity: number; unit: string }>) =>
          ingredients.map((ing) => ({
            name: ing.name,
            totalQuantity: ing.quantity * quantity,
            unit: ing.unit,
          }));

        prepItems.push({
          flavorName: name,
          quantity,
          baseIngredients: scaleIngredients(baseIngredients),
          foldIngredients: scaleIngredients(foldIngredients),
          laminationIngredients: scaleIngredients(laminationIngredients),
          steps,
        });
      } else {
        prepItems.push({
          flavorName: name,
          quantity,
          baseIngredients: [],
          foldIngredients: [],
          laminationIngredients: [],
          steps: [],
          noRecipe: true,
        });
      }
    }

    return {
      bakeSlotId,
      date: slot.date,
      location: slot.location_name,
      generatedAt: new Date().toISOString(),
      items: prepItems,
      totalLoaves: Array.from(flavorTotals.values()).reduce((sum, f) => sum + f.quantity, 0),
    };
  });

  // Analytics
  ipcMain.handle('analytics:summary', async (_event, dateRange) => {
    const db = getDb();

    // Get orders within date range
    let orderQuery = `
      SELECT o.*, c.first_name, c.last_name
      FROM orders o
      LEFT JOIN customers c ON o.customer_id = c.id
      LEFT JOIN bake_slots b ON o.bake_slot_id = b.id
      WHERE o.status NOT IN ('canceled')
    `;
    const params: unknown[] = [];

    if (dateRange?.startDate) {
      orderQuery += ' AND o.created_at >= ?';
      params.push(dateRange.startDate);
    }
    if (dateRange?.endDate) {
      orderQuery += ' AND o.created_at <= ?';
      params.push(dateRange.endDate);
    }

    const orders = db.prepare(orderQuery).all(...params) as Array<{
      id: string;
      items: string;
      total_amount: number;
      payment_status: string;
      payment_method: string;
      status: string;
    }>;

    // Calculate summary
    const totalOrders = orders.length;
    const totalRevenue = orders
      .filter((o) => o.payment_status === 'paid')
      .reduce((sum, o) => sum + o.total_amount, 0);
    const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

    // Top flavors
    const flavorCounts = new Map<string, { name: string; quantity: number; revenue: number }>();
    orders.forEach((order) => {
      try {
        const items = JSON.parse(order.items) as Array<{
          flavorName: string;
          quantity: number;
          subtotal: number;
        }>;
        items.forEach((item) => {
          const current = flavorCounts.get(item.flavorName) || {
            name: item.flavorName,
            quantity: 0,
            revenue: 0,
          };
          current.quantity += item.quantity;
          current.revenue += item.subtotal || 0;
          flavorCounts.set(item.flavorName, current);
        });
      } catch {
        // Skip malformed items
      }
    });
    const topFlavors = Array.from(flavorCounts.values())
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 10);

    // Revenue by payment method
    const revenueByPaymentMethod: Record<string, number> = {};
    orders
      .filter((o) => o.payment_status === 'paid' && o.payment_method)
      .forEach((o) => {
        revenueByPaymentMethod[o.payment_method] =
          (revenueByPaymentMethod[o.payment_method] || 0) + o.total_amount;
      });

    // Orders by status
    const ordersByStatus: Record<string, number> = {};
    orders.forEach((o) => {
      ordersByStatus[o.status] = (ordersByStatus[o.status] || 0) + 1;
    });

    return {
      totalOrders,
      totalRevenue,
      averageOrderValue,
      topFlavors,
      revenueByPaymentMethod,
      ordersByStatus,
    };
  });

  // Settings
  ipcMain.handle('settings:get', async () => {
    const db = getDb();
    const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get() as Record<
      string,
      unknown
    > | undefined;

    if (!settings) return {};

    // Map snake_case database columns to camelCase for frontend
    const keyMap: Record<string, string> = {
      business_name: 'businessName',
      business_email: 'businessEmail',
      business_phone: 'businessPhone',
      default_cutoff_hours: 'defaultCutoffHours',
      require_payment_method: 'requirePaymentMethod',
      notification_email: 'notificationEmail',
      notification_sms: 'notificationSms',
      notification_emails: 'notificationEmails',
      notification_phones: 'notificationPhones',
      sms_provider: 'smsProvider',
      sms_api_key: 'smsApiKey',
      email_provider: 'emailProvider',
      email_api_key: 'emailApiKey',
      google_sheets_id: 'googleSheetsId',
      google_credentials: 'googleCredentials',
      quiet_hours_start: 'quietHoursStart',
      quiet_hours_end: 'quietHoursEnd',
      enable_prepayment: 'enablePrepayment',
      venmo_username: 'venmoUsername',
      cashapp_cashtag: 'cashappCashtag',
      paypal_username: 'paypalUsername',
      zelle_email: 'zelleEmail',
      bake_day_setup_minutes: 'bakeDaySetupMinutes',
      bake_day_per_loaf_minutes: 'bakeDayPerLoafMinutes',
      bake_day_cleanup_minutes: 'bakeDayCleanupMinutes',
      misc_production_per_loaf_minutes: 'miscProductionPerLoafMinutes',
    };

    const booleanFields = ['notificationEmail', 'notificationSms', 'requirePaymentMethod', 'enablePrepayment'];
    const converted: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(settings)) {
      const frontendKey = keyMap[key] || key;
      // Convert 0/1 back to boolean for checkbox fields
      if (booleanFields.includes(frontendKey)) {
        converted[frontendKey] = value === 1;
      } else {
        converted[frontendKey] = value;
      }
    }
    return converted;
  });

  ipcMain.handle('settings:save', async (_event, data) => {
    const db = getDb();
    const now = new Date().toISOString();

    // Map camelCase keys to snake_case database columns
    const keyMap: Record<string, string> = {
      businessName: 'business_name',
      businessEmail: 'business_email',
      businessPhone: 'business_phone',
      defaultCutoffHours: 'default_cutoff_hours',
      requirePaymentMethod: 'require_payment_method',
      notificationEmail: 'notification_email',
      notificationSms: 'notification_sms',
      notificationEmails: 'notification_emails',
      notificationPhones: 'notification_phones',
      smsProvider: 'sms_provider',
      smsApiKey: 'sms_api_key',
      emailProvider: 'email_provider',
      emailApiKey: 'email_api_key',
      googleSheetsId: 'google_sheets_id',
      googleCredentials: 'google_credentials',
      quietHoursStart: 'quiet_hours_start',
      quietHoursEnd: 'quiet_hours_end',
      enablePrepayment: 'enable_prepayment',
      venmoUsername: 'venmo_username',
      cashappCashtag: 'cashapp_cashtag',
      paypalUsername: 'paypal_username',
      zelleEmail: 'zelle_email',
      bakeDaySetupMinutes: 'bake_day_setup_minutes',
      bakeDayPerLoafMinutes: 'bake_day_per_loaf_minutes',
      bakeDayCleanupMinutes: 'bake_day_cleanup_minutes',
      miscProductionPerLoafMinutes: 'misc_production_per_loaf_minutes',
    };

    // Convert data keys to snake_case and booleans to integers
    const convertedData: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      const dbKey = keyMap[key] || key;
      // SQLite doesn't support booleans, convert to 1/0
      if (typeof value === 'boolean') {
        convertedData[dbKey] = value ? 1 : 0;
      } else {
        convertedData[dbKey] = value;
      }
    }

    // Check if settings exist
    const existing = db.prepare('SELECT id FROM settings WHERE id = 1').get();

    if (existing) {
      const fields = Object.keys(convertedData)
        .map((k) => `${k} = ?`)
        .join(', ');
      const values = [...Object.values(convertedData), now];
      db.prepare(`UPDATE settings SET ${fields}, updated_at = ? WHERE id = 1`).run(...values);
    } else {
      const keys = ['id', ...Object.keys(convertedData), 'created_at', 'updated_at'];
      const placeholders = keys.map(() => '?').join(', ');
      const values = [1, ...Object.values(convertedData), now, now];
      db.prepare(`INSERT INTO settings (${keys.join(', ')}) VALUES (${placeholders})`).run(
        ...values
      );
    }

    log('info', 'Settings saved');
  });

  ipcMain.handle('settings:testGoogle', async () => {
    try {
      // Test connection by trying to sync
      const status = getSyncStatus();
      if (status.isOnline) {
        await syncAll();
        return true;
      }
      return false;
    } catch (error) {
      log('error', 'Google connection test failed', { error });
      return false;
    }
  });

  // Sync
  ipcMain.handle('sync:now', async () => {
    await syncAll();
  });

  ipcMain.handle('sync:status', async () => {
    return getSyncStatus();
  });

  // Auth
  ipcMain.handle('auth:signIn', async () => {
    await signIn();
  });

  ipcMain.handle('auth:signOut', async () => {
    await signOut();
  });

  ipcMain.handle('auth:status', async () => {
    return { isSignedIn: isAuthenticated() };
  });

  ipcMain.handle('auth:configure', async (_event, credentials, spreadsheetId) => {
    try {
      await setConfig(credentials, spreadsheetId);
      return { success: true };
    } catch (error) {
      log('error', 'Failed to configure Google Sheets', { error });
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  });

  // Admin Users
  ipcMain.handle('admin:checkSetup', async () => {
    const db = getDb();
    const count = db.prepare('SELECT COUNT(*) as count FROM admin_users').get() as { count: number };
    return { needsSetup: count.count === 0 };
  });

  // Setup developer account - only works if no developers exist
  ipcMain.handle('admin:setupDeveloper', async (_event, name: string, pin: string, secret: string) => {
    // Require a secret key to prevent unauthorized developer creation
    // Secret must be set via DEV_SETUP_SECRET environment variable
    const expectedSecret = process.env.DEV_SETUP_SECRET;
    if (!expectedSecret || secret !== expectedSecret) {
      return { success: false, error: 'Invalid secret' };
    }

    const db = getDb();

    // Check if any developers already exist
    const devCount = db.prepare('SELECT COUNT(*) as count FROM admin_users WHERE is_developer = 1').get() as { count: number };
    if (devCount.count > 0) {
      return { success: false, error: 'Developer account already exists' };
    }

    // Check if PIN is already in use
    if (isPinTaken(pin)) {
      return { success: false, error: 'This PIN is already in use. Please choose a different PIN.' };
    }

    const id = `admin-${Date.now().toString(36)}`;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO admin_users (id, name, pin_hash, is_active, is_developer, is_owner, created_at, updated_at)
      VALUES (?, ?, ?, 1, 1, 1, ?, ?)
    `).run(id, name, hashPin(pin), now, now);

    currentUser = { id, name, role: 'developer', isDeveloper: true, isOwner: true, permissions: FULL_PERMISSIONS };
    logAudit('DEVELOPER_SETUP', 'admin_users', id, `Developer account created: ${name}`);
    log('info', 'Developer account created', { id, name });

    return { success: true, user: currentUser };
  });

  ipcMain.handle('admin:setupOwner', async (_event, name: string, pin: string) => {
    // Check if PIN is already in use
    if (isPinTaken(pin)) {
      return { success: false, error: 'This PIN is already in use. Please choose a different PIN.' };
    }

    const db = getDb();
    const id = `admin-${Date.now().toString(36)}`;
    const now = new Date().toISOString();

    db.prepare(`
      INSERT INTO admin_users (id, name, pin_hash, is_active, is_developer, is_owner, created_at, updated_at)
      VALUES (?, ?, ?, 1, 0, 1, ?, ?)
    `).run(id, name, hashPin(pin), now, now);

    currentUser = { id, name, role: 'owner', isDeveloper: false, isOwner: true, permissions: FULL_PERMISSIONS };
    logAudit('OWNER_SETUP', 'admin_users', id, `Owner account created: ${name}`);
    log('info', 'Owner account created', { id, name });

    return { success: true, user: currentUser };
  });

  ipcMain.handle('admin:login', async (_event, pin: string) => {
    const db = getDb();
    const pinHash = hashPin(pin);

    const user = db.prepare(`
      SELECT id, name, is_developer, is_owner, permissions FROM admin_users
      WHERE pin_hash = ? AND is_active = 1
    `).get(pinHash) as { id: string; name: string; is_developer: number; is_owner: number; permissions: string | null } | undefined;

    if (!user) {
      logAudit('LOGIN_FAILED', 'admin_users', null, 'Invalid PIN attempt');
      return { success: false, error: 'Invalid PIN' };
    }

    // Update last login
    db.prepare('UPDATE admin_users SET last_login = ? WHERE id = ?')
      .run(new Date().toISOString(), user.id);

    const isDeveloper = user.is_developer === 1;
    const isOwner = user.is_owner === 1;
    const role = getUserRole(isDeveloper, isOwner);
    const permissions = parsePermissions(user.permissions, role);
    currentUser = { id: user.id, name: user.name, role, isDeveloper, isOwner, permissions };
    logAudit('LOGIN', 'admin_users', user.id, `User logged in: ${user.name} (${role})`);
    log('info', 'Admin login', { id: user.id, name: user.name, role });

    return { success: true, user: currentUser };
  });

  ipcMain.handle('admin:logout', async () => {
    if (currentUser) {
      logAudit('LOGOUT', 'admin_users', currentUser.id, `User logged out: ${currentUser.name}`);
    }
    currentUser = null;
    return { success: true };
  });

  ipcMain.handle('admin:getCurrentUser', async () => {
    return currentUser;
  });

  ipcMain.handle('admin:getUsers', async () => {
    const db = getDb();
    return db.prepare(`
      SELECT id, name, is_active, is_developer, is_owner, permissions, last_login, created_at
      FROM admin_users ORDER BY is_developer DESC, is_owner DESC, name
    `).all();
  });

  ipcMain.handle('admin:createUser', async (_event, data: {
    name: string;
    pin: string;
    role: 'owner' | 'admin';
    permissions?: UserPermissions;
  }) => {
    // Only developers and owners can create users
    if (!currentUser?.isDeveloper && !currentUser?.isOwner) {
      return { success: false, error: 'Only developers and owners can create users' };
    }

    // Only developers can create owners
    if (data.role === 'owner' && !currentUser?.isDeveloper) {
      return { success: false, error: 'Only developers can create owner accounts' };
    }

    // Check if PIN is already in use
    if (isPinTaken(data.pin)) {
      return { success: false, error: 'This PIN is already in use. Please choose a different PIN.' };
    }

    const db = getDb();
    const id = `admin-${Date.now().toString(36)}`;
    const now = new Date().toISOString();
    const isOwner = data.role === 'owner' ? 1 : 0;
    const permissionsJson = data.permissions ? JSON.stringify(data.permissions) : null;

    db.prepare(`
      INSERT INTO admin_users (id, name, pin_hash, is_active, is_developer, is_owner, permissions, created_at, updated_at)
      VALUES (?, ?, ?, 1, 0, ?, ?, ?, ?)
    `).run(id, data.name, hashPin(data.pin), isOwner, permissionsJson, now, now);

    logAudit('USER_CREATED', 'admin_users', id, `User created: ${data.name} (${data.role})`);
    log('info', 'Admin user created', { id, name: data.name, role: data.role });

    return { success: true, id };
  });

  ipcMain.handle('admin:updateUser', async (_event, id: string, data: {
    name?: string;
    pin?: string;
    isActive?: boolean;
    isOwner?: boolean;
    permissions?: UserPermissions;
  }) => {
    // Check permissions
    const isEditingSelf = currentUser?.id === id;
    const canEdit = currentUser?.isDeveloper || currentUser?.isOwner || isEditingSelf;
    if (!canEdit) {
      return { success: false, error: 'Permission denied' };
    }

    // Get the target user to check their role
    const db = getDb();
    const targetUser = db.prepare('SELECT is_developer, is_owner FROM admin_users WHERE id = ?')
      .get(id) as { is_developer: number; is_owner: number } | undefined;

    if (!targetUser) {
      return { success: false, error: 'User not found' };
    }

    // Only developers can edit developer or owner accounts (except themselves)
    if ((targetUser.is_developer || targetUser.is_owner) && !currentUser?.isDeveloper && !isEditingSelf) {
      return { success: false, error: 'Only developers can edit owner accounts' };
    }

    // Only developers can change owner status
    if (typeof data.isOwner === 'boolean' && !currentUser?.isDeveloper) {
      return { success: false, error: 'Only developers can change owner status' };
    }

    // Only developers and owners can change permissions
    if (data.permissions && !currentUser?.isDeveloper && !currentUser?.isOwner) {
      return { success: false, error: 'Only developers and owners can change permissions' };
    }

    // Check if new PIN is already in use (exclude current user)
    if (data.pin && isPinTaken(data.pin, id)) {
      return { success: false, error: 'This PIN is already in use. Please choose a different PIN.' };
    }

    const updates: string[] = [];
    const values: unknown[] = [];

    if (data.name) {
      updates.push('name = ?');
      values.push(data.name);
    }
    if (data.pin) {
      updates.push('pin_hash = ?');
      values.push(hashPin(data.pin));
    }
    if (typeof data.isActive === 'boolean') {
      updates.push('is_active = ?');
      values.push(data.isActive ? 1 : 0);
    }
    if (typeof data.isOwner === 'boolean') {
      updates.push('is_owner = ?');
      values.push(data.isOwner ? 1 : 0);
    }
    if (data.permissions) {
      updates.push('permissions = ?');
      values.push(JSON.stringify(data.permissions));
    }

    if (updates.length === 0) return { success: true };

    updates.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);

    db.prepare(`UPDATE admin_users SET ${updates.join(', ')} WHERE id = ?`).run(...values);

    logAudit('USER_UPDATED', 'admin_users', id, `Admin user updated: ${JSON.stringify(Object.keys(data))}`);
    log('info', 'Admin user updated', { id });

    return { success: true };
  });

  ipcMain.handle('admin:deleteUser', async (_event, id: string) => {
    if (!currentUser?.isOwner) {
      return { success: false, error: 'Only owners can delete users' };
    }

    const db = getDb();

    // Can't delete yourself or other owners
    const user = db.prepare('SELECT is_owner FROM admin_users WHERE id = ?').get(id) as { is_owner: number } | undefined;
    if (!user) return { success: false, error: 'User not found' };
    if (user.is_owner) return { success: false, error: 'Cannot delete owner accounts' };

    db.prepare('DELETE FROM admin_users WHERE id = ?').run(id);

    logAudit('USER_DELETED', 'admin_users', id, 'Admin user deleted');
    log('info', 'Admin user deleted', { id });

    return { success: true };
  });

  // Audit Log
  ipcMain.handle('audit:getLog', async (_event, filters?: { limit?: number; offset?: number }) => {
    const db = getDb();
    const limit = filters?.limit || 100;
    const offset = filters?.offset || 0;

    return db.prepare(`
      SELECT * FROM audit_log
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(limit, offset);
  });

  // System
  ipcMain.handle('system:sendErrorReport', async () => {
    const report = createErrorReport();
    log('info', 'Error report created', { path: report.path });
    shell.showItemInFolder(report.path);
  });

  ipcMain.handle('system:version', async () => {
    return app.getVersion();
  });

  ipcMain.handle('system:openExternal', async (_event, url) => {
    await shell.openExternal(url);
  });

  // Extra Production
  ipcMain.handle('extraProduction:getAll', async (_event, filters) => {
    const db = getDb();
    let query = `
      SELECT ep.*,
             f.name as flavor_name,
             b.date as bake_date,
             l.name as location_name
      FROM extra_production ep
      LEFT JOIN flavors f ON ep.flavor_id = f.id
      LEFT JOIN bake_slots b ON ep.bake_slot_id = b.id
      LEFT JOIN locations l ON b.location_id = l.id
      WHERE 1=1
    `;
    const params: unknown[] = [];

    if (filters?.dateFrom) {
      query += ' AND ep.production_date >= ?';
      params.push(filters.dateFrom);
    }
    if (filters?.dateTo) {
      query += ' AND ep.production_date <= ?';
      params.push(filters.dateTo);
    }
    if (filters?.flavorId) {
      query += ' AND ep.flavor_id = ?';
      params.push(filters.flavorId);
    }
    if (filters?.disposition) {
      query += ' AND ep.disposition = ?';
      params.push(filters.disposition);
    }
    if (filters?.bakeSlotId) {
      query += ' AND ep.bake_slot_id = ?';
      params.push(filters.bakeSlotId);
    }

    query += ' ORDER BY ep.production_date DESC, ep.created_at DESC';
    return db.prepare(query).all(...params);
  });

  ipcMain.handle('extraProduction:create', async (_event, data) => {
    const db = getDb();
    const id = `ep-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
    const now = new Date().toISOString();

    // Calculate total_revenue for sold items
    const totalRevenue = data.disposition === 'sold'
      ? (data.quantity * (data.salePrice || 0))
      : null;

    db.prepare(`
      INSERT INTO extra_production (
        id, bake_slot_id, production_date, flavor_id, quantity,
        disposition, sale_price, total_revenue, notes, created_by,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.bakeSlotId || null,
      data.productionDate,
      data.flavorId,
      data.quantity,
      data.disposition,
      data.salePrice || null,
      totalRevenue,
      data.notes || null,
      currentUser?.id || null,
      now,
      now
    );

    logAudit('EXTRA_PRODUCTION_CREATED', 'extra_production', id,
      `${data.quantity}x ${data.disposition}`);
    log('info', 'Extra production logged', { id, disposition: data.disposition });
    return { success: true, id };
  });

  ipcMain.handle('extraProduction:update', async (_event, id, data) => {
    const db = getDb();
    const updates: string[] = [];
    const values: unknown[] = [];

    if (data.quantity !== undefined) {
      updates.push('quantity = ?');
      values.push(data.quantity);
    }
    if (data.disposition !== undefined) {
      updates.push('disposition = ?');
      values.push(data.disposition);
    }
    if (data.salePrice !== undefined) {
      updates.push('sale_price = ?');
      values.push(data.salePrice);
    }
    if (data.notes !== undefined) {
      updates.push('notes = ?');
      values.push(data.notes);
    }

    // Recalculate total_revenue if quantity or salePrice changed
    if (data.quantity !== undefined || data.salePrice !== undefined) {
      const existing = db.prepare('SELECT quantity, sale_price, disposition FROM extra_production WHERE id = ?')
        .get(id) as { quantity: number; sale_price: number | null; disposition: string } | undefined;
      if (existing) {
        const qty = data.quantity ?? existing.quantity;
        const price = data.salePrice ?? existing.sale_price ?? 0;
        const disp = data.disposition ?? existing.disposition;
        const newRevenue = disp === 'sold' ? qty * price : null;
        updates.push('total_revenue = ?');
        values.push(newRevenue);
      }
    }

    if (updates.length === 0) return { success: true };

    updates.push('updated_at = ?');
    values.push(new Date().toISOString());
    values.push(id);

    db.prepare(`UPDATE extra_production SET ${updates.join(', ')} WHERE id = ?`).run(...values);
    log('info', 'Extra production updated', { id });
    return { success: true };
  });

  ipcMain.handle('extraProduction:delete', async (_event, id) => {
    const db = getDb();
    db.prepare('DELETE FROM extra_production WHERE id = ?').run(id);
    logAudit('EXTRA_PRODUCTION_DELETED', 'extra_production', id);
    log('info', 'Extra production deleted', { id });
    return { success: true };
  });

  ipcMain.handle('extraProduction:getOpenCapacity', async (_event, bakeSlotId) => {
    const db = getDb();

    // Get slot capacity and ordered count
    const slot = db.prepare(`
      SELECT total_capacity, current_orders FROM bake_slots WHERE id = ?
    `).get(bakeSlotId) as { total_capacity: number; current_orders: number } | undefined;

    if (!slot) return null;

    // Get already-logged extra production for this slot
    const extraLogged = db.prepare(`
      SELECT COALESCE(SUM(quantity), 0) as total
      FROM extra_production WHERE bake_slot_id = ?
    `).get(bakeSlotId) as { total: number };

    return {
      totalCapacity: slot.total_capacity,
      orderedCount: slot.current_orders,
      extraLoggedCount: extraLogged.total,
      openSlots: slot.total_capacity - slot.current_orders - extraLogged.total
    };
  });

  ipcMain.handle('extraProduction:getAnalytics', async (_event, filters) => {
    const db = getDb();
    let whereClause = 'WHERE 1=1';
    const params: unknown[] = [];

    if (filters?.startDate || filters?.dateFrom) {
      whereClause += ' AND production_date >= ?';
      params.push(filters.startDate || filters.dateFrom);
    }
    if (filters?.endDate || filters?.dateTo) {
      whereClause += ' AND production_date <= ?';
      params.push(filters.endDate || filters.dateTo);
    }

    // Get summary by disposition
    const summary = db.prepare(`
      SELECT
        disposition,
        COUNT(*) as entry_count,
        SUM(quantity) as total_loaves,
        SUM(CASE WHEN disposition = 'sold' THEN total_revenue ELSE 0 END) as revenue
      FROM extra_production
      ${whereClause}
      GROUP BY disposition
    `).all(...params) as Array<{
      disposition: string;
      entry_count: number;
      total_loaves: number;
      revenue: number;
    }>;

    // Calculate cost of wasted/gifted using flavor costs
    const wasteGiftCost = db.prepare(`
      SELECT
        ep.disposition,
        SUM(ep.quantity * COALESCE(f.estimated_cost, 0)) as total_cost
      FROM extra_production ep
      LEFT JOIN flavors f ON ep.flavor_id = f.id
      ${whereClause}
      AND ep.disposition IN ('wasted', 'gifted')
      GROUP BY ep.disposition
    `).all(...params) as Array<{
      disposition: string;
      total_cost: number;
    }>;

    // Calculate totals
    const totals = {
      sold: { count: 0, loaves: 0, revenue: 0 },
      pending: { count: 0, loaves: 0 },
      gifted: { count: 0, loaves: 0, cost: 0 },
      wasted: { count: 0, loaves: 0, cost: 0 },
      personal: { count: 0, loaves: 0 },
      totalLoaves: 0
    };

    for (const row of summary) {
      const key = row.disposition as 'sold' | 'pending' | 'gifted' | 'wasted' | 'personal';
      if (totals[key]) {
        totals[key].count = row.entry_count || 0;
        totals[key].loaves = row.total_loaves || 0;
        totals.totalLoaves += row.total_loaves || 0;
        if (key === 'sold') {
          (totals[key] as { count: number; loaves: number; revenue: number }).revenue = row.revenue || 0;
        }
      }
    }

    for (const row of wasteGiftCost) {
      const key = row.disposition as 'wasted' | 'gifted';
      if (totals[key]) {
        totals[key].cost = row.total_cost || 0;
      }
    }

    return totals;
  });

  // Public settings (available without login - for lock screen branding)
  ipcMain.handle('settings:getPublic', async () => {
    const { isPortable } = require('./database');
    const db = getDb();
    const settings = db.prepare('SELECT business_name FROM settings WHERE id = 1').get() as { business_name?: string } | undefined;
    return {
      businessName: settings?.business_name || 'Bakery Admin',
      isPortable: isPortable()
    };
  });

  log('info', 'IPC handlers registered');
}
