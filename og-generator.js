// og-generator.js
// Generates a 1200×630 OG image for a given topic + traditions.
// Uses sharp + inline SVG — no canvas, no fonts to load.
// Export: generateOG(topic, traditions) → Buffer (PNG)

import sharp from 'sharp';

const W = 1200, H = 630;

const TRADITION_COLOR = {
  Christianity: '#D4A843',
  Judaism:      '#3B6DB5',
  Islam:        '#2E9E6A',
  Buddhism:     '#E07B2A',
  Hinduism:     '#C03A2B',
  Taoism:       '#6BAA8A',
  Sikhism:      '#4A6FA5',
};

const DEFAULT_COLOR = '#c8900e';

// Memory cache: topic+traditions key → PNG Buffer
const _cache = new Map();

function cacheKey(topic, traditions) {
  return `${topic.toLowerCase().trim()}__${[...traditions].sort().join(',')}`;
}

// Wrap long topic text into lines of max ~charLimit chars
function wrapText(text, charLimit) {
  const words = text.split(' ');
  const lines = [];
  let line = '';
  for (const w of words) {
    if ((line + ' ' + w).trim().length > charLimit) {
      if (line) lines.push(line);
      line = w;
    } else {
      line = (line + ' ' + w).trim();
    }
  }
  if (line) lines.push(line);
  return lines;
}

// Escape XML special characters for SVG text
function esc(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function generateOG(topic, traditions = []) {
  const key = cacheKey(topic, traditions);
  if (_cache.has(key)) return _cache.get(key);

  // ── Tradition dots ────────────────────────────────────────────────────────
  const colors = traditions.length > 0
    ? traditions.map(t => TRADITION_COLOR[t] || DEFAULT_COLOR)
    : Object.values(TRADITION_COLOR);

  const R       = 18;
  const GAP     = 22;
  const dotStep = R * 2 + GAP;
  const totalW  = colors.length * R * 2 + (colors.length - 1) * GAP;
  const startX  = (W - totalW) / 2 + R;
  const dotY    = 148;

  const circles = colors.map((c, i) =>
    `<circle cx="${startX + i * dotStep}" cy="${dotY}" r="${R}" fill="${c}"/>`
  ).join('\n  ');

  // ── Topic text (wrapped, large) ───────────────────────────────────────────
  const displayTopic = topic.length > 60 ? topic.slice(0, 57) + '…' : topic;
  const topicLines   = wrapText(displayTopic, 26);       // ~26 chars per line at font-size 88
  const topicFontSize = topicLines.length > 1 ? 72 : 88;
  const topicStartY   = topicLines.length > 1 ? 295 : 340;
  const topicLineH    = topicFontSize * 1.2;

  const topicSVG = topicLines.map((ln, i) =>
    `<text x="${W/2}" y="${topicStartY + i * topicLineH}"
      text-anchor="middle"
      font-family="Georgia, 'Times New Roman', serif"
      font-size="${topicFontSize}"
      font-weight="bold"
      letter-spacing="2"
      fill="#f5f3ee">${esc(ln)}</text>`
  ).join('\n  ');

  // ── Wordmark ──────────────────────────────────────────────────────────────
  const wordmarkY = topicStartY + topicLines.length * topicLineH + 52;

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <!-- background -->
  <rect width="${W}" height="${H}" fill="#0e0e0f"/>
  <!-- soft center glow -->
  <radialGradient id="g" cx="50%" cy="48%" r="55%">
    <stop offset="0%"   stop-color="#2a1f0a" stop-opacity="0.65"/>
    <stop offset="100%" stop-color="#0e0e0f" stop-opacity="0"/>
  </radialGradient>
  <rect width="${W}" height="${H}" fill="url(#g)"/>

  <!-- tradition dots -->
  ${circles}

  <!-- thin rule below dots -->
  <line x1="${W/2 - 200}" y1="${dotY + R + 18}" x2="${W/2 + 200}" y2="${dotY + R + 18}"
    stroke="#f5f3ee" stroke-width="0.6" opacity="0.18"/>

  <!-- topic -->
  ${topicSVG}

  <!-- wordmark -->
  <text x="${W/2}" y="${wordmarkY}"
    text-anchor="middle"
    font-family="Georgia, 'Times New Roman', serif"
    font-size="22"
    letter-spacing="6"
    fill="#f5f3ee"
    opacity="0.38">MANY PATHS · manypaths.one</text>
</svg>`;

  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  _cache.set(key, buf);
  console.log(`[og-generator] generated OG for "${topic}" (${traditions.length} traditions)`);
  return buf;
}
