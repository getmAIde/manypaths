# Many Paths (BridgeMAIde) — Project Notes

## Live URL
https://manypaths.one (apex only — www redirects to apex)

## Hosting
- **Vercel** — project name: `bridgemaide`
- GitHub: `getmAIde/manypaths` (connected, auto-deploys on push to main)
- Domain registrar: Namecheap
- DNS: A record → 76.76.21.21, CNAME www → cname.vercel-dns.com

## Stack
- Node.js HTTP server (`server.js`) deployed as `@vercel/node` serverless function
- Static files (HTML/CSS/JS) bundled via `includeFiles` in `vercel.json`
- Anthropic SDK for compare + research modes
- No database, no auth, no Stripe yet

## API Key
- `ANTHROPIC_API_KEY` set in Vercel env vars — must be trimmed (no trailing newline)
- `server.js` and `research-engine.js` both use `.trim()` defensively
- Local dev: key in `.env` (never committed)

## Key Files
| File | Purpose |
|---|---|
| `server.js` | Main HTTP handler, routes, API proxy |
| `app.js` | Compare mode UI, badge logic |
| `research-ui.js` | Research mode UI, badge logic |
| `research-engine.js` | Research prompt builder, Anthropic calls |
| `og-generator.js` | Dynamic OG image via sharp+SVG |
| `i18n.js` | Translation function `t()` — must be included in every page |
| `vercel.json` | Build config, includeFiles, www→apex redirect |

## Traditions Supported
Christianity, Judaism, Islam, Buddhism, Hinduism, Taoism, Sikhism, Latter-day Saints

## "New" Badge System
- `TRADITION_ADDED` map in both `app.js` and `research-ui.js`
- Auto-expires 30 days after the date set per tradition
- CSS class `.new-badge`: gold outline, transparent bg, 10px superscript
- Nav badge on Research link: same 30-day logic, `NAV_BADGE_ADDED = '2026-03-24'`
- LDS added: `2026-03-24`

## vercel.json Notes
- Must use `builds` + `routes` (not `functions`) — they conflict
- `maxDuration: 60` inside `builds[].config` (not top-level)
- `includeFiles` must list every static file explicitly — `@vercel/node` won't bundle them otherwise
- `redirects` key handles www→apex at edge level before routes

## Known 404s (resolved)
- favicon, apple-touch-icon, logo SVGs, robots.txt — all handled via server routes + includeFiles

## Security Notes (as of 2026-03-25)
- CORS restricted to `https://manypaths.one` on `/api/research` SSE endpoint
- Security headers on all responses: `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`
- Error messages sanitized — internal details logged server-side only, generic message to client
- Paywall quotas are client-side localStorage (bypassable) — acceptable until Stripe goes live
- No CSP yet — blocked by inline onclick handlers in app.js / research-ui.js (future sprint)

## Session History
### 2026-03-24
- Fixed DNS: moved from Render to Vercel (A + CNAME in Namecheap)
- Fixed CSS/JS 404s: added `includeFiles` to `vercel.json`
- Fixed `APIConnectionError`: trailing `\n` in API key — added `.trim()`
- Fixed wrong Haiku model ID: `claude-3-5-haiku-20241022`
- Fixed `t() not defined` on Research page: added `i18n.js` to page + includeFiles
- Added Latter-day Saints to Compare + Research modes with TRADITION_CONTEXT
- Added "new" badge system (denomination + nav), gold outline style
- Added dynamic OG image endpoint (`/og`) via sharp+SVG
- Added favicon, robots.txt, logo SVG routes
- Added www→apex 301 redirect in `vercel.json`
- Connected GitHub repo to Vercel for auto-deploys

### 2026-03-25
- Confirmed Sermon Brief 500 error was pre-fix; models.js has correct `claude-haiku-4-5-20251001`
- Added "Report an issue" mailto link to footer (both index.html + research.html)
- Security hardening: CORS restricted, security headers added, error messages sanitized
- Security audit completed — 0 npm vulnerabilities, no hardcoded secrets
