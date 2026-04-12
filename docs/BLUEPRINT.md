# ManyPaths System Blueprint
**Last Updated:** 2026-04-12  
**Project:** manypaths.one (Interfaith Religion Comparison + Paid Research)  
**Vercel Project:** bridgemaide  
**Repository:** https://github.com/getmAIde/bridgemaide.git

---

## 1. Repository & Deployment

### Live Site
- **Production:** https://manypaths.one
- **Vercel Project ID:** prj_tbd (Vercel project name: "bridgemaide")
- **Environment:** Vercel serverless (Node.js runtime)

### Repository
- **GitHub:** https://github.com/getmAIde/bridgemaide.git
- **Main Branch:** master
- **Deployment:** Git push to master → automatic Vercel deploy

### Local Development
```bash
cd ~/atom/getmAIde/Projects/bridgemaide
npm install
PORT=3100 npm start
# Server runs on http://localhost:3100
```

### Vercel Configuration
**File:** `vercel.json`
- Single build: `server.js` with `@vercel/node`
- `maxDuration: 60` (functions timeout after 60 seconds)
- Includes 25+ files: HTML, CSS, JS, logos, node_modules
- All routes directed to `server.js`
- `www.manypaths.one` redirects to `manypaths.one` (permanent)

---

## 2. Architecture

### Tech Stack
| Component | Tech | Version |
|-----------|------|---------|
| Runtime | Node.js | 20+ (Vercel default) |
| HTTP Server | Express.js (embedded in server.js) | native |
| Database Client | @supabase/supabase-js | 2.101.1 |
| AI Model | @anthropic-ai/sdk | 0.39.0 |
| Payment | stripe | 17.7.0 |
| Image Processing | sharp | 0.34.5 |
| Config | dotenv | 17.3.1 |
| Frontend | Vanilla HTML/CSS/JS | no framework |
| Styling | CSS custom properties | native |
| Language Support | i18n.js (8 languages) | custom |

### Directory Structure
```
bridgemaide/
├── server.js                    # Main Express server (21961 bytes)
├── app.js                       # Core app logic + tradition metadata (24421 bytes)
├── research-engine.js           # Research prompt layer + modes (22473 bytes)
├── research-ui.js               # Research tab UI (72820 bytes)
├── stripe-handlers.js           # Stripe checkout/webhook handlers (7046 bytes)
├── supabase.js                  # Database client + queries (4521 bytes)
├── auth.js                      # JWT sign/verify (1425 bytes)
├── lectionary.js                # RCL Gospel readings (7589 bytes)
├── tradition-context.js         # Tradition scholarship notes (28025 bytes)
├── i18n.js                      # Internationalization (9826 bytes)
├── og-generator.js              # OG image generation (6115 bytes)
├── costTracker.js               # API cost tracking (1581 bytes)
├── models.js                    # Claude model IDs (518 bytes)
├── index.html                   # Compare tab (main page)
├── research.html                # Research tab (paid)
├── upgrade.html                 # Paywall page
├── how-it-works.html            # Info page
├── onboarding.html              # Onboarding flow
├── styles.css                   # All styles
├── quote-card.js                # Quote card component
├── robots.txt                   # SEO
├── sitemap.xml                  # SEO
├── og-default.png               # Default OG image
├── logo/                        # Favicons + brand assets
└── node_modules/                # Dependencies

```

### Key Files & Purposes

| File | Size | Purpose |
|------|------|---------|
| **server.js** | 21961 B | Express server, rate limiting, OG meta injection, health check |
| **app.js** | 24421 B | Core Compare logic, tradition symbols/colors, history pills, surprise button |
| **research-engine.js** | 22473 B | Research prompt builder (4 modes × 3 depths), session cache, max tokens per mode |
| **research-ui.js** | 72820 B | Research tab UI, form controls, result rendering, save/load UI |
| **supabase.js** | 4521 B | DB client, research_usage tracking, research_saves CRUD |
| **stripe-handlers.js** | 7046 B | Checkout session creation, payment verification, webhook handler, donations |
| **auth.js** | 1425 B | JWT signing/verification (HMAC-SHA256, 30-day expiry) |
| **lectionary.js** | 7589 B | RCL data (date → Gospel → Compare topic mapping) |
| **tradition-context.js** | 28025 B | 8 traditions × denominations × scholarship notes |
| **i18n.js** | 9826 B | String translations (8 languages: en, es, ar, he, hi, fr, zh, ja) |
| **og-generator.js** | 6115 B | Dynamic OG image generation for social shares |
| **costTracker.js** | 1581 B | Tracks API costs per request |
| **models.js** | 518 B | Centralized Claude model IDs (Sonnet, Haiku) |

