/**
 * API: GET /api/bake-slots/[slotId]/flavors
 * Returns available flavors for a specific bake slot
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { readSheet, SHEETS, parseRows, findRow } from './sheets-client';

interface FlavorRow {
  id: string;
  name: string;
  description: string;
  basePrice: string;
  isActive: string;
  season: string;
  sortOrder: string;
}

interface FlavorCapRow {
  bakeSlotId: string;
  flavorId: string;
  maxQuantity: string;
  currentQuantity: string;
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
    const { slotId } = req.query;

    if (!slotId || typeof slotId !== 'string') {
      return res.status(400).json({ error: 'Slot ID required' });
    }

    // Get all flavors
    const flavorRows = await readSheet(SHEETS.FLAVORS);
    const flavors = parseRows<FlavorRow>(flavorRows);

    // Get flavor caps for this slot (if they exist in a FlavorCaps sheet)
    // For simplicity, caps are stored as columns in the BakeSlots sheet
    // or in a separate FlavorCaps sheet

    // Transform for public consumption
    const availableFlavors = flavors
      .filter(f => f.isActive === 'TRUE')
      .map(flavor => ({
        id: flavor.id,
        name: flavor.name,
        basePrice: parseFloat(flavor.basePrice) || 0,
        isActive: true, // Could check caps here
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    return res.status(200).json(availableFlavors);
  } catch (error) {
    console.error('Error fetching flavors:', error);
    return res.status(500).json({
      error: 'Failed to fetch flavors',
      code: 'SYNC-203'
    });
  }
}
