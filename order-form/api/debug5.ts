/**
 * Debug endpoint with path import
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import path from 'path';

export default function handler(_req: VercelRequest, res: VercelResponse) {
  return res.status(200).json({
    status: 'debug5',
    sep: path.sep,
  });
}
