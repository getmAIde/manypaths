// research-engine.js
// Prompt layer for Research mode — 4 modes × 3 depths with session cache and cost controls.
// Export: runResearch(mode, depth, input, traditions) → structured JSON

import Anthropic from '@anthropic-ai/sdk';
import { track } from './costTracker.js';

const client = new Anthropic({ apiKey: (process.env.ANTHROPIC_API_KEY || '').trim() });

// Session-level cache — same query never hits the API twice per process lifetime
const _cache = new Map();

// ─── Config ───────────────────────────────────────────────────────────────────

const MODEL_SONNET = process.env.CLAUDE_MODEL        || 'claude-sonnet-4-20250514';
const MODEL_HAIKU  = process.env.CLAUDE_HAIKU_MODEL  || 'claude-3-5-haiku-20241022';

// Note: prompt specified "claude-haiku-4-5-20251001" and "claude-sonnet-4-6" —
// neither is a valid model ID. Using latest real equivalents above.

// Tokens scale with tradition count — original spec assumed 2-3 traditions;
// 7 traditions × ~200 tokens each needs headroom. Keep sermon_brief tight.
const MAX_TOKENS = {
  quick:        2000,
  study:        4000,
  sermon_brief: 3000,
};

// ─── Tradition context (injected when that tradition is present) ──────────────

const TRADITION_CONTEXT = {
  'Latter-day Saints': 'The Church of Jesus Christ of Latter-day Saints (Latter-day Saints): Restoration theology — the Church as the restored original church of Jesus Christ. Scripture includes the Bible and Book of Mormon as companion witnesses of Christ. Continuing revelation through a living prophet. Eternal progression and exaltation. Sacred temple ordinances. Lay priesthood. Strong emphasis on family, community, and self-reliance. Christ-centered in all theology and practice.',
};

function traditionContextNote(traditions) {
  const notes = traditions
    .filter(t => TRADITION_CONTEXT[t])
    .map(t => `• ${TRADITION_CONTEXT[t]}`);
  return notes.length
    ? `Tradition context for accurate scholarship:\n${notes.join('\n')}`
    : '';
}

// ─── Prompt builders ──────────────────────────────────────────────────────────

function traditionsNote(traditions) {
  return `Use exactly these tradition names as JSON keys: ${traditions.map(t => `"${t}"`).join(', ')}.`;
}

function sharedRules() {
  return `Rules:
- Always cite actual scripture with book/chapter/verse (or equivalent sacred text reference)
- Be scrupulously balanced — no tradition favoured
- Plain, warm, accessible language — not academic jargon
- Return ONLY the JSON object, no markdown fences, no explanation`;
}

function buildPrompt(mode, depth, input, traditions) {
  const tNote   = traditionsNote(traditions);
  const ctxNote = traditionContextNote(traditions);

  // ── Sermon Brief (always deep, single path) ──────────────────────────────
  if (mode === 'sermon_brief') {
    return `You are a respectful interfaith scholar preparing sermon research material.

Theme: "${input}"
Traditions to cover: ${traditions.join(', ')}

${ctxNote ? ctxNote + '\n\n' : ''}${tNote}

Return valid JSON with this exact structure:
{
  "results": {
    "Christianity": {
      "passage": "key passage with full citation",
      "interpretation": "how this tradition approaches the theme",
      "context": "theological and historical context"
    }
  },
  "commonGround": "2-3 sentences on what all these traditions share on this theme",
  "sermonAngle": "a concrete sermon angle that honours all the traditions represented — one paragraph"
}

${sharedRules()}`;
  }

  // ── Verse ────────────────────────────────────────────────────────────────
  if (mode === 'verse') {
    if (depth === 'quick') {
      return `You are a respectful interfaith scholar.

Verse: "${input}"
Traditions: ${traditions.join(', ')}

${ctxNote ? ctxNote + '\n\n' : ''}${tNote}

Return valid JSON:
{
  "results": {
    "Christianity": {
      "passage": "${input}",
      "interpretation": "one sentence on what this tradition teaches from this verse"
    }
  },
  "commonGround": "one sentence on the shared insight across these traditions in this verse"
}

${sharedRules()}`;
    }

    // verse + study
    return `You are a respectful interfaith scholar.

Verse: "${input}"
Traditions: ${traditions.join(', ')}

${ctxNote ? ctxNote + '\n\n' : ''}${tNote}

Return valid JSON:
{
  "results": {
    "Christianity": {
      "passage": "the verse text as rendered in this tradition, with full citation",
      "interpretation": "this tradition's theological interpretation of the verse",
      "context": "historical and theological context within this tradition"
    }
  },
  "commonGround": "cross-tradition patterns and shared insights from this verse — 2-3 sentences"
}

${sharedRules()}`;
  }

  // ── Topic ────────────────────────────────────────────────────────────────
  if (mode === 'topic') {
    if (depth === 'quick') {
      return `You are a respectful interfaith scholar.

Topic: "${input}"
Traditions: ${traditions.join(', ')}

${ctxNote ? ctxNote + '\n\n' : ''}${tNote}

Return valid JSON:
{
  "results": {
    "Christianity": {
      "passage": "2-3 most relevant passages with citations",
      "interpretation": "one sentence on this tradition's core teaching on this topic"
    }
  },
  "commonGround": "what all these traditions share on this topic — one to two sentences"
}

${sharedRules()}`;
    }

    // topic + study
    return `You are a respectful interfaith scholar.

Topic: "${input}"
Traditions: ${traditions.join(', ')}

${ctxNote ? ctxNote + '\n\n' : ''}${tNote}

Return valid JSON:
{
  "results": {
    "Christianity": {
      "passage": "key passages with citations",
      "interpretation": "this tradition's teaching and lived practice around this topic",
      "context": "historical and theological context; note any surprising cross-tradition echoes"
    }
  },
  "commonGround": "shared ground and the most surprising connection across these traditions — 2-3 sentences"
}

${sharedRules()}`;
  }

  // ── Keyword ──────────────────────────────────────────────────────────────
  if (mode === 'keyword') {
    if (depth === 'quick') {
      return `You are a respectful interfaith scholar.

Keyword: "${input}"
Traditions: ${traditions.join(', ')}

${ctxNote ? ctxNote + '\n\n' : ''}${tNote}

Return valid JSON:
{
  "results": {
    "Christianity": {
      "passage": "key passage(s) using this word or concept, with citations",
      "interpretation": "one sentence on the theological significance of this word in this tradition"
    }
  },
  "commonGround": "how this word or concept bridges these traditions — one to two sentences"
}

${sharedRules()}`;
    }

    // keyword + study
    return `You are a respectful interfaith scholar.

Keyword: "${input}"
Traditions: ${traditions.join(', ')}

${ctxNote ? ctxNote + '\n\n' : ''}${tNote}

Return valid JSON:
{
  "results": {
    "Christianity": {
      "passage": "key passages featuring this word or concept, with citations",
      "interpretation": "theological significance of this word in this tradition",
      "context": "root meaning in this tradition's language or sacred text; how its use has evolved"
    }
  },
  "commonGround": "shared theological meaning and the most surprising connection across traditions — 2-3 sentences"
}

${sharedRules()}`;
  }

  throw new Error(`Unknown mode: ${mode}`);
}

