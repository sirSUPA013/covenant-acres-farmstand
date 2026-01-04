/**
 * IPC Handlers
 * Handles communication between main and renderer processes
 */

import { ipcMain, shell, app } from 'electron';
import { getDb } from './database';
import { syncAll, getSyncStatus, signIn, signOut, isAuthenticated } from './sheets-sync';
import { log, createErrorReport, getLogPath } from './logger';

export function setupIpcHandlers(): void {
  // Orders
  ipcMain.handle('orders:getAll', async (_event, filters) => {
    const db = getDb();
    let query = `
      SELECT o.*, c.first_name, c.last_name, c.email, c.phone,
             b.date as bake_date, l.name as location_name
      FROM orders o
      LEFT JOIN customers c ON o.customer_id = c.id
      LEFT JOIN bake_slots b ON o.bake_slot_id = b.id
      LEFT JOIN locations l ON b.location_id = l.id
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
    const fields = Object.keys(data)
      .map((k) => `${k} = ?`)
      .join(', ');
    const values = [...Object.values(data), new Date().toISOString(), id];

    db.prepare(`UPDATE orders SET ${fields}, updated_at = ? WHERE id = ?`).run(...values);
    log('info', 'Order updated', { id, changes: Object.keys(data) });
  });

  // Customers
  ipcMain.handle('customers:getAll', async (_event, filters) => {
    const db = getDb();
    let query = 'SELECT * FROM customers WHERE 1=1';
    const params: unknown[] = [];

    if (filters?.search) {
      query += ' AND (first_name LIKE ? OR last_name LIKE ? OR email LIKE ?)';
      const term = `%${filters.search}%`;
      params.push(term, term, term);
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
    const fields = Object.keys(data)
      .map((k) => `${k} = ?`)
      .join(', ');
    const values = [...Object.values(data), new Date().toISOString(), id];

    db.prepare(`UPDATE customers SET ${fields}, updated_at = ? WHERE id = ?`).run(...values);
    log('info', 'Customer updated', { id });
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
      SELECT b.*, l.name as location_name
      FROM bake_slots b
      LEFT JOIN locations l ON b.location_id = l.id
      WHERE 1=1
    `;
    const params: unknown[] = [];

    if (filters?.upcoming) {
      query += ' AND b.date >= date("now")';
    }
    if (filters?.locationId) {
      query += ' AND b.location_id = ?';
      params.push(filters.locationId);
    }

    query += ' ORDER BY b.date ASC';

    return db.prepare(query).all(...params);
  });

  ipcMain.handle('bakeSlots:create', async (_event, data) => {
    const db = getDb();
    const id = `slot-${Date.now().toString(36)}`;
    const now = new Date().toISOString();

    db.prepare(
      `INSERT INTO bake_slots (id, date, location_id, total_capacity, cutoff_time, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    ).run(id, data.date, data.locationId, data.totalCapacity, data.cutoffTime, now, now);

    log('info', 'Bake slot created', { id, date: data.date });
    return id;
  });

  ipcMain.handle('bakeSlots:update', async (_event, id, data) => {
    const db = getDb();
    const fields = Object.keys(data)
      .map((k) => `${k} = ?`)
      .join(', ');
    const values = [...Object.values(data), new Date().toISOString(), id];

    db.prepare(`UPDATE bake_slots SET ${fields}, updated_at = ? WHERE id = ?`).run(...values);
    log('info', 'Bake slot updated', { id });
  });

  ipcMain.handle('bakeSlots:delete', async (_event, id) => {
    const db = getDb();
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
    const id = `flav-${Date.now().toString(36)}`;
    const now = new Date().toISOString();

    db.prepare(
      `INSERT INTO flavors (id, name, description, sizes, is_active, season, sort_order, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      data.name,
      data.description || '',
      JSON.stringify(data.sizes),
      data.isActive ? 1 : 0,
      data.season || 'year_round',
      data.sortOrder || 0,
      now,
      now
    );

    log('info', 'Flavor created', { id, name: data.name });
    return id;
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

  ipcMain.handle('flavors:delete', async (_event, id) => {
    const db = getDb();
    db.prepare('DELETE FROM flavors WHERE id = ?').run(id);
    log('info', 'Flavor deleted', { id });
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
    const fields = Object.keys(data)
      .map((k) => `${k} = ?`)
      .join(', ');
    const values = [...Object.values(data), new Date().toISOString(), id];

    db.prepare(`UPDATE locations SET ${fields}, updated_at = ? WHERE id = ?`).run(...values);
    log('info', 'Location updated', { id });
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

    Object.entries(data).forEach(([key, value]) => {
      if (['baseIngredients', 'foldIngredients', 'laminationIngredients', 'steps'].includes(key)) {
        updates.push(`${key.replace(/([A-Z])/g, '_$1').toLowerCase()} = ?`);
        values.push(JSON.stringify(value));
      } else {
        updates.push(`${key.replace(/([A-Z])/g, '_$1').toLowerCase()} = ?`);
        values.push(value);
      }
    });

    values.push(new Date().toISOString(), id);
    db.prepare(`UPDATE recipes SET ${updates.join(', ')}, updated_at = ? WHERE id = ?`).run(
      ...values
    );
    log('info', 'Recipe updated', { id });
  });

  ipcMain.handle('recipes:delete', async (_event, id) => {
    const db = getDb();
    db.prepare('DELETE FROM recipes WHERE id = ?').run(id);
    log('info', 'Recipe deleted', { id });
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
    return settings || {};
  });

  ipcMain.handle('settings:save', async (_event, data) => {
    const db = getDb();
    const now = new Date().toISOString();

    // Check if settings exist
    const existing = db.prepare('SELECT id FROM settings WHERE id = 1').get();

    if (existing) {
      const fields = Object.keys(data)
        .map((k) => `${k} = ?`)
        .join(', ');
      const values = [...Object.values(data), now];
      db.prepare(`UPDATE settings SET ${fields}, updated_at = ? WHERE id = 1`).run(...values);
    } else {
      const keys = ['id', ...Object.keys(data), 'created_at', 'updated_at'];
      const placeholders = keys.map(() => '?').join(', ');
      const values = [1, ...Object.values(data), now, now];
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

  log('info', 'IPC handlers registered');
}
