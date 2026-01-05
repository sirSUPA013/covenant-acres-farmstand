/**
 * API: GET /api/payment-options
 * Returns configured payment links for prepayment
 */

import type { VercelRequest, VercelResponse } from '@vercel/node';

interface PaymentOption {
  type: 'venmo' | 'cashapp' | 'paypal' | 'zelle';
  label: string;
  value: string;
  link?: string;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Check if prepayment is enabled
  const enablePrepayment = process.env.ENABLE_PREPAYMENT === 'true';

  if (!enablePrepayment) {
    return res.status(200).json({
      enabled: false,
      options: [],
    });
  }

  // Build payment options from env vars
  const options: PaymentOption[] = [];

  const venmoUsername = process.env.VENMO_USERNAME?.trim();
  if (venmoUsername) {
    options.push({
      type: 'venmo',
      label: 'Venmo',
      value: `@${venmoUsername}`,
      // Venmo deep link with amount placeholder (amount added by frontend)
      link: `https://venmo.com/${venmoUsername}`,
    });
  }

  const cashappCashtag = process.env.CASHAPP_CASHTAG?.trim();
  if (cashappCashtag) {
    options.push({
      type: 'cashapp',
      label: 'Cash App',
      value: `$${cashappCashtag}`,
      link: `https://cash.app/$${cashappCashtag}`,
    });
  }

  const paypalUsername = process.env.PAYPAL_USERNAME?.trim();
  if (paypalUsername) {
    options.push({
      type: 'paypal',
      label: 'PayPal',
      value: `paypal.me/${paypalUsername}`,
      link: `https://paypal.me/${paypalUsername}`,
    });
  }

  const zelleEmail = process.env.ZELLE_EMAIL?.trim();
  if (zelleEmail) {
    options.push({
      type: 'zelle',
      label: 'Zelle',
      value: zelleEmail,
      // Zelle doesn't have a universal deep link
    });
  }

  return res.status(200).json({
    enabled: true,
    options,
  });
}