### Core Features

**Compare Tab (Free, Unlimited)**
- Input topic → Anthropic Claude generates multi-tradition comparison
- 8 traditions: Christianity, Judaism, Islam, Buddhism, Hinduism, Taoism, Sikhism, Latter-day Saints
- Dynamic tradition selection via checkboxes
- Language picker (8 languages)
- Compare history pills (quick re-run)
- Surprise button (random topic)
- Lectionary widget shows This Sunday's Gospel (RCL-based)

**Research Tab (Paid, $9/mo or $79/yr + 3 free runs/month)**
- Mode selector: verse, theme, sermon_brief, topical
- Depth selector: quick, study, deep (varies by mode)
- Tradition multi-select
- 3 free runs/month per fingerprint/user
- After free limit: paywall gate with Stripe checkout
- Research results saved to Supabase (authenticated)
- Export/save functionality

**Liturgical Calendar Integration**
- RCL data in lectionary.js (50+ entries)
- Auto-shows This Sunday widget (Gospel + Compare topic)
- Example: 2026-04-12 Easter Sunday → Luke 24:1-12 "resurrection"
- One-click Compare button from widget

**Text-to-Speech (Listen Button)**
- ElevenLabs integration (ELEVENLABS_API_KEY, live per manny-boot.md)
- Reads Compare results aloud with George's voice

**Brand Video**
- Audio asset integrated (7 traditions, George narration)
- Playback control in header

---

## 3. Database (Supabase)

### Connection
- **Project URL:** https://cvniwzqfiauwvslxjjbm.supabase.co
- **Client:** `@supabase/supabase-js` 2.101.1
- **Auth:** Service Role Key (server-side, bypasses RLS) or Anon Key (client-side, with RLS)

### Tables

#### `research_usage`
Tracks free tier usage (3 runs/month per fingerprint/user).

```sql
CREATE TABLE research_usage (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  created_at TIMESTAMPTZ DEFAULT now(),
  user_id UUID,
  fingerprint TEXT,
  month TEXT,  -- 'YYYY-MM'
  run_count INTEGER DEFAULT 0,
  UNIQUE(user_id, month),
  UNIQUE(fingerprint, month)
);
```

**Key Functions:**
- `checkUsage(userId, fingerprint)` → `{ allowed: bool, remaining: number, count: number }`
- `atomicIncrementUsage(userId, fingerprint)` → `{ newCount: number, allowed: bool }` (RPC: `increment_usage_atomic`)

#### `research_saves`
Persistent user research sessions (authenticated).

```sql
CREATE TABLE research_saves (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  user_id UUID NOT NULL,
  title TEXT,
  tradition TEXT,           -- selected tradition
  denomination TEXT,        -- user denomination
  topic TEXT,              -- input topic/verse
  format TEXT,             -- mode: 'verse', 'theme', 'sermon_brief', 'topical'
  depth TEXT,              -- 'quick', 'study', 'deep'
  language TEXT,           -- 'en', 'es', 'ar', 'he', 'hi', 'fr', 'zh', 'ja'
  output TEXT,             -- JSON stringified result
  FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
```

**Key Functions:**
- `listSaves(userId)` → `[{ id, title, tradition, denomination, topic, format, depth, language, created_at, updated_at }]`
- `getSave(userId, saveId)` → `{ id, ..., output }`
- `createSave(userId, payload)` → saved record
- `deleteSave(userId, saveId)` → void

### RLS Policies
- `research_saves`: User can only read/write their own saves (user_id = auth.uid())
- `research_usage`: No RLS (server-mediated via service role key)

---

## 4. APIs & Endpoints

### Server Routes (server.js)

