/**
 * Debug endpoint without any imports from _sheets
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

// Inline constant instead of importing
const SHEETS = {
  ORDERS: 'Orders',
  BAKE_SLOTS: 'BakeSlots',
} as const;

export default function handler(_req: VercelRequest, res: VercelResponse) {
  return res.status(200).json({
    status: 'debug2',
    sheetsConstant: SHEETS.BAKE_SLOTS,
  });
}
