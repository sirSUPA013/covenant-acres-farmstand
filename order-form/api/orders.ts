/**
 * API: POST /api/orders
 * Submit a new order
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { appendRow, findRow, updateRow, readSheet, SHEETS, parseRows } from './sheets-client';

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
    createAccount: boolean;
  };
}

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

    // Check if bake slot is still available
    const slotResult = await findRow(SHEETS.BAKE_SLOTS, 0, order.bakeSlotId);
    if (!slotResult) {
      return res.status(400).json({
        error: 'Bake slot not found',
        code: 'ORD-SLOT_CLOSED'
      });
    }

    // Check capacity
    const totalCapacity = parseInt(slotResult.data[4]) || 0;
    const currentOrders = parseInt(slotResult.data[5]) || 0;
    const orderQuantity = order.items.reduce((sum, item) => sum + item.quantity, 0);

    if (currentOrders + orderQuantity > totalCapacity) {
      return res.status(400).json({
        error: 'Not enough capacity for this order',
        code: 'ORD-106'
      });
    }

    // Find or create customer
    let customerId: string;
    const existingCustomer = await findRow(SHEETS.CUSTOMERS, 3, customer.email);

    if (existingCustomer) {
      customerId = existingCustomer.data[0];
      // Update customer info
      const updatedCustomer = [
        customerId,
        customer.firstName,
        customer.lastName,
        customer.email,
        customer.phone,
        customer.notificationPref,
        customer.smsOptIn ? 'TRUE' : 'FALSE',
        customer.smsOptIn ? new Date().toISOString() : existingCustomer.data[7],
        customer.createAccount ? 'TRUE' : 'FALSE',
        '', // passwordHash
        existingCustomer.data[10] || '0', // creditBalance
        (parseInt(existingCustomer.data[11]) || 0) + 1, // totalOrders
        parseFloat(existingCustomer.data[12] || '0') + order.totalAmount, // totalSpent
        existingCustomer.data[13] || new Date().toISOString(), // firstOrderDate
        new Date().toISOString(), // lastOrderDate
        existingCustomer.data[15], // createdAt
        new Date().toISOString(), // updatedAt
      ];
      await updateRow(SHEETS.CUSTOMERS, existingCustomer.rowIndex, updatedCustomer);
    } else {
      customerId = `cust-${Date.now().toString(36)}`;
      const now = new Date().toISOString();
      const newCustomer = [
        customerId,
        customer.firstName,
        customer.lastName,
        customer.email,
        customer.phone,
        customer.notificationPref,
        customer.smsOptIn ? 'TRUE' : 'FALSE',
        customer.smsOptIn ? now : '',
        customer.createAccount ? 'TRUE' : 'FALSE',
        '', // passwordHash
        '0', // creditBalance
        '1', // totalOrders
        order.totalAmount.toString(), // totalSpent
        now, // firstOrderDate
        now, // lastOrderDate
        now, // createdAt
        now, // updatedAt
      ];
      await appendRow(SHEETS.CUSTOMERS, newCustomer);
    }

    // Create order
    const now = new Date().toISOString();
    const itemsJson = JSON.stringify(order.items);

    const orderRow = [
      order.id,
      customerId,
      order.bakeSlotId,
      itemsJson,
      order.totalAmount.toString(),
      'submitted', // status
      '', // paymentMethod
      'pending', // paymentStatus
      now, // createdAt
      now, // updatedAt
      slotResult.data[6], // cutoffAt (from slot)
      order.customerNotes,
      '', // adminNotes
      '0', // creditApplied
      '', // adjustmentReason
    ];

    await appendRow(SHEETS.ORDERS, orderRow);

    // Update bake slot order count
    const updatedSlot = [...slotResult.data];
    updatedSlot[5] = (currentOrders + orderQuantity).toString();
    await updateRow(SHEETS.BAKE_SLOTS, slotResult.rowIndex, updatedSlot);

    // TODO: Send confirmation notification

    return res.status(200).json({
      orderId: order.id,
      message: 'Order placed successfully'
    });
  } catch (error) {
    console.error('Error submitting order:', error);
    return res.status(500).json({
      error: 'Failed to submit order',
      code: 'ORD-001'
    });
  }
}
