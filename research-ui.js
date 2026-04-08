// research-ui.js
// Browser-side logic for research.html.
// Calls POST /api/run-research → server.js → research-engine.js
// Do NOT import this in Node — browser only.

(function () {
  'use strict';

  // ─── Tradition data ────────────────────────────────────────────────────────

  const TRADITIONS = [
    { key: 'Christianity',       sym: '✝', color: '#7F77DD', hasDenoms: true  },
    { key: 'Judaism',            sym: '✡', color: '#1D9E75', hasDenoms: true  },
    { key: 'Islam',              sym: '☪', color: '#378ADD', hasDenoms: true  },
    { key: 'Buddhism',           sym: '☸', color: '#EF9F27', hasDenoms: true  },
    { key: 'Hinduism',           sym: 'ॐ', color: '#D85A30', hasDenoms: false },
    { key: 'Taoism',             sym: '☯', color: '#5DCAA5', hasDenoms: false },
    { key: 'Sikhism',            sym: '☬', color: '#D4537E', hasDenoms: false },
    { key: 'Latter-day Saints',  sym: '✦', color: '#1B3A6B', hasDenoms: false },
  ];

  const TRADITION_COLORS = Object.fromEntries(TRADITIONS.map(t => [t.key, t.color]));

  const DENOMINATION_GROUPS = {
    Christianity: [
      { value: 'Christianity',     label: 'All' },
      { value: 'Roman Catholic',   label: 'Catholic' },
      { value: 'Eastern Orthodox', label: 'Orthodox' },
      { value: 'Baptist',          label: 'Baptist' },
      { value: 'Methodist',        label: 'Methodist' },
      { value: 'Lutheran',         label: 'Lutheran' },
      { value: 'Pentecostal',      label: 'Pentecostal' },
    ],
    Judaism: [
      { value: 'Judaism',               label: 'All' },
      { value: 'Orthodox Judaism',      label: 'Orthodox' },
      { value: 'Conservative Judaism',  label: 'Conservative' },
      { value: 'Reform Judaism',        label: 'Reform' },
    ],
    Islam: [
      { value: 'Islam',       label: 'All' },
      { value: 'Sunni Islam', label: 'Sunni' },
      { value: 'Shia Islam',  label: 'Shia' },
      { value: 'Sufi Islam',  label: 'Sufi' },
    ],
    Buddhism: [
      { value: 'Buddhism',            label: 'All' },
      { value: 'Theravada Buddhism',  label: 'Theravada' },
      { value: 'Zen Buddhism',        label: 'Zen' },
      { value: 'Tibetan Buddhism',    label: 'Tibetan' },
    ],
  };

  // ─── Format map ───────────────────────────────────────────────────────────

  const FORMAT_MAP = {
    quick: {
      mode: 'topic', depth: 'quick',
      icon: '⚡', name: 'Quick Answer', desc: 'One-sentence answer per tradition',
      placeholder: 'Enter a topic, verse, or theme — e.g. forgiveness',
    },
    scripture_study: {
      mode: 'verse', depth: 'study',
      icon: '📖', name: 'Scripture Study', desc: 'Deep interpretation + historical context',
      placeholder: 'Enter a verse — e.g. John 3:16, Psalm 23, Surah Al-Fatiha',
    },
    devotional: {
      mode: 'topic', depth: 'devotional',
      icon: '🕯️', name: 'Devotional', desc: 'Personal reflection for morning devotions',
      placeholder: 'Enter a theme — e.g. rest, trust, the dark night of the soul',
    },
    preaching_outline: {
      mode: 'topic', depth: 'preaching_outline',
      icon: '🗒️', name: 'Preaching Outline', desc: 'I / II / III structure with a unifying angle',
      placeholder: 'Enter a text or theme — e.g. redemption through suffering',
    },
    manuscript: {
      mode: 'topic', depth: 'manuscript',
      icon: '✍️', name: 'Sermon Manuscript', desc: 'Full sermon — intro, body, application, close',
      placeholder: 'Enter a theme or text for your sermon',
    },
    childrens_lesson: {
      mode: 'topic', depth: 'childrens_lesson',
      icon: '🌱', name: "Children's Lesson", desc: 'Story-based lesson for ages 8–12',
      placeholder: "Enter a theme — e.g. kindness, forgiveness, caring for others",
    },
    funeral_homily: {
      mode: 'topic', depth: 'funeral_homily',
      icon: '🕊️', name: 'Funeral Homily', desc: 'Pastoral words for grief and loss',
      placeholder: 'Enter a text or theme for the service',
    },
    wedding_homily: {
      mode: 'topic', depth: 'wedding_homily',
      icon: '💛', name: 'Wedding Homily', desc: 'Words for covenant and celebration',
      placeholder: 'Enter a text or theme for the wedding',
    },
    small_group: {
      mode: 'topic', depth: 'small_group',
      icon: '👥', name: 'Small Group Guide', desc: 'Discussion questions for community study',
      placeholder: 'Enter a topic or passage for your group',
    },
    personal_reflection: {
      mode: 'topic', depth: 'personal_reflection',
      icon: '✦', name: 'Personal Reflection', desc: 'Quiet prompts for prayer and contemplation',
      placeholder: 'Enter a theme — e.g. exile, threshold, return',
    },
  };

  // ─── Suggestion chips by format ────────────────────────────────────────────

  const SUGGESTIONS = {
    quick: [
      'forgiveness', 'prayer', 'suffering', 'silence', 'justice', 'mercy', 'hope',
    ],
    scripture_study: [
      'Psalm 88', 'Matthew 25:31–46', 'Isaiah 58:6–7', 'Romans 8:38–39',
      'Surah Al-Inshirah 94', 'Tao Te Ching 16', 'Dhammapada 1–2',
    ],
    devotional: [
      'the dark night of the soul', 'when God seems absent', 'gratitude', 'rest', 'trust',
    ],
    preaching_outline: [
      'redemption through suffering', 'doubt as devotion', 'justice and mercy',
      'the stranger at the gate', 'when faith feels like absence',
    ],
    manuscript: [
      'redemption', 'the body as sacred',
      'what to do when the tradition feels insufficient', 'the God who suffers with us',
    ],
    childrens_lesson: [
      'kindness', 'forgiveness', 'prayer', 'gratitude', 'caring for others',
    ],
    funeral_homily: [
      'resurrection and hope', 'the valley of the shadow', 'love that endures', 'grief and grace',
    ],
    wedding_homily: [
      'covenant', 'love is patient', 'two becoming one', 'building a life together',
    ],
    small_group: [
      'suffering and meaning', 'money and faith', 'how we treat strangers', 'doubt and belief',
    ],
    personal_reflection: [
      'exile', 'threshold', 'wilderness', 'shadow', 'return', 'hunger',
    ],
  };

  // ─── Research history ──────────────────────────────────────────────────────

  const RESEARCH_HISTORY_KEY = 'mp_research_history';
  const RESEARCH_HISTORY_MAX = 10;

  function researchHistoryGet() {
    try { return JSON.parse(localStorage.getItem(RESEARCH_HISTORY_KEY) || '[]'); }
    catch { return []; }
  }

  function researchHistorySave(format, tradition, denom, query) {
    try {
      const entry = { format, tradition: denom || tradition || null, query, ts: Date.now() };
      const hist  = researchHistoryGet().filter(h =>
        !(h.format === entry.format &&
          h.tradition === entry.tradition &&
          h.query.toLowerCase() === entry.query.toLowerCase())
      );
      hist.unshift(entry);
      localStorage.setItem(RESEARCH_HISTORY_KEY, JSON.stringify(hist.slice(0, RESEARCH_HISTORY_MAX)));
      researchHistoryRender();
    } catch { /* storage full */ }
  }

  function researchHistoryRender() {
    const hist = researchHistoryGet();
    let wrap = document.getElementById('researchHistoryWrap');
    if (!hist.length) { if (wrap) wrap.remove(); return; }

    if (!wrap) {
      wrap = document.createElement('div');
      wrap.id = 'researchHistoryWrap';
      // Insert above the action row
      const actionRow = document.querySelector('.action-row');
      if (actionRow) actionRow.insertAdjacentElement('beforebegin', wrap);
    }

    // Build with DOM — no inline handlers
    wrap.innerHTML = '';
    const eyebrow = document.createElement('div');
    eyebrow.className = 'history-eyebrow';
    eyebrow.textContent = 'Recent';
    wrap.appendChild(eyebrow);

    const row = document.createElement('div');
    row.className = 'history-row';
    wrap.appendChild(row);

    hist.forEach((h, i) => {
      const icon     = FORMAT_MAP[h.format]?.icon || '✦';
      const tradLabel = h.tradition ? ` · ${h.tradition.replace(/ (Islam|Judaism|Buddhism|Christianity)$/, '')}` : '';
      const btn = document.createElement('button');
      btn.className = 'history-pill';
      btn.dataset.historyIndex = i;
      btn.title = `${h.format}${tradLabel}: ${h.query}`;
      btn.textContent = `${icon}${tradLabel} ${h.query}`;
      row.appendChild(btn);
    });

    // Wire clicks after innerHTML
    wrap.querySelectorAll('.history-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        const i = parseInt(btn.dataset.historyIndex, 10);
        const h = researchHistoryGet()[i];
        if (!h) return;
        selectFormat(h.format);
        if (h.tradition) {
          // find parent tradition key if a denomination was saved
          const parentKey = TRADITIONS.find(t => t.key === h.tradition)?.key
            || Object.keys(DENOMINATION_GROUPS).find(k =>
                DENOMINATION_GROUPS[k].some(d => d.value === h.tradition));
          selectTradition(parentKey || h.tradition);
          // if it was a denomination, click that denom pill
          if (parentKey && parentKey !== h.tradition) {
            const denomPill = document.querySelector(`#denomSubpicker [data-value="${CSS.escape(h.tradition)}"]`);
            if (denomPill) selectDenom(denomPill, h.tradition);
          }
        }
        if (inputEl) inputEl.value = h.query;
        renderChips(h.format);
      });
    });
  }

  // ─── "New" badge ───────────────────────────────────────────────────────────

  const TRADITION_ADDED = { 'Latter-day Saints': '2026-03-24' };
  function isNewTradition(name) {
    const added = TRADITION_ADDED[name];
    if (!added) return false;
    return (Date.now() - new Date(added).getTime()) < 30 * 24 * 60 * 60 * 1000;
  }

  // ─── Free tier limits (server-enforced, 3/month across all Research) ────────

  const FREE_LIMIT = 3;
  let _usageCache = null; // { plan, remaining, count } — fetched once on load

  async function fetchUsage() {
    try {
      const headers = { 'Content-Type': 'application/json' };
      const token = getStoredToken();
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const fp = await getFingerprint();
      headers['x-fingerprint'] = fp;
      const res = await fetch('/api/usage', { headers });
      if (res.ok) _usageCache = await res.json();
    } catch (e) {
      console.warn('[mp] usage fetch failed:', e.message);
    }
  }

  async function getFingerprint() {
    // Simple stable fingerprint from browser signals
    const raw = [navigator.userAgent, navigator.language, screen.width, screen.height, Intl.DateTimeFormat().resolvedOptions().timeZone].join('|');
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(raw));
    return Array.from(new Uint8Array(buf)).slice(0, 8).map(b => b.toString(16).padStart(2,'0')).join('');
  }

  const PAYWALL_DISMISS_KEY = 'mp_paywall_dismissed';

  // ─── Subscription token (Stripe) ──────────────────────────────────────────

  const SESSION_KEY = 'mp_session_token';

  function getStoredToken() {
    return localStorage.getItem(SESSION_KEY) || '';
  }

  function storeToken(token) {
    localStorage.setItem(SESSION_KEY, token);
  }

  // Check for ?session_id= in URL (Stripe success redirect) and verify it
  async function handleStripeReturn() {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');
    if (!sessionId) return;

    // Clean URL immediately
    params.delete('session_id');
    const newSearch = params.toString();
    window.history.replaceState({}, '', '/research' + (newSearch ? '?' + newSearch : ''));

    try {
      const res = await fetch('/api/checkout/verify', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ sessionId }),
      });
      if (res.ok) {
        const { token } = await res.json();
        if (token) {
          storeToken(token);
          // Brief confirmation
          const notice = document.createElement('div');
          notice.style.cssText = 'position:fixed;top:1rem;right:1rem;background:#1a1a18;color:#f5c842;padding:0.75rem 1.2rem;border-radius:6px;font-size:0.85rem;z-index:9999;';
          notice.textContent = 'Research Pro unlocked.';
          document.body.appendChild(notice);
          setTimeout(() => notice.remove(), 3000);
        }
      }
    } catch (e) {
      console.warn('[mp] stripe return verification failed:', e.message);
    }
  }

  // Kick off token check on load (non-blocking)
  handleStripeReturn();
  // Fetch usage from server (non-blocking — updates indicator + My Saves button when ready)
  fetchUsage().then(() => {
    updateUsageIndicator();
    if (_usageCache?.plan === 'paid') injectMySavesBtn();
  });

  function limitConfig() { return { max: FREE_LIMIT, noun: "Research sessions" }; }
  function isOverLimit() { return false; } // server returns 402 when limit hit

  function isPaywallDismissed() { return !!sessionStorage.getItem(PAYWALL_DISMISS_KEY); }

  // ─── State ────────────────────────────────────────────────────────────────

  let currentTradition = null;   // null = all traditions
  let currentDenom     = null;   // specific denomination value, or null
  let currentFormat    = 'quick';
  let _shareURL        = '';

  // ─── DOM refs ─────────────────────────────────────────────────────────────

  let inputEl, chipWrap, runBtn, inspireBtn, resultsSection, usageIndicatorEl;

  // ─── Injected styles ──────────────────────────────────────────────────────

  function injectStyles() {
    const s = document.createElement('style');
    s.textContent = `
      /* Loading */
      .research-loading {
        text-align: center; padding: 3rem 1rem;
      }
      .research-loading .spinner {
        display: inline-block; width: 36px; height: 36px;
        border: 3px solid var(--border); border-top-color: var(--accent2);
        border-radius: 50%; animation: r-spin 0.75s linear infinite; margin-bottom: 1rem;
      }
      @keyframes r-spin { to { transform: rotate(360deg); } }
      .research-loading p {
        font-size: 0.78rem; letter-spacing: 2.5px; text-transform: uppercase;
        color: var(--text-muted); animation: faith-text-pulse 2s ease-in-out infinite;
      }

      /* Results wrapper */
      .research-results { margin-top: 0.5rem; }

      /* Tradition card */
      .research-card {
        background: var(--surface); border: 1px solid var(--border);
        border-top: 3px solid var(--accent2); border-radius: var(--radius);
        margin-bottom: 0.85rem; overflow: hidden;
        animation: fadeIn 0.35s ease; box-shadow: 0 2px 10px rgba(150,90,0,0.06);
      }
      .research-card-header {
        display: flex; align-items: center; justify-content: space-between;
        gap: 0.75rem; padding: 0.9rem 1.2rem;
        cursor: pointer; user-select: none; transition: background 0.15s;
      }
      .research-card-header:hover { background: rgba(200,144,14,0.04); }
      .research-card-title {
        display: flex; align-items: center; gap: 0.55rem;
        font-family: 'Cinzel', serif; font-size: 0.9rem; font-weight: 600;
        letter-spacing: 0.8px; color: var(--accent);
      }
      .trad-dot { width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0; }
      .card-actions { display: flex; align-items: center; gap: 0.5rem; flex-shrink: 0; }
      .card-copy-btn {
        font-family: 'Josefin Sans', sans-serif; font-size: 0.64rem; font-weight: 600;
        letter-spacing: 1px; text-transform: uppercase; color: var(--text-muted);
        background: none; border: 1px solid var(--border); border-radius: 4px;
        padding: 0.22rem 0.55rem; cursor: pointer; transition: color 0.15s, border-color 0.15s;
      }
      .card-copy-btn:hover { color: var(--accent); border-color: var(--accent2); }

      .card-listen-btn {
        font-family: 'Josefin Sans', sans-serif; font-size: 0.64rem; font-weight: 600;
        letter-spacing: 1px; text-transform: uppercase; color: var(--text-muted);
        background: none; border: 1px solid var(--border); border-radius: 4px;
        padding: 0.22rem 0.55rem; cursor: pointer; transition: color 0.15s, border-color 0.15s;
      }
      .card-listen-btn:hover { color: var(--accent); border-color: var(--accent2); }
      .card-listen-btn:has(◼) { color: var(--accent); border-color: var(--accent2); }
      .card-chevron {
        color: var(--text-muted); font-size: 0.8rem; transition: transform 0.2s; line-height: 1;
      }
      .research-card.collapsed .card-chevron { transform: rotate(-90deg); }
      .research-card-body { padding: 0 1.2rem 1.2rem; border-top: 1px solid var(--border); }
      .research-card.collapsed .research-card-body { display: none; }

      .research-blockquote {
        margin: 1rem 0 0.75rem; padding: 0.75rem 1rem;
        background: var(--surface2); border-left: 3px solid var(--accent2);
        border-radius: 0 6px 6px 0; font-family: 'EB Garamond', Georgia, serif;
        font-style: italic; font-size: 0.95rem; color: var(--text); line-height: 1.7;
      }
      .research-field-label {
        font-size: 0.7rem; font-weight: 700; text-transform: uppercase;
        letter-spacing: 1.2px; color: var(--text-muted); margin: 0.9rem 0 0.3rem;
      }
      .research-field-text { font-size: 0.93rem; line-height: 1.75; color: var(--text); }

      /* Sermon angle / manuscript angle callout */
      .sermon-angle-block {
        background: linear-gradient(135deg, rgba(212,160,34,0.13) 0%, rgba(200,144,14,0.07) 100%);
        border: 1px solid rgba(200,144,14,0.4); border-left: 4px solid var(--gold);
        border-radius: var(--radius); padding: 1.4rem 1.6rem;
        margin-bottom: 1rem; animation: fadeIn 0.4s ease;
      }
      .sermon-angle-label {
        font-family: 'Josefin Sans', sans-serif; font-size: 0.7rem; font-weight: 600;
        letter-spacing: 2px; text-transform: uppercase; color: var(--gold); margin-bottom: 0.5rem;
      }
      .sermon-angle-text {
        font-family: 'EB Garamond', Georgia, serif; font-size: 1rem;
        line-height: 1.8; color: var(--text); font-style: italic;
      }

      /* Export button */
      .export-btn {
        display: inline-flex; align-items: center; gap: 0.4rem;
        font-family: 'Josefin Sans', sans-serif; font-size: 0.7rem; font-weight: 600;
        letter-spacing: 1.5px; text-transform: uppercase; color: var(--text-muted);
        background: none; border: 1px solid var(--border); border-radius: 20px;
        padding: 0.4rem 0.95rem; cursor: pointer; margin-top: 0.25rem;
        transition: color 0.15s, border-color 0.15s;
      }
      .export-btn:hover { color: var(--accent); border-color: var(--accent2); }

      /* Error */
      .research-error {
        color: #b03030; background: rgba(180,40,40,0.07); border: 1px solid rgba(180,40,40,0.2);
        border-radius: var(--radius); padding: 1.25rem 1.5rem; font-size: 0.9rem;
        text-align: center; animation: fadeIn 0.3s ease;
      }

      /* Usage indicator */
      .usage-indicator {
        font-size: 0.75rem; color: var(--text-muted); margin-top: 0.5rem;
        min-height: 1.1rem; letter-spacing: 0.2px; animation: fadeIn 0.2s ease;
      }
      .usage-indicator.near-limit { color: #b07020; }
      .usage-indicator.at-limit   { color: #a03020; font-weight: 600; }

      /* Paywall banner */
      .paywall-banner {
        background: linear-gradient(135deg, rgba(160,60,20,0.07) 0%, rgba(180,80,10,0.05) 100%);
        border: 1px solid rgba(180,80,20,0.3); border-left: 4px solid #c05820;
        border-radius: var(--radius); padding: 1.25rem 1.4rem;
        margin-bottom: 1.25rem; animation: fadeIn 0.35s ease;
      }
      .paywall-msg { font-size: 0.95rem; color: var(--text); line-height: 1.6; margin-bottom: 0.9rem; }
      .paywall-msg strong { color: #b05010; }
      .paywall-actions {
        display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap; margin-bottom: 0.75rem;
      }
      .paywall-cta {
        font-family: 'Josefin Sans', sans-serif; font-size: 0.78rem; font-weight: 600;
        letter-spacing: 1px; text-transform: uppercase; color: #fffbf0;
        background: linear-gradient(135deg, #a06c10, #d4a022, #c08010);
        border: none; border-radius: 6px; padding: 0.55rem 1rem; text-decoration: none;
        cursor: pointer; transition: filter 0.15s; box-shadow: 0 2px 8px rgba(160,100,0,0.2);
      }
      .paywall-cta:hover { filter: brightness(1.08); }
      .paywall-dismiss {
        font-family: 'EB Garamond', Georgia, serif; font-size: 0.9rem; font-style: italic;
        color: var(--text-muted); background: none; border: none; cursor: pointer;
        padding: 0.3rem 0; transition: color 0.15s;
      }
      .paywall-dismiss:hover { color: var(--text); }
      .sermon-pack-nudge {
        font-size: 0.82rem; color: var(--text); padding-top: 0.6rem;
        border-top: 1px solid rgba(180,80,20,0.15); line-height: 1.5;
      }
      .sermon-pack-nudge a { color: var(--accent); text-decoration: none; font-weight: 600; }
      .sermon-pack-nudge a:hover { text-decoration: underline; }

      /* History */
      .history-eyebrow {
        font-size: 0.65rem; font-weight: 700; letter-spacing: 1.5px;
        text-transform: uppercase; color: var(--text-muted);
        margin-bottom: 0.45rem; font-family: 'Josefin Sans', sans-serif;
      }
      .history-row {
        display: flex; flex-wrap: wrap; gap: 0.35rem; margin-bottom: 1.25rem;
      }
      .history-pill {
        font-family: 'Josefin Sans', sans-serif; font-size: 0.68rem; font-weight: 600;
        letter-spacing: 0.3px; background: var(--surface2); border: 1px solid var(--border);
        border-radius: 20px; padding: 0.25rem 0.75rem; cursor: pointer;
        color: var(--text-muted); transition: border-color 0.15s, color 0.15s;
        white-space: nowrap; max-width: 220px; overflow: hidden; text-overflow: ellipsis;
      }
      .history-pill:hover { border-color: var(--accent2); color: var(--accent); }

      /* New badge */
      .new-badge {
        display: inline-block; position: relative; top: -5px;
        font-family: 'Josefin Sans', sans-serif; font-size: 10px; font-weight: 600;
        letter-spacing: 0.4px; color: #c8900e; background: transparent;
        border: 1px solid #c8900e; border-radius: 3px; padding: 1px 4px;
        line-height: 1.3; white-space: nowrap;
      }

      /* Saves panel */
      .saves-panel {
        margin-bottom: 1.5rem; animation: fadeIn 0.3s ease;
      }
      .saves-panel-header {
        display: flex; align-items: center; justify-content: space-between;
        margin-bottom: 0.75rem;
      }
      .saves-panel-title {
        font-family: 'Josefin Sans', sans-serif; font-size: 0.7rem; font-weight: 700;
        letter-spacing: 1.5px; text-transform: uppercase; color: var(--text-muted);
      }
      .saves-panel-close {
        font-family: 'EB Garamond', Georgia, serif; font-size: 0.85rem; font-style: italic;
        color: var(--text-muted); background: none; border: none; cursor: pointer;
        padding: 0.2rem 0.4rem; transition: color 0.15s;
      }
      .saves-panel-close:hover { color: var(--text); }
      .saves-list { display: flex; flex-direction: column; gap: 0.6rem; }
      .save-card {
        background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
        padding: 0.85rem 1rem; display: flex; align-items: flex-start;
        justify-content: space-between; gap: 0.75rem; animation: fadeIn 0.25s ease;
      }
      .save-card-info { flex: 1; min-width: 0; }
      .save-card-title {
        font-family: 'Cinzel', serif; font-size: 0.82rem; font-weight: 600;
        color: var(--accent); white-space: nowrap; overflow: hidden;
        text-overflow: ellipsis; margin-bottom: 0.25rem;
      }
      .save-card-meta {
        font-family: 'Josefin Sans', sans-serif; font-size: 0.63rem; font-weight: 600;
        letter-spacing: 0.3px; text-transform: uppercase; color: var(--text-muted);
      }
      .save-card-actions { display: flex; gap: 0.4rem; flex-shrink: 0; align-items: center; }
      .save-load-btn, .save-delete-btn {
        font-family: 'Josefin Sans', sans-serif; font-size: 0.63rem; font-weight: 600;
        letter-spacing: 0.8px; text-transform: uppercase; background: none;
        border: 1px solid var(--border); border-radius: 4px;
        padding: 0.22rem 0.55rem; cursor: pointer; transition: color 0.15s, border-color 0.15s;
        color: var(--text-muted);
      }
      .save-load-btn:hover { color: var(--accent); border-color: var(--accent2); }
      .save-delete-btn:hover { color: #a03020; border-color: rgba(160,48,32,0.4); }
      .saves-empty {
        text-align: center; padding: 1.5rem; color: var(--text-muted);
        font-family: 'EB Garamond', Georgia, serif; font-style: italic; font-size: 0.95rem;
      }
      .saves-panel-divider { height: 1px; background: var(--border); margin: 1.25rem 0; }
      .save-result-btn {
        font-family: 'Josefin Sans', sans-serif; font-size: 0.68rem; font-weight: 600;
        letter-spacing: 1px; text-transform: uppercase; color: var(--accent);
        background: none; border: 1px solid var(--accent2); border-radius: 20px;
        padding: 0.32rem 0.85rem; cursor: pointer;
        transition: background 0.15s, color 0.15s;
        margin-top: 0.35rem;
      }
      .save-result-btn:hover { background: rgba(200,144,14,0.1); }
      .save-result-btn:disabled { opacity: 0.45; cursor: not-allowed; }
      .my-saves-btn {
        font-family: 'Josefin Sans', sans-serif; font-size: 0.68rem; font-weight: 600;
        letter-spacing: 0.8px; text-transform: uppercase; color: var(--text-muted);
        background: none; border: 1px solid var(--border); border-radius: 20px;
        padding: 0.28rem 0.75rem; cursor: pointer;
        transition: color 0.15s, border-color 0.15s;
      }
      .my-saves-btn:hover { color: var(--accent); border-color: var(--accent2); }

      /* Voice picker */
      .voice-picker {
        display: flex; align-items: center; gap: 0.5rem;
        margin-bottom: 1.25rem;
      }
      .voice-picker-label {
        font-family: 'Josefin Sans', sans-serif; font-size: 0.65rem; font-weight: 700;
        letter-spacing: 1.5px; text-transform: uppercase; color: var(--text-muted);
      }
      .voice-btn {
        font-family: 'Josefin Sans', sans-serif; font-size: 0.68rem; font-weight: 600;
        letter-spacing: 0.5px; text-transform: uppercase;
        background: var(--surface2); border: 1px solid var(--border); border-radius: 20px;
        padding: 0.28rem 0.8rem; cursor: pointer; color: var(--text-muted);
        transition: border-color 0.15s, color 0.15s, background 0.15s;
      }
      .voice-btn:hover { border-color: var(--accent2); color: var(--accent); }
      .voice-btn.active {
        border-color: var(--accent2); color: var(--accent);
        background: rgba(200,144,14,0.1);
      }
    `;
    document.head.appendChild(s);
  }

  // ─── Build tradition pills ─────────────────────────────────────────────────

  function buildTradPills() {
    const wrap = document.getElementById('tradPills');
    if (!wrap) return;

    // "All" pill
    const allBtn = document.createElement('button');
    allBtn.type = 'button';
    allBtn.className = 'trad-pill active';
    allBtn.dataset.tradition = '';
    allBtn.textContent = 'All traditions';
    allBtn.addEventListener('click', () => selectTradition(null));
    wrap.appendChild(allBtn);

    TRADITIONS.forEach(t => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'trad-pill';
      btn.dataset.tradition = t.key;
      btn.style.setProperty('--trad-color', t.color);
      btn.innerHTML = `<span class="trad-sym" style="color:${t.color}">${t.sym}</span>${escHtml(t.key)}`;
      if (isNewTradition(t.key)) {
        const badge = document.createElement('span');
        badge.className = 'new-badge';
        badge.textContent = 'new';
        btn.appendChild(badge);
      }
      btn.addEventListener('click', () => selectTradition(t.key));
      wrap.appendChild(btn);
    });
  }

  function selectTradition(key) {
    currentTradition = key || null;
    currentDenom     = null;

    // Update active pill
    document.querySelectorAll('#tradPills .trad-pill').forEach(p => {
      p.classList.toggle('active', p.dataset.tradition === (key || ''));
    });

    // Show/hide denomination sub-picker
    const subpicker = document.getElementById('denomSubpicker');
    if (!subpicker) return;

    const denoms = key ? DENOMINATION_GROUPS[key] : null;
    if (denoms) {
      subpicker.innerHTML = '';
      denoms.forEach((d, i) => {
        const pill = document.createElement('button');
        pill.type = 'button';
        pill.className = 'denom-pill' + (i === 0 ? ' active' : '');
        pill.dataset.value = d.value;
        pill.textContent = d.label;
        pill.addEventListener('click', () => selectDenom(pill, d.value));
        subpicker.appendChild(pill);
      });
      subpicker.classList.remove('hidden');
    } else {
      subpicker.innerHTML = '';
      subpicker.classList.add('hidden');
    }
  }

  function selectDenom(pill, value) {
    currentDenom = value === currentTradition ? null : value;
    document.querySelectorAll('#denomSubpicker .denom-pill').forEach(p => {
      p.classList.toggle('active', p === pill);
    });
    // If "All" selected, clear denom
    if (value === currentTradition) currentDenom = null;
  }

  // ─── Build format grid ────────────────────────────────────────────────────

  function buildFormatGrid() {
    const grid = document.getElementById('formatGrid');
    if (!grid) return;

    Object.entries(FORMAT_MAP).forEach(([key, fmt]) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'format-card' + (key === currentFormat ? ' active' : '');
      card.dataset.format = key;
      card.innerHTML = `
        <span class="format-icon">${fmt.icon}</span>
        <span class="format-name">${escHtml(fmt.name)}</span>
        <span class="format-desc">${escHtml(fmt.desc)}</span>`;
      card.addEventListener('click', () => selectFormat(key));
      grid.appendChild(card);
    });
  }

  function selectFormat(key) {
    if (!FORMAT_MAP[key]) return;
    currentFormat = key;

    document.querySelectorAll('#formatGrid .format-card').forEach(c => {
      c.classList.toggle('active', c.dataset.format === key);
    });

    // Update placeholder
    if (inputEl) inputEl.placeholder = FORMAT_MAP[key].placeholder;

    renderChips(key);
    updateUsageIndicator();
  }

  // ─── Suggestion chips ──────────────────────────────────────────────────────

  function renderChips(format) {
    if (!chipWrap) return;
    chipWrap.innerHTML = '';
    (SUGGESTIONS[format] || []).forEach(s => {
      const btn = document.createElement('button');
      btn.className = 'chip';
      btn.textContent = s;
      btn.addEventListener('click', () => { inputEl.value = s; inputEl.focus(); });
      chipWrap.appendChild(btn);
    });
  }

  // ─── Tradition helpers ─────────────────────────────────────────────────────

  function getSelectedTraditions() {
    const other = document.getElementById('otherTradition')?.value.trim();

    if (!currentTradition) {
      // All traditions
      const list = TRADITIONS.map(t => t.key);
      return other ? [...list, other] : list;
    }

    // Single tradition — use denomination if selected
    const effective = currentDenom || currentTradition;
    return other ? [effective, other] : [effective];
  }

  // ─── Usage indicator ───────────────────────────────────────────────────────

  function updateUsageIndicator() {
    if (!usageIndicatorEl) return;
    if (!_usageCache) { usageIndicatorEl.textContent = ''; return; }

    if (_usageCache.plan === 'paid') {
      usageIndicatorEl.textContent = '';
      usageIndicatorEl.className = 'usage-indicator';
      return;
    }

    const used  = _usageCache.count ?? (FREE_LIMIT - (_usageCache.remaining ?? FREE_LIMIT));
    const remaining = _usageCache.remaining ?? FREE_LIMIT;
    usageIndicatorEl.className = 'usage-indicator' +
      (remaining <= 0 ? ' at-limit' : remaining === 1 ? ' near-limit' : '');

    usageIndicatorEl.textContent = remaining <= 0
      ? `All ${FREE_LIMIT} free Research sessions used this month.`
      : `${used} of ${FREE_LIMIT} free Research sessions used this month`;
  }

  // ─── Paywall banner ────────────────────────────────────────────────────────

  function showPaywallBanner(mode, depth) {
    document.getElementById('researchPaywall')?.remove();
    const cfg      = limitConfig(mode, depth);
    const isSermon = mode === 'sermon_brief' || depth === 'sermon_brief' || depth === 'manuscript';

    const banner = document.createElement('div');
    banner.className = 'paywall-banner';
    banner.id = 'researchPaywall';
    banner.innerHTML = `
      <p class="paywall-msg">
        You've used your <strong>${cfg.max} free ${cfg.noun}</strong>.<br>
        Try Pro free for 7 days — no card required.
      </p>
      <div class="paywall-actions">
        <a class="paywall-cta" href="mailto:pro@manypaths.one?subject=Pro trial - Many Paths">
          Start free trial →
        </a>
        <button class="paywall-dismiss" type="button">Maybe later</button>
      </div>
      ${isSermon ? `
        <p class="sermon-pack-nudge">
          Not ready to commit?
          <a href="mailto:sermonpack@manypaths.one?subject=Sermon pack">5 sermon credits for $12</a>
          — never expire.
        </p>` : ''}`;

    banner.querySelector('.paywall-dismiss').addEventListener('click', () => {
      sessionStorage.setItem(PAYWALL_DISMISS_KEY, '1');
      banner.remove();
      runBtn.disabled = false;
      resultsSection.innerHTML = '';
    });

    resultsSection.innerHTML = '';
    resultsSection.appendChild(banner);
    runBtn.disabled = true;
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // ─── Stripe paywall (server-enforced) ────────────────────────────────────
  // Shown when the server returns 402 (paywall enabled) or 401 (token expired).

  function showStripePaywall(mode, depth, isExpired = false) {
    document.getElementById('researchStripePaywall')?.remove();

    const isSermon = mode === 'sermon_brief' || depth === 'sermon_brief' || depth === 'manuscript';
    const msg = isExpired
      ? 'Your Research Pro access has expired.'
      : 'Research Pro is required for this format.';

    const banner = document.createElement('div');
    banner.className = 'paywall-banner';
    banner.id = 'researchStripePaywall';
    banner.innerHTML = `
      <p class="paywall-msg">
        <strong>${msg}</strong><br>
        Unlock unlimited Research for $9/month or $79/year.
        7-day free trial — cancel anytime.
      </p>
      <div class="paywall-actions">
        <button class="paywall-cta" id="stripeCheckoutBtn" type="button">
          Start free trial →
        </button>
        <button class="paywall-dismiss" type="button">Maybe later</button>
      </div>
      <p style="font-size:0.75rem;color:var(--text-muted);margin-top:0.5rem;">
        Secure checkout via Stripe. Manage or cancel anytime.
      </p>`;

    banner.querySelector('#stripeCheckoutBtn').addEventListener('click', async () => {
      const btn = banner.querySelector('#stripeCheckoutBtn');
      btn.disabled = true;
      btn.textContent = 'Redirecting…';
      try {
        const r = await fetch('/api/checkout', { method: 'POST' });
        const { url, error } = await r.json();
        if (url) { window.location.href = url; }
        else { btn.textContent = error || 'Checkout unavailable'; btn.disabled = false; }
      } catch (e) {
        btn.textContent = 'Error — try again'; btn.disabled = false;
      }
    });

    banner.querySelector('.paywall-dismiss').addEventListener('click', () => {
      banner.remove();
      runBtn.disabled = false;
      resultsSection.innerHTML = '';
    });

    resultsSection.innerHTML = '';
    resultsSection.appendChild(banner);
    runBtn.disabled = true;
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // ─── Featured load ─────────────────────────────────────────────────────────

  window.loadFeatured = function (format, query) {
    selectFormat(format);
    if (inputEl) { inputEl.value = query; inputEl.focus(); }
    document.querySelector('.controls')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  // ─── Loading state ─────────────────────────────────────────────────────────

  function showLoading() {
    ttsStop(); // stop any playing audio before clearing results
    const trad = currentDenom || currentTradition;
    const label = trad ? trad : 'traditions';
    resultsSection.innerHTML = `
      <div class="research-loading">
        <div class="spinner"></div>
        <p>Researching across ${escHtml(label)}…</p>
      </div>`;
  }

  // ─── API call ──────────────────────────────────────────────────────────────

  async function callAPI(mode, depth, query, traditions) {
    const headers = { 'Content-Type': 'application/json' };
    const token = getStoredToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const fp = await getFingerprint();
    headers['x-fingerprint'] = fp;

    const res = await fetch('/api/run-research', {
      method:  'POST',
      headers,
      body:    JSON.stringify({ mode, depth, input: query, traditions }),
    });

    // Server-side paywall responses
    if (res.status === 402) {
      const body = await res.json().catch(() => ({}));
      if (body.error === 'free_limit_reached') {
        // Update local cache so indicator reflects the limit
        _usageCache = { plan: 'free', remaining: 0, count: FREE_LIMIT };
        updateUsageIndicator();
      }
      throw Object.assign(new Error(body.error || 'subscription_required'), { isPaywall: true });
    }
    if (res.status === 401) {
      localStorage.removeItem(SESSION_KEY);
      throw Object.assign(new Error('token_expired'), { isPaywall: true });
    }

    if (!res.ok) throw new Error(`Server error ${res.status}: ${await res.text()}`);

    // Update usage cache after successful run
    if (_usageCache?.plan === 'free') {
      _usageCache.count = (_usageCache.count ?? 0) + 1;
      _usageCache.remaining = Math.max(0, (_usageCache.remaining ?? FREE_LIMIT) - 1);
      updateUsageIndicator();
    }

    return res.json();
  }

  // ─── Run research ──────────────────────────────────────────────────────────

  async function runResearch() {
    const query = inputEl.value.trim();
    if (!query) { inputEl.focus(); return; }

    const fmt   = FORMAT_MAP[currentFormat];
    const mode  = fmt.mode;
    const depth = fmt.depth;

    if (isOverLimit(mode, depth) && !isPaywallDismissed()) {
      showPaywallBanner(mode, depth);
      return;
    }

    const traditions = getSelectedTraditions();
    window.plausible && plausible('Research Query', { props: { format: currentFormat, tradition: currentTradition || 'all' } });
    showLoading();
    runBtn.disabled = true;

    try {
      const data = await callAPI(mode, depth, query, traditions);

      updateUsageIndicator();

      researchHistorySave(currentFormat, currentTradition, currentDenom, query);
      renderResults(data);
    } catch (err) {
      if (err.isPaywall) {
        showStripePaywall(mode, depth, err.message === 'token_expired');
      } else {
        resultsSection.innerHTML = `<div class="research-error">${escHtml(err.message)}</div>`;
        console.error('[research-ui]', err);
      }
    } finally {
      runBtn.disabled = false;
    }
  }

  // ─── Render results ────────────────────────────────────────────────────────

  function renderResults(data) {
    const { results, commonGround, sermonAngle } = data;
    resultsSection.innerHTML = '';

    const wrap = document.createElement('div');
    wrap.className = 'research-results';

    wrap.appendChild(buildVoicePicker());

    Object.entries(results).forEach(([tradition, content]) => {
      wrap.appendChild(buildTraditionCard(tradition, content));
    });

    if (sermonAngle) {
      const block = document.createElement('div');
      block.className = 'sermon-angle-block';
      block.innerHTML = `
        <div class="sermon-angle-label">Unifying Angle</div>
        <p class="sermon-angle-text">${escHtml(sermonAngle)}</p>`;
      wrap.appendChild(block);
    }

    if (commonGround) {
      const cg = document.createElement('div');
      cg.className = 'common-ground';
      cg.innerHTML = `
        <h2>Common Ground</h2>
        <div class="content">${escHtml(commonGround)}</div>`;
      wrap.appendChild(cg);
    }

    wrap.appendChild(buildShareBar(data));

    const expBtn = document.createElement('button');
    expBtn.className = 'export-btn';
    expBtn.textContent = '↓ Export as Markdown';
    expBtn.addEventListener('click', () => exportMarkdown(data));
    wrap.appendChild(expBtn);

    // Save button — paid users only
    if (_usageCache?.plan === 'paid') {
      const saveBtn = document.createElement('button');
      saveBtn.id        = 'saveResultBtn';
      saveBtn.className = 'save-result-btn';
      saveBtn.textContent = 'Save';
      saveBtn.addEventListener('click', () => saveCurrentResult(data));
      wrap.appendChild(saveBtn);
    }

    _currentData = data;
    resultsSection.appendChild(wrap);
    wrap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  // ─── Tradition card ────────────────────────────────────────────────────────

  function buildTraditionCard(tradition, content) {
    const color = TRADITION_COLORS[tradition] || '#c8900e';

    const card = document.createElement('div');
    card.className = 'research-card';
    card.style.borderTopColor = color;

    const header = document.createElement('div');
    header.className = 'research-card-header';
    header.innerHTML = `
      <span class="research-card-title">
        <span class="trad-dot" style="background:${color}"></span>
        ${escHtml(tradition)}
      </span>
      <span class="card-actions">
        <button class="card-copy-btn" type="button">Copy</button>
        ${hasTTS ? '<button class="card-listen-btn" type="button">▶ Listen</button>' : ''}
        <span class="card-chevron" aria-hidden="true">▾</span>
      </span>`;

    header.querySelector('.card-copy-btn').addEventListener('click', e => {
      e.stopPropagation();
      const plain = buildPlainText(tradition, content);
      navigator.clipboard.writeText(plain).then(() => {
        const btn = e.currentTarget;
        const orig = btn.textContent;
        btn.textContent = 'Copied!';
        setTimeout(() => { btn.textContent = orig; }, 1600);
      });
    });

    if (hasTTS) {
      header.querySelector('.card-listen-btn')?.addEventListener('click', e => {
        e.stopPropagation();
        ttsSpeak(buildSpeakText(tradition, content), e.currentTarget);
      });
    }

    header.addEventListener('click', () => card.classList.toggle('collapsed'));

    const body = document.createElement('div');
    body.className = 'research-card-body';

    // ── Quick / Study (verse/topic/keyword) ──────────────────────────────────
    if (content.passage) {
      const bq = document.createElement('blockquote');
      bq.className = 'research-blockquote';
      bq.textContent = content.passage;
      body.appendChild(bq);
    }
    if (content.interpretation) {
      body.insertAdjacentHTML('beforeend', `
        <p class="research-field-label">Interpretation</p>
        <p class="research-field-text">${escHtml(content.interpretation)}</p>`);
    }
    if (content.context) {
      body.insertAdjacentHTML('beforeend', `
        <p class="research-field-label">Context</p>
        <p class="research-field-text">${escHtml(content.context)}</p>`);
    }

    // ── Devotional / Personal Reflection ─────────────────────────────────────
    if (content.scripture && !content.passage) {
      const bq = document.createElement('blockquote');
      bq.className = 'research-blockquote';
      bq.textContent = content.scripture;
      body.appendChild(bq);
    }
    if (content.reflection) {
      body.insertAdjacentHTML('beforeend', `
        <p class="research-field-text research-reflection">${escHtml(content.reflection)}</p>`);
    }

    // ── Preaching Outline ─────────────────────────────────────────────────────
    if (content.main_point) {
      body.insertAdjacentHTML('beforeend', `
        <p class="research-field-label">Main Point</p>
        <p class="research-field-text" style="font-style:italic">${escHtml(content.main_point)}</p>`);
    }
    if (Array.isArray(content.sub_points) && content.sub_points.length) {
      const ol = document.createElement('ol');
      ol.className = 'research-outline';
      content.sub_points.forEach(pt => {
        const li = document.createElement('li');
        li.textContent = pt;
        ol.appendChild(li);
      });
      body.appendChild(ol);
    }

    // ── Sermon Manuscript ─────────────────────────────────────────────────────
    if (content.title) {
      body.insertAdjacentHTML('beforeend', `
        <p class="research-field-label">Title</p>
        <p class="research-field-text" style="font-family:'Cinzel',serif;font-size:1rem">${escHtml(content.title)}</p>`);
    }
    if (content.intro) {
      body.insertAdjacentHTML('beforeend', `
        <p class="research-field-label">Introduction</p>
        <p class="research-field-text">${escHtml(content.intro)}</p>`);
    }
    if (content.body) {
      body.insertAdjacentHTML('beforeend', `
        <p class="research-field-label">Body</p>
        <p class="research-field-text">${escHtml(content.body)}</p>`);
    }
    if (content.application) {
      body.insertAdjacentHTML('beforeend', `
        <p class="research-field-label">Application</p>
        <p class="research-field-text">${escHtml(content.application)}</p>`);
    }
    if (content.close) {
      body.insertAdjacentHTML('beforeend', `
        <p class="research-field-label">Close</p>
        <p class="research-field-text">${escHtml(content.close)}</p>`);
    }

    // ── Funeral / Wedding Homily ──────────────────────────────────────────────
    if (content.homily) {
      body.insertAdjacentHTML('beforeend', `
        <p class="research-field-text research-reflection">${escHtml(content.homily)}</p>`);
    }

    // ── Small Group Guide ─────────────────────────────────────────────────────
    if (content.framing) {
      body.insertAdjacentHTML('beforeend', `
        <p class="research-field-label">Framing</p>
        <p class="research-field-text">${escHtml(content.framing)}</p>`);
    }
    if (Array.isArray(content.questions) && content.questions.length) {
      body.insertAdjacentHTML('beforeend', `<p class="research-field-label">Discussion Questions</p>`);
      const ol = document.createElement('ol');
      ol.className = 'research-outline';
      content.questions.forEach(q => {
        const li = document.createElement('li');
        li.textContent = q;
        ol.appendChild(li);
      });
      body.appendChild(ol);
    }

    // ── Children's Lesson ─────────────────────────────────────────────────────
    if (content.story_hook) {
      body.insertAdjacentHTML('beforeend', `
        <p class="research-field-label">Story Hook</p>
        <p class="research-field-text">${escHtml(content.story_hook)}</p>`);
    }
    if (content.teaching) {
      body.insertAdjacentHTML('beforeend', `
        <p class="research-field-label">Teaching</p>
        <p class="research-field-text">${escHtml(content.teaching)}</p>`);
    }
    if (content.discussion_question) {
      body.insertAdjacentHTML('beforeend', `
        <p class="research-field-label">Discussion Question</p>
        <p class="research-field-text research-discussion">${escHtml(content.discussion_question)}</p>`);
    }

    card.appendChild(header);
    card.appendChild(body);
    return card;
  }

  function buildPlainText(tradition, c) {
    const parts = [tradition];
    if (c.passage)        parts.push('\n' + c.passage);
    if (c.scripture)      parts.push('\n' + c.scripture);
    if (c.interpretation) parts.push('\n\n' + c.interpretation);
    if (c.context)        parts.push('\n\n' + c.context);
    if (c.reflection)     parts.push('\n\n' + c.reflection);
    if (c.title)          parts.push('\n\nTitle: ' + c.title);
    if (c.intro)          parts.push('\n\nIntro: ' + c.intro);
    if (c.body)           parts.push('\n\nBody: ' + c.body);
    if (c.application)    parts.push('\n\nApplication: ' + c.application);
    if (c.close)          parts.push('\n\nClose: ' + c.close);
    if (c.homily)         parts.push('\n\n' + c.homily);
    if (c.main_point)     parts.push('\n\nMain Point: ' + c.main_point);
    if (Array.isArray(c.sub_points)) parts.push('\n' + c.sub_points.join('\n'));
    if (c.framing)        parts.push('\n\n' + c.framing);
    if (Array.isArray(c.questions)) parts.push('\n' + c.questions.join('\n'));
    return parts.join('').trim();
  }

  // ─── TTS (ElevenLabs) ─────────────────────────────────────────────────────

  const hasTTS = true;
  let _ttsBtn   = null;   // currently active listen button
  let _ttsAudio = null;   // current HTMLAudioElement

  let _ttsVoice = localStorage.getItem('mp_tts_voice') || 'male';

  function ttsStop() {
    if (_ttsAudio) {
      _ttsAudio.pause();
      _ttsAudio.src = '';
      _ttsAudio = null;
    }
    if (_ttsBtn) { _ttsBtn.textContent = '▶ Listen'; _ttsBtn = null; }
  }

  async function ttsSpeak(text, btn) {
    if (_ttsBtn === btn) { ttsStop(); return; }
    ttsStop();

    btn.textContent = '… Loading';
    btn.disabled = true;
    _ttsBtn = btn;

    try {
      const res = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice: _ttsVoice }),
      });

      if (!res.ok) throw new Error(`TTS error ${res.status}`);

      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const audio = new Audio(url);
      _ttsAudio = audio;

      audio.onended = () => {
        URL.revokeObjectURL(url);
        if (_ttsBtn === btn) { btn.textContent = '▶ Listen'; _ttsBtn = null; }
        _ttsAudio = null;
      };
      audio.onerror = audio.onended;

      btn.textContent = '◼ Stop';
      btn.disabled = false;
      audio.play();
    } catch (err) {
      console.error('[ttsSpeak]', err.message);
      btn.textContent = '▶ Listen';
      btn.disabled = false;
      _ttsBtn = null;
    }
  }

  function buildVoicePicker() {
    const wrap = document.createElement('div');
    wrap.className = 'voice-picker';
    wrap.innerHTML = `
      <span class="voice-picker-label">Voice</span>
      <button class="voice-btn${_ttsVoice === 'female' ? ' active' : ''}" data-voice="female" type="button">Female</button>
      <button class="voice-btn${_ttsVoice === 'male'   ? ' active' : ''}" data-voice="male"   type="button">Male</button>`;
    wrap.querySelectorAll('.voice-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        ttsStop();
        _ttsVoice = btn.dataset.voice;
        localStorage.setItem('mp_tts_voice', _ttsVoice);
        wrap.querySelectorAll('.voice-btn').forEach(b => b.classList.toggle('active', b === btn));
      });
    });
    return wrap;
  }

  function buildSpeakText(tradition, content) {
    const p = [`${tradition}.`];
    if (content.passage)       p.push(content.passage);
    if (content.scripture)     p.push(content.scripture);
    if (content.interpretation) p.push(content.interpretation);
    if (content.context)       p.push(content.context);
    if (content.reflection)    p.push(content.reflection);
    if (content.title)         p.push(content.title + '.');
    if (content.intro)         p.push(content.intro);
    if (content.body)          p.push(content.body);
    if (content.application)   p.push('Application. ' + content.application);
    if (content.close)         p.push(content.close);
    if (content.homily)        p.push(content.homily);
    if (content.main_point)    p.push('Main point. ' + content.main_point);
    if (Array.isArray(content.sub_points))
      content.sub_points.forEach(pt => p.push(pt));
    if (content.framing)       p.push(content.framing);
    if (Array.isArray(content.questions))
      content.questions.forEach((q, i) => p.push(`Question ${i + 1}. ${q}`));
    if (content.story_hook)    p.push(content.story_hook);
    if (content.teaching)      p.push(content.teaching);
    if (content.discussion_question) p.push('Discussion question. ' + content.discussion_question);
    return p.join(' ');
  }

  // ─── Share bar ─────────────────────────────────────────────────────────────

  function buildShareBar(data) {
    const { input, depth, commonGround } = data;
    _shareURL = `${window.location.origin}/research?format=${encodeURIComponent(depth)}&q=${encodeURIComponent(input)}`;

    const pullQuote = (commonGround || input).slice(0, 200);
    const shareText = `${pullQuote}\n\nmanypaths.one/research #ManyPaths`;
    const encoded   = encodeURIComponent(shareText);

    const bar = document.createElement('div');
    bar.className = 'share-bar';
    bar.innerHTML = `
      <span class="share-label">Share</span>
      <button class="share-btn share-copy" type="button">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
        </svg>
        Copy Link
      </button>
      <button class="share-btn share-card-btn" type="button">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>
        </svg>
        Image Card
      </button>
      <a class="share-btn share-bluesky"
         href="https://bsky.app/intent/compose?text=${encoded}"
         target="_blank" rel="noopener noreferrer">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 320" fill="currentColor">
          <path d="M180 142c-16.3-31.7-60.7-90.8-102-120C38 0 0 4.7 0 55.3c0 19 10.7 80 18 91.7
                   8.7 13.7 27.3 17.3 46 14.7-20.3 9.3-56.3 29.3-56.3 71.3 0 40.7 38 62 76 44.3
                   17-8 31-17.3 44.3-32 13.3 14.7 27.3 24 44.3 32 38 17.7 76-3.6 76-44.3
                   0-42-36-62-56.3-71.3 18.7 2.6 37.3-1 46-14.7 7.3-11.7 18-72.7 18-91.7
                   0-50.6-38-55.3-78-122-41.3 29.2-85.7 88.3-102 120z"/>
        </svg>
        Bluesky
      </a>
      <a class="share-btn share-x"
         href="https://twitter.com/intent/tweet?text=${encoded}"
         target="_blank" rel="noopener noreferrer">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" fill="currentColor">
          <path d="M178.57 127.15 290.27 0h-26.46l-97.03 110.38L89.34 0H0l117.13 166.93L0 300.1h26.46
                   l102.4-116.59 81.8 116.59h89.34M36.01 19.54H76.66l187.13 262.13h-40.66"/>
        </svg>
        X
      </a>`;

    bar.querySelector('.share-copy').addEventListener('click', function () {
      navigator.clipboard.writeText(_shareURL).then(() => {
        const orig = this.innerHTML;
        this.textContent = 'Copied!';
        setTimeout(() => { this.innerHTML = orig; }, 1600);
      });
    });

    bar.querySelector('.share-card-btn').addEventListener('click', () => {
      const quote = (data.commonGround || Object.values(data.results || {})[0]?.passage || data.input || '').trim();
      if (quote && window.QuoteCard) window.QuoteCard.download(quote, 'Many Paths', data.input);
    });

    return bar;
  }

  // ─── Markdown export ───────────────────────────────────────────────────────

  function exportMarkdown(data) {
    const { depth, input, traditions, results, commonGround, sermonAngle } = data;
    const date = new Date().toISOString().slice(0, 10);
    const slug = input.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

    let md = `# ${input}\n\n`;
    md += `**Format:** ${depth} · **Date:** ${date}  \n`;
    md += `**Traditions:** ${traditions.join(', ')}\n\n---\n\n`;

    Object.entries(results).forEach(([tradition, c]) => {
      md += `## ${tradition}\n\n`;
      if (c.passage)        md += `> ${c.passage.replace(/\n/g, '\n> ')}\n\n`;
      if (c.scripture)      md += `> ${c.scripture.replace(/\n/g, '\n> ')}\n\n`;
      if (c.interpretation) md += `**Interpretation:** ${c.interpretation}\n\n`;
      if (c.context)        md += `**Context:** ${c.context}\n\n`;
      if (c.reflection)     md += `${c.reflection}\n\n`;
      if (c.title)          md += `**Title:** ${c.title}\n\n`;
      if (c.intro)          md += `**Intro:** ${c.intro}\n\n`;
      if (c.body)           md += `${c.body}\n\n`;
      if (c.application)    md += `**Application:** ${c.application}\n\n`;
      if (c.close)          md += `**Close:** ${c.close}\n\n`;
      if (c.homily)         md += `${c.homily}\n\n`;
      if (c.main_point)     md += `**Main Point:** ${c.main_point}\n\n`;
      if (Array.isArray(c.sub_points)) md += c.sub_points.map(p => `- ${p}`).join('\n') + '\n\n';
      if (c.framing)        md += `${c.framing}\n\n`;
      if (Array.isArray(c.questions)) md += c.questions.map((q, i) => `${i+1}. ${q}`).join('\n') + '\n\n';
    });

    if (sermonAngle) md += `---\n\n## Unifying Angle\n\n${sermonAngle}\n\n`;
    if (commonGround) md += `---\n\n## Common Ground\n\n${commonGround}\n\n`;
    md += `---\n_Exported from [Many Paths](https://manypaths.one) · ${date}_\n`;

    const blob = new Blob([md], { type: 'text/markdown' });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), { href: url, download: `${depth}-${slug}-${date}.md` });
    a.click();
    URL.revokeObjectURL(url);
  }

  // ─── Saves ────────────────────────────────────────────────────────────────

  let _savesOpen   = false;
  let _currentData = null; // last successful run result

  function injectMySavesBtn() {
    if (document.getElementById('mySavesBtn')) return;
    const btn = document.createElement('button');
    btn.id        = 'mySavesBtn';
    btn.className = 'my-saves-btn';
    btn.textContent = 'My Saves';
    btn.addEventListener('click', () => {
      if (_savesOpen) hideSavesPanel();
      else showSavesPanel();
    });
    // Insert into topnav-links
    const navLinks = document.querySelector('.topnav-links');
    if (navLinks) navLinks.appendChild(btn);
  }

  function authHeaders() {
    const h = { 'Content-Type': 'application/json' };
    const token = getStoredToken();
    if (token) h['Authorization'] = `Bearer ${token}`;
    return h;
  }

  async function loadSaves() {
    try {
      const res = await fetch('/api/saves', { headers: authHeaders() });
      if (!res.ok) return [];
      return await res.json();
    } catch { return []; }
  }

  async function apiDeleteSave(id) {
    await fetch(`/api/saves/${id}`, { method: 'DELETE', headers: authHeaders() });
  }

  async function apiCreateSave(payload) {
    const res = await fetch('/api/saves', {
      method: 'POST',
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error(await res.text());
    return await res.json();
  }

  function autoTitle(data) {
    const fmt   = FORMAT_MAP[data.depth]?.name || data.depth;
    const trad  = data.traditions?.length === 1 ? data.traditions[0] : 'All traditions';
    return `${fmt} · ${data.input?.slice(0, 50) || 'Untitled'} (${trad})`;
  }

  function showSavesPanel() {
    _savesOpen = true;
    const section = document.getElementById('savesSection');
    if (section) { renderSavesPanel(); return; }

    const el = document.createElement('section');
    el.id = 'savesSection';
    el.className = 'saves-panel';
    // Insert just above the featured section
    const featured = document.querySelector('.featured-section');
    if (featured) featured.insertAdjacentElement('beforebegin', el);
    else document.querySelector('main')?.prepend(el);

    renderSavesPanel();
  }

  function hideSavesPanel() {
    _savesOpen = false;
    document.getElementById('savesSection')?.remove();
  }

  async function renderSavesPanel() {
    const el = document.getElementById('savesSection');
    if (!el) return;
    el.innerHTML = `
      <div class="saves-panel-header">
        <span class="saves-panel-title">My Saves</span>
        <button class="saves-panel-close" type="button">Close ✕</button>
      </div>
      <div class="saves-list" id="savesList"><div class="saves-empty">Loading…</div></div>
      <div class="saves-panel-divider"></div>`;

    el.querySelector('.saves-panel-close').addEventListener('click', hideSavesPanel);

    const saves = await loadSaves();
    const list  = document.getElementById('savesList');
    if (!list) return;

    if (!saves.length) {
      list.innerHTML = '<div class="saves-empty">No saved research yet. Run a session and tap Save.</div>';
      return;
    }

    list.innerHTML = '';
    saves.forEach(s => {
      const card = document.createElement('div');
      card.className = 'save-card';
      card.dataset.saveId = s.id;

      const date = new Date(s.updated_at || s.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
      const tradLabel = s.denomination && s.denomination !== s.tradition ? s.denomination : (s.tradition || 'All traditions');
      const fmtLabel  = FORMAT_MAP[s.format]?.name || s.format;

      card.innerHTML = `
        <div class="save-card-info">
          <div class="save-card-title">${escHtml(s.title || s.topic || 'Untitled')}</div>
          <div class="save-card-meta">${escHtml(fmtLabel)} · ${escHtml(tradLabel)} · ${escHtml(date)}</div>
        </div>
        <div class="save-card-actions">
          <button class="save-load-btn" type="button">Load</button>
          <button class="save-delete-btn" type="button">Delete</button>
        </div>`;

      card.querySelector('.save-load-btn').addEventListener('click', async () => {
        try {
          const full = await fetch(`/api/saves/${s.id}`, { headers: authHeaders() });
          const save = await full.json();
          hideSavesPanel();
          if (save.tradition) selectTradition(save.tradition);
          if (save.denomination) {
            const denomPill = document.querySelector(`#denomSubpicker [data-value="${CSS.escape(save.denomination)}"]`);
            if (denomPill) selectDenom(denomPill, save.denomination);
          }
          if (save.format) selectFormat(save.format);
          if (save.topic && inputEl) inputEl.value = save.topic;
          if (save.output) { _currentData = save.output; renderResults(save.output); }
          resultsSection?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } catch (e) { console.error('[saves] load error', e.message); }
      });

      card.querySelector('.save-delete-btn').addEventListener('click', async (e) => {
        const btn = e.currentTarget;
        if (btn.dataset.confirm !== '1') {
          btn.textContent = 'Sure?'; btn.dataset.confirm = '1';
          setTimeout(() => { if (btn.isConnected) { btn.textContent = 'Delete'; btn.dataset.confirm = ''; } }, 3000);
          return;
        }
        try {
          await apiDeleteSave(s.id);
          card.remove();
          if (!document.querySelectorAll('#savesList .save-card').length) {
            document.getElementById('savesList').innerHTML = '<div class="saves-empty">No saved research yet.</div>';
          }
        } catch (e) { console.error('[saves] delete error', e.message); }
      });

      list.appendChild(card);
    });
  }

  async function saveCurrentResult(data) {
    const btn = document.getElementById('saveResultBtn');
    if (!btn) return;
    btn.disabled = true;
    btn.textContent = 'Saving…';
    try {
      const title = autoTitle(data);
      await apiCreateSave({
        title,
        tradition:   data.traditions?.[0] || null,
        denomination: data.traditions?.length === 1 ? data.traditions[0] : null,
        topic:       data.input,
        format:      data.depth,
        depth:       data.depth,
        language:    'en',
        output:      data,
      });
      btn.textContent = 'Saved ✓';
      setTimeout(() => { if (btn.isConnected) { btn.textContent = 'Save'; btn.disabled = false; } }, 2500);
      // Refresh panel if open
      if (_savesOpen) renderSavesPanel();
    } catch (e) {
      btn.textContent = 'Error'; btn.disabled = false;
      console.error('[saves] create error', e.message);
    }
  }

  // ─── Utility ──────────────────────────────────────────────────────────────

  function escHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // ─── Init ──────────────────────────────────────────────────────────────────

  function init() {
    injectStyles();

    inputEl        = document.getElementById('researchInput');
    chipWrap       = document.getElementById('suggestionChips');
    runBtn         = document.getElementById('runBtn');
    inspireBtn     = document.getElementById('inspireBtn');
    resultsSection = document.getElementById('researchResults');

    // Build dynamic UI
    buildTradPills();
    buildFormatGrid();

    // Inject usage indicator below action row
    usageIndicatorEl = document.createElement('div');
    usageIndicatorEl.className = 'usage-indicator';
    document.querySelector('.action-row')?.insertAdjacentElement('afterend', usageIndicatorEl);

    // Run — button click, Enter in input, Cmd/Ctrl+Enter anywhere
    runBtn.addEventListener('click', runResearch);
    inputEl.addEventListener('keydown', e => { if (e.key === 'Enter') runResearch(); });
    document.addEventListener('keydown', e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') runResearch(); });

    // Inspire Me
    inspireBtn.addEventListener('click', () => {
      const list = SUGGESTIONS[currentFormat] || [];
      if (!list.length) return;
      inputEl.value = list[Math.floor(Math.random() * list.length)];
      inputEl.focus();
    });

    // Featured cards delegation
    const featuredCards = document.querySelector('.featured-cards');
    if (featuredCards) {
      featuredCards.addEventListener('click', (e) => {
        const btn = e.target.closest('.featured-load-btn');
        if (btn) loadFeatured(btn.dataset.featuredFormat, btn.dataset.featuredQuery);
      });
    }

    // Nav badge on Research link (auto-expires 30 days after addedDate)
    const NAV_BADGE_ADDED = '2026-03-24';
    const navIsNew = (Date.now() - new Date(NAV_BADGE_ADDED).getTime()) < 30 * 24 * 60 * 60 * 1000;
    if (navIsNew) {
      const researchLink = document.querySelector('.topnav-link[href="/research"]');
      if (researchLink) {
        const badge = document.createElement('span');
        badge.className = 'new-badge';
        badge.textContent = 'new';
        researchLink.appendChild(badge);
      }
    }

    // Init chips, indicator, history
    renderChips(currentFormat);
    updateUsageIndicator();
    researchHistoryRender();

    // Pre-fill from URL params: /research?format=scripture_study&q=John+3:16
    // Also handle legacy: /research?mode=verse&q=... or input=...
    // Compare nudge: /research?tradition=Methodist&q=forgiveness
    const params = new URLSearchParams(window.location.search);
    const legacyModeMap = { verse: 'scripture_study', topic: 'quick', keyword: 'quick', sermon: 'preaching_outline', sermon_brief: 'preaching_outline' };
    const qFormat    = params.get('format') || legacyModeMap[params.get('mode')] || null;
    const qVal       = params.get('q') || params.get('input');
    const qTradition = params.get('tradition');

    if (qTradition) selectTradition(qTradition);
    if (qVal) {
      if (qFormat && FORMAT_MAP[qFormat]) selectFormat(qFormat);
      inputEl.value = decodeURIComponent(qVal);
      renderChips(currentFormat);
    }
  }

  document.addEventListener('DOMContentLoaded', init);

})();
