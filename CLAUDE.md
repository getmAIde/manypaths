# Many Paths (BridgeMAIde) — Project Notes for Claude

## What This Is
Many Paths is a comparative religion platform at **manypaths.one**. It makes every major religious tradition — and every denomination within them — accessible, comparable, and usable by anyone.

**The core premise:** Every tradition has been ignored, misread, or reduced to a stereotype. Many Paths gives them all equal standing, in their own voice, side by side.

**Tagline:** Many paths — one destination.

---

## Business Model
| Tier | Feature | Price |
|------|---------|-------|
| Free (forever) | Compare — side-by-side topic comparison | Always free |
| Paid (soon) | Research — deep study, sermon tools, pocket guides | Free during beta → paid |

**Compare** is the top-of-funnel. Millions of people curious about religion, students, interfaith couples, journalists. It grows organically. Never paywalled.

**Research** is the monetization layer. Primary paying customers: clergy (weekly sermon prep, 52x/year), seminary students, chaplains (multi-faith by definition), religious educators, interfaith organizations.

**The market:** ~400,000 active clergy in the US alone. Weekly sermon prep — they use this 52 times a year. At 1% penetration × $20/month = ~$960K ARR before touching the global market, seminaries, or institutional licensing. The denomination profile system is what unlocks this — generic sermon tools already exist. A tool that knows the difference between a Baptist altar call and an Eastern Orthodox doxology does not.

Stripe not yet live. Launch after LLC + EIN + Mercury are in place.

---

## Product Vision

