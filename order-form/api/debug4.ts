/**
 * Debug endpoint importing from shared folder
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { SHEETS } from '../shared/sheets';

export default function handler(_req: VercelRequest, res: VercelResponse) {
  return res.status(200).json({
    status: 'debug4',
    sheetsConstant: SHEETS.BAKE_SLOTS,
  });
}
