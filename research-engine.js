// research-engine.js
// Prompt layer for Research mode — 4 modes × 3 depths with session cache and cost controls.
// Export: runResearch(mode, depth, input, traditions) → structured JSON

import Anthropic from '@anthropic-ai/sdk';
import { track } from './costTracker.js';
import { resolvedModels } from './models.js';
import { TRADITION_CONTEXT } from './tradition-context.js';

const client = new Anthropic({ apiKey: (process.env.ANTHROPIC_API_KEY || '').trim() });
const { sonnet: MODEL_SONNET, haiku: MODEL_HAIKU } = resolvedModels();

// Session-level cache — same query never hits the API twice per process lifetime
const _cache = new Map();

// ─── Config ───────────────────────────────────────────────────────────────────


// Tokens scale with tradition count — original spec assumed 2-3 traditions;
// 7 traditions × ~200 tokens each needs headroom. Keep sermon_brief tight.
const MAX_TOKENS = {
  quick:              2000,
  study:              4000,
  sermon_brief:       3000,
  devotional:         2000,
  preaching_outline:  3000,
  childrens_lesson:   2500,
  manuscript:         5000,
  funeral_homily:     2500,
  wedding_homily:     2500,
  small_group:        3500,
  personal_reflection:1800,
};

// ─── Tradition context — imported from shared module ─────────────────────────
// TRADITION_CONTEXT covers all 8 traditions + all denominations.

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

  // ── Cross-mode formats (devotional / preaching_outline / childrens_lesson) ──
  // These intercept before mode-specific dispatch and work with any query type.

  if (depth === 'devotional') {
    const inputLabel = mode === 'verse' ? 'Scripture' : mode === 'keyword' ? 'Word or Concept' : 'Theme';
    return `You are an interfaith devotional writer.

${inputLabel}: "${input}"
Traditions: ${traditions.join(', ')}

${ctxNote ? ctxNote + '\n\n' : ''}${tNote}

Return valid JSON:
{
  "results": {
    "Christianity": {
      "scripture": "one key verse with full citation",
      "reflection": "a personal, meditative paragraph of 100-120 words written in the warmth of this tradition's devotional voice"
    }
  },
  "commonGround": "one sentence on the shared invitation these traditions extend to the reader"
}

Rules:
- Warm, personal, accessible prose — not academic
- Each reflection must feel distinctly shaped by that tradition's spirituality — use the DEVOTIONAL/TEACHING VOICE specified in the tradition context notes above
- Never scary, preachy, or exclusionary
- Return ONLY the JSON object, no markdown fences`;
  }

  if (depth === 'preaching_outline') {
    const inputLabel = mode === 'verse' ? 'Text' : mode === 'keyword' ? 'Word or Concept' : 'Theme';
    return `You are an interfaith preaching coach preparing sermon outlines.

${inputLabel}: "${input}"
Traditions: ${traditions.join(', ')}

${ctxNote ? ctxNote + '\n\n' : ''}${tNote}

Return valid JSON:
{
  "results": {
    "Christianity": {
      "passage": "key passage with citation",
      "main_point": "the central preaching point — one punchy, memorable sentence",
      "sub_points": ["I. First movement", "II. Second movement", "III. Third movement — application"]
    }
  },
  "sermonAngle": "a unifying angle that a preacher could carry through all these traditions — one paragraph",
  "commonGround": "what all these traditions converge on for this theme — 1-2 sentences"
}

Rules:
- sub_points: exactly 3, labelled I. II. III. — each a complete thought
- main_point: preachable, memorable, one sentence
- Shape the outline to match that tradition's preaching structure and voice — use the PREACHING VOICE specified in the tradition context notes above
- Return ONLY the JSON object, no markdown fences`;
  }

  if (depth === 'childrens_lesson') {
    const inputLabel = mode === 'verse' ? 'Scripture' : mode === 'keyword' ? 'Word or Concept' : 'Theme';
    return `You are an interfaith religious educator designing lessons for ages 8-12.

${inputLabel}: "${input}"
Traditions: ${traditions.join(', ')}

${ctxNote ? ctxNote + '\n\n' : ''}${tNote}

Return valid JSON:
{
  "results": {
    "Christianity": {
      "story_hook": "a 2-sentence story or vivid image to open the lesson — concrete and child-friendly",
      "teaching": "what this tradition teaches, in simple words an 8-year-old understands — 2-3 sentences",
      "scripture": "one short, child-friendly verse or teaching saying with citation",
      "discussion_question": "one open question to ask children — something they can actually answer from their own life"
    }
  },
  "commonGround": "one sentence: what all these traditions teach children to do or feel about this"
}

Rules:
- No jargon — if a big word appears, explain it in the same breath
- Concrete images and stories over abstract theology
- Shape the lesson to match that tradition's teaching style — use the TEACHING VOICE specified in the tradition context notes above
- Inclusive, warm, never scary or exclusionary
- Return ONLY the JSON object, no markdown fences`;
  }

  // ── Full Sermon Manuscript ─────────────────────────────────────────────────
  if (depth === 'manuscript') {
    const inputLabel = mode === 'verse' ? 'Text' : 'Theme';
    return `You are an interfaith preaching scholar writing full sermon manuscripts.

${inputLabel}: "${input}"
Traditions: ${traditions.join(', ')}

${ctxNote ? ctxNote + '\n\n' : ''}${tNote}

Return valid JSON:
{
  "results": {
    "Christianity": {
      "passage": "key scripture with full citation",
      "title": "a sermon title — memorable, preachable",
      "intro": "Opening paragraph, 100-120 words — hook the congregation with a story or image, not a thesis statement",
      "body": "Main content — three movements, each 80-100 words, labelled I. II. III. Build tension across the three movements",
      "application": "Concrete, specific, actionable — what should they actually do on Monday?",
      "close": "Closing paragraph, 60-80 words — send them out with hope and without cheap comfort"
    }
  },
  "sermonAngle": "the unifying thread a preacher could carry across all these traditions — one paragraph",
  "commonGround": "what all traditions share at the heart of this theme — 2-3 sentences"
}

Rules:
- Each manuscript must feel shaped by that tradition's actual preaching culture — use the PREACHING VOICE from the context notes above
- Manuscript language: you are writing to be spoken aloud, not read silently
- No jargon without explanation in the same breath
- Return ONLY the JSON object, no markdown fences`;
  }

  // ── Funeral Homily ────────────────────────────────────────────────────────
  if (depth === 'funeral_homily') {
    return `You are an interfaith pastoral care specialist writing funeral homilies.

Theme/Text: "${input}"
Traditions: ${traditions.join(', ')}

${ctxNote ? ctxNote + '\n\n' : ''}${tNote}

Return valid JSON:
{
  "results": {
    "Christianity": {
      "scripture": "key passage with citation — genuinely comforting, not triumphalist",
      "homily": "A 120-150 word funeral homily: tender, honest about grief, grounded in hope without minimising loss. Written in this tradition's pastoral voice."
    }
  },
  "commonGround": "what all these traditions say at the edge of death — the shared pastoral wisdom — 2 sentences"
}

Rules:
- Never toxic positivity — name the grief before the hope
- Use each tradition's authentic language for loss, afterlife, and consolation — use the PREACHING VOICE specified in the tradition context notes above
- Warm, personal, pastoral — not a theological lecture
- Return ONLY the JSON object, no markdown fences`;
  }

  // ── Wedding Homily ────────────────────────────────────────────────────────
  if (depth === 'wedding_homily') {
    return `You are an interfaith pastoral care specialist writing wedding homilies.

Theme/Text: "${input}"
Traditions: ${traditions.join(', ')}

${ctxNote ? ctxNote + '\n\n' : ''}${tNote}

Return valid JSON:
{
  "results": {
    "Christianity": {
      "scripture": "key passage with citation — something genuinely about love, covenant, or commitment",
      "homily": "A 120-150 word wedding homily: joyful, grounded, real about the covenant being made. Written in this tradition's pastoral voice."
    }
  },
  "commonGround": "what all these traditions celebrate and call sacred in committed partnership — 2 sentences"
}

Rules:
- Joyful but not saccharine — this is a serious covenant
- Use each tradition's authentic theology of covenant, love, and community — use the PREACHING VOICE specified in the tradition context notes above
- Inclusive — avoid gender-specific language unless theologically essential to the tradition
- Return ONLY the JSON object, no markdown fences`;
  }

  // ── Small Group Guide ─────────────────────────────────────────────────────
  if (depth === 'small_group') {
    const inputLabel = mode === 'verse' ? 'Text' : 'Topic';
    return `You are an interfaith religious educator designing small group discussion guides.

${inputLabel}: "${input}"
Traditions: ${traditions.join(', ')}

${ctxNote ? ctxNote + '\n\n' : ''}${tNote}

Return valid JSON:
{
  "results": {
    "Christianity": {
      "passage": "key scripture with citation",
      "framing": "2 sentences framing how this tradition approaches the topic — accessible, not academic",
      "questions": [
        "Opening question — invites the group in, no wrong answers",
        "Deeper question — surfaces the tension or complexity",
        "Application question — what does this mean for how we live this week?"
      ]
    }
  },
  "commonGround": "a closing reflection helping the group see what all traditions share — 2-3 sentences"
}

Rules:
- questions: exactly 3 per tradition — open-ended, not yes/no, accessible to non-experts
- Questions build: opening → deeper → personal/application
- Frame questions in language that feels natural within that tradition's communal life
- Return ONLY the JSON object, no markdown fences`;
  }

  // ── Personal Reflection ───────────────────────────────────────────────────
  if (depth === 'personal_reflection') {
    const inputLabel = mode === 'verse' ? 'Scripture' : 'Topic';
    return `You are an interfaith spiritual director writing prompts for personal prayer and reflection.

${inputLabel}: "${input}"
Traditions: ${traditions.join(', ')}

${ctxNote ? ctxNote + '\n\n' : ''}${tNote}

Return valid JSON:
{
  "results": {
    "Christianity": {
      "scripture": "one key verse or teaching with full citation",
      "reflection": "A 60-80 word personal reflection written in second person (\"you\" or \"we\"), in the warmth of this tradition's devotional voice — an invitation inward, not a lecture outward"
    }
  },
  "commonGround": "one sentence: the universal invitation all these traditions extend on this topic"
}

Rules:
- Short, intimate, personal — not a theological summary
- Second person: \"As you sit with this...\" or \"Notice how...\"
- Each reflection must feel distinctly shaped by that tradition's spirituality — use the DEVOTIONAL/TEACHING VOICE specified in the tradition context notes above
- Return ONLY the JSON object, no markdown fences`;
  }

  throw new Error(`Unknown mode/depth: ${mode}/${depth}`);
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
  const validDepths = ['quick', 'study', 'sermon_brief', 'devotional', 'preaching_outline',
                       'childrens_lesson', 'manuscript', 'funeral_homily', 'wedding_homily',
                       'small_group', 'personal_reflection'];
  if (!validModes.includes(mode))   throw new Error(`invalid mode: ${mode}`);
  if (!validDepths.includes(depth)) throw new Error(`invalid depth: ${depth}`);

  // Sermon Brief mode always runs at sermon_brief depth regardless of depth param
  const effectiveDepth = mode === 'sermon_brief' ? 'sermon_brief' : depth;

  const key = cacheKey(mode, effectiveDepth, input, traditions);
  if (_cache.has(key)) {
    console.log(`[research-engine] cache hit — ${key}`);
    return _cache.get(key);
  }

  const haiku_formats = ['sermon_brief', 'devotional', 'childrens_lesson',
                         'funeral_homily', 'wedding_homily', 'personal_reflection'];
  const model     = haiku_formats.includes(effectiveDepth) ? MODEL_HAIKU : MODEL_SONNET;
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

  const hasSermonAngle = mode === 'sermon_brief' ||
    ['preaching_outline', 'manuscript'].includes(effectiveDepth);

  const result = {
    mode,
    depth:        effectiveDepth,
    input:        input.trim(),
    traditions,
    results:      parsed.results      || {},
    commonGround: parsed.commonGround || '',
    ...(hasSermonAngle && { sermonAngle: parsed.sermonAngle || '' }),
  };

  _cache.set(key, result);
  console.log(`[research-engine] done — ${Object.keys(result.results).length} traditions returned`);

  return result;
}
