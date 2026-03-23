let _shareURL  = '';
let _shareText = '';

const TRADITION_SYMBOL = {
  Christianity: { sym: "✝", color: "#7F77DD" },
  Judaism:      { sym: "✡", color: "#1D9E75" },
  Islam:        { sym: "☪", color: "#378ADD" },
  Buddhism:     { sym: "☸", color: "#EF9F27" },
  Hinduism:     { sym: "ॐ", color: "#D85A30" },
  Taoism:       { sym: "☯", color: "#5DCAA5" },
  Sikhism:      { sym: "☬", color: "#D4537E" },
};

// ─── Cache helpers ───────────────────────────────────────────────────────────
function cacheKey(topic, religions) {
  return "mp_cache_" + topic.toLowerCase() + "__" + [...religions].sort().join(",");
}

function cacheGet(topic, religions) {
  try {
    const raw = localStorage.getItem(cacheKey(topic, religions));
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function cacheSave(topic, religions, data) {
  try {
    localStorage.setItem(cacheKey(topic, religions), JSON.stringify(data));
  } catch { /* storage full — silently skip */ }
}

// ─── Build cards (shared by live + cached paths) ──────────────────────────────
function buildCards(selected) {
  const columnsEl = document.getElementById("columns");
  const cgEl = document.getElementById("commonGround");
  const cards = {};

  for (const religion of selected) {
    const card = document.createElement("div");
    card.className = "column-card";
    const trad = TRADITION_SYMBOL[religion] || { sym: "✦", color: "#c8900e" };
    card.innerHTML = `
      <h2><span class="sym" style="color:${trad.color}">${trad.sym}</span> ${tr(religion)}</h2>
      <div class="content"></div>
    `;
    columnsEl.appendChild(card);
    cards[religion] = card.querySelector(".content");
  }

  cgEl.className = "common-ground";
  cgEl.innerHTML = `<h2>${t('commonGround')}</h2><div class="content"></div>`;

  return { cards, cgContent: cgEl.querySelector(".content") };
}

// ─── Render from cache ────────────────────────────────────────────────────────
function renderCached(topic, cached, selected) {
  document.getElementById("loading").classList.add("hidden");
  document.getElementById("results").classList.remove("hidden");

  const { cards, cgContent } = buildCards(selected);

  for (const religion of selected) {
    if (cards[religion]) cards[religion].textContent = cached.religions[religion] || "";
  }
  cgContent.textContent = cached.commonGround || "";
  showShareBar(topic, selected, cached);
  showTipJar();
}

// ─── Main compare ─────────────────────────────────────────────────────────────
async function compare() {
  const topic = document.getElementById("topic").value.trim();
  const selected = [
    ...document.querySelectorAll(".checkboxes input:checked"),
  ].map((cb) => cb.value);

  if (!topic) { alert(t('alertNoTopic')); return; }
  if (selected.length < 2) { alert(t('alertMinReligions')); return; }

  // Reset UI
  const btn = document.getElementById("compareBtn");
  btn.disabled = true;
  document.getElementById("loading").classList.remove("hidden");
  document.getElementById("results").classList.add("hidden");
  document.getElementById("columns").innerHTML = "";
  document.getElementById("commonGround").innerHTML = "";
  document.getElementById("shareBar")?.remove();

  // ── Cache hit ──
  const cached = cacheGet(topic, selected);
  if (cached) {
    console.log("[cache] HIT:", cacheKey(topic, selected));
    renderCached(topic, cached, selected);
    btn.disabled = false;
    return;
  }
  console.log("[cache] MISS — calling API");

  try {
    const { cards, cgContent } = buildCards(selected);
    // Add streaming cursors
    Object.values(cards).forEach(el => el.closest(".column-card").classList.add("streaming"));
    document.getElementById("commonGround").classList.add("streaming");

    document.getElementById("loading").classList.add("hidden");
    document.getElementById("results").classList.remove("hidden");

    const response = await fetch("/api/research", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic, religions: selected }),
    });

    if (!response.ok) throw new Error(`Server error: ${response.status}`);

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let currentSection = null;

    // Accumulate for cache
    const accumulated = { religions: {}, commonGround: "" };
    for (const r of selected) accumulated.religions[r] = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop();

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const raw = line.slice(6).trim();
        if (raw === "[DONE]") break;

        try {
          const { section, text } = JSON.parse(raw);

          if (section !== currentSection) {
            if (currentSection && cards[currentSection]) {
              cards[currentSection].closest(".column-card").classList.remove("streaming");
            }
            currentSection = section;
          }

          if (section === "COMMON_GROUND") {
            cgContent.textContent += text;
            accumulated.commonGround += text;
          } else if (cards[section]) {
            cards[section].textContent += text;
            accumulated.religions[section] += text;
          } else {
            console.warn("[SSE] Unknown section:", section, "| known:", Object.keys(cards));
          }
        } catch (e) {
          console.error("[SSE parse error]", e);
        }
      }
    }

    // Remove remaining streaming cursors
    document.querySelectorAll(".streaming").forEach(el => el.classList.remove("streaming"));

    // Save to cache and show share bar
    cacheSave(topic, selected, accumulated);
    console.log("[cache] saved:", cacheKey(topic, selected));
    showShareBar(topic, selected, accumulated);
  showTipJar();

  } catch (err) {
    document.getElementById("loading").classList.add("hidden");
    alert(t('alertError') + err.message);
  } finally {
    btn.disabled = false;
  }
}

