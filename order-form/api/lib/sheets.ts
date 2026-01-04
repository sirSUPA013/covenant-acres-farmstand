/**
 * Google Sheets Client - Shared module
 */

// Sheet names
export const SHEETS = {
  ORDERS: 'Orders',
  CUSTOMERS: 'Customers',
  BAKE_SLOTS: 'BakeSlots',
  FLAVORS: 'Flavors',
  LOCATIONS: 'Locations',
} as const;

// Placeholder - will be implemented
export async function readSheet(sheetName: string): Promise<string[][]> {
  console.log('readSheet called for', sheetName);
  return [['header1', 'header2'], ['value1', 'value2']];
}

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
