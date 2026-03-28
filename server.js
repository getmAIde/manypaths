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

const TRADITION_CONTEXT = {
  'Latter-day Saints':    'The Church of Jesus Christ of Latter-day Saints: Restoration theology — the Church as the restored original church of Jesus Christ. Scripture includes the Bible and Book of Mormon as companion witnesses of Christ. Continuing revelation through a living prophet. Eternal progression and exaltation. Sacred temple ordinances. Lay priesthood. Strong emphasis on family, community, and self-reliance. Christ-centered in all theology and practice.',
  'Roman Catholic':       'Roman Catholic Christianity: Teaching authority of the Pope and Magisterium as definitive. Seven sacraments as objective means of grace. Scripture and Sacred Tradition as co-equal sources of revelation. Natural law ethics. Veneration of Mary (Theotokos, Immaculate Conception, Assumption) and the communion of saints. The Mass as the re-presentation of Christ\'s sacrifice (transubstantiation). Apostolic succession from Peter.',
  'Eastern Orthodox':     'Eastern Orthodox Christianity: Theosis — union with God — as the goal of Christian life. Conciliar authority; no single bishop above others. The Philokalia and hesychast tradition of contemplative prayer. Icons as windows into divine reality, not idols. The Divine Liturgy of St. John Chrysostom. Seven Ecumenical Councils as doctrinal authority. Scripture interpreted through Holy Tradition. Emphasis on mystery, apophatic theology, and the uncreated energies of God.',
  'Baptist':              'Baptist Christianity: Soul competency — each person answers directly to God without priestly mediation. Scripture alone (Sola Scriptura) as final authority. Believer\'s baptism by immersion only — not infant baptism. Local church autonomy, no hierarchy above the congregation. Priesthood of all believers. Personal conversion experience ("born again") as the mark of genuine faith. Strong emphasis on evangelism and missions.',
  'Methodist':            'Methodist Christianity: The Wesleyan Quadrilateral — Scripture, Tradition, Reason, and Experience as sources of authority. Prevenient grace — God\'s grace available to all before conversion. Sanctification as a lifelong journey toward entire holiness. Social holiness — faith must express in justice, service, and social reform. Connectionalism between local churches. John Wesley\'s emphasis on practical Christianity and ministry to the poor.',
  'Lutheran':             'Lutheran Christianity: Justification by grace through faith alone (Sola Fide) as the article on which the Church stands or falls. Scripture alone (Sola Scriptura). The Law-Gospel distinction — the tension between God\'s demand and God\'s mercy as central to preaching. Two kingdoms theology. Real presence of Christ in the Eucharist (not transubstantiation, not mere symbol). Luther\'s Small and Large Catechisms as foundational teaching texts.',
  'Pentecostal':          'Pentecostal Christianity: Baptism of the Holy Spirit as a second definite work of grace, evidenced by speaking in tongues (glossolalia). The gifts of the Spirit are active today — healing, prophecy, tongues, interpretation. Direct, experiential encounter with God in worship. Eschatological urgency — Christ\'s return is imminent. Expressive, participatory worship with prayer, praise, and physical manifestations. Scripture as literally inspired and inerrant.',
  'Sunni Islam':          'Sunni Islam (Ahl al-Sunnah): The majority tradition (~85-90% of Muslims). Authority through scholarly consensus (ijma\') and analogical reasoning (qiyas). Four legal schools: Hanafi, Maliki, Shafi\'i, Hanbali — all considered valid. Hadith collections of Bukhari and Muslim as the most authoritative. The caliphate as the historical model of Islamic governance. Emphasis on following the Prophet\'s Sunnah as recorded in hadith. The Six Articles of Faith and Five Pillars.',
  'Shia Islam':           'Shia Islam (Twelver / Ithna Ashari): The Imamate — Ali and eleven Imams as the Prophet\'s divinely appointed successors, not elected. The Occultation of the Twelfth Imam (al-Mahdi), whose return is awaited. Marja\'iya — authority of living Grand Ayatollahs as deputies of the Hidden Imam. Karbala and the martyrdom of Husayn ibn Ali as central to spirituality and theology. Ziyarat — pilgrimage to shrines of Imams. Mourning rituals of Muharram (Ashura).',
  'Sufi Islam':           'Sufi Islam (Tasawwuf): The inner, mystical dimension of Islam. The spiritual path (tariqa) toward direct experience of divine presence and annihilation of the ego (fana). Dhikr — rhythmic remembrance of God\'s names as the core practice. The shaykh-murid (master-disciple) relationship as essential. Maqamat — stations of the spiritual journey (tawba, sabr, tawakkul, mahabbah). Rumi, Ibn Arabi, Al-Ghazali, Rabia al-Adawiyya as foundational voices. Love (mahabbah) as the highest spiritual reality.',
  'Orthodox Judaism':     'Orthodox Judaism: Halakha (Jewish law) as binding and divinely revealed to Moses at Sinai. Torah min haShamayim — the divine, verbatim origin of both the Written Torah and the Oral Torah (Talmud). The Babylonian Talmud as the primary text of rabbinic authority. Poskim (halakhic decisors) — Rambam, Shulchan Aruch, contemporary responsa — as ongoing authorities. Mechitza separating men and women in prayer. Strict Shabbat and kashrut observance. Yeshiva learning as the religious ideal.',
  'Conservative Judaism': 'Conservative Judaism (Masorti): Halakha is binding but evolves through scholarly interpretation responsive to historical context. The Jewish Theological Seminary (JTS) as the intellectual center of the movement. Historical-critical method applied to Jewish texts alongside traditional learning. Full egalitarianism — men and women participate equally in prayer and leadership. Commitment to the State of Israel and Hebrew as the sacred language. The Committee on Jewish Law and Standards as the authoritative halakhic body.',
  'Reform Judaism':       'Reform Judaism: The autonomy of the individual Jew in their relationship with tradition and practice. Ethical monotheism as the core of Judaism — the prophetic tradition of justice over ritual. Torah as divinely inspired but not literally dictated word-for-word. Hebrew integrated with vernacular in worship. Full egalitarianism — women rabbis since 1972, LGBTQ+ inclusion. Strong emphasis on tikkun olam (repair of the world) as a primary religious obligation. Patrilineal descent recognized alongside matrilineal.',
  'Theravada Buddhism':   'Theravada Buddhism (The Way of the Elders): The oldest surviving school, predominant in Southeast Asia (Thailand, Myanmar, Sri Lanka, Cambodia). The Pali Canon (Tipitaka) — Vinaya, Sutta, Abhidhamma — as the authoritative scripture. The bhikkhu (monk) and the monastic sangha as the ideal path to liberation. Vipassana (insight meditation) and samatha (calm abiding) as the primary practices. Attainment of nibbana through the Noble Eightfold Path. The arahat — the liberated one — as the spiritual ideal.',
  'Zen Buddhism':         'Zen Buddhism (Chan): Direct, unmediated awakening (satori or kensho) — seeing one\'s original nature. Transmission beyond scriptures — mind-to-mind transmission from teacher to student, not textual authority. Koan practice (Rinzai school) — paradoxical questions that shatter conceptual thinking. Zazen — seated meditation as the central practice (Soto school: shikantaza, "just sitting"). Integration of awakening into every moment of ordinary life — "chop wood, carry water." The Zendo and intensive sesshin retreats as the training ground.',
  'Tibetan Buddhism':     'Tibetan Buddhism (Vajrayana / Tantric Buddhism): The tantric path as an accelerated route to Buddhahood in this very lifetime. Guru Yoga — the teacher (lama) is inseparable from the Buddha; devotion is primary. Deity yoga — visualization of enlightened beings (yidams) to recognize and embody their qualities. The Bardo Thodol (Tibetan Book of the Dead) as a guide to dying and rebirth. The Tulku system — reincarnated masters recognized and enthroned. The Bodhisattva vow — to attain enlightenment for the benefit of all sentient beings — as central. Four schools: Gelug, Kagyu, Nyingma, Sakya.',
};

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
// Supabase / Stripe: Not wired yet — all data is stateless / localStorage only.
// ─────────────────────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
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
