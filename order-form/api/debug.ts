/**
 * Debug endpoint to test API and sheets connection
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { SHEETS } from './_sheets';

export default function handler(_req: VercelRequest, res: VercelResponse) {
  return res.status(200).json({
    status: 'debug',
    sheetsConstant: SHEETS.BAKE_SLOTS,
  });
}
