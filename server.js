import 'dotenv/config';
import Anthropic from "@anthropic-ai/sdk";
import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { track } from "./costTracker.js";
import { runResearch } from "./research-engine.js";
import { generateOG } from "./og-generator.js";
import { resolvedModels } from "./models.js";
import { TRADITION_CONTEXT } from "./tradition-context.js";
import { verifyToken } from "./auth.js";
import { createCheckout, verifyCheckout, handleWebhook, createDonationCheckout } from "./stripe-handlers.js";
import { checkUsage, atomicIncrementUsage, FREE_LIMIT, listSaves, getSave, createSave, deleteSave } from "./supabase.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const client = new Anthropic({ apiKey: (process.env.ANTHROPIC_API_KEY || '').trim() });
const PORT = process.env.PORT || 3100;

// ─── Per-fingerprint rate limiter ─────────────────────────────────────────────
// Prevents machine-gun requests from bypassing the monthly gate.
// In-memory: per-process, resets on cold start — intentional (defense in depth only).
const RATE_LIMIT_MS = 30_000; // 30 seconds between requests per device
const _lastRequest  = new Map(); // fingerprint → timestamp

function isRateLimited(fingerprint) {
  const now = Date.now();
  const last = _lastRequest.get(fingerprint);
  if (last && now - last < RATE_LIMIT_MS) return true;
  _lastRequest.set(fingerprint, now);
  // Prune map to prevent unbounded growth (keep last 5000 entries)
  if (_lastRequest.size > 5000) {
    const oldest = [..._lastRequest.entries()]
      .sort((a, b) => a[1] - b[1])
      .slice(0, 1000)
      .map(([k]) => k);
    oldest.forEach(k => _lastRequest.delete(k));
  }
  return false;
}

// Known abusive device fingerprints — blocked permanently
const BLOCKED_FINGERPRINTS = new Set([
  '4d98f02fb217a76d7266805a9b42b366276fba8222236109caff9893839cffa6',
]);

// ─── Rate limit alert (Resend) ────────────────────────────────────────────────
// Fires at most once per hour to avoid spam. In-memory cooldown.
const _alertCooldown = new Map(); // fingerprint → last alert timestamp
const ALERT_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

async function sendRateLimitAlert(fingerprint, endpoint, reason) {
  const resendKey = process.env.RESEND_API_KEY;
  if (!resendKey) return;

  const now = Date.now();
  const last = _alertCooldown.get(fingerprint);
  if (last && now - last < ALERT_COOLDOWN_MS) return; // already alerted recently
  _alertCooldown.set(fingerprint, now);

  const to = process.env.ADMIN_ALERT_EMAIL || 'hello@legisplain.org';
  const subject = `🚨 ManyPaths abuse detected — ${reason}`;
  const body = `Endpoint: ${endpoint}\nFingerprint: ${fingerprint}\nReason: ${reason}\nTime: ${new Date().toISOString()}\n\nCheck Vercel logs and Anthropic usage dashboard.`;

  try {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: 'decode@legisplain.org', to, subject, text: body }),
    });
  } catch (e) {
    console.error('[alert] Resend failed:', e.message);
  }
}

const MIME = {
  ".html": "text/html",
  ".css":  "text/css",
  ".js":   "application/javascript",
  ".svg":  "image/svg+xml",
};

