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
import { createCheckout, verifyCheckout, handleWebhook } from "./stripe-handlers.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const client = new Anthropic({ apiKey: (process.env.ANTHROPIC_API_KEY || '').trim() });
const PORT = process.env.PORT || 3001;

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

  // ─── Stripe: checkout, verify, webhook ───────────────────────────────────
  if (req.method === "POST" && pathname === "/api/checkout") {
    return createCheckout(res);
  }
  if (req.method === "POST" && pathname === "/api/checkout/verify") {
    return verifyCheckout(req, res);
  }
  if (req.method === "POST" && pathname === "/api/webhook") {
    return handleWebhook(req, res);
  }

  // Research page API — used by research-ui.js
  if (req.method === "POST" && pathname === "/api/run-research") {
    // ─── Paywall gate (server-side) ─────────────────────────────────────────
    // Activate by setting RESEARCH_PAYWALL_ENABLED=true in Vercel env.
    // While false, all research requests pass through regardless of token.
    const paywallEnabled = process.env.RESEARCH_PAYWALL_ENABLED === 'true';
    if (paywallEnabled) {
      const authHeader = req.headers['authorization'] || '';
      const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
      const jwtSecret = process.env.STRIPE_JWT_SECRET || '';
      if (!token || !jwtSecret) {
        res.writeHead(402, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'subscription_required' }));
      }
      try {
        verifyToken(token, jwtSecret);
      } catch (tokenErr) {
        const code = tokenErr.message === 'expired' ? 401 : 403;
        res.writeHead(code, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: tokenErr.message === 'expired' ? 'token_expired' : 'token_invalid' }));
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

  // Research page
  if (pathname === "/research") {
    return serveStatic(res, path.join(__dirname, "research.html"));
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