// Allow Enter key to trigger compare
document.getElementById("topic").addEventListener("keydown", (e) => {
  if (e.key === "Enter") compare();
});

// ─── Share ────────────────────────────────────────────────────────────────────
function buildShareURL(topic, religions) {
  return window.location.origin
    + '/?topic=' + encodeURIComponent(topic)
    + '&traditions=' + encodeURIComponent(religions.join(','));
}

function buildShareText(topic, religions, accumulated, shareURL) {
  const syms = religions.map(r => TRADITION_SYMBOL[r]?.sym || '✦').join(' ');
  const cg   = (accumulated.commonGround || '').trim().replace(/\s+/g, ' ');
  const snippet = cg.length > 200 ? cg.slice(0, 197) + '…' : cg;
  return `${syms} on "${topic}"\n\n${snippet}\n\n✦ Many Paths ${shareURL} #interfaith`;
}

function showShareBar(topic, religions, accumulated) {
  document.getElementById('shareBar')?.remove();
  _shareURL  = buildShareURL(topic, religions);
  _shareText = buildShareText(topic, religions, accumulated, _shareURL);
  const encoded = encodeURIComponent(_shareText);

  const bar = document.createElement('div');
  bar.id = 'shareBar';
  bar.className = 'share-bar';
  bar.innerHTML = `
    <span class="share-label">Share</span>
    <button class="share-btn share-copy" onclick="copyShareLink(this)">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
      Copy Link
    </button>
    <a class="share-btn share-bluesky" href="https://bsky.app/intent/compose?text=${encoded}" target="_blank" rel="noopener noreferrer">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 360 320" fill="currentColor"><path d="M180 142c-16.3-31.7-60.7-90.8-102-120C38 0 0 4.7 0 55.3c0 19 10.7 80 18 91.7 8.7 13.7 27.3 17.3 46 14.7-20.3 9.3-56.3 29.3-56.3 71.3 0 40.7 38 62 76 44.3 17-8 31-17.3 44.3-32 13.3 14.7 27.3 24 44.3 32 38 17.7 76-3.6 76-44.3 0-42-36-62-56.3-71.3 18.7 2.6 37.3-1 46-14.7 7.3-11.7 18-72.7 18-91.7 0-50.6-38-55.3-78-122-41.3 29.2-85.7 88.3-102 120z"/></svg>
      Bluesky
    </a>
    <a class="share-btn share-x" href="https://twitter.com/intent/tweet?text=${encoded}" target="_blank" rel="noopener noreferrer">
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 300" fill="currentColor"><path d="M178.57 127.15 290.27 0h-26.46l-97.03 110.38L89.34 0H0l117.13 166.93L0 300.1h26.46l102.4-116.59 81.8 116.59h89.34M36.01 19.54H76.66l187.13 262.13h-40.66"/></svg>
      X
    </a>
  `;
  document.getElementById('results').appendChild(bar);
}

