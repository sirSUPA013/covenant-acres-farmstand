/**
 * Google Sheets Client
 * Handles authentication and CRUD operations with Google Sheets
 */

import { google, sheets_v4 } from 'googleapis';

// Sheet names
export const SHEETS = {
  ORDERS: 'Orders',
  CUSTOMERS: 'Customers',
  BAKE_SLOTS: 'BakeSlots',
  FLAVORS: 'Flavors',
  LOCATIONS: 'Locations',
  RECIPES: 'Recipes',
  INGREDIENTS: 'Ingredients',
  CONFIG: 'Config',
  NOTIFICATIONS: 'NotificationLog',
} as const;

let sheetsClient: sheets_v4.Sheets | null = null;

/**
 * Get authenticated Google Sheets client
 */
export async function getSheetsClient(): Promise<sheets_v4.Sheets> {
  if (sheetsClient) return sheetsClient;

  const credentials = JSON.parse(process.env.GOOGLE_CREDENTIALS || '{}');

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });

  sheetsClient = google.sheets({ version: 'v4', auth });
  return sheetsClient;
}

/**
 * Get spreadsheet ID from environment
 */
export function getSpreadsheetId(): string {
  const id = process.env.GOOGLE_SPREADSHEET_ID;
  if (!id) throw new Error('GOOGLE_SPREADSHEET_ID not configured');
  return id;
}

/**
 * Read all rows from a sheet
 */
export async function readSheet(sheetName: string): Promise<string[][]> {
  const sheets = await getSheetsClient();
  const spreadsheetId = getSpreadsheetId();

  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: sheetName,
  });

  return response.data.values || [];
}

/**
 * Append a row to a sheet
 */
export async function appendRow(sheetName: string, values: (string | number | boolean | null)[]): Promise<void> {
  const sheets = await getSheetsClient();
  const spreadsheetId = getSpreadsheetId();

  await sheets.spreadsheets.values.append({
    spreadsheetId,
    range: sheetName,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [values.map(v => v === null ? '' : String(v))],
    },
  });
}

/**
 * Update a specific row in a sheet
 */
export async function updateRow(
  sheetName: string,
  rowIndex: number,
  values: (string | number | boolean | null)[]
): Promise<void> {
  const sheets = await getSheetsClient();
  const spreadsheetId = getSpreadsheetId();

  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${sheetName}!A${rowIndex + 1}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: {
      values: [values.map(v => v === null ? '' : String(v))],
    },
  });
}

/**
 * Find a row by column value
 */
export async function findRow(
  sheetName: string,
  columnIndex: number,
  value: string
): Promise<{ rowIndex: number; data: string[] } | null> {
  const rows = await readSheet(sheetName);

  for (let i = 1; i < rows.length; i++) { // Skip header row
    if (rows[i][columnIndex] === value) {
      return { rowIndex: i, data: rows[i] };
    }
  }

  return null;
}

/**
 * Parse sheet rows into objects using header row
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
