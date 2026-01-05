/**
 * API: POST /api/orders
 * Submit a new order to Google Sheets
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

let cachedToken: { token: string; expires: number } | null = null;

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

  const data = await response.json() as TokenResponse;
  cachedToken = {
    token: data.access_token,
    expires: Date.now() + (data.expires_in - 60) * 1000,
  };
  return data.access_token;
}

function getConfig() {
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

async function readSheet(sheetName: string): Promise<string[][]> {
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

async function appendRow(sheetName: string, values: string[]): Promise<void> {
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

async function updateRow(sheetName: string, rowIndex: number, values: string[]): Promise<void> {
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

// ============ Data Types ============

interface OrderItem {
  flavorId: string;
  flavorName: string;
  size: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

interface OrderPayload {
  order: {
    id: string;
    bakeSlotId: string;
    pickupLocationId?: string;
    items: OrderItem[];
    totalAmount: number;
    customerNotes: string;
  };
  customer: {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    notificationPref: string;
    smsOptIn: boolean;
  };
}

// ============ Twilio SMS Integration ============

interface OrderSummary {
  customerName: string;
  customerPhone: string;
  items: OrderItem[];
  totalAmount: number;
  bakeDate: string;
}

async function sendOwnerSmsNotification(orderSummary: OrderSummary): Promise<void> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioPhone = process.env.TWILIO_PHONE_NUMBER;
  const ownerPhones = process.env.OWNER_PHONE_NUMBERS; // comma-separated

  // Skip if Twilio not configured
  if (!accountSid || !authToken || !twilioPhone || !ownerPhones) {
    console.log('Twilio not configured, skipping SMS notification');
    return;
  }

  // Build message
  const itemSummary = orderSummary.items
    .map(item => `${item.quantity}x ${item.flavorName} (${item.size})`)
    .join(', ');

  const message = `New Order!\n` +
    `${orderSummary.customerName}\n` +
    `${orderSummary.customerPhone}\n` +
    `${itemSummary}\n` +
    `$${orderSummary.totalAmount.toFixed(2)}\n` +
    `Pickup: ${orderSummary.bakeDate}`;

  // Send to each owner phone
  const phones = ownerPhones.split(',').map(p => p.trim()).filter(Boolean);
  const auth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');

  for (const phone of phones) {
    try {
      const response = await fetch(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          body: new URLSearchParams({
            From: twilioPhone,
            To: phone,
            Body: message,
          }).toString(),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Failed to send SMS to ${phone}:`, errorText);
      } else {
        console.log(`SMS sent to ${phone}`);
      }
    } catch (error) {
      console.error(`Error sending SMS to ${phone}:`, error);
    }
  }
}

// ============ Handler ============

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { order, customer } = req.body as OrderPayload;

    // Validate required fields
    if (!order?.id || !order?.bakeSlotId || !order?.items?.length) {
      return res.status(400).json({
        error: 'Invalid order data',
        code: 'DATA-403'
      });
    }

    if (!customer?.firstName || !customer?.lastName || !customer?.email || !customer?.phone) {
      return res.status(400).json({
        error: 'Customer information required',
        code: 'DATA-403'
      });
    }

    // Read current data
    const [slotsData, customersData] = await Promise.all([
      readSheet('BakeSlots'),
      readSheet('Customers'),
    ]);

    // Find the bake slot
    const slotHeaders = slotsData[0] || [];
    const slotIdIdx = slotHeaders.indexOf('id');
    const totalCapIdx = slotHeaders.indexOf('total_capacity');
    const currentOrdersIdx = slotHeaders.indexOf('current_orders');
    const slotDateIdx = slotHeaders.indexOf('date');

    let slotRowIndex = -1;
    let slotRow: string[] | null = null;

    for (let i = 1; i < slotsData.length; i++) {
      if (slotsData[i][slotIdIdx] === order.bakeSlotId) {
        slotRowIndex = i;
        slotRow = slotsData[i];
        break;
      }
    }

    if (!slotRow) {
      return res.status(400).json({
        error: 'Bake slot not found',
        code: 'ORD-SLOT_CLOSED'
      });
    }

    // Check capacity
    const totalCapacity = parseInt(slotRow[totalCapIdx]) || 0;
    const currentOrders = parseInt(slotRow[currentOrdersIdx]) || 0;
    const orderQuantity = order.items.reduce((sum, item) => sum + item.quantity, 0);

    if (currentOrders + orderQuantity > totalCapacity) {
      return res.status(400).json({
        error: 'Not enough capacity for this order',
        code: 'ORD-106'
      });
    }

    // Find or create customer
    const custHeaders = customersData[0] || [];
    const custEmailIdx = custHeaders.indexOf('email');
    const custIdIdx = custHeaders.indexOf('id');

    let customerId: string;
    let existingCustRowIndex = -1;

    for (let i = 1; i < customersData.length; i++) {
      if (customersData[i][custEmailIdx]?.toLowerCase() === customer.email.toLowerCase()) {
        customerId = customersData[i][custIdIdx];
        existingCustRowIndex = i;
        break;
      }
    }

    const now = new Date().toISOString();

    if (existingCustRowIndex === -1) {
      // Create new customer
      customerId = `cust-${Date.now().toString(36)}`;
      const newCustomer = [
        customerId,                           // id
        customer.firstName,                   // first_name
        customer.lastName,                    // last_name
        customer.email,                       // email
        customer.phone,                       // phone
        customer.notificationPref,            // notification_pref
        customer.smsOptIn ? '1' : '0',        // sms_opt_in
        '0',                                  // credit_balance
        '1',                                  // total_orders
        order.totalAmount.toString(),         // total_spent
        now,                                  // created_at
        now,                                  // updated_at
      ];
      await appendRow('Customers', newCustomer);
    } else {
      customerId = customersData[existingCustRowIndex][custIdIdx];
      // Update existing customer stats
      const existingRow = customersData[existingCustRowIndex];
      const totalOrdersIdx = custHeaders.indexOf('total_orders');
      const totalSpentIdx = custHeaders.indexOf('total_spent');
      const updatedAtIdx = custHeaders.indexOf('updated_at');

      const updatedRow = [...existingRow];
      updatedRow[totalOrdersIdx] = ((parseInt(existingRow[totalOrdersIdx]) || 0) + 1).toString();
      updatedRow[totalSpentIdx] = ((parseFloat(existingRow[totalSpentIdx]) || 0) + order.totalAmount).toString();
      updatedRow[updatedAtIdx] = now;

      await updateRow('Customers', existingCustRowIndex, updatedRow);
    }

    // Create order row matching sheet columns:
    // id, customer_id, bake_slot_id, pickup_location_id, items, total_amount, status, payment_method, payment_status, customer_notes, admin_notes, created_at, updated_at
    const orderRow = [
      order.id,
      customerId,
      order.bakeSlotId,
      order.pickupLocationId || '',           // pickup_location_id
      JSON.stringify(order.items),
      order.totalAmount.toString(),
      'submitted',
      '',                                     // payment_method
      'pending',                              // payment_status
      order.customerNotes || '',
      '',                                     // admin_notes
      now,
      now,
    ];

    await appendRow('Orders', orderRow);

    // Update bake slot order count
    const updatedSlot = [...slotRow];
    updatedSlot[currentOrdersIdx] = (currentOrders + orderQuantity).toString();
    await updateRow('BakeSlots', slotRowIndex, updatedSlot);

    // Send owner SMS notification (non-blocking - don't fail order if SMS fails)
    const bakeDate = slotRow[slotDateIdx] || 'TBD';
    sendOwnerSmsNotification({
      customerName: `${customer.firstName} ${customer.lastName}`,
      customerPhone: customer.phone,
      items: order.items,
      totalAmount: order.totalAmount,
      bakeDate,
    }).catch(err => console.error('SMS notification error:', err));

    return res.status(200).json({
      orderId: order.id,
      message: 'Order placed successfully'
    });

  } catch (error) {
    console.error('Error submitting order:', error);
    return res.status(500).json({
      error: 'Failed to submit order',
      details: error instanceof Error ? error.message : 'Unknown error',
      code: 'ORD-001'
    });
  }
}
