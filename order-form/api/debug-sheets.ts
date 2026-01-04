/**
 * Debug endpoint to view raw sheet data
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createSign } from 'crypto';

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
    const error = await response.text();
    throw new Error(`Token exchange failed: ${error}`);
  }

  const data = await response.json() as TokenResponse;
  return data.access_token;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  try {
    const credentialsJson = process.env.GOOGLE_SHEETS_CREDENTIALS;
    const spreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID;

    if (!credentialsJson || !spreadsheetId) {
      return res.status(500).json({
        error: 'Missing config',
        hasCredentials: !!credentialsJson,
        hasSpreadsheetId: !!spreadsheetId
      });
    }

    const credentials = JSON.parse(credentialsJson) as ServiceAccountCredentials;
    const accessToken = await getAccessToken(credentials);

    // Get spreadsheet metadata to see all sheet names
    const metaUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=sheets.properties.title`;
    const metaResponse = await fetch(metaUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!metaResponse.ok) {
      const error = await metaResponse.text();
      return res.status(500).json({ error: 'Metadata fetch failed', details: error });
    }

    const metadata = await metaResponse.json() as { sheets: { properties: { title: string } }[] };
    const sheetNames = metadata.sheets.map(s => s.properties.title);

    // Try to read BakeSlots sheet
    const sheetName = req.query.sheet as string || 'BakeSlots';
    const dataUrl = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${encodeURIComponent(sheetName)}`;
    const dataResponse = await fetch(dataUrl, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    let sheetData = null;
    let sheetError = null;
    if (dataResponse.ok) {
      const data = await dataResponse.json() as { values?: string[][] };
      sheetData = data.values || [];
    } else {
      sheetError = await dataResponse.text();
    }

    return res.status(200).json({
      spreadsheetId,
      availableSheets: sheetNames,
      requestedSheet: sheetName,
      sheetData,
      sheetError,
      rowCount: sheetData?.length || 0,
    });

  } catch (error) {
    return res.status(500).json({
      error: 'Debug failed',
      details: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}
