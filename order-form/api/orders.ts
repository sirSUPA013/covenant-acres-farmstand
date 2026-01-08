/**
 * API: POST /api/orders
 * Submit a new order to Google Sheets
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { readSheet, appendRow, updateRow } from './lib/sheets';

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

// ============ Server-Side Validation ============

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^[\d\s\-+().]{10,20}$/;
const MAX_NAME_LENGTH = 100;
const MAX_NOTES_LENGTH = 500;
const MAX_QUANTITY_PER_ITEM = 50;
const MAX_ITEMS_PER_ORDER = 20;
const MAX_ORDER_TOTAL = 5000;

function validateEmail(email: string): boolean {
  return EMAIL_REGEX.test(email) && email.length <= 254;
}

function validatePhone(phone: string): boolean {
  return PHONE_REGEX.test(phone);
}

function sanitizeString(str: string, maxLength: number): string {
  // Remove control characters and limit length
  return str.replace(/[\x00-\x1F\x7F]/g, '').trim().substring(0, maxLength);
}

function validateOrderItems(items: OrderItem[]): { valid: boolean; error?: string } {
  if (!Array.isArray(items) || items.length === 0) {
    return { valid: false, error: 'Order must contain at least one item' };
  }
  if (items.length > MAX_ITEMS_PER_ORDER) {
    return { valid: false, error: `Order cannot contain more than ${MAX_ITEMS_PER_ORDER} items` };
  }

  for (const item of items) {
    if (!item.flavorId || typeof item.flavorId !== 'string') {
      return { valid: false, error: 'Invalid flavor ID' };
    }
    if (!item.quantity || item.quantity < 1 || item.quantity > MAX_QUANTITY_PER_ITEM) {
      return { valid: false, error: `Quantity must be between 1 and ${MAX_QUANTITY_PER_ITEM}` };
    }
    if (typeof item.unitPrice !== 'number' || item.unitPrice < 0 || item.unitPrice > 1000) {
      return { valid: false, error: 'Invalid item price' };
    }
  }

  return { valid: true };
}

function recalculateTotalAmount(items: OrderItem[]): number {
  // Server-side recalculation - never trust client-provided total
  return items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
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

    // Enhanced validation
    if (!validateEmail(customer.email)) {
      return res.status(400).json({
        error: 'Invalid email address',
        code: 'DATA-403'
      });
    }

    if (!validatePhone(customer.phone)) {
      return res.status(400).json({
        error: 'Invalid phone number',
        code: 'DATA-403'
      });
    }

    // Validate order items
    const itemsValidation = validateOrderItems(order.items);
    if (!itemsValidation.valid) {
      return res.status(400).json({
        error: itemsValidation.error,
        code: 'DATA-403'
      });
    }

    // Recalculate total server-side (don't trust client)
    const calculatedTotal = recalculateTotalAmount(order.items);
    if (calculatedTotal > MAX_ORDER_TOTAL) {
      return res.status(400).json({
        error: `Order total cannot exceed $${MAX_ORDER_TOTAL}`,
        code: 'DATA-403'
      });
    }

    // Sanitize text inputs
    const sanitizedCustomer = {
      firstName: sanitizeString(customer.firstName, MAX_NAME_LENGTH),
      lastName: sanitizeString(customer.lastName, MAX_NAME_LENGTH),
      email: customer.email.toLowerCase().trim(),
      phone: customer.phone.replace(/[^\d+]/g, ''),
      notificationPref: customer.notificationPref,
      smsOptIn: customer.smsOptIn,
    };
    const sanitizedNotes = sanitizeString(order.customerNotes || '', MAX_NOTES_LENGTH);

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
      // Create new customer (using sanitized values)
      customerId = `cust-${Date.now().toString(36)}`;
      const newCustomer = [
        customerId,                             // id
        sanitizedCustomer.firstName,            // first_name
        sanitizedCustomer.lastName,             // last_name
        sanitizedCustomer.email,                // email
        sanitizedCustomer.phone,                // phone
        sanitizedCustomer.notificationPref,     // notification_pref
        sanitizedCustomer.smsOptIn ? '1' : '0', // sms_opt_in
        '0',                                    // credit_balance
        '1',                                    // total_orders
        calculatedTotal.toString(),             // total_spent (use server-calculated total)
        now,                                    // created_at
        now,                                    // updated_at
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
      updatedRow[totalSpentIdx] = ((parseFloat(existingRow[totalSpentIdx]) || 0) + calculatedTotal).toString();
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
      calculatedTotal.toString(),             // Use server-calculated total
      'submitted',
      '',                                     // payment_method
      'pending',                              // payment_status
      sanitizedNotes,                         // Use sanitized notes
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
      customerName: `${sanitizedCustomer.firstName} ${sanitizedCustomer.lastName}`,
      customerPhone: sanitizedCustomer.phone,
      items: order.items,
      totalAmount: calculatedTotal,
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
