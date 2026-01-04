/**
 * API: GET /api/bake-slots
 * Returns available bake slots from Google Sheets
 *
 * Self-contained to avoid Vercel module import issues
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

// Matches actual sheet column names
interface BakeSlotRow {
  id: string;
  date: string;
  location_id: string;
  total_capacity: string;
  current_orders: string;
  cutoff_time: string;
  is_open: string;
}

interface LocationRow {
  id: string;
  name: string;
  address: string;
  description: string;
  is_active: string;
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

  try {
    // Fetch both sheets
    const [slotRows, locationRows] = await Promise.all([
      readSheet('BakeSlots'),
      readSheet('Locations'),
    ]);

    const slots = parseRows<BakeSlotRow>(slotRows);
    const locations = parseRows<LocationRow>(locationRows);

    // Create location lookup map
    const locationMap = new Map(locations.map(loc => [loc.id, loc.name]));

    const now = new Date();

    // Filter and transform for public consumption
    const availableSlots = slots
      .filter(slot => {
        // Only show open slots (is_open = "1" or "TRUE")
        if (slot.is_open !== '1' && slot.is_open !== 'TRUE') return false;

        // Only show future slots
        const slotDate = new Date(slot.date);
        if (slotDate < now) return false;

        // Only show slots before cutoff
        if (slot.cutoff_time) {
          const cutoff = new Date(slot.cutoff_time);
          if (cutoff < now) return false;
        }

        return true;
      })
      .map(slot => {
        const total = parseInt(slot.total_capacity) || 0;
        const current = parseInt(slot.current_orders) || 0;
        const remaining = Math.max(0, total - current);

        return {
          id: slot.id,
          date: slot.date,
          locationName: locationMap.get(slot.location_id) || 'Unknown Location',
          spotsRemaining: remaining,
          isOpen: remaining > 0,
        };
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return res.status(200).json(availableSlots);
  } catch (error) {
    console.error('Error fetching bake slots:', error);
    return res.status(500).json({
      error: 'Failed to fetch bake slots',
      details: error instanceof Error ? error.message : 'Unknown error',
      code: 'SYNC-203'
    });
  }
}
