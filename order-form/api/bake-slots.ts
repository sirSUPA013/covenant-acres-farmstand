/**
 * API: GET /api/bake-slots
 * Returns available bake slots for the order form
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { readSheet, SHEETS, parseRows } from './sheets-client';

interface BakeSlotRow {
  id: string;
  date: string;
  locationId: string;
  locationName: string;
  totalCapacity: string;
  currentOrders: string;
  cutoffTime: string;
  isOpen: string;
  manuallyClosedBy: string;
}

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
    const rows = await readSheet(SHEETS.BAKE_SLOTS);
    const slots = parseRows<BakeSlotRow>(rows);

    const now = new Date();

    // Filter and transform for public consumption
    const availableSlots = slots
      .filter(slot => {
        // Only show open slots
        if (slot.isOpen !== 'TRUE') return false;
        if (slot.manuallyClosedBy) return false;

        // Only show future slots
        const slotDate = new Date(slot.date);
        if (slotDate < now) return false;

        // Only show slots before cutoff
        const cutoff = new Date(slot.cutoffTime);
        if (cutoff < now) return false;

        return true;
      })
      .map(slot => {
        const total = parseInt(slot.totalCapacity) || 0;
        const current = parseInt(slot.currentOrders) || 0;
        const remaining = Math.max(0, total - current);

        return {
          id: slot.id,
          date: slot.date,
          locationName: slot.locationName,
          remainingCapacity: remaining,
          isOpen: remaining > 0,
        };
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return res.status(200).json(availableSlots);
  } catch (error) {
    console.error('Error fetching bake slots:', error);
    return res.status(500).json({
      error: 'Failed to fetch bake slots',
      code: 'SYNC-203'
    });
  }
}
