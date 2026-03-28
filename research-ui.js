// research-ui.js
// Browser-side logic for research.html.
// Calls POST /api/run-research → server.js → research-engine.js
// Do NOT import this in Node — browser only.

(function () {
  'use strict';

  // ─── Data ─────────────────────────────────────────────────────────────────

  const TRADITION_COLORS = {
    Christianity:        '#7F77DD',
    Judaism:             '#1D9E75',
    Islam:               '#378ADD',
    Buddhism:            '#EF9F27',
    Hinduism:            '#D85A30',
    Taoism:              '#5DCAA5',
    Sikhism:             '#D4537E',
    'Latter-day Saints': '#1B3A6B',
  };

  // ─── "New" badge (auto-expires 30 days after addedDate) ────────────────────
  const TRADITION_ADDED = {
    'Latter-day Saints': '2026-03-24',
  };

  function isNewTradition(name) {
    const added = TRADITION_ADDED[name];
    if (!added) return false;
    return (Date.now() - new Date(added).getTime()) < 30 * 24 * 60 * 60 * 1000;
  }

  const SUGGESTIONS = {
    verse: [
      'Psalm 88',                    // the psalm that never resolves — rare, powerful
      'Matthew 25:31–46',            // sheep and goats — justice as the test
      'Isaiah 58:6–7',               // true fasting vs. empty ritual
      'Romans 8:38–39',              // nothing can separate us
      'Surah Al-Inshirah 94',        // "with hardship comes ease" — twice
      'Tao Te Ching 16',             // returning to the root
      'Dhammapada 1–2',              // mind is the forerunner of all actions
    ],
    topic: [
      'the dark night of the soul',
      'when God seems absent',
      'the body as sacred',
      'shame and its remedies',
      'anger and the sacred',
      'the stranger at the gate',
      'what the mystics say about silence',
    ],
    keyword: ['exile', 'threshold', 'wilderness', 'shadow', 'return', 'anointing', 'hunger'],
    sermon_brief: [
      'when faith feels like absence',
      'the spirituality of failure',
      'doubt as a form of devotion',
      'justice and mercy — can both be true at once?',
      'what to do when the tradition feels insufficient',
      'the God who suffers with us',
    ],
  };

  // ─── Free tier limits ──────────────────────────────────────────────────────

  const FREE_LIMITS = {
    study:        { key: 'mp_study_count',        max: 10, noun: 'Study lookups'  },
    sermon_brief: { key: 'mp_sermon_count',        max: 3,  noun: 'Sermon briefs' },
    denomination: { key: 'mp_denomination_count',  max: 1,  noun: 'deep dives'    },
  };

  const PAYWALL_DISMISS_KEY = 'mp_paywall_dismissed'; // sessionStorage

  function getCount(key)  { return parseInt(localStorage.getItem(key) || '0', 10); }
  function incCount(key)  { localStorage.setItem(key, getCount(key) + 1); }

  function limitConfig(mode, depth) {
    if (mode === 'sermon_brief') return FREE_LIMITS.sermon_brief;
    if (depth === 'study')       return FREE_LIMITS.study;
    return null; // quick = unlimited
  }

  function isOverLimit(mode, depth) {
    const cfg = limitConfig(mode, depth);
    return cfg ? getCount(cfg.key) >= cfg.max : false;
  }

  function isPaywallDismissed() {
    return !!sessionStorage.getItem(PAYWALL_DISMISS_KEY);
  }

  // ─── State ────────────────────────────────────────────────────────────────

  let currentMode  = 'verse';
  let currentDepth = 'quick';
  let _shareURL    = '';

  // ─── DOM refs (set in init) ───────────────────────────────────────────────

  let tabs, inputEl, depthBtns, chipWrap, runBtn, inspireBtn,
      resultsSection, usageIndicatorEl;

  // ─── Injected styles ──────────────────────────────────────────────────────

  function injectStyles() {
    const s = document.createElement('style');
    s.textContent = `
      /* Loading */
      .research-loading {
        text-align: center;
        padding: 3rem 1rem;
      }
      .research-loading .spinner {
        display: inline-block;
        width: 36px; height: 36px;
        border: 3px solid var(--border);
        border-top-color: var(--accent2);
        border-radius: 50%;
        animation: r-spin 0.75s linear infinite;
        margin-bottom: 1rem;
      }
      @keyframes r-spin { to { transform: rotate(360deg); } }
      .research-loading p {
        font-size: 0.78rem;
        letter-spacing: 2.5px;
        text-transform: uppercase;
        color: var(--text-muted);
        animation: faith-text-pulse 2s ease-in-out infinite;
      }

      /* Results wrapper */
      .research-results { margin-top: 0.5rem; }

      /* Tradition card */
      .research-card {
        background: var(--surface);
        border: 1px solid var(--border);
        border-top: 3px solid var(--accent2);
        border-radius: var(--radius);
        margin-bottom: 0.85rem;
        overflow: hidden;
        animation: fadeIn 0.35s ease;
        box-shadow: 0 2px 10px rgba(150,90,0,0.06);
      }

      .research-card-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 0.75rem;
        padding: 0.9rem 1.2rem;
        cursor: pointer;
        user-select: none;
        transition: background 0.15s;
      }
      .research-card-header:hover { background: rgba(200,144,14,0.04); }

      .research-card-title {
        display: flex;
        align-items: center;
        gap: 0.55rem;
        font-family: 'Cinzel', serif;
        font-size: 0.9rem;
        font-weight: 600;
        letter-spacing: 0.8px;
        color: var(--accent);
      }

      .trad-dot {
        width: 9px; height: 9px;
        border-radius: 50%;
        flex-shrink: 0;
      }

      .card-actions {
        display: flex;
        align-items: center;
        gap: 0.5rem;
        flex-shrink: 0;
      }

      .card-copy-btn {
        font-family: 'Josefin Sans', sans-serif;
        font-size: 0.64rem;
        font-weight: 600;
        letter-spacing: 1px;
        text-transform: uppercase;
        color: var(--text-muted);
        background: none;
        border: 1px solid var(--border);
        border-radius: 4px;
        padding: 0.22rem 0.55rem;
        cursor: pointer;
        transition: color 0.15s, border-color 0.15s;
      }
      .card-copy-btn:hover { color: var(--accent); border-color: var(--accent2); }

      .card-chevron {
        color: var(--text-muted);
        font-size: 0.8rem;
        transition: transform 0.2s;
        line-height: 1;
      }
      .research-card.collapsed .card-chevron { transform: rotate(-90deg); }

      .research-card-body {
        padding: 0 1.2rem 1.2rem;
        border-top: 1px solid var(--border);
      }
      .research-card.collapsed .research-card-body { display: none; }

      .research-blockquote {
        margin: 1rem 0 0.75rem;
        padding: 0.75rem 1rem;
        background: var(--surface2);
        border-left: 3px solid var(--accent2);
        border-radius: 0 6px 6px 0;
        font-family: 'EB Garamond', Georgia, serif;
        font-style: italic;
        font-size: 0.95rem;
        color: var(--text);
        line-height: 1.7;
      }

      .research-field-label {
        font-size: 0.7rem;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 1.2px;
        color: var(--text-muted);
        margin: 0.9rem 0 0.3rem;
      }

      .research-field-text {
        font-size: 0.93rem;
        line-height: 1.75;
        color: var(--text);
      }

      /* Sermon angle callout */
      .sermon-angle-block {
        background: linear-gradient(135deg,
          rgba(212,160,34,0.13) 0%,
          rgba(200,144,14,0.07) 100%);
        border: 1px solid rgba(200,144,14,0.4);
        border-left: 4px solid var(--gold);
        border-radius: var(--radius);
        padding: 1.4rem 1.6rem;
        margin-bottom: 1rem;
        animation: fadeIn 0.4s ease;
      }
      .sermon-angle-label {
        font-family: 'Josefin Sans', sans-serif;
        font-size: 0.7rem;
        font-weight: 600;
        letter-spacing: 2px;
        text-transform: uppercase;
        color: var(--gold);
        margin-bottom: 0.5rem;
      }
      .sermon-angle-text {
        font-family: 'EB Garamond', Georgia, serif;
        font-size: 1rem;
        line-height: 1.8;
        color: var(--text);
        font-style: italic;
      }

      /* Export button */
      .export-btn {
        display: inline-flex;
        align-items: center;
        gap: 0.4rem;
        font-family: 'Josefin Sans', sans-serif;
        font-size: 0.7rem;
        font-weight: 600;
        letter-spacing: 1.5px;
        text-transform: uppercase;
        color: var(--text-muted);
        background: none;
        border: 1px solid var(--border);
        border-radius: 20px;
        padding: 0.4rem 0.95rem;
        cursor: pointer;
        margin-top: 0.25rem;
        transition: color 0.15s, border-color 0.15s;
      }
      .export-btn:hover { color: var(--accent); border-color: var(--accent2); }

      /* Error */
      .research-error {
        color: #b03030;
        background: rgba(180,40,40,0.07);
        border: 1px solid rgba(180,40,40,0.2);
        border-radius: var(--radius);
        padding: 1.25rem 1.5rem;
        font-size: 0.9rem;
        text-align: center;
        animation: fadeIn 0.3s ease;
      }

      /* ─── Usage indicator ─── */
      .usage-indicator {
        font-size: 0.75rem;
        color: var(--text-muted);
        margin-top: 0.5rem;
        min-height: 1.1rem;
        letter-spacing: 0.2px;
        animation: fadeIn 0.2s ease;
      }
      .usage-indicator.near-limit { color: #b07020; }
      .usage-indicator.at-limit   { color: #a03020; font-weight: 600; }

      /* ─── Paywall banner ─── */
      .paywall-banner {
        background: linear-gradient(135deg,
          rgba(160,60,20,0.07) 0%,
          rgba(180,80,10,0.05) 100%);
        border: 1px solid rgba(180,80,20,0.3);
        border-left: 4px solid #c05820;
        border-radius: var(--radius);
        padding: 1.25rem 1.4rem;
        margin-bottom: 1.25rem;
        animation: fadeIn 0.35s ease;
      }

      .paywall-msg {
        font-size: 0.95rem;
        color: var(--text);
        line-height: 1.6;
        margin-bottom: 0.9rem;
      }
      .paywall-msg strong { color: #b05010; }

      .paywall-actions {
        display: flex;
        align-items: center;
        gap: 0.75rem;
        flex-wrap: wrap;
        margin-bottom: 0.75rem;
      }

      .paywall-cta {
        font-family: 'Josefin Sans', sans-serif;
        font-size: 0.78rem;
        font-weight: 600;
        letter-spacing: 1px;
        text-transform: uppercase;
        color: #fffbf0;
        background: linear-gradient(135deg, #a06c10, #d4a022, #c08010);
        border: none;
        border-radius: 6px;
        padding: 0.55rem 1rem;
        text-decoration: none;
        cursor: pointer;
        transition: filter 0.15s;
        box-shadow: 0 2px 8px rgba(160,100,0,0.2);
      }
      .paywall-cta:hover { filter: brightness(1.08); }

      .paywall-dismiss {
        font-family: 'EB Garamond', Georgia, serif;
        font-size: 0.9rem;
        font-style: italic;
        color: var(--text-muted);
        background: none;
        border: none;
        cursor: pointer;
        padding: 0.3rem 0;
        transition: color 0.15s;
      }
      .paywall-dismiss:hover { color: var(--text); }

      .sermon-pack-nudge {
        font-size: 0.82rem;
        color: var(--text-muted);
        padding-top: 0.6rem;
        border-top: 1px solid rgba(180,80,20,0.15);
        line-height: 1.5;
      }
      .sermon-pack-nudge a {
        color: var(--accent);
        text-decoration: none;
        font-weight: 600;
      }
      .sermon-pack-nudge a:hover { text-decoration: underline; }

      /* ─── New badge (denomination checkboxes + nav) ─── */
      .new-badge {
        display: inline-block; position: relative; top: -5px;
        font-family: 'Josefin Sans', sans-serif; font-size: 10px; font-weight: 600;
        letter-spacing: 0.4px; color: #c8900e; background: transparent;
        border: 1px solid #c8900e; border-radius: 3px;
        padding: 1px 4px; line-height: 1.3; white-space: nowrap;
      }
    `;
    document.head.appendChild(s);
  }

  // ─── Usage indicator ───────────────────────────────────────────────────────

  function updateUsageIndicator() {
    if (!usageIndicatorEl) return;
    const cfg = limitConfig(currentMode, currentDepth);

    if (!cfg) {
      usageIndicatorEl.textContent = '';
      usageIndicatorEl.className = 'usage-indicator';
      return;
    }

    const used = getCount(cfg.key);
    const remaining = cfg.max - used;
    usageIndicatorEl.className = 'usage-indicator' +
      (remaining <= 0 ? ' at-limit' : remaining <= 2 ? ' near-limit' : '');

    if (remaining <= 0) {
      usageIndicatorEl.textContent = `All ${cfg.max} free ${cfg.noun} used.`;
    } else {
      usageIndicatorEl.textContent = `${used} of ${cfg.max} free ${cfg.noun} used`;
    }
  }

  // ─── Paywall banner ────────────────────────────────────────────────────────

  function showPaywallBanner(mode, depth) {
    document.getElementById('researchPaywall')?.remove();

    const cfg      = limitConfig(mode, depth);
    const isSermon = mode === 'sermon_brief';

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
          <a href="mailto:sermonpack@manypaths.one?subject=Sermon pack">5 sermon briefs for $12</a>
          — never expire.
        </p>` : ''}
    `;

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

  // ─── Tab switching ─────────────────────────────────────────────────────────

  function activateTab(tab) {
    tabs.forEach(t => {
      t.classList.remove('active');
      t.setAttribute('aria-selected', 'false');
    });
    tab.classList.add('active');
    tab.setAttribute('aria-selected', 'true');

    currentMode = tab.dataset.mode;
    inputEl.placeholder = tab.dataset.placeholder;
    renderChips(currentMode);

    const isSermon = currentMode === 'sermon_brief';
    depthBtns.forEach(b => {
      b.disabled = isSermon && b.dataset.depth !== 'sermon_brief';
      if (isSermon) b.classList.toggle('active', b.dataset.depth === 'sermon_brief');
    });

    if (isSermon) {
      currentDepth = 'sermon_brief';
    } else {
      const activeDepth = document.querySelector('.depth-btn.active:not([disabled])');
      if (!activeDepth) {
        depthBtns[0].classList.add('active');
        currentDepth = depthBtns[0].dataset.depth;
      }
    }

    updateUsageIndicator();
  }

  // ─── Suggestion chips ──────────────────────────────────────────────────────

  function renderChips(mode) {
    chipWrap.innerHTML = '';
    (SUGGESTIONS[mode] || []).forEach(s => {
      const btn = document.createElement('button');
      btn.className = 'chip';
      btn.textContent = s;
      btn.addEventListener('click', () => { inputEl.value = s; inputEl.focus(); });
      chipWrap.appendChild(btn);
    });
  }

  // ─── Depth buttons ─────────────────────────────────────────────────────────

  function activateDepth(btn) {
    if (btn.disabled) return;
    depthBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentDepth = btn.dataset.depth;
    updateUsageIndicator();
  }

  // ─── Tradition helpers ─────────────────────────────────────────────────────

  function getSelectedTraditions() {
    const scopeEl = document.querySelector('input[name="traditionScope"]:checked');
    const isPick  = scopeEl?.value === 'pick';

    if (!isPick) {
      const other = document.getElementById('otherTradition')?.value.trim();
      const list  = Object.keys(TRADITION_COLORS);
      return other ? [...list, other] : list;
    }

    const checked = Array.from(
      document.querySelectorAll('#traditionCheckboxes input[type="checkbox"]:checked')
    ).map(cb => cb.value);
    const other = document.getElementById('otherTradition')?.value.trim();
    if (other) checked.push(other);
    return checked.length ? checked : Object.keys(TRADITION_COLORS);
  }

  // ─── Exposed globals (called from HTML onclick attrs) ─────────────────────

  window.handleTraditionScope = function (radio) {
    const isPick = radio.value === 'pick';
    document.querySelectorAll('#traditionCheckboxes label').forEach(lbl => {
      lbl.classList.toggle('enabled', isPick);
    });
  };

  window.loadFeatured = function (mode, query) {
    const tab = document.querySelector(`.tab-btn[data-mode="${mode}"]`);
    if (tab) activateTab(tab);
    inputEl.value = query;
    inputEl.focus();
    document.querySelector('.controls')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  };

  // ─── Loading state ─────────────────────────────────────────────────────────

  function showLoading() {
    resultsSection.innerHTML = `
      <div class="research-loading">
        <div class="spinner"></div>
        <p>Researching across traditions…</p>
      </div>`;
  }

  // ─── API call ──────────────────────────────────────────────────────────────

  async function callAPI(mode, depth, query, traditions) {
    const res = await fetch('/api/run-research', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ mode, depth, input: query, traditions }),
    });
    if (!res.ok) throw new Error(`Server error ${res.status}: ${await res.text()}`);
    return res.json();
  }

  // ─── Run Research (main entry) ─────────────────────────────────────────────

  async function runResearch() {
    const query = inputEl.value.trim();
    if (!query) { inputEl.focus(); return; }

    // ── Free tier gate ──
    if (isOverLimit(currentMode, currentDepth) && !isPaywallDismissed()) {
      showPaywallBanner(currentMode, currentDepth);
      return;
    }

    const traditions = getSelectedTraditions();
    window.plausible && plausible('Research Query', {props: {mode: currentMode, depth: currentDepth}});
    showLoading();
    runBtn.disabled = true;

    try {
      const data = await callAPI(currentMode, currentDepth, query, traditions);

      // Increment AFTER successful result only
      const cfg = limitConfig(currentMode, currentDepth);
      if (cfg) {
        incCount(cfg.key);
        updateUsageIndicator();
      }

      renderResults(data);
    } catch (err) {
      resultsSection.innerHTML = `<div class="research-error">${escHtml(err.message)}</div>`;
      console.error('[research-ui]', err);
      // Do NOT increment on error
    } finally {
      runBtn.disabled = false;
    }
  }

  // ─── Render results ────────────────────────────────────────────────────────

  function renderResults(data) {
    const { mode, results, commonGround, sermonAngle } = data;
    resultsSection.innerHTML = '';

    const wrap = document.createElement('div');
    wrap.className = 'research-results';

    Object.entries(results).forEach(([tradition, content]) => {
      wrap.appendChild(buildTraditionCard(tradition, content));
    });

    if (mode === 'sermon_brief' && sermonAngle) {
      const block = document.createElement('div');
      block.className = 'sermon-angle-block';
      block.innerHTML = `
        <div class="sermon-angle-label">Sermon Angle</div>
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
        <span class="card-chevron" aria-hidden="true">▾</span>
      </span>`;

    header.querySelector('.card-copy-btn').addEventListener('click', e => {
      e.stopPropagation();
      const plain = [
        tradition,
        content.passage        ? `\n${content.passage}`         : '',
        content.interpretation ? `\n\n${content.interpretation}` : '',
        content.context        ? `\n\n${content.context}`        : '',
      ].join('').trim();
      navigator.clipboard.writeText(plain).then(() => {
        const btn = e.currentTarget;
        const orig = btn.textContent;
        btn.textContent = 'Copied!';
        setTimeout(() => { btn.textContent = orig; }, 1600);
      });
    });

    header.addEventListener('click', () => card.classList.toggle('collapsed'));

    const body = document.createElement('div');
    body.className = 'research-card-body';

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

    card.appendChild(header);
    card.appendChild(body);
    return card;
  }

  // ─── Share bar ─────────────────────────────────────────────────────────────

  function buildShareBar(data) {
    const { input, mode, commonGround } = data;
    _shareURL = `${window.location.origin}/research?mode=${encodeURIComponent(mode)}&input=${encodeURIComponent(input)}`;

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
    const { mode, depth, input, traditions, results, commonGround, sermonAngle } = data;
    const date = new Date().toISOString().slice(0, 10);
    const slug = input.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

    let md = `# ${input}\n\n`;
    md += `**Mode:** ${mode} · **Depth:** ${depth} · **Date:** ${date}  \n`;
    md += `**Traditions:** ${traditions.join(', ')}\n\n---\n\n`;

    Object.entries(results).forEach(([tradition, c]) => {
      md += `## ${tradition}\n\n`;
      if (c.passage)        md += `> ${c.passage.replace(/\n/g, '\n> ')}\n\n`;
      if (c.interpretation) md += `**Interpretation:** ${c.interpretation}\n\n`;
      if (c.context)        md += `**Context:** ${c.context}\n\n`;
    });

    if (sermonAngle) md += `---\n\n## Sermon Angle\n\n${sermonAngle}\n\n`;
    if (commonGround) md += `---\n\n## Common Ground\n\n${commonGround}\n\n`;
    md += `---\n_Exported from [Many Paths](https://manypaths.one) · ${date}_\n`;

    const blob = new Blob([md], { type: 'text/markdown' });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement('a'), { href: url, download: `${mode}-${slug}-${date}.md` });
    a.click();
    URL.revokeObjectURL(url);
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

    tabs           = document.querySelectorAll('.tab-btn');
    inputEl        = document.getElementById('researchInput');
    depthBtns      = document.querySelectorAll('.depth-btn');
    chipWrap       = document.getElementById('suggestionChips');
    runBtn         = document.getElementById('runBtn');
    inspireBtn     = document.getElementById('inspireBtn');
    resultsSection = document.getElementById('researchResults');

    // Inject usage indicator below depth buttons
    usageIndicatorEl = document.createElement('div');
    usageIndicatorEl.className = 'usage-indicator';
    document.querySelector('.depth-select')?.appendChild(usageIndicatorEl);

    // Tabs
    tabs.forEach(tab => tab.addEventListener('click', () => activateTab(tab)));

    // Depth
    depthBtns.forEach(btn => btn.addEventListener('click', () => activateDepth(btn)));

    // Run — Enter in input or Cmd/Ctrl+Enter anywhere
    runBtn.addEventListener('click', runResearch);
    inputEl.addEventListener('keydown', e => { if (e.key === 'Enter') runResearch(); });
    document.addEventListener('keydown', e => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') runResearch(); });

    // Inspire Me
    inspireBtn.addEventListener('click', () => {
      const list = SUGGESTIONS[currentMode] || [];
      if (!list.length) return;
      inputEl.value = list[Math.floor(Math.random() * list.length)];
      inputEl.focus();
    });

    // Default: all unchecked
    document.querySelectorAll('#traditionCheckboxes input[type="checkbox"]').forEach(cb => {
      cb.checked = false;
      // Inject "New" badge if within 30 days of addedDate
      if (isNewTradition(cb.value)) {
        const badge = document.createElement('span');
        badge.className = 'new-badge';
        badge.textContent = 'new';
        cb.closest('label').appendChild(badge);
      }
    });

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

    // Featured cards — delegation (replaces inline onclick="loadFeatured(...)")
    const featuredCards = document.querySelector('.featured-cards');
    if (featuredCards) {
      featuredCards.addEventListener('click', (e) => {
        const btn = e.target.closest('.featured-load-btn');
        if (btn) loadFeatured(btn.dataset.featuredMode, btn.dataset.featuredQuery);
      });
    }

    // Tradition scope radios — delegation (replaces inline onchange="handleTraditionScope(this)")
    const traditionSelect = document.querySelector('.tradition-select');
    if (traditionSelect) {
      traditionSelect.addEventListener('change', (e) => {
        if (e.target.name === 'traditionScope') handleTraditionScope(e.target);
      });
    }

    // Init chips + indicator
    renderChips(currentMode);
    updateUsageIndicator();

    // Pre-fill from URL params: /research?mode=verse&q=John+3:16
    const params = new URLSearchParams(window.location.search);
    const qMode = params.get('mode');
    const qVal  = params.get('q');
    if (qVal) {
      if (qMode) {
        const matchTab = [...tabs].find(t => t.dataset.mode === qMode);
        if (matchTab) activateTab(matchTab);
      }
      inputEl.value = decodeURIComponent(qVal);
      renderChips(currentMode);
    }
  }

  document.addEventListener('DOMContentLoaded', init);

})();
