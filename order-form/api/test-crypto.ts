/**
 * Test crypto import
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createSign } from 'crypto';

export default function handler(_req: VercelRequest, res: VercelResponse) {
  try {
    const sign = createSign('RSA-SHA256');
    return res.status(200).json({
      status: 'ok',
      cryptoAvailable: true,
      signType: typeof sign
    });
  } catch (e) {
    return res.status(500).json({
      status: 'error',
      error: e instanceof Error ? e.message : 'unknown'
    });
  }
}