| Method | Path | Handler | Returns |
|--------|------|---------|---------|
| GET | `/` | serveIndex() | index.html with OG meta tags |
| GET | `/research` | serveIndex() | research.html with OG meta tags |
| GET | `/upgrade` | serveIndex() | upgrade.html |
| GET | `/how-it-works` | serveIndex() | how-it-works.html |
| GET | `/health` | inline | 200 OK |
| POST | `/api/compare` | [research handler] | Compare JSON result |
| POST | `/api/research` | [research handler] | Research JSON result |
| POST | `/api/checkout` | createCheckout() | `{ url: stripe_checkout_url }` |
| POST | `/api/checkout/verify` | verifyCheckout() | `{ token: jwt_for_research }` |
| POST | `/api/webhook` | handleWebhook() | 200 OK |
| POST | `/api/plate` | createDonationCheckout() | `{ url: stripe_donation_checkout }` |
| POST | `/api/saves` | [list saves] | `[save_records]` |
| POST | `/api/saves/:id` | [get save] | `{ id, ..., output }` |
| DELETE | `/api/saves/:id` | [delete save] | 204 No Content |

### Compare Request (POST /api/compare)
```json
{
  "topic": "forgiveness",
  "traditions": ["Christianity", "Buddhism", "Judaism"],
  "language": "en"
}
```

**Response:**
```json
{
  "results": {
    "Christianity": {
      "passage": "Matthew 18:21-22",
      "interpretation": "...",
      "context": "..."
    },
    "Buddhism": { ... },
    "Judaism": { ... }
  },
  "commonGround": "...",
  "comparison": "..."
}
```

### Research Request (POST /api/research)
```json
{
  "mode": "verse",
  "depth": "study",
  "input": "John 3:16",
  "traditions": ["Christianity", "Islam"],
  "language": "en",
  "token": "eyJhbGc..."  // optional JWT from checkout/verify
}
```

**Response:**
```json
{
  "results": {
    "Christianity": { ... },
    "Islam": { ... }
  },
  "commonGround": "...",
  "sermonAngle": "..."
}
```

### Checkout Request (POST /api/checkout)
```json
{
  "annual": false,
  "seminary": false
}
```

**Response:**
```json
{
  "url": "https://checkout.stripe.com/pay/cs_live_..."
}
```

### Checkout Verify (POST /api/checkout/verify)
```json
{
  "sessionId": "cs_live_..."
}
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...."
}
```
- JWT contains: `customerId`, `subscriptionId`, `email`
- Expiry: 30 days
- Stored in localStorage, passed in Research requests

### Webhook (POST /api/webhook)
Basic handler (no signature verification yet).
```json
{
  "type": "customer.subscription.created|updated|deleted",
  "data": { "object": { ... } }
}
```

### OG Meta Injection (serveIndex)
```js
// Dynamically injects based on ?topic= query param:
meta property="og:title" content="Many Paths — [Topic]"
meta property="og:description" content="What do the world's religions teach about [topic]?"
meta property="og:image" content="https://manypaths.one/og-[topic-hash].png"
```

### External API Calls

| Service | Purpose | Rate Limit | Notes |
|---------|---------|-----------|-------|
| Anthropic Claude API | Compare & Research generation | Per Sonnet token budget | Session-level cache |
| ElevenLabs TTS | Listen button audio | Per API key | ELEVENLABS_API_KEY |
| Stripe API | Payment processing | Stripe rate limits | createCheckout → /v1/checkout/sessions |

---

## 5. Environment Variables

### Required for Production

