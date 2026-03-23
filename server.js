import 'dotenv/config';
import Anthropic from "@anthropic-ai/sdk";
import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { track } from "./costTracker.js";
import { runResearch } from "./research-engine.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const PORT = process.env.PORT || 3001;

const MIME = {
  ".html": "text/html",
  ".css":  "text/css",
  ".js":   "application/javascript",
  ".svg":  "image/svg+xml",
};

function serveIndex(res, topic) {
  try {
    let html = fs.readFileSync(path.join(__dirname, "index.html"), "utf8");
    if (topic) {
      const cap = topic.charAt(0).toUpperCase() + topic.slice(1);
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
        );
    }
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end(html);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
}

function serveStatic(res, filePath) {
  const ext = path.extname(filePath);
  try {
    const content = fs.readFileSync(filePath);
    res.writeHead(200, { "Content-Type": MIME[ext] || "text/plain" });
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
        "Access-Control-Allow-Origin": "*",
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

  return `You are a respectful, balanced religious scholar researching how different traditions approach "${topic}".

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

const server = http.createServer((req, res) => {
  // Strip query string from URL before routing
  const pathname = new URL(req.url, "http://localhost").pathname;

  console.log(`[${req.method}] ${pathname}`);

  if (req.method === "POST" && pathname === "/api/research") {
    return handleResearch(req, res);
  }

  // Research page API — used by research-ui.js
  if (req.method === "POST" && pathname === "/api/run-research") {
    let body = "";
    req.on("data", c => (body += c));
    req.on("end", async () => {
      try {
        const { mode, depth, input, traditions } = JSON.parse(body);
        const result = await runResearch(mode, depth, input, traditions);
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(result));
      } catch (err) {
        console.error("[/api/run-research]", err.message);
        res.writeHead(err.message.startsWith("invalid") ? 400 : 500);
        res.end(err.message);
      }
    });
    return;
  }

  // Root: serve index.html with optional dynamic OG tags
  if (pathname === "/") {
    const topic = new URL(req.url, "http://localhost").searchParams.get("topic") || "";
    return serveIndex(res, topic);
  }

  // Research page
  if (pathname === "/research") {
    return serveStatic(res, path.join(__dirname, "research.html"));
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
});
