/**
 * auth.js — Lightweight JWT sign/verify using native Node.js crypto.
 * No external dependencies.
 *
 * Tokens are HMAC-SHA256 signed, 30-day expiry.
 * Secret: STRIPE_JWT_SECRET env var (generate with: openssl rand -hex 32)
 */

import crypto from 'crypto';

const EXPIRY_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

export function signToken(payload, secret) {
  const header  = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const body    = Buffer.from(JSON.stringify({ ...payload, iat: Date.now(), exp: Date.now() + EXPIRY_MS })).toString('base64url');
  const sig     = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');
  return `${header}.${body}.${sig}`;
}

export function verifyToken(token, secret) {
  const parts = (token || '').split('.');
  if (parts.length !== 3) throw new Error('malformed');

  const [header, body, sig] = parts;
  const expected = crypto.createHmac('sha256', secret).update(`${header}.${body}`).digest('base64url');

  const sigBuf  = Buffer.from(sig,      'base64url');
  const expBuf  = Buffer.from(expected, 'base64url');
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    throw new Error('invalid_signature');
  }

  const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  if (payload.exp < Date.now()) throw new Error('expired');
  return payload;
}