| Variable | Format | Set In | Purpose | Criticality |
|----------|--------|--------|---------|------------|
| `ANTHROPIC_API_KEY` | `sk-proj-...` | Vercel | Claude API authentication | **CRITICAL** |
| `SUPABASE_URL` | `https://[project].supabase.co` | Vercel | Database URL | **CRITICAL** |
| `SUPABASE_SERVICE_ROLE_KEY` | 40-char hex | Vercel | Server-side DB access (bypasses RLS) | **CRITICAL** |
| `SUPABASE_ANON_KEY` | 40-char hex | Vercel (optional) | Client-side DB fallback | Optional |
| `STRIPE_SECRET_KEY` | `sk_live_...` | Vercel | Stripe API authentication | **CRITICAL** |
| `STRIPE_PRICE_ID_MONTHLY` | `price_...` | Vercel | Standard monthly plan ($9) | **CRITICAL** |
| `STRIPE_PRICE_ID_YEARLY` | `price_...` | Vercel | Standard annual plan ($79) | **CRITICAL** |
| `STRIPE_PRICE_ID_SEM_MONTHLY` | `price_...` | Vercel | Seminary monthly plan | Required if seminary tier enabled |
| `STRIPE_PRICE_ID_SEM_YEARLY` | `price_...` | Vercel | Seminary annual plan | Required if seminary tier enabled |
| `STRIPE_JWT_SECRET` | 32-byte hex (openssl rand -hex 32) | Vercel | JWT signing for Stripe tokens | **CRITICAL** |
| `STRIPE_WEBHOOK_SECRET` | `whsec_...` | Vercel | Stripe webhook signature verification | **CRITICAL** (if webhooks enabled) |
| `ELEVENLABS_API_KEY` | 32-char | Vercel | TTS for Listen button | Required if TTS enabled |
| `CLAUDE_MODEL` | `claude-sonnet-4-20250514` | Vercel (optional) | Override default Sonnet model | Optional |
| `CLAUDE_HAIKU_MODEL` | `claude-haiku-4-5-20251001` | Vercel (optional) | Override default Haiku model | Optional |

### Local Development (.env.local)
```bash
ANTHROPIC_API_KEY=sk-proj-...
SUPABASE_URL=https://cvniwzqfiauwvslxjjbm.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PRICE_ID_MONTHLY=price_...
STRIPE_PRICE_ID_YEARLY=price_...
STRIPE_PRICE_ID_SEM_MONTHLY=price_...
STRIPE_PRICE_ID_SEM_YEARLY=price_...
STRIPE_JWT_SECRET=...
STRIPE_WEBHOOK_SECRET=whsec_...
ELEVENLABS_API_KEY=...
PORT=3100
```

**Vercel Deployment Status (2026-04-12):**
- ✅ All 7 Stripe vars confirmed in `.env` locally
- ⏳ Vercel production deployment pending verification (OPIE to deploy via UI)
- ⏳ STRIPE_WEBHOOK_SECRET added to required vars (new for webhook signature verification)

### Deployment Status
**Last Updated:** 2026-04-07 (Stripe keys set locally, Vercel production status unverified per STATUS.md)

---

## 6. Core Features

### Compare Tab (Free, Always)
- **Topic Input:** User types topic or uses "Surprise me" button
- **Tradition Selection:** 8 traditions (checkboxes, persistent)
- **Language Selection:** 8 languages via dropdown
- **Claude Prompt:** tradition-context-aware, balanced, scrupulous
- **Result Format:** JSON with per-tradition passage, interpretation, context
- **Lectionary Widget:** This Sunday's Gospel (RCL-based, auto-hides if not Sunday)
- **History Pills:** Recent comparisons as clickable quick-access
- **Share Button:** Social share with OG image
- **TTS:** "Listen" button calls ElevenLabs for audio

### Research Tab (Paid)
- **Login:** Magic link via Supabase (status: pending confirmation per manny-boot.md)
- **Mode Selector:** verse, theme, sermon_brief, topical
- **Depth Selector:** quick, study, deep (varies by mode)
- **Tradition Selection:** Multi-select from 8 traditions
- **Free Tier:** 3 runs/month per fingerprint (tracked in research_usage)
- **Paywall Gate:** After 3 runs, Stripe checkout ($9/mo or $79/yr)
- **Token Validation:** JWT from checkout/verify passed to API
- **Result Caching:** Session-level cache prevents duplicate API calls
- **Cost Tracking:** costTracker.js logs API costs
- **Save/Load:** research_saves table (user-authenticated)

### Liturgical Calendar Integration
- **RCL Data:** lectionary.js (50+ Gospel readings, Year C 2025-2026 + Year A Advent 2026)
- **Widget:** Shows This Sunday's Gospel + Compare topic
- **One-Click Action:** "Compare this theme →" button populates Compare form
- **Example:** 2026-04-12 Easter → Luke 24:1-12 → "resurrection" topic pre-filled