### The Scale
"Any and all" — every tradition, every denomination, every flavor. Not just 8 traditions but:
- **Christianity**: Catholic (Roman/Eastern/Tridentine), Orthodox (Greek/Russian/Coptic/Ethiopian/Armenian), Baptist (Southern/American/National), Methodist, Lutheran, Presbyterian, Anglican/Episcopal, Pentecostal, Charismatic, SDA, Evangelical, LDS, Quaker, Mennonite, and more
- **Judaism**: Orthodox, Conservative, Reform, Reconstructionist, Renewal, Hasidic sects
- **Islam**: Sunni (Hanafi/Maliki/Shafi'i/Hanbali), Shia (Twelver/Ismaili/Zaidi), Sufi orders
- **Buddhism**: Theravada, Mahayana, Vajrayana, Zen, Pure Land, Nichiren
- **Hinduism**: Vaishnavism, Shaivism, Shaktism, Smartism
- **Plus**: Bahá'í, Jainism, Zoroastrianism, Shinto, indigenous traditions

This is built via a **denomination profile system** — not hardcoded lists. Each tradition gets a profile:
```js
{
  tradition: "Eastern Orthodox",
  branch: "Greek Orthodox",
  voice: "liturgical, patristic, poetic, meditative",
  structure: "scriptural anchor → Church Father citation → theological reflection → doxology",
  sources: ["Scripture (LXX/NRSV)", "Church Fathers", "Lives of Saints", "Liturgical texts"],
  language: ["occasional Greek transliteration", "formal register", "Trinitarian framing"],
  congregation: "gathered faithful, assumed catechesis, liturgical rhythm",
  avoids: ["casual tone", "pop culture references", "altar call structure"]
}
```
A Catholic homily does not sound like a Baptist sermon. A Rabbi's drash does not sound like a Pentecostal altar call. The denominational voice IS the product.

### Output Formats — All of Them
"Give them all of it and let them choose." User selects format:
- 📜 Full Sermon Manuscript
- 🗂 Preaching Outline
- 📖 Scripture Study
- 🕯 Devotional
- 👶 Children's Lesson
- ⚰️ Funeral Homily
- 💍 Wedding Homily
- 👥 Small Group Guide
- 🙏 Personal Reflection

Each format = different prompt template. Same denomination profile, different shape.

### Research UI Flow (planned)
1. **Who are you?** → tradition picker → denomination/branch picker
2. **What do you need?** → format card grid (all options shown, pick one)
3. **What's your topic or scripture?** → free text
4. → Generate in their voice, for their people

---

## Current Capabilities (Live)

### Compare (index.html + app.js)
- Side-by-side topic comparison across 2-4 traditions
- 8 traditions: Christianity, Judaism, Islam, Buddhism, Hinduism, Taoism, Sikhism, Latter-day Saints
- "Inspire me" random topic generator
- 8 languages: EN, ES, AR, HE, HI, FR, ZH, JA
- Dynamic OG image per compare result

### Research (research.html + research-engine.js)
**3-step UI:** (1) Your tradition pill → (2) Format card → (3) Your topic or text

**10 output formats (all live):**
| Format | Depth key | Model | Notes |
|--------|-----------|-------|-------|
| Quick Answer | `quick` | Haiku | One sentence per tradition |
| Scripture Study | `study` | Sonnet | Full interpretation + context |
| Devotional | `devotional` | Haiku | Personal reflection |
| Preaching Outline | `preaching_outline` | Sonnet | I/II/III + sermon angle |
| Sermon Manuscript | `manuscript` | Sonnet | Full intro/body/application/close |
| Children's Lesson | `childrens_lesson` | Haiku | Ages 8-12 |
| Funeral Homily | `funeral_homily` | Haiku | Pastoral, grief-honest |
| Wedding Homily | `wedding_homily` | Haiku | Covenant theology per tradition |
| Small Group Guide | `small_group` | Sonnet | 3-question arc per tradition |
| Personal Reflection | `personal_reflection` | Haiku | 2nd-person devotional prompts |

**Denomination system:** tradition-context.js has PREACHING VOICE sections for all 8 base traditions + 14 denominations. Each denomination gets voice, structure, lectionary, authorities, and avoidance patterns.

**Denomination pickers in Research:** Christianity (7), Judaism (4), Islam (4), Buddhism (4).

**Research history:** last 10 queries in localStorage, shown as pills above Run. Click to restore.

**Compare → Research funnel:** each Compare result card shows "Go deeper in {tradition} →" after render, linking to `/research?tradition={t}&q={topic}`.

---

## Technical Architecture

### Stack
- Node.js HTTP server (`server.js`) as `@vercel/node` serverless function
- Static HTML/CSS/JS — no framework (intentional, keeps it fast and portable)
- Anthropic SDK — Sonnet 4 for compare + study, Haiku for quick/sermon_brief
- No database, no auth — localStorage for session state (acceptable until Stripe)
- Vercel auto-deploy from GitHub (`getmAIde/manypaths`)
- Fonts: Josefin Sans (UI), Cinzel + EB Garamond (Research)
- Accent color: `#c8900e` (gold)

### Key Files
| File | Purpose |
|------|---------|
| `server.js` | Main HTTP handler, all routes, API proxy |
| `app.js` | Compare mode UI logic |
| `research-ui.js` | Research mode UI, mode/depth selectors |
| `research-engine.js` | All Research prompts, Anthropic calls, cache, cost tracking |
| `i18n.js` | Translation function `t()` — must be included in every HTML page |
| `models.js` | Model ID resolution (Sonnet/Haiku) |
| `costTracker.js` | Token + cost logging on every API call |
| `og-generator.js` | Dynamic OG image via sharp+SVG |
| `styles.css` | Shared styles — CSS variables, no hardcoded colors |
| `vercel.json` | Build config — `builds` + `routes`, `includeFiles` |

### Models
```js
MODEL_SONNET = 'claude-sonnet-4-20250514'   // compare, topic study, verse study
MODEL_HAIKU  = 'claude-haiku-4-5-20251001'  // quick modes, sermon_brief
```

### TRADITION_CONTEXT in tradition-context.js
Shared module imported by research-engine.js. All 8 base traditions + 14 denominations have entries. Each entry has theological identity + PREACHING/TEACHING/KHUTBA/DHAMMA TALK VOICE section (tone, structure, lectionary, preferred authorities, avoidance patterns).

### vercel.json Rules — Do Not Break
- Use `builds` + `routes` — never mix with `functions` (they conflict)
- `maxDuration: 60` inside `builds[].config`, NOT top-level
- `includeFiles` must list every static file explicitly
- `redirects` handles www→apex before routes

---

## Live at
**https://manypaths.one** — apex canonical, www 301s to apex

### DNS (Namecheap)
- A → 76.76.21.21
- CNAME www → cname.vercel-dns.com

### GitHub
- Repo: `getmAIde/manypaths` — auto-deploys on push to main

---

## Badge System
- **BETA** badge: gold (`#c8900e`) outline, on brand name — permanent
- **NEW** badge: green (`#1a9e6a`) outline, on Research nav link in index.html
- `TRADITION_ADDED` map: auto-expires 30 days after set date
- `NAV_BADGE_ADDED = '2026-03-24'` — Research NEW badge expires 30 days from this date

---

## Security
- CORS restricted to `https://manypaths.one` on `/api/research` SSE
- Security headers: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`
- Error messages sanitized — internal details server-side only
- No CSP yet — blocked by inline onclick handlers (future sprint: move to addEventListener)
- Paywall: client-side localStorage (bypassable — acceptable until Stripe)

---

## Environment Variables
| Key | Where | Notes |
|-----|-------|-------|
| `ANTHROPIC_API_KEY` | Vercel env + `.env` local | Must be trimmed — `.trim()` in code |

---

## Next Sprint Priorities

### 1. Stripe + Auth (biggest unlock)
- Gate: LLC + EIN + Mercury must be live first
- Email magic link for auth
- Stripe Checkout subscription for Research paid tier
- Replace localStorage paywall with server-side session check

### 2. More Denominations
- Anglican/Episcopal, Presbyterian, SDA, Quaker, Mennonite
- Reconstructionist + Renewal Judaism
- Hanafi/Maliki/Shafi'i/Hanbali schools within Sunni Islam
- Add to tradition-context.js + Research denomination picker

### 3. CSP Hardening
- Move remaining inline event handlers to addEventListener
- Enable strict Content Security Policy
- Currently blocked by `historyRender()` inline onmouseover in app.js

### 4. Save / Export (Research)
- Full session save (beyond recent history pills)
- Named saves: "Advent sermon - Methodist - 2026"
- Export improvements: PDF, DOCX (pastors live in Word)

### 5. Share on Research results
- Already ships (share bar). Need OG image generation per Research result.

### 6. More Traditions
- Bahá'í, Jainism, Zoroastrianism, Shinto — add to both Compare + Research
- Indigenous traditions (careful framing required)

---

## getMAIde Ecosystem
Many Paths is one of 16 active projects under getMAIde (Wyoming LLC). Parent entity never surfaced to users — each project is a standalone public brand.

**Portfolio position:**
- LegisPlain (legisplain.org): legislation → readable
- Many Paths (manypaths.one): traditions → comparable
- KaChing (kaching.click): finance → plain language
- D/CODE: any document → decoded

All share the same verb: *make it accessible.*

**The Doc family connection:** LegisPlain has The Doc — a crumpled piece of paper who narrates his own existence. Many Paths has a character waiting: an ancient scroll, 4,000 years old, copied, translated, misread across every civilization, who is *thrilled* someone finally wants to compare him to a different tradition. Character not yet built — when the video series launches, this is the direction.

---

## Session History

### 2026-03-24
- Fixed DNS: Render → Vercel (A + CNAME in Namecheap)
- Fixed CSS/JS 404s: `includeFiles` in `vercel.json`
- Fixed `APIConnectionError`: trailing `\n` in API key — added `.trim()`
- Fixed wrong Haiku model ID
- Fixed `t() not defined` on Research page
- Added Latter-day Saints with `TRADITION_CONTEXT`
- Added NEW badge system, 30-day auto-expiry
- Added dynamic OG image, favicon, robots.txt, logo SVG routes
- Added www→apex 301 redirect
- Connected GitHub → Vercel auto-deploy

### 2026-03-25
- Research mode confirmed live
- "Report an issue" mailto added to both page footers
- Security hardening: CORS, headers, error sanitization
- Security audit: 0 npm vulnerabilities, no hardcoded secrets

### 2026-03-26
- Research nav: "coming soon" copy → NEW green badge (live feature)
- index.html footer: updated to "Research is live — try free during beta"
- research.html footer: "Paid plans coming soon" — kept (correct)
- CLAUDE.md: full rewrite with product vision, denomination system, full roadmap

---

## Known Issues
- No CSP (blocked by inline `onmouseover` in `historyRender()` + tip jar dismiss — fix = move to addEventListener)
- Paywall is localStorage only — bypassable until Stripe
- `DENOMINATION_PARENT` removed from app.js but still referenced at line ~132 in `historyRender()` — safe due to optional chaining (`?.`) but technically dead code
- Research history `selectTradition()` restores parent but denomination sub-picker may not auto-select if denomination pills haven't rendered yet — edge case, acceptable
