/**
 * Minimal async test endpoint
 * Tests if async/await works in Vercel serverless functions
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

export default async function handler(_req: VercelRequest, res: VercelResponse) {
  // Simple async operation
  await Promise.resolve();

  return res.status(200).json({
    status: 'ok',
    async: true,
    time: new Date().toISOString()
  });
}