### Text-to-Speech (Listen)
- **Service:** ElevenLabs API
- **Voice:** George (selected per manny-boot.md)
- **Trigger:** Listen button on Compare results
- **API Key:** ELEVENLABS_API_KEY (Vercel env var)

### Brand Video
- **Audio:** 7 traditions narration by George
- **Playback:** Header video player
- **Status:** DONE (manny-boot.md)

### Multi-Language
- **Supported:** en, es, ar, he, hi, fr, zh, ja
- **Implementation:** i18n.js (string translations)
- **UI:** Language picker in header

### Internationalization
- **HTML:** lang="en" dynamically set
- **API Responses:** language parameter propagated
- **Tradition Context:** Translated notes per language

---

## 7. What's Missing

### Blocking
- **Research API Debug** (STATUS.md): Generic error masks actual Vercel failure. Check Vercel logs for real error. Owner: Manny.
- **Stripe Env Vars Verification** (STATUS.md): Locally set 2026-04-07, production deployment status unverified. Owner: Opie.
- **Magic Link Auth Confirmation** (manny-boot.md): "Confirm with Sonny before building on top of it."

### Features Not Yet Implemented
- **User Authentication** (Compare tab): No auth gate; fingerprint-only usage tracking (free tier).
- **Subscription Management Dashboard:** Users cannot view/modify subscription status.
- **Export to PDF/Email:** No save-as-PDF or email-result functionality.
- **Conversation History:** No multi-turn dialogue mode.
- **Bookmarking:** No Supabase-backed bookmarks (only saves).
- **Comments/Annotations:** No user comment system on comparisons.
- **Offline Mode:** No service worker or offline fallback.

### Known Incomplete (as of 2026-04-12)
- **Admin Dashboard:** No analytics, usage charts, or subscription metrics.
- **Donation Tracking:** Donation checkout exists but no follow-up confirmation/receipt.

### Completed (2026-04-12)
- ✅ **Seminary Pricing Tier:** UI built in upgrade.html ($19/mo, $149/yr, 50 sessions/mo limit), checkout wired to STRIPE_PRICE_ID_SEM_*
- ✅ **Webhook Signature Verification:** Implemented stripe.webhooks.constructEvent() + signature validation in handleWebhook()

---

## 8. Known Issues & Fixes

### Critical (2026-04-12)
- **Research API Error Masking** ✅ **FIXED (2026-04-12):**
  - **Was:** Generic "Research unavailable, try again later" masked real Vercel errors
  - **Now:** Improved error logging with full error details (message, type, stack, timestamp) + specific user messages based on error type:
    - Claude API errors (503): "AI service error. Check API key and quota."
    - Timeout errors (504): "Request timeout. Try with fewer traditions or shorter input."
    - Invalid input (400): Returns specific input error
    - Other errors: Generic message with error type in response JSON
  - **Implementation:** server.js lines 356-377, research-engine.js input validation

### Production
- **Stripe Env Vars Unverified:** STRIPE_SECRET_KEY, STRIPE_PRICE_ID_MONTHLY/YEARLY, STRIPE_PRICE_ID_SEM_MONTHLY/YEARLY, STRIPE_JWT_SECRET, STRIPE_WEBHOOK_SECRET set locally in .env (confirmed 2026-04-12). **Pending:** Vercel production deployment verification by OPIE.
- **Magic Link Auth Pending:** Status unclear; do not build features on top until confirmed with Sonny.

### API & Security
- **Webhook Signature Verification** ✅ **FIXED (2026-04-12):**
  - **Was:** handleWebhook() accepted all POST /api/webhook events without Stripe signature check. Risk: spoofed events.
  - **Now:** Implements stripe.webhooks.constructEvent(rawBody, sig, secret) for full signature validation. Rejects events with missing/invalid signatures.
  - **Implementation:** stripe-handlers.js lines 145-211, requires STRIPE_WEBHOOK_SECRET env var

### Deployment
- **No Graceful Shutdown:** Server doesn't handle SIGTERM for cleanup (e.g., finish pending Stripe calls).
- **Rate Limiting:** Per-fingerprint cooldown (30s) may block legitimate users behind shared IP; no user notification.

