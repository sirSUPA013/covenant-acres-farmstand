/**
 * Google Sheets Sync
 * Handles sync between local SQLite and Google Sheets using service account JWT auth
 */

import { createSign } from 'crypto';
import Store from 'electron-store';
import { BrowserWindow } from 'electron';
import { getDb } from './database';
import { log } from './logger';
import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';

const store = new Store();

// Config
interface ServiceAccountCredentials {
  client_email: string;
  private_key: string;
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
}

let cachedToken: { token: string; expires: number } | null = null;
let syncInterval: NodeJS.Timeout | null = null;
let isOnline = true;

// Sync status
interface SyncStatus {
  isOnline: boolean;
  lastSync: string | null;
  pendingChanges: number;
  isSyncing: boolean;
  isConfigured: boolean;
}

let syncStatus: SyncStatus = {
  isOnline: true,
  lastSync: null,
  pendingChanges: 0,
  isSyncing: false,
  isConfigured: false,
};

export function getSyncStatus(): SyncStatus {
  return { ...syncStatus };
}

// JWT-based authentication (same as Vercel API)
function createJWT(credentials: ServiceAccountCredentials): string {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'RS256', typ: 'JWT' };
  const payload = {
    iss: credentials.client_email,
    scope: 'https://www.googleapis.com/auth/spreadsheets',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };

  const base64Header = Buffer.from(JSON.stringify(header)).toString('base64url');
  const base64Payload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signatureInput = `${base64Header}.${base64Payload}`;

  const sign = createSign('RSA-SHA256');
  sign.update(signatureInput);
  const signature = sign.sign(credentials.private_key, 'base64url');

  return `${signatureInput}.${signature}`;
}

async function getAccessToken(credentials: ServiceAccountCredentials): Promise<string> {
  // Use cached token if valid
  if (cachedToken && cachedToken.expires > Date.now()) {
    return cachedToken.token;
  }

  const jwt = createJWT(credentials);
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!response.ok) {
    throw new Error(`Token exchange failed: ${await response.text()}`);
  }

  const data = (await response.json()) as TokenResponse;
  cachedToken = {
    token: data.access_token,
    expires: Date.now() + (data.expires_in - 60) * 1000,
  };
  return data.access_token;
}

function getConfig(): { credentials: ServiceAccountCredentials; spreadsheetId: string } | null {
  // Try environment variables first
  let credentialsJson = process.env.GOOGLE_SHEETS_CREDENTIALS;
  let spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;

  // Fall back to electron-store
  if (!credentialsJson) {
    credentialsJson = store.get('googleCredentials') as string | undefined;
  }
  if (!spreadsheetId) {
    spreadsheetId = store.get('spreadsheetId') as string | undefined;
  }

  // Fall back to config file in app data
  if (!credentialsJson || !spreadsheetId) {
    const configPath = path.join(app.getPath('userData'), 'google-config.json');
    if (fs.existsSync(configPath)) {
      try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        if (!credentialsJson && config.credentials) {
          credentialsJson = JSON.stringify(config.credentials);
        }
        if (!spreadsheetId && config.spreadsheetId) {
          spreadsheetId = config.spreadsheetId;
        }
      } catch (error) {
        log('error', 'Failed to read config file', { error });
      }
    }
  }

  if (!credentialsJson || !spreadsheetId) {
    return null;
  }

  try {
    const credentials =
      typeof credentialsJson === 'string'
        ? JSON.parse(credentialsJson)
        : credentialsJson;
    return { credentials, spreadsheetId: spreadsheetId.trim() };
  } catch (error) {
    log('error', 'Failed to parse credentials', { error });
    return null;
  }
}

async function readSheet(sheetName: string): Promise<string[][]> {
  const config = getConfig();
  if (!config) {
    throw new Error('Google Sheets not configured');
  }

  const accessToken = await getAccessToken(config.credentials);
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${config.spreadsheetId}/values/${encodeURIComponent(sheetName)}`;

  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Sheets read error: ${await response.text()}`);
  }

  const data = (await response.json()) as { values?: string[][] };
  return data.values || [];
}

export async function initSheetsSync(): Promise<void> {
  const config = getConfig();
  if (config) {
    syncStatus.isConfigured = true;
    log('info', 'Google Sheets configured, starting sync');
    startPeriodicSync();
  } else {
    syncStatus.isConfigured = false;
    log('warn', 'Google Sheets not configured - create google-config.json in app data folder');
  }

  // Monitor online status
  setInterval(checkOnlineStatus, 30000);
}

