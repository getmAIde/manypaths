/**
 * stripe-handlers.js — Stripe subscription checkout & verification
 *
 * Required env vars (set in Vercel):
 *   STRIPE_SECRET_KEY       — sk_live_...
 *   STRIPE_PRICE_ID_MONTHLY — price_... (Pro plan, monthly)
 *   STRIPE_PRICE_ID_YEARLY  — price_... (Pro plan, annual)
 *   STRIPE_JWT_SECRET       — random 32-byte hex for JWT signing
 *
 * Endpoints:
 *   POST /api/checkout          → { url: <stripe_hosted_checkout> }
 *   POST /api/checkout/verify   → { token: <jwt> }
 */

import { signToken } from './auth.js';

const STRIPE_API = 'https://api.stripe.com/v1';
const BASE_URL = 'https://manypaths.one';
const SUCCESS_URL = `${BASE_URL}/research?session_id={CHECKOUT_SESSION_ID}`;
const CANCEL_URL = `${BASE_URL}/upgrade?cancelled=1`;

/**
 * POST /api/checkout
 * Body: { annual: boolean }
 * Returns: { url: <stripe_hosted_checkout_url> }
 */
export async function createCheckout(req, res) {
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', async () => {
    try {
      const { annual, seminary } = JSON.parse(body || '{}');
      const secretKey = process.env.STRIPE_SECRET_KEY;
      let priceId;
      if (seminary) {
        priceId = annual
          ? process.env.STRIPE_PRICE_ID_SEM_YEARLY
          : process.env.STRIPE_PRICE_ID_SEM_MONTHLY;
      } else {
        priceId = annual
          ? process.env.STRIPE_PRICE_ID_YEARLY
          : process.env.STRIPE_PRICE_ID_MONTHLY;
      }

      if (!secretKey) throw new Error('STRIPE_SECRET_KEY not set');
      if (!priceId) throw new Error(`STRIPE_PRICE_ID_${seminary ? 'SEM_' : ''}${annual ? 'YEARLY' : 'MONTHLY'} not set`);

      const params = new URLSearchParams();
      params.append('mode', 'subscription');
      params.append('line_items[0][price]', priceId);
      params.append('line_items[0][quantity]', '1');
      params.append('success_url', SUCCESS_URL);
      params.append('cancel_url', CANCEL_URL);
      params.append('subscription_data[trial_period_days]', '7');

      const response = await fetch(`${STRIPE_API}/checkout/sessions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${secretKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error?.message || `Stripe error: ${response.status}`);
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ url: data.url }));
    } catch (err) {
      console.error('[checkout] error:', err.message);
      const status = err.message.includes('not set') ? 503 : 500;
      res.writeHead(status, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
  });
}

/**
 * POST /api/checkout/verify
 * Body: { sessionId }
 * Returns: { token: <jwt_for_research_access> }
 */
export async function verifyCheckout(req, res) {
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', async () => {
    try {
      const { sessionId } = JSON.parse(body || '{}');
      if (!sessionId) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'sessionId required' }));
      }

      const secretKey = process.env.STRIPE_SECRET_KEY;
      const jwtSecret = process.env.STRIPE_JWT_SECRET;
      if (!secretKey) throw new Error('STRIPE_SECRET_KEY not set');
      if (!jwtSecret) throw new Error('STRIPE_JWT_SECRET not set');

      const response = await fetch(`${STRIPE_API}/checkout/sessions/${sessionId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${secretKey}`,
        },
      });

      const session = await response.json();
      if (!response.ok) {
        throw new Error(session.error?.message || `Stripe error: ${response.status}`);
      }

      // Check if payment is complete
      if (session.payment_status !== 'paid') {
        res.writeHead(402, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Payment not complete' }));
      }

      // Sign JWT for research access
      const token = signToken({
        customerId: session.customer,
        subscriptionId: session.subscription,
        email: session.customer_details?.email || null,
      }, jwtSecret);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ token }));
    } catch (err) {
      console.error('[verify] error:', err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
  });
}

/**
 * POST /api/webhook
 * Stripe webhook handler (basic — no signature verification yet)
 */
export async function handleWebhook(req, res) {
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', async () => {
    try {
      const event = JSON.parse(body);
      console.log(`[webhook] ${event.type}: ${event.data?.object?.id}`);
      res.writeHead(200);
      res.end('ok');
    } catch (err) {
      console.error('[webhook] error:', err.message);
      res.writeHead(500);
      res.end('error');
    }
  });
}
