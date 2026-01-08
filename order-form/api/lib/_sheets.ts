/**
 * Google Sheets Client - Shared module for all API endpoints
 */

import { createSign } from 'crypto';

// Sheet names
export const SHEETS = {
  ORDERS: 'Orders',
  CUSTOMERS: 'Customers',
  BAKE_SLOTS: 'BakeSlots',
  FLAVORS: 'Flavors',
  LOCATIONS: 'Locations',
  EXTRA_PRODUCTION: 'ExtraProduction',
  FLAVOR_CAPS: 'FlavorCaps',
  BAKE_SLOT_LOCATIONS: 'BakeSlotLocations',
  PAYMENT_OPTIONS: 'PaymentOptions',
} as const;

// Types
export interface ServiceAccountCredentials {
  client_email: string;
  private_key: string;
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
}

// Token cache
let cachedToken: { token: string; expires: number } | null = null;

/**
 * Create a JWT for Google API authentication
 */
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

/**
 * Get an access token for Google Sheets API
 */
export async function getAccessToken(credentials: ServiceAccountCredentials): Promise<string> {
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

  const data = await response.json() as TokenResponse;
  cachedToken = {
    token: data.access_token,
    expires: Date.now() + (data.expires_in - 60) * 1000,
  };
  return data.access_token;
}

/**
 * Get Google Sheets configuration from environment variables
 */
export function getConfig(): { credentials: ServiceAccountCredentials; spreadsheetId: string } {
  const credentialsJson = process.env.GOOGLE_SHEETS_CREDENTIALS;
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;

  if (!credentialsJson || !spreadsheetId) {
    throw new Error('Missing Google Sheets configuration');
  }

  return {
    credentials: JSON.parse(credentialsJson) as ServiceAccountCredentials,
    spreadsheetId: spreadsheetId.trim(),
  };
}

/**
 * Read data from a Google Sheet
 */
export async function readSheet(sheetName: string): Promise<string[][]> {
  const { credentials, spreadsheetId } = getConfig();
  const accessToken = await getAccessToken(credentials);

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}`;
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Sheets read error: ${await response.text()}`);
  }

  const data = await response.json() as { values?: string[][] };
  return data.values || [];
}

/**
 * Append a row to a Google Sheet
 */
export async function appendRow(sheetName: string, values: string[]): Promise<void> {
  const { credentials, spreadsheetId } = getConfig();
  const accessToken = await getAccessToken(credentials);

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      values: [values],
    }),
  });

  if (!response.ok) {
    throw new Error(`Sheets append error: ${await response.text()}`);
  }
}

/**
 * Update a specific row in a Google Sheet
 */
export async function updateRow(sheetName: string, rowIndex: number, values: string[]): Promise<void> {
  const { credentials, spreadsheetId } = getConfig();
  const accessToken = await getAccessToken(credentials);

  // A1 notation for the row (rowIndex is 0-based, Sheets is 1-based)
  const range = `${sheetName}!A${rowIndex + 1}`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`;

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      values: [values],
    }),
  });

  if (!response.ok) {
    throw new Error(`Sheets update error: ${await response.text()}`);
  }
}

/**
 * Parse sheet rows into typed objects
 */
export function parseRows<T>(rows: string[][]): T[] {
  if (rows.length < 2) return [];
  const headers = rows[0];
  const results: T[] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    const obj: Record<string, string> = {};
    headers.forEach((header, index) => {
      obj[header] = row[index] || '';
    });
    results.push(obj as T);
  }
  return results;
}

/**
 * Find a row by column value
 */
export function findRowIndex(rows: string[][], columnName: string, value: string): number {
  if (rows.length < 2) return -1;
  const headers = rows[0];
  const columnIdx = headers.indexOf(columnName);
  if (columnIdx === -1) return -1;

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][columnIdx] === value) {
      return i;
    }
  }
  return -1;
}
