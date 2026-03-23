// Regenerate og-default.png after any branding changes — node gen-og.js
import sharp from 'sharp';

const W = 1200, H = 630;

const dots = [
  { color: '#D4A843' }, // Christianity
  { color: '#3B6DB5' }, // Judaism
  { color: '#2E9E6A' }, // Islam
  { color: '#E07B2A' }, // Buddhism
  { color: '#C03A2B' }, // Hinduism
  { color: '#6BAA8A' }, // Taoism
  { color: '#4A6FA5' }, // Sikhism
];

const R       = 22;
const GAP     = 28;
const dotStep = R * 2 + GAP;
const totalW  = dots.length * R * 2 + (dots.length - 1) * GAP;
const startX  = (W - totalW) / 2 + R;
const dotY    = 218;

const circles = dots.map((d, i) =>
  `<circle cx="${startX + i * dotStep}" cy="${dotY}" r="${R}" fill="${d.color}"/>`
).join('\n  ');

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}">
  <!-- background -->
  <rect width="${W}" height="${H}" fill="#0e0e0f"/>
  <!-- soft center glow -->
  <radialGradient id="g" cx="50%" cy="52%" r="55%">
    <stop offset="0%"   stop-color="#2a1f0a" stop-opacity="0.6"/>
    <stop offset="100%" stop-color="#0e0e0f" stop-opacity="0"/>
  </radialGradient>
  <rect width="${W}" height="${H}" fill="url(#g)"/>
  <!-- tradition dots -->
  ${circles}
  <!-- thin rule -->
  <line x1="${W/2 - 180}" y1="${dotY + R + 22}" x2="${W/2 + 180}" y2="${dotY + R + 22}" stroke="#f5f3ee" stroke-width="0.6" opacity="0.18"/>
  <!-- wordmark -->
  <text x="${W/2}" y="360"
    text-anchor="middle"
    font-family="Georgia, 'Times New Roman', serif"
    font-size="80"
    font-weight="bold"
    letter-spacing="14"
    fill="#f5f3ee">MANY PATHS</text>
  <!-- tagline -->
  <text x="${W/2}" y="416"
    text-anchor="middle"
    font-family="Georgia, 'Times New Roman', serif"
    font-size="22"
    font-weight="normal"
    letter-spacing="4"
    fill="#f5f3ee"
    opacity="0.45">One humanity · Many paths</text>
</svg>`;

await sharp(Buffer.from(svg)).png().toFile('og-default.png');
console.log('✓ og-default.png written (1200×630)');