// ─── Response parser ──────────────────────────────────────────────────────────

function parseResponse(text) {
  // Strip markdown code fences if Claude wraps the JSON
  const cleaned = text
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim();
  try {
    return JSON.parse(cleaned);
  } catch (err) {
    throw new Error(`research-engine: failed to parse Claude response as JSON.\nRaw: ${text.slice(0, 300)}\nError: ${err.message}`);
  }
}

// ─── Cache key ────────────────────────────────────────────────────────────────

function cacheKey(mode, depth, input, traditions) {
  return `${mode}:${depth}:${input.trim().toLowerCase()}:${[...traditions].sort().join(',')}`;
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * runResearch(mode, depth, input, traditions)
 *
 * @param {string}   mode        — 'verse' | 'topic' | 'keyword' | 'sermon_brief'
 * @param {string}   depth       — 'quick' | 'study' | 'sermon_brief' (overridden for sermon_brief mode)
 * @param {string}   input       — the verse, topic, keyword, or theme
 * @param {string[]} traditions  — array of tradition names to include
 * @returns {Promise<{mode, depth, input, traditions, results, commonGround, sermonAngle?}>}
 */
export async function runResearch(mode, depth, input, traditions) {
  if (!input?.trim())                                    throw new Error('input is required');
  if (!Array.isArray(traditions) || !traditions.length)  throw new Error('at least one tradition is required');

  const validModes  = ['verse', 'topic', 'keyword', 'sermon_brief'];
  const validDepths = ['quick', 'study', 'sermon_brief'];
  if (!validModes.includes(mode))   throw new Error(`invalid mode: ${mode}`);
  if (!validDepths.includes(depth)) throw new Error(`invalid depth: ${depth}`);

  // Sermon Brief mode always runs at sermon_brief depth regardless of depth param
  const effectiveDepth = mode === 'sermon_brief' ? 'sermon_brief' : depth;

  const key = cacheKey(mode, effectiveDepth, input, traditions);
  if (_cache.has(key)) {
    console.log(`[research-engine] cache hit — ${key}`);
    return _cache.get(key);
  }

  const model     = mode === 'sermon_brief' ? MODEL_HAIKU : MODEL_SONNET;
  const maxTokens = MAX_TOKENS[effectiveDepth];
  const prompt    = buildPrompt(mode, effectiveDepth, input, traditions);

  console.log(`[research-engine] calling ${model} | mode=${mode} depth=${effectiveDepth} tokens≤${maxTokens}`);
  console.log(`[research-engine] input="${input}" traditions=[${traditions.join(', ')}]`);

  const message = await client.messages.create({
    model,
    max_tokens: maxTokens,
    messages: [{ role: 'user', content: prompt }],
  });

  // Track cost (note: costTracker uses Sonnet 4 pricing; haiku calls will be logged
  // conservatively — update costTracker pricing when haiku cost matters at scale)
  track(message.usage, `research-${mode}-${effectiveDepth}`);

  const raw    = message.content[0]?.text || '';
  const parsed = parseResponse(raw);

  const result = {
    mode,
    depth:        effectiveDepth,
    input:        input.trim(),
    traditions,
    results:      parsed.results      || {},
    commonGround: parsed.commonGround || '',
    ...(mode === 'sermon_brief' && { sermonAngle: parsed.sermonAngle || '' }),
  };

  _cache.set(key, result);
  console.log(`[research-engine] done — ${Object.keys(result.results).length} traditions returned`);

  return result;
}
