/**
 * API: GET /api/flavors
 * Returns available bread flavors from Google Sheets
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
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Sheets API error: ${await response.text()}`);
  }

  const data = await response.json() as { values?: string[][] };
  return data.values || [];
}

// ============ Data Types ============

interface FlavorRow {
  id: string;
  name: string;
  description: string;
  sizes: string; // JSON string
  is_active: string;
  season: string;
  sort_order: string;
}

interface Size {
  name: string;
  price: number;
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
    const rows = await readSheet('Flavors');
    const flavors = parseRows<FlavorRow>(rows);

    // Determine current season for filtering
    const month = new Date().getMonth() + 1;
    const currentSeason = month >= 9 && month <= 11 ? 'fall'
                        : month === 12 || month <= 2 ? 'winter'
                        : month >= 3 && month <= 5 ? 'spring'
                        : 'summer';

    // Filter and transform
    const availableFlavors = flavors
      .filter(flavor => {
        // Only active flavors
        if (flavor.is_active !== '1' && flavor.is_active !== 'TRUE') return false;

        // Check season availability
        const season = flavor.season?.toLowerCase() || 'year_round';
        if (season !== 'year_round' && season !== currentSeason) return false;

        return true;
      })
      .map(flavor => {
        let sizes: Size[] = [];
        try {
          sizes = JSON.parse(flavor.sizes || '[]');
        } catch {
          sizes = [{ name: 'Regular', price: 10 }]; // Default fallback
        }

        return {
          id: flavor.id,
          name: flavor.name,
          description: flavor.description,
          sizes,
        };
      })
      .sort((a, b) => parseInt(flavors.find(f => f.id === a.id)?.sort_order || '999')
                    - parseInt(flavors.find(f => f.id === b.id)?.sort_order || '999'));

    return res.status(200).json(availableFlavors);
  } catch (error) {
    console.error('Error fetching flavors:', error);
    return res.status(500).json({
      error: 'Failed to fetch flavors',
      details: error instanceof Error ? error.message : 'Unknown error',
      code: 'SYNC-204'
    });
  }
}