function copyShareLink(btn) {
  const orig = btn.innerHTML;
  const finish = () => {
    btn.textContent = 'Copied!';
    setTimeout(() => { btn.innerHTML = orig; }, 1500);
  };
  if (navigator.clipboard) {
    navigator.clipboard.writeText(_shareURL).then(finish).catch(finish);
  } else {
    const ta = document.createElement('textarea');
    ta.value = _shareURL;
    ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    finish();
  }
}

// ─── Tip jar ─────────────────────────────────────────────────────────────────

(function injectTipJarStyles() {
  const s = document.createElement('style');
  s.textContent = `
    .tip-jar {
      position: relative;
      background: linear-gradient(135deg,
        rgba(200,144,14,0.09) 0%,
        rgba(220,170,40,0.06) 100%);
      border: 1px solid rgba(200,144,14,0.3);
      border-radius: var(--radius);
      padding: 1rem 1.25rem 1rem 1.1rem;
      margin-top: 1.25rem;
      animation: fadeIn 0.4s ease;
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 0.65rem;
    }
    .tip-jar-msg {
      font-family: 'EB Garamond', Georgia, serif;
      font-size: 0.92rem;
      color: var(--text-muted);
      font-style: italic;
      flex: 1;
      min-width: 160px;
    }
    .tip-amounts {
      display: flex;
      gap: 0.4rem;
      flex-wrap: wrap;
    }
    .tip-btn {
      font-family: 'Josefin Sans', sans-serif;
      font-size: 0.72rem;
      font-weight: 600;
      letter-spacing: 1px;
      color: var(--accent);
      background: none;
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: 0.28rem 0.7rem;
      text-decoration: none;
      transition: border-color 0.15s, background 0.15s, color 0.15s;
      white-space: nowrap;
    }
    .tip-btn:hover {
      border-color: var(--accent2);
      background: rgba(200,144,14,0.1);
      color: var(--accent);
    }
    .tip-dismiss {
      position: absolute;
      top: 0.5rem; right: 0.6rem;
      background: none;
      border: none;
      font-size: 1rem;
      color: var(--text-muted);
      cursor: pointer;
      line-height: 1;
      padding: 0.1rem 0.25rem;
      opacity: 0.5;
      transition: opacity 0.15s;
    }
    .tip-dismiss:hover { opacity: 1; }
  `;
  document.head.appendChild(s);
}());

function showTipJar() {
  if (sessionStorage.getItem('mp_tip_shown')) return;
  document.getElementById('tipJar')?.remove();

  const jar = document.createElement('div');
  jar.id = 'tipJar';
  jar.className = 'tip-jar';
  jar.innerHTML = `
    <button class="tip-dismiss" aria-label="Dismiss" onclick="this.closest('.tip-jar').remove();sessionStorage.setItem('mp_tip_shown','1')">×</button>
    <span class="tip-jar-msg">Many Paths is free. If it helped you today, pay what you want.</span>
    <div class="tip-amounts">
      <a class="tip-btn" href="mailto:tip@manypaths.one?subject=Tip $3">$3</a>
      <a class="tip-btn" href="mailto:tip@manypaths.one?subject=Tip $5">$5</a>
      <a class="tip-btn" href="mailto:tip@manypaths.one?subject=Tip $10">$10</a>
      <a class="tip-btn" href="mailto:tip@manypaths.one?subject=Tip - other amount">Other</a>
    </div>`;

  document.getElementById('results').appendChild(jar);
  sessionStorage.setItem('mp_tip_shown', '1');
}

// ─── URL param auto-run ───────────────────────────────────────────────────────
(function initFromURL() {
  const params      = new URLSearchParams(window.location.search);
  const topicParam  = params.get('topic');
  if (!topicParam) return;

  document.getElementById('topic').value = topicParam;

  const traditionsParam = params.get('traditions');
  if (traditionsParam) {
    const requested = new Set(traditionsParam.split(',').map(s => s.trim()));
    document.querySelectorAll('.checkboxes input[type="checkbox"]').forEach(cb => {
      cb.checked = requested.has(cb.value);
    });
  }

  compare();
}());
