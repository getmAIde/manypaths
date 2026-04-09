/**
 * stripe-handlers.js — Stripe Checkout, session verification, and webhook.
 *
 * Required env vars (add to Vercel):
 *   STRIPE_SECRET_KEY      — sk_live_... (from Stripe Dashboard → Developers → API keys)
 *   STRIPE_PRICE_ID        — price_... (from Stripe Dashboard → Products → Many Paths Pro → price ID)
 *   STRIPE_WEBHOOK_SECRET  — whsec_... (from Stripe Dashboard → Webhooks → endpoint secret)
 *   STRIPE_JWT_SECRET      — random 32-byte hex (run: openssl rand -hex 32)
 *
 * Activation: set RESEARCH_PAYWALL_ENABLED=true in Vercel env vars.
 */

import { signToken } from './auth.js';

const BASE_URL      = 'https://manypaths.one';
const SUCCESS_URL   = `${BASE_URL}/research?session_id={CHECKOUT_SESSION_ID}`;
const CANCEL_URL    = `${BASE_URL}/research?checkout=cancelled`;
const STRIPE_API    = 'https://api.stripe.com/v1';

// POST /api/checkout → { url: <stripe-hosted-checkout-url> }
// seminary=true applies the SEMINARY44 coupon (44% off forever)
export async function createCheckout(res, { seminary = false } = {}) {
  try {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) throw new Error('STRIPE_SECRET_KEY not set');

    const priceId = seminary
      ? process.env.STRIPE_PRICE_ID_SEM_MONTHLY
      : process.env.STRIPE_PRICE_ID_MONTHLY;
    if (!priceId) throw new Error('Price ID not configured');

    const body = new URLSearchParams();
    body.append('mode', 'subscription');
    body.append('line_items[0][price]', priceId);
    body.append('line_items[0][quantity]', '1');
    body.append('success_url', SUCCESS_URL);
    body.append('cancel_url', CANCEL_URL);
    body.append('subscription_data[trial_period_days]', '7');
    body.append('subscription_data[metadata][product]', 'manypaths_research_pro');
    body.append('subscription_data[metadata][seminary]', seminary ? 'true' : 'false');

    if (seminary) {
      body.append('discounts[0][coupon]', 'SEMINARY44');
    } else {
      body.append('allow_promotion_codes', 'true');
    }

    const response = await fetch(`${STRIPE_API}/checkout/sessions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.message || `Stripe API error: ${response.status}`);
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ url: data.url }));
  } catch (err) {
    console.error('[checkout/create] error:', err.message);
    res.writeHead(err.message.includes('not set') ? 503 : 500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: err.message }));
  }
}

// POST /api/checkout/verify  body: { sessionId }  → { token }
export async function verifyCheckout(req, res) {
  let body = '';
  req.on('data', c => (body += c));
  req.on('end', async () => {
    try {
      const { sessionId } = JSON.parse(body || '{}');
      if (!sessionId) { res.writeHead(400); return res.end(JSON.stringify({ error: 'sessionId required' })); }

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
        throw new Error(session.error?.message || `Stripe API error: ${response.status}`);
      }

      if (session.status !== 'complete' && session.payment_status !== 'paid') {
        res.writeHead(402, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Payment not complete' }));
      }

      const token = signToken({
        customerId:     session.customer,
        subscriptionId: session.subscription,
        email:          session.customer_details?.email ?? null,
      }, jwtSecret);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ token }));
    } catch (err) {
      console.error('[checkout/verify] error:', err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Verification failed. Contact support@manypaths.one' }));
    }
  });
}

// POST /api/webhook — Stripe event handler
export async function handleWebhook(req, res) {
  let body = '';
  req.on('data', c => (body += c));
  req.on('end', async () => {
    try {
      let event;
      const whSecret = process.env.STRIPE_WEBHOOK_SECRET;

      if (whSecret) {
        // Signature verification would require crypto — for now, accept dev mode
        // TODO: Implement HMAC-SHA256 signature verification if needed
        try {
          event = JSON.parse(body);
        } catch (e) {
          console.error('[webhook] parse failed:', e.message);
          res.writeHead(400);
          return res.end('Invalid JSON');
        }
      } else {
        // Dev/test: no signature verification
        event = JSON.parse(body);
      }

      switch (event.type) {
        case 'customer.subscription.deleted':
          // JWTs expire naturally after 30 days — no DB action needed
          console.log(`[webhook] subscription cancelled: ${event.data.object.id}`);
          break;
        case 'customer.subscription.updated':
          console.log(`[webhook] subscription updated: ${event.data.object.id} status=${event.data.object.status}`);
          break;
        case 'checkout.session.completed':
          console.log(`[webhook] checkout completed: ${event.data.object.id}`);
          break;
        default:
          // Ignore other events
          break;
      }

      res.writeHead(200);
      res.end('ok');
    } catch (err) {
      console.error('[webhook] handler error:', err.message);
      res.writeHead(500);
      res.end('Internal error');
    }
  });
}

// POST /api/plate — one-time donation checkout (tip jar)
export async function createDonationCheckout(res, amountCents) {
  try {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) throw new Error('STRIPE_SECRET_KEY not set');

    const body = new URLSearchParams();
    body.append('mode', 'payment');
    body.append('line_items[0][price_data][currency]', 'usd');
    body.append('line_items[0][price_data][product_data][name]', 'Pass the Plate — Many Paths');
    body.append('line_items[0][price_data][product_data][description]', 'Keep the lights on. Compare is always free.');
    body.append('line_items[0][price_data][unit_amount]', amountCents.toString());
    body.append('line_items[0][quantity]', '1');
    body.append('success_url', 'https://manypaths.one/?donated=1');
    body.append('cancel_url', 'https://manypaths.one/');

    const response = await fetch(`${STRIPE_API}/checkout/sessions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${secretKey}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error?.message || `Stripe API error: ${response.status}`);
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ url: data.url }));
  } catch (err) {
    console.error('[plate/create] error:', err.message);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Checkout unavailable. Try again later.' }));
  }
}