function startPeriodicSync(): void {
  // Sync every 2 minutes
  syncInterval = setInterval(() => {
    if (isOnline && !syncStatus.isSyncing && syncStatus.isConfigured) {
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
    await fetch('https://www.google.com/favicon.ico', {
      method: 'HEAD',
    });
    const wasOffline = !isOnline;
    isOnline = true;
    syncStatus.isOnline = true;

    if (wasOffline && syncStatus.isConfigured) {
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
  const config = getConfig();
  if (!config) {
    log('warn', 'Sheets not configured, skipping sync');
    return;
  }

  if (syncStatus.isSyncing) {
    log('debug', 'Sync already in progress');
    return;
  }

  syncStatus.isSyncing = true;
  notifyRenderer();

  try {
    log('info', 'Starting full sync from Google Sheets...');

    // Pull from Sheets
    await pullFromSheets();

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
  const tables = [
    { sheet: 'Orders', table: 'orders' },
    { sheet: 'Customers', table: 'customers' },
    { sheet: 'BakeSlots', table: 'bake_slots' },
    { sheet: 'Flavors', table: 'flavors' },
    { sheet: 'Locations', table: 'locations' },
  ];

  for (const { sheet, table } of tables) {
    try {
      log('info', `Pulling ${sheet}...`);
      const rows = await readSheet(sheet);

      if (rows.length < 2) {
        log('debug', `${sheet} is empty or has no data rows`);
        continue;
      }

      const headers = rows[0];
      const data = rows.slice(1);

      updateLocalTable(table, headers, data);
      log('info', `Pulled ${data.length} rows from ${sheet}`);
    } catch (error) {
      log('error', `Failed to pull ${sheet}`, { error });
    }
  }
}

function updateLocalTable(table: string, headers: string[], rows: string[][]): void {
  const db = getDb();
  const now = new Date().toISOString();

  // Columns to skip during sync (foreign keys to tables not synced from Sheets)
  const skipColumns: Record<string, Set<string>> = {
    flavors: new Set(['recipe_id']), // recipes table not synced from Sheets
  };

  // Map sheet column headers to database column names
  const columnMap: Record<string, string> = {
    // Common mappings
    id: 'id',
    // Orders
    customer_id: 'customer_id',
    bake_slot_id: 'bake_slot_id',
    items: 'items',
    total_amount: 'total_amount',
    status: 'status',
    payment_method: 'payment_method',
    payment_status: 'payment_status',
    customer_notes: 'customer_notes',
    admin_notes: 'admin_notes',
    created_at: 'created_at',
    updated_at: 'updated_at',
    // Customers
    first_name: 'first_name',
    last_name: 'last_name',
    email: 'email',
    phone: 'phone',
    notification_pref: 'notification_pref',
    sms_opt_in: 'sms_opt_in',
    credit_balance: 'credit_balance',
    total_orders: 'total_orders',
    total_spent: 'total_spent',
    // BakeSlots
    date: 'date',
    location_id: 'location_id',
    total_capacity: 'total_capacity',
    current_orders: 'current_orders',
    cutoff_time: 'cutoff_time',
    is_open: 'is_open',
    // Flavors
    name: 'name',
    description: 'description',
    sizes: 'sizes',
    is_active: 'is_active',
    season: 'season',
    sort_order: 'sort_order',
    // Locations
    address: 'address',
  };

  // Get table columns from DB
  const tableInfo = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  const dbColumns = new Set(tableInfo.map((col) => col.name));

  for (const row of rows) {
    const id = row[0];
    if (!id) continue;

    // Build column/value pairs
    const columns: string[] = [];
    const values: (string | null)[] = [];

    headers.forEach((header, index) => {
      const dbColumn = columnMap[header.toLowerCase()] || header.toLowerCase();
      // Skip columns that reference tables not synced from Sheets
      if (skipColumns[table]?.has(dbColumn)) {
        return;
      }
      if (dbColumns.has(dbColumn)) {
        columns.push(dbColumn);
        values.push(row[index] || null);
      }
    });

    // Add synced_at
    if (dbColumns.has('synced_at')) {
      columns.push('synced_at');
      values.push(now);
    }

    if (columns.length === 0) continue;

    try {
      const placeholders = columns.map(() => '?').join(', ');
      const updatePairs = columns.map((c) => `${c} = excluded.${c}`).join(', ');

      db.prepare(
        `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders})
         ON CONFLICT(id) DO UPDATE SET ${updatePairs}`
      ).run(...values);
    } catch (error) {
      log('debug', `Could not upsert into ${table}`, { error, id });
    }
  }
}

function notifyRenderer(): void {
  const windows = BrowserWindow.getAllWindows();
  windows.forEach((win) => {
    win.webContents.send('sync:update', getSyncStatus());
  });
}

// Configuration
export async function setConfig(
  credentials: ServiceAccountCredentials,
  spreadsheetId: string
): Promise<void> {
  store.set('googleCredentials', JSON.stringify(credentials));
  store.set('spreadsheetId', spreadsheetId);
  syncStatus.isConfigured = true;
  cachedToken = null; // Clear token cache

  log('info', 'Google Sheets configuration saved');

  // Start sync
  startPeriodicSync();
}

export function isAuthenticated(): boolean {
  return syncStatus.isConfigured;
}

// Legacy signIn/signOut for compatibility
export async function signIn(): Promise<void> {
  log('info', 'Sign in - use setConfig with service account credentials');
}

export async function signOut(): Promise<void> {
  store.delete('googleCredentials');
  store.delete('spreadsheetId');
  syncStatus.isConfigured = false;
  cachedToken = null;
  stopSync();
  log('info', 'Signed out');
}