### Seminary .edu Gate (2026-04-12)
- **Email Validation:** Seminary plan requires .edu email at checkout (validation in stripe-handlers.js line 37-44)
- **Automatic Discount:** SEMINARY coupon (44% off) applied automatically after .edu validation
- **Pricing:** $5/mo (44% off $9 Pro rate), $44/yr (44% off $79 annual)
- **Stripe Setup Required:** Manual coupon creation in Stripe Dashboard:
  - Code: `SEMINARY`
  - Discount: `44%` off
  - Duration: `Forever`
  - Unlimited redemptions

### User Experience
- **No Auth on Compare:** Free tier is fingerprint-only; no persistent user saves on Compare tab.
- **Paywall Timing Verified** ✅ **CORRECT (not an issue):**
  - Free tier usage check happens BEFORE Claude API call (atomicIncrementUsage at line 340-345, runResearch at line 353)
  - Users hitting free limit get 402 response immediately, no wasted token spend

---

## 9. External Services

| Service | Purpose | Status | Notes |
|---------|---------|--------|-------|
| **Anthropic Claude API** | Compare & Research generation | LIVE | Sonnet for Research, session cache, cost tracked |
| **Supabase** | Database (research_usage, research_saves) | LIVE | Project: cvniwzqfiauwvslxjjbm, service role key for server |
| **Stripe** | Payment processing (subscriptions + donations) | BUILT, UNVERIFIED | Env vars set locally, production deployment pending |
| **ElevenLabs TTS** | Listen button audio | LIVE | Voice: George, API key set in Vercel |
| **Vercel** | Hosting & serverless functions | LIVE | Project: bridgemaide, custom domain: manypaths.one |
| **DNS** | Domain routing | LIVE | www.manypaths.one → manypaths.one (301 redirect) |

---

## 10. Quick Reference

### Live URLs
| Resource | URL |
|----------|-----|
| Production | https://manypaths.one |
| Vercel Dashboard | https://vercel.com/getmaide/bridgemaide |
| Supabase Project | https://cvniwzqfiauwvslxjjbm.supabase.co |
| Repository | https://github.com/getmAIde/bridgemaide.git |

### Key Dashboards & Monitoring
| System | Dashboard | Credentials |
|--------|-----------|-------------|
| Stripe | https://dashboard.stripe.com/ | Stripe account (live mode) |
| Supabase | https://app.supabase.com/ (project: cvniwzqfiauwvslxjjbm) | Supabase credentials |
| Vercel Logs | https://vercel.com/getmaide/bridgemaide/deployments | Check function logs for Research API errors |
| Anthropic Usage | https://console.anthropic.com/ | API key dashboard (token usage) |
| ElevenLabs | https://elevenlabs.io/app/usage | Usage quota (TTS) |

### File Paths (Local)
```
~/atom/getmAIde/Projects/bridgemaide/
  server.js                 # Main server
  package.json              # Dependencies
  vercel.json               # Deployment config
  .env.local                # Local secrets (git-ignored)
```

### Models Used
```js
// models.js — single source of truth
export const MODELS = {
  sonnet: 'claude-sonnet-4-20250514',      // Research + Compare
  haiku:  'claude-haiku-4-5-20251001',     // Optional fallback
};
```

### Critical Env Vars to Verify
```bash
# After OPIE deployment, verify in Vercel UI:
echo $STRIPE_SECRET_KEY          # Should not be empty
echo $STRIPE_PRICE_ID_MONTHLY    # Should be price_...
echo $STRIPE_PRICE_ID_YEARLY     # Should be price_...
echo $STRIPE_JWT_SECRET          # Should be 32-byte hex
```

---

## Summary

**ManyPaths** is a free interfaith comparison tool (Compare tab) with a paid research tier (Research tab, $9/mo/$79/yr, 3 free runs/month). It uses Claude Sonnet for generation, Supabase for usage tracking & saves, Stripe for payments, and Vercel for hosting.

**Blocking Issues:** Research API debug (generic error masking real failure), Stripe env var production verification, magic link auth confirmation.

**Next Steps:**
1. Verify Stripe env vars deployed to Vercel (OPIE)
2. Debug Research API error masking in Vercel logs (Manny)
3. Confirm magic link auth readiness with Sonny (Manny)
4. Implement Stripe webhook signature verification (Sonny/Manny)
5. Monitor deployment for payment flow success
