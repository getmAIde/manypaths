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

import Stripe from 'stripe';
import { signToken } from './auth.js';

const BASE_URL      = 'https://manypaths.one';
const SUCCESS_URL   = `${BASE_URL}/research?session_id={CHECKOUT_SESSION_ID}`;
const CANCEL_URL    = `${BASE_URL}/research?checkout=cancelled`;

function stripeClient() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY not set');
  return new Stripe(key, { apiVersion: '2025-03-31.basil' });
}

// POST /api/checkout → { url: <stripe-hosted-checkout-url> }
// seminary=true applies the SEMINARY44 coupon (44% off forever)
export async function createCheckout(res, { seminary = false } = {}) {
  try {
    const stripe    = stripeClient();
    const priceId   = process.env.STRIPE_PRICE_ID_MONTHLY || process.env.STRIPE_PRICE_ID;
    if (!priceId) throw new Error('STRIPE_PRICE_ID_MONTHLY not set');

    const sessionParams = {
      mode:                 'subscription',
      line_items:           [{ price: priceId, quantity: 1 }],
      success_url:          SUCCESS_URL,
      cancel_url:           CANCEL_URL,
      allow_promotion_codes: !seminary, // hide promo box when applying seminary coupon directly
      subscription_data: {
        trial_period_days: 7,
        metadata: { product: 'manypaths_research_pro', seminary: seminary ? 'true' : 'false' },
      },
    };

    if (seminary) {
      sessionParams.discounts = [{ coupon: 'SEMINARY44' }];
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ url: session.url }));
  } catch (err) {
    console.error('[checkout/create] error:', err.message);
    res.writeHead(err.message.includes('not set') ? 503 : 500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Checkout unavailable. Try again later.' }));
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

      const jwtSecret = process.env.STRIPE_JWT_SECRET;
      if (!jwtSecret) throw new Error('STRIPE_JWT_SECRET not set');

      const stripe  = stripeClient();
      const session = await stripe.checkout.sessions.retrieve(sessionId);

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
        const sig = req.headers['stripe-signature'];
        const stripe = stripeClient();
        try {
          event = stripe.webhooks.constructEvent(body, sig, whSecret);
        } catch (e) {
          console.error('[webhook] signature verification failed:', e.message);
          res.writeHead(400);
          return res.end('Webhook signature invalid');
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
    const stripe = stripeClient();
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: { name: 'Pass the Plate — Many Paths', description: 'Keep the lights on. Compare is always free.' },
          unit_amount: amountCents,
        },
        quantity: 1,
      }],
      success_url: 'https://manypaths.one/?donated=1',
      cancel_url: 'https://manypaths.one/',
    });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ url: session.url }));
  } catch (err) {
    console.error('[plate/create] error:', err.message);
    res.writeHead(500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Checkout unavailable. Try again later.' }));
  }
}
