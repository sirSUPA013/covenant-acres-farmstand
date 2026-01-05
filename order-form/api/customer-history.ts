/**
 * API: GET /api/customer-history?email=xxx
 * Returns customer info and order history for returning customers
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createSign } from 'crypto';

// ============ Google Sheets Integration ============

interface ServiceAccountCredentials {
  client_email: string;
  private_key: string;
}

interface TokenResponse {
  access_token: string;
  expires_in: number;
}

function createJWT(credentials: ServiceAccountCredentials): string {
  const now = Math.floor(Date.now() / 1000);

  const header = {
    alg: 'RS256',
    typ: 'JWT',
  };

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
  const jwt = createJWT(credentials);

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Token exchange failed: ${error}`);
  }

  const data = await response.json() as TokenResponse;
  return data.access_token;
}

async function readSheet(sheetName: string): Promise<string[][]> {
  const credentialsJson = process.env.GOOGLE_SHEETS_CREDENTIALS;
  const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;

  if (!credentialsJson || !spreadsheetId) {
    throw new Error('Missing Google Sheets configuration');
  }

  const credentials = JSON.parse(credentialsJson) as ServiceAccountCredentials;
  const accessToken = await getAccessToken(credentials);

  const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}`;

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Sheets API error: ${error}`);
  }

  const data = await response.json() as { values?: string[][] };
  return data.values || [];
}

// ============ Data Types ============

interface CustomerRow {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
}

interface OrderRow {
  id: string;
  customer_id: string;
  bake_slot_id: string;
  pickup_location_id: string;
  items: string;
  total_amount: string;
  status: string;
  created_at: string;
}

interface BakeSlotRow {
  id: string;
  date: string;
}

interface LocationRow {
  id: string;
  name: string;
}

function parseRows<T>(rows: string[][]): T[] {
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

// ============ Handler ============

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const email = req.query.email as string;
  if (!email) {
    return res.status(400).json({ error: 'Email is required' });
  }

  try {
    // Fetch all needed sheets
    const [customerRows, orderRows, slotRows, locationRows] = await Promise.all([
      readSheet('Customers'),
      readSheet('Orders'),
      readSheet('BakeSlots'),
      readSheet('Locations'),
    ]);

    const customers = parseRows<CustomerRow>(customerRows);
    const orders = parseRows<OrderRow>(orderRows);
    const slots = parseRows<BakeSlotRow>(slotRows);
    const locations = parseRows<LocationRow>(locationRows);

    // Find customer by email (case-insensitive)
    const customer = customers.find(c => c.email.toLowerCase() === email.toLowerCase());

    if (!customer) {
      return res.status(200).json({
        found: false,
        customer: null,
        orders: [],
      });
    }

    // Create lookup maps
    const slotMap = new Map(slots.map(s => [s.id, s.date]));
    const locationMap = new Map(locations.map(l => [l.id, l.name]));

    // Get customer's orders, sorted by date (newest first)
    const customerOrders = orders
      .filter(o => o.customer_id === customer.id)
      .map(o => {
        let items: Array<{ flavorName: string; quantity: number; totalPrice: number }> = [];
        try {
          items = JSON.parse(o.items || '[]');
        } catch {
          items = [];
        }

        return {
          id: o.id,
          date: slotMap.get(o.bake_slot_id) || 'Unknown',
          location: locationMap.get(o.pickup_location_id) || locationMap.get(o.bake_slot_id) || 'Unknown',
          items: items.map(i => ({
            name: i.flavorName,
            quantity: i.quantity,
            price: i.totalPrice,
          })),
          total: parseFloat(o.total_amount) || 0,
          status: o.status,
          createdAt: o.created_at,
        };
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10); // Last 10 orders

    return res.status(200).json({
      found: true,
      customer: {
        firstName: customer.first_name,
        lastName: customer.last_name,
        phone: customer.phone,
      },
      orders: customerOrders,
    });
  } catch (error) {
    console.error('Error fetching customer history:', error);
    return res.status(500).json({
      error: 'Failed to fetch customer history',
      details: error instanceof Error ? error.message : 'Unknown error',
      code: 'HIST-001'
    });
  }
}
