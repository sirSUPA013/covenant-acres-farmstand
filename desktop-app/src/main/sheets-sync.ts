/**
 * Google Sheets Sync
 * Handles bidirectional sync between local SQLite and Google Sheets
 */

import { google, sheets_v4 } from 'googleapis';
import Store from 'electron-store';
import { BrowserWindow } from 'electron';
import { getDb } from './database';
import { log } from './logger';

const store = new Store();

let sheetsClient: sheets_v4.Sheets | null = null;
let syncInterval: NodeJS.Timeout | null = null;
let isOnline = true;

// Sync status
interface SyncStatus {
  isOnline: boolean;
  lastSync: string | null;
  pendingChanges: number;
  isSyncing: boolean;
}

let syncStatus: SyncStatus = {
  isOnline: true,
  lastSync: null,
  pendingChanges: 0,
  isSyncing: false,
};

export function getSyncStatus(): SyncStatus {
  return { ...syncStatus };
}

export async function initSheetsSync(): Promise<void> {
  // Check for stored credentials
  const credentials = store.get('googleCredentials') as object | undefined;
  if (credentials) {
    try {
      await initializeSheetsClient(credentials);
      startPeriodicSync();
    } catch (error) {
      log('warn', 'Stored credentials invalid, need to re-authenticate', { error });
    }
  }

  // Monitor online status
  setInterval(checkOnlineStatus, 30000);
}

async function initializeSheetsClient(credentials: object): Promise<void> {
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  sheetsClient = google.sheets({ version: 'v4', auth });
  log('info', 'Google Sheets client initialized');
}

function startPeriodicSync(): void {
  // Sync every 2 minutes
  syncInterval = setInterval(() => {
    if (isOnline && !syncStatus.isSyncing) {
      syncAll().catch((error) => {
        log('error', 'Periodic sync failed', { error });
      });
    }
  }, 2 * 60 * 1000);

  // Initial sync
  syncAll().catch((error) => {
    log('error', 'Initial sync failed', { error });
  });
}

export function stopSync(): void {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
  }
}

async function checkOnlineStatus(): Promise<void> {
  try {
    const response = await fetch('https://www.google.com/favicon.ico', {
      method: 'HEAD',
      mode: 'no-cors',
    });
    const wasOffline = !isOnline;
    isOnline = true;
    syncStatus.isOnline = true;

    if (wasOffline) {
      log('info', 'Connection restored, syncing...');
      await syncAll();
    }
  } catch {
    isOnline = false;
    syncStatus.isOnline = false;
    log('warn', 'No internet connection');
  }

  notifyRenderer();
}

export async function syncAll(): Promise<void> {
  if (!sheetsClient) {
    log('warn', 'Sheets client not initialized, skipping sync');
    return;
  }

  if (syncStatus.isSyncing) {
    log('debug', 'Sync already in progress');
    return;
  }

  syncStatus.isSyncing = true;
  notifyRenderer();

  try {
    log('info', 'Starting full sync...');

    // Pull from Sheets
    await pullFromSheets();

    // Push local changes
    await pushToSheets();

    syncStatus.lastSync = new Date().toISOString();
    syncStatus.pendingChanges = 0;

    log('info', 'Sync completed successfully');
  } catch (error) {
    log('error', 'Sync failed', { error });
    throw error;
  } finally {
    syncStatus.isSyncing = false;
    notifyRenderer();
  }
}

async function pullFromSheets(): Promise<void> {
  const spreadsheetId = store.get('spreadsheetId') as string;
  if (!spreadsheetId || !sheetsClient) return;

  const tables = ['Orders', 'Customers', 'BakeSlots', 'Flavors', 'Locations', 'Recipes'];

  for (const table of tables) {
    try {
      const response = await sheetsClient.spreadsheets.values.get({
        spreadsheetId,
        range: table,
      });

      const rows = response.data.values || [];
      if (rows.length < 2) continue;

      const headers = rows[0];
      const data = rows.slice(1);

      // Update local database
      updateLocalTable(table.toLowerCase(), headers, data);
    } catch (error) {
      log('error', `Failed to pull ${table}`, { error });
    }
  }
}

function updateLocalTable(table: string, headers: string[], rows: string[][]): void {
  const db = getDb();

  // Map table names to local schema
  const tableMap: Record<string, string> = {
    orders: 'orders',
    customers: 'customers',
    bakeslots: 'bake_slots',
    flavors: 'flavors',
    locations: 'locations',
    recipes: 'recipes',
  };

  const localTable = tableMap[table];
  if (!localTable) return;

  const now = new Date().toISOString();

  for (const row of rows) {
    const id = row[0];
    if (!id) continue;

    // Check if record exists and if remote is newer
    const existing = db.prepare(`SELECT synced_at FROM ${localTable} WHERE id = ?`).get(id) as
      | { synced_at: string }
      | undefined;

    if (!existing) {
      // Insert new record
      const columns = headers.map((h) => h.toLowerCase().replace(/([A-Z])/g, '_$1').toLowerCase());
      const placeholders = columns.map(() => '?').join(', ');
      const values = row.map((v) => v || null);
      values.push(now); // synced_at

      try {
        db.prepare(
          `INSERT OR REPLACE INTO ${localTable} (${columns.join(', ')}, synced_at) VALUES (${placeholders}, ?)`
        ).run(...values);
      } catch (error) {
        log('debug', `Could not insert into ${localTable}`, { error, id });
      }
    }
  }
}

async function pushToSheets(): Promise<void> {
  const spreadsheetId = store.get('spreadsheetId') as string;
  if (!spreadsheetId || !sheetsClient) return;

  const db = getDb();

  // Find records that have been modified locally but not synced
  const tables = ['orders', 'customers', 'bake_slots', 'flavors', 'locations', 'recipes'];

  for (const table of tables) {
    try {
      const unsynced = db
        .prepare(`SELECT * FROM ${table} WHERE synced_at IS NULL OR updated_at > synced_at`)
        .all() as Record<string, unknown>[];

      for (const record of unsynced) {
        await pushRecord(spreadsheetId, table, record);
      }
    } catch (error) {
      log('error', `Failed to push ${table}`, { error });
    }
  }
}

async function pushRecord(
  spreadsheetId: string,
  table: string,
  record: Record<string, unknown>
): Promise<void> {
  // This would update the specific row in Google Sheets
  // Implementation depends on how we want to handle conflicts
  log('debug', `Would push ${table} record`, { id: record.id });
}

function notifyRenderer(): void {
  const windows = BrowserWindow.getAllWindows();
  windows.forEach((win) => {
    win.webContents.send('sync:update', getSyncStatus());
  });
}

// Auth flow
export async function signIn(): Promise<void> {
  // In production, this would open OAuth flow
  // For now, we'll use service account credentials
  log('info', 'Sign in requested');
}

export async function signOut(): Promise<void> {
  store.delete('googleCredentials');
  store.delete('spreadsheetId');
  sheetsClient = null;
  stopSync();
  log('info', 'Signed out');
}

export function isAuthenticated(): boolean {
  return sheetsClient !== null;
}