function serveIndex(res, topic, traditions = []) {
  try {
    let html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
    if (topic) {
      const cap = topic.charAt(0).toUpperCase() + topic.slice(1);
      const ogImageURL = traditions.length > 0
        ? `https://manypaths.one/og?topic=${encodeURIComponent(topic)}&traditions=${encodeURIComponent(traditions.join(','))}`
        : `https://manypaths.one/og?topic=${encodeURIComponent(topic)}`;
      html = html
        .replace(
          /(<meta property="og:title" content=")[^"]*(")/,
          `$1${cap} — Many Paths$2`
        )
        .replace(
          /(<meta property="og:description" content=")[^"]*(")/,
          `$1What does ${topic} mean across 7 world religions? Explore the common ground at Many Paths.$2`
        )
        .replace(
          /(<meta property="og:url" content=")[^"]*(")/,
          `$1https://manypaths.one/?topic=${encodeURIComponent(topic)}$2`
        )
        .replace(
          /(<meta property="og:image" content=")[^"]*(")/,
          `$1${ogImageURL}$2`
        );
    }
    res.writeHead(200, { "Content-Type": "text/html", ...SECURITY_HEADERS });
    res.end(html);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}

const SECURITY_HEADERS = {
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
};

function serveStatic(res, filePath) {
  const ext = path.extname(filePath);
  try {
    const content = fs.readFileSync(filePath);
    res.writeHead(200, { "Content-Type": MIME[ext] || "text/plain", ...SECURITY_HEADERS });
    res.end(content);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}

async function handleResearch(req, res) {
  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", async () => {
    try {
      const { topic, religions } = JSON.parse(body);

      if (!topic || !Array.isArray(religions) || religions.length < 2) {
        res.writeHead(400);
        return res.end("Invalid request");
      }

      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "https://manypaths.one",
      });

      console.log("[server] API key present:", !!process.env.ANTHROPIC_API_KEY);

      const prompt = buildPrompt(topic, religions);
      const stream = client.messages.stream({
        model: process.env.CLAUDE_MODEL || "claude-sonnet-4-20250514",
        max_tokens: 16000,
        messages: [{ role: "user", content: prompt }],
      });

      stream.on("error", (err) => console.error("[stream error]", err));

      // Parse streaming text into sections and forward as SSE
      // Keep a persistent buffer across chunks so markers split across
      // chunk boundaries are still detected correctly.
      let buffer = "";
      let currentSection = null;
      let fullText = "";   // accumulate everything Claude says for debug logging

      for await (const event of stream) {
        console.log("[event]", event.type, event.delta?.type ?? "");

        if (
          event.type !== "content_block_delta" ||
          event.delta.type !== "text_delta"
        ) continue;

        buffer += event.delta.text;
        fullText += event.delta.text;

        // Scan for complete ##SECTION:Name## markers and route content between them.
        // Only hold back a trailing partial marker prefix (not the closing ## of a
        // complete marker — that was the original bug).
        const markerRe = /##SECTION:([^#]+)##/g;
        let lastEnd = 0;
        let m;
        while ((m = markerRe.exec(buffer)) !== null) {
          const before = buffer.slice(lastEnd, m.index);
          if (before) {
            if (currentSection) send(res, currentSection, before);
            else console.log("[server] pre-marker text:", JSON.stringify(before.slice(0, 60)));
          }
          currentSection = m[1].trim();
          console.log("[server] section →", currentSection);
          lastEnd = m.index + m[0].length;
        }

        // Hold back only a genuine partial marker at the end of the buffer.
        const tail = buffer.slice(lastEnd);
        const partial = tail.match(/#+$|##SECTION:[^#]*$/);
        if (partial) {
          const safe = tail.slice(0, tail.length - partial[0].length);
          if (safe) {
            if (currentSection) send(res, currentSection, safe);
            else console.log("[server] pre-marker text:", JSON.stringify(safe.slice(0, 60)));
          }
          buffer = partial[0];
        } else {
          if (tail && currentSection) send(res, currentSection, tail);
          buffer = "";
        }
      }

      // Flush anything left in the buffer
      if (buffer && currentSection) {
        send(res, currentSection, buffer);
      }

      const finalMsg = await stream.finalMessage();
      track(finalMsg.usage, 'bridgemaide-search');

      console.log("[server] stream complete");
      console.log("[server] full Claude response:\n" + fullText);
      console.log("[server] sections detected:", fullText.match(/##SECTION:[^#]+##/g) || "NONE — markers missing!");

      res.write("data: [DONE]\n\n");
      res.end();
    } catch (err) {
      console.error(err);
      if (!res.headersSent) {
        res.writeHead(500);
        res.end("Internal server error");
      }
    }
  });
}

function send(res, section, text) {
  res.write(`data: ${JSON.stringify({ section, text })}\n\n`);
}


function buildPrompt(topic, religions) {
  const sections = religions
    .map((r) => `##SECTION:${r}##\n[Write the ${r} section here]`)
    .join("\n\n");

  const ctxNotes = religions
    .filter(r => TRADITION_CONTEXT[r])
    .map(r => `• ${TRADITION_CONTEXT[r]}`)
    .join('\n');
  const ctxBlock = ctxNotes
    ? `Tradition context for accurate scholarship:\n${ctxNotes}\n\n`
    : '';

  return `You are a respectful, balanced religious scholar researching how different traditions approach "${topic}".

${ctxBlock}

IMPORTANT: You must use these EXACT section markers in your response — they are required for parsing:
${sections}
##SECTION:COMMON_GROUND##
[Write the common ground section here]

Use EXACTLY those marker names, no variations. Each section should include:
1. Core belief or teaching on "${topic}"
2. Key scripture or authoritative text reference (quote it)
3. How it is practiced or expressed
4. One surprising or lesser-known insight

The COMMON_GROUND section should include:
- What all or most traditions share on this topic
- The most surprising connection between two of the traditions
- A single bridge statement that unites them all

Rules:
- Be scrupulously balanced — no tradition is favored
- Always cite actual scripture
- Plain, warm, accessible language — not academic jargon
- Start your response immediately with the first ##SECTION:## marker
- NEVER deviate from the exact marker names listed above`;
}

// ─── Notes ────────────────────────────────────────────────────────────────────
// SSL/HTTPS: Handled by Vercel's edge — this server speaks plain HTTP internally.
// Markdown export: Client-side only (research-ui.js Blob download) — no server involvement.
// Stripe: Wired. Activation: set RESEARCH_PAYWALL_ENABLED=true in Vercel env vars.
//         Required env vars: STRIPE_SECRET_KEY, STRIPE_PRICE_ID,
//                            STRIPE_WEBHOOK_SECRET, STRIPE_JWT_SECRET
// ─────────────────────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  // Strip query string from URL before routing
  const pathname = new URL(req.url, "http://localhost").pathname;

  console.log(`[${req.method}] ${pathname}`);

  if (req.method === "POST" && pathname === "/api/research") {
    return handleResearch(req, res);
  }

  // ─── Stripe: checkout, verify, webhook, tip jar ───────────────────────────
  if (req.method === "POST" && pathname === "/api/checkout") {
    return createCheckout(res);
  }
  if (req.method === "POST" && pathname === "/api/checkout/verify") {
    return verifyCheckout(req, res);
  }
  if (req.method === "POST" && pathname === "/api/webhook") {
    return handleWebhook(req, res);
  }
  if (req.method === 'POST' && pathname === '/api/plate') {
    let body = '';
    req.on('data', c => (body += c));
    req.on('end', () => {
      const { amount } = JSON.parse(body || '{}');
      const cents = [300, 500, 1000, 2500].includes(Number(amount)) ? Number(amount) : 500;
      return createDonationCheckout(res, cents);
    });
    return;
  }

  // Research page API — used by research-ui.js
  if (req.method === "POST" && pathname === "/api/run-research") {
    // ─── Auth + Usage gate ───────────────────────────────────────────────────
    // Paid users: valid JWT → unlimited access, no usage tracking
    // Free users: 3 runs/month tracked by fingerprint or userId
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    const jwtSecret = process.env.STRIPE_JWT_SECRET || '';
    let isPaid = false;
    let tokenUserId = null;

    if (token && jwtSecret) {
      try {
        const payload = verifyToken(token, jwtSecret);
        isPaid = true;
        tokenUserId = payload.customerId || null;
      } catch {
        // Invalid/expired token — treat as free user
      }
    }

    if (!isPaid) {
      const fingerprint = req.headers['x-fingerprint'] || req.headers['x-forwarded-for'] || 'unknown';

      // Hard block known abusive devices
      if (BLOCKED_FINGERPRINTS.has(fingerprint)) {
        sendRateLimitAlert(fingerprint, '/api/run-research', 'hard-blocked device').catch(() => {});
        res.writeHead(403, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'access_denied' }));
      }

      // Per-device rate limit (30s cooldown) — stops machine-gun bypass attempts
      if (isRateLimited(fingerprint)) {
        sendRateLimitAlert(fingerprint, '/api/run-research', 'rate limited (30s cooldown)').catch(() => {});
        res.writeHead(429, { 'Content-Type': 'application/json', 'Retry-After': '30' });
        return res.end(JSON.stringify({ error: 'rate_limited', retryAfter: 30 }));
      }

      // Atomic increment-then-check — eliminates the race condition.
      // We increment BEFORE running; if over limit, we reject (count stays bumped, correct behavior).
      const { newCount, allowed } = await atomicIncrementUsage(tokenUserId, fingerprint);
      if (!allowed) {
        sendRateLimitAlert(fingerprint, '/api/run-research', `monthly limit exceeded (count=${newCount})`).catch(() => {});
        res.writeHead(402, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'free_limit_reached', remaining: 0 }));
      }
    }
    // ────────────────────────────────────────────────────────────────────────

    let body = "";
    req.on("data", c => (body += c));
    req.on("end", async () => {
      try {
        const { mode, depth, input, traditions } = JSON.parse(body);
        const result = await runResearch(mode, depth, input, traditions);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result));
      } catch (err) {
        console.error("[/api/run-research] ERROR:", err.message);
        console.error("[/api/run-research] STACK:", err.stack);
        console.error("[/api/run-research] TYPE:", err.constructor?.name);
        res.writeHead(err.message.startsWith("invalid") ? 400 : 500);
        res.end(JSON.stringify({ error: err.message.startsWith("invalid") ? err.message : "Something went wrong. Please try again." }));
      }
    });
    return;
  }

  // ─── Saves API (paid users only) ─────────────────────────────────────────
  if (pathname.startsWith('/api/saves')) {
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    const jwtSecret = process.env.STRIPE_JWT_SECRET || '';
    if (!token || !jwtSecret) {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'auth_required' }));
    }
    let payload;
    try {
      payload = verifyToken(token, jwtSecret);
    } catch {
      res.writeHead(401, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'token_invalid' }));
    }
    const userId = payload.customerId;
    const saveId = pathname.split('/')[3] || null;

    try {
      if (req.method === 'GET' && !saveId) {
        const saves = await listSaves(userId);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify(saves));
      }
      if (req.method === 'GET' && saveId) {
        const save = await getSave(userId, saveId);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify(save));
      }
      if (req.method === 'POST') {
        let body = '';
        req.on('data', c => (body += c));
        await new Promise(r => req.on('end', r));
        const save = await createSave(userId, JSON.parse(body));
        res.writeHead(201, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify(save));
      }
      if (req.method === 'DELETE' && saveId) {
        await deleteSave(userId, saveId);
        res.writeHead(204);
        return res.end();
      }
      res.writeHead(405);
      return res.end('Method not allowed');
    } catch (err) {
      console.error('[/api/saves]', err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: err.message }));
    }
  }

  // ─── Usage check endpoint ─────────────────────────────────────────────────
  if (req.method === 'GET' && pathname === '/api/usage') {
    const authHeader = req.headers['authorization'] || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    const jwtSecret = process.env.STRIPE_JWT_SECRET || '';
    let userId = null;
    let isPaid = false;
    if (token && jwtSecret) {
      try { const p = verifyToken(token, jwtSecret); isPaid = true; userId = p.customerId; } catch {}
    }
    if (isPaid) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ plan: 'paid', remaining: null }));
    }
    const fingerprint = req.headers['x-fingerprint'] || req.headers['x-forwarded-for'] || 'unknown';
    const usage = await checkUsage(userId, fingerprint);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ plan: 'free', remaining: usage.remaining, count: usage.count }));
  }

  // Root: serve index.html with optional dynamic OG tags
  if (pathname === "/") {
    const url         = new URL(req.url, "http://localhost");
    const topic       = url.searchParams.get("topic") || "";
    const tradParam   = url.searchParams.get("traditions") || "";
    const traditions  = tradParam ? tradParam.split(",").map(s => s.trim()).filter(Boolean) : [];
    return serveIndex(res, topic, traditions);
  }

  // Dynamic OG image endpoint — GET /og?topic=...&traditions=...
  if (req.method === "GET" && pathname === "/og") {
    const url        = new URL(req.url, "http://localhost");
    const topic      = (url.searchParams.get("topic") || "").trim();
    const tradParam  = url.searchParams.get("traditions") || "";
    const traditions = tradParam ? tradParam.split(",").map(s => s.trim()).filter(Boolean) : [];
    if (!topic) {
      // Fall back to default OG image
      return serveStatic(res, path.join(__dirname, "og-default.png"));
    }
    try {
      const buf = await generateOG(topic, traditions);
      res.writeHead(200, {
        "Content-Type":  "image/png",
        "Cache-Control": "public, max-age=86400",
        "Content-Length": buf.length,
      });
      return res.end(buf);
    } catch (err) {
      console.error("[/og]", err.message);
      return serveStatic(res, path.join(__dirname, "og-default.png"));
    }
  }

  // ─── ElevenLabs TTS ──────────────────────────────────────────────────────
  if (req.method === 'POST' && pathname === '/api/tts') {
    let body = '';
    req.on('data', c => (body += c));
    req.on('end', async () => {
      try {
        const { text, voice } = JSON.parse(body);
        if (!text || typeof text !== 'string') {
          res.writeHead(400); return res.end('Missing text');
        }
        const apiKey = process.env.ELEVENLABS_API_KEY;
        if (!apiKey) {
          res.writeHead(503); return res.end('TTS not configured');
        }
        const VOICES = {
          male:   'onwK4e9ZLuTAKqWW03F9',  // Daniel — steady broadcaster, British
          female: 'EXAVITQu4vr4xnSDxMaL',  // Sarah — mature, reassuring, confident
        };
        const voiceId = VOICES[voice] || VOICES.female;
        const elRes = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`, {
          method: 'POST',
          headers: {
            'xi-api-key': apiKey,
            'Content-Type': 'application/json',
            'Accept': 'audio/mpeg',
          },
          body: JSON.stringify({
            text: text.slice(0, 5000),
            model_id: 'eleven_turbo_v2_5',
            voice_settings: { stability: 0.5, similarity_boost: 0.75 },
          }),
        });
        if (!elRes.ok) {
          const errText = await elRes.text();
          console.error('[/api/tts] ElevenLabs error:', elRes.status, errText);
          res.writeHead(502); return res.end('TTS error');
        }
        res.writeHead(200, {
          'Content-Type': 'audio/mpeg',
          'Cache-Control': 'no-store',
          ...SECURITY_HEADERS,
        });
        elRes.body.pipe(res);
      } catch (err) {
        console.error('[/api/tts]', err.message);
        if (!res.headersSent) { res.writeHead(500); res.end('Internal error'); }
      }
    });
    return;
  }

  // Research page
  if (pathname === "/research") {
    return serveStatic(res, path.join(__dirname, "research.html"));
  }

  // /upgrade → pricing page
  if (pathname === "/upgrade") {
    return serveStatic(res, path.join(__dirname, "upgrade.html"));
  }

  // Favicon and touch icons → logo SVGs
  if (pathname === "/favicon.ico") {
    return serveStatic(res, path.join(__dirname, "logo/icon-32.svg"));
  }
  if (pathname === "/apple-touch-icon.png" || pathname === "/apple-touch-icon-precomposed.png") {
    return serveStatic(res, path.join(__dirname, "logo/icon-180.svg"));
  }

  // Everything else serves directly
  const filePath = path.join(__dirname, pathname.slice(1));

  // Prevent path traversal
  if (!filePath.startsWith(__dirname + path.sep) && filePath !== __dirname) {
    res.writeHead(403);
    return res.end("Forbidden");
  }

  serveStatic(res, filePath);
});

server.listen(PORT, () => {
  console.log(`\n🛤️  Many Paths running at http://localhost:${PORT}\n`);
  checkModels();
});

async function checkModels() {
  try {
    const list = await client.models.list();
    const available = new Set(list.data.map(m => m.id));
    const used = Object.entries(resolvedModels());
    const bad = used.filter(([, id]) => !available.has(id));
    if (bad.length) {
      bad.forEach(([name, id]) => console.warn(`⚠️  MODEL WARNING: "${id}" (${name}) not found in Anthropic API — update models.js`));
    } else {
      console.log(`✓ Model check passed: ${used.map(([, id]) => id).join(', ')}`);
    }
  } catch (err) {
    console.warn(`⚠️  Model check skipped: ${err.message}`);
  }
}
