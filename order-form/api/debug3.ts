/**
 * Debug endpoint importing from lib/sheets
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { SHEETS } from './lib/sheets';

export default function handler(_req: VercelRequest, res: VercelResponse) {
  return res.status(200).json({
    status: 'debug3',
    sheetsConstant: SHEETS.BAKE_SLOTS,
  });
}
