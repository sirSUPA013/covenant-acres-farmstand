/**
 * API: GET /api/payment-options
 * Returns configured payment links for prepayment from Google Sheets
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

interface PaymentOption {
  type: 'venmo' | 'cashapp' | 'paypal' | 'zelle';
  label: string;
  value: string;
  link?: string;
}

interface SettingsRow {
  id: string;
  enable_prepayment: string;
  venmo_username: string;
  cashapp_cashtag: string;
  paypal_username: string;
  zelle_email: string;
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
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Read settings from Google Sheets
    const rows = await readSheet('PublicSettings');
    const settings = parseRows<SettingsRow>(rows);

    // Get first row (settings are single-row)
    const config = settings[0];

    if (!config) {
      return res.status(200).json({
        enabled: false,
        options: [],
      });
    }

    // Check if prepayment is enabled
    const enablePrepayment = config.enable_prepayment === '1' || config.enable_prepayment === 'TRUE';

    if (!enablePrepayment) {
      return res.status(200).json({
        enabled: false,
        options: [],
      });
    }

    // Build payment options from settings
    const options: PaymentOption[] = [];

    const venmoUsername = config.venmo_username?.trim();
    if (venmoUsername) {
      options.push({
        type: 'venmo',
        label: 'Venmo',
        value: `@${venmoUsername}`,
        link: `https://venmo.com/${venmoUsername}`,
      });
    }

    const cashappCashtag = config.cashapp_cashtag?.trim();
    if (cashappCashtag) {
      options.push({
        type: 'cashapp',
        label: 'Cash App',
        value: `$${cashappCashtag}`,
        link: `https://cash.app/$${cashappCashtag}`,
      });
    }

    const paypalUsername = config.paypal_username?.trim();
    if (paypalUsername) {
      options.push({
        type: 'paypal',
        label: 'PayPal',
        value: `paypal.me/${paypalUsername}`,
        link: `https://paypal.me/${paypalUsername}`,
      });
    }

    const zelleEmail = config.zelle_email?.trim();
    if (zelleEmail) {
      options.push({
        type: 'zelle',
        label: 'Zelle',
        value: zelleEmail,
        // Zelle doesn't have a universal deep link
      });
    }

    return res.status(200).json({
      enabled: true,
      options,
    });
  } catch (error) {
    console.error('Error fetching payment options:', error);
    // Return disabled if we can't read settings
    return res.status(200).json({
      enabled: false,
      options: [],
    });
  }
}
