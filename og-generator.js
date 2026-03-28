// og-generator.js
// Generates a 1200×630 OG image for a given topic + traditions.
// Uses sharp + inline SVG — no canvas, no fonts to load.
// Export: generateOG(topic, traditions) → Buffer (PNG)

import sharp from 'sharp';

const W = 1200, H = 630;

const TRADITION_COLOR = {
  Christianity:       '#D4A843',
  Judaism:            '#3B6DB5',
  Islam:              '#2E9E6A',
  Buddhism:           '#E07B2A',
  Hinduism:           '#C03A2B',
  Taoism:             '#6BAA8A',
  Sikhism:            '#4A6FA5',
  'Latter-day Saints':'#2A5298',
  // Denominations inherit parent color
  'Roman Catholic':   '#D4A843',
  'Eastern Orthodox': '#D4A843',
  'Baptist':          '#D4A843',
  'Methodist':        '#D4A843',
  'Lutheran':         '#D4A843',
  'Pentecostal':      '#D4A843',
  'Sunni Islam':      '#2E9E6A',
  'Shia Islam':       '#2E9E6A',
  'Sufi Islam':       '#2E9E6A',
  'Orthodox Judaism': '#3B6DB5',
  'Conservative Judaism': '#3B6DB5',
  'Reform Judaism':   '#3B6DB5',
  'Theravada Buddhism': '#E07B2A',
  'Zen Buddhism':     '#E07B2A',
  'Tibetan Buddhism': '#E07B2A',
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

  // ── Tradition dots + labels ───────────────────────────────────────────────
  const showNames = traditions.length > 0 && traditions.length <= 4;
  const colors = traditions.length > 0
    ? traditions.map(t => TRADITION_COLOR[t] || DEFAULT_COLOR)
    : Object.values(TRADITION_COLOR).slice(0, 7);

  const R       = 16;
  const GAP     = showNames ? 48 : 20;
  const dotStep = R * 2 + GAP;
  const totalW  = colors.length * R * 2 + (colors.length - 1) * GAP;
  const startX  = (W - totalW) / 2 + R;
  const dotY    = 138;

  const circles = colors.map((c, i) =>
    `<circle cx="${startX + i * dotStep}" cy="${dotY}" r="${R}" fill="${c}" opacity="0.92"/>`
  ).join('\n  ');

  // Short tradition label (strip "Buddhism", "Judaism" etc. for readability)
  function shortName(t) {
    return t.replace(' Buddhism','').replace(' Judaism','').replace(' Islam','')
            .replace(' Christianity','').replace('Eastern ','E. ').replace('Conservative','Cons.')
            .replace('Latter-day Saints','LDS');
  }

  const nameLabels = showNames
    ? traditions.map((t, i) =>
        `<text x="${startX + i * dotStep}" y="${dotY + R + 18}"
          text-anchor="middle"
          font-family="Georgia, 'Times New Roman', serif"
          font-size="16"
          letter-spacing="0.5"
          fill="#f5f3ee"
          opacity="0.55">${esc(shortName(t))}</text>`
      ).join('\n  ')
    : '';

  // ── Topic text (wrapped, large) ───────────────────────────────────────────
  const displayTopic = topic.length > 60 ? topic.slice(0, 57) + '…' : topic;
  const topicLines   = wrapText(displayTopic, 26);
  const topicFontSize = topicLines.length > 1 ? 72 : 88;
  const ruleY         = dotY + R + (showNames ? 38 : 20);
  const topicStartY   = ruleY + (topicLines.length > 1 ? 82 : 100);
  const topicLineH    = topicFontSize * 1.2;

  const topicSVG = topicLines.map((ln, i) =>
    `<text x="${W/2}" y="${topicStartY + i * topicLineH}"
      text-anchor="middle"
      font-family="Georgia, 'Times New Roman', serif"
      font-size="${topicFontSize}"
      font-weight="bold"
      letter-spacing="2"
      fill="#f0e6c8">${esc(ln)}</text>`
  ).join('\n  ');

  // ── Wordmark ──────────────────────────────────────────────────────────────
  const wordmarkY = Math.min(topicStartY + topicLines.length * topicLineH + 52, H - 42);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <!-- background -->
  <rect width="${W}" height="${H}" fill="#0e0e0f"/>
  <!-- soft center glow -->
  <radialGradient id="g" cx="50%" cy="48%" r="55%">
    <stop offset="0%"   stop-color="#2a1f0a" stop-opacity="0.7"/>
    <stop offset="100%" stop-color="#0e0e0f" stop-opacity="0"/>
  </radialGradient>
  <rect width="${W}" height="${H}" fill="url(#g)"/>
  <!-- gold border frame -->
  <rect x="20" y="20" width="${W - 40}" height="${H - 40}" rx="8"
    fill="none" stroke="#c8900e" stroke-width="1" opacity="0.28"/>

  <!-- tradition dots -->
  ${circles}

  <!-- tradition names (if ≤ 4) -->
  ${nameLabels}

  <!-- thin rule below dots / labels -->
  <line x1="${W/2 - 220}" y1="${ruleY}" x2="${W/2 + 220}" y2="${ruleY}"
    stroke="#f5f3ee" stroke-width="0.6" opacity="0.15"/>

  <!-- topic -->
  ${topicSVG}

  <!-- wordmark -->
  <text x="${W/2}" y="${wordmarkY}"
    text-anchor="middle"
    font-family="Georgia, 'Times New Roman', serif"
    font-size="20"
    letter-spacing="5"
    fill="#f5f3ee"
    opacity="0.55">MANY PATHS · manypaths.one</text>
</svg>`;

  const buf = await sharp(Buffer.from(svg)).png().toBuffer();
  _cache.set(key, buf);
  console.log(`[og-generator] generated OG for "${topic}" (${traditions.length} traditions)`);
  return buf;
}
