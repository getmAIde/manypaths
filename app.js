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
function renderCached(cached, selected) {
  document.getElementById("loading").classList.add("hidden");
  document.getElementById("results").classList.remove("hidden");

  const { cards, cgContent } = buildCards(selected);

  for (const religion of selected) {
    if (cards[religion]) cards[religion].textContent = cached.religions[religion] || "";
  }
  cgContent.textContent = cached.commonGround || "";
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

  // ── Cache hit ──
  const cached = cacheGet(topic, selected);
  if (cached) {
    console.log("[cache] HIT:", cacheKey(topic, selected));
    renderCached(cached, selected);
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

    // Save to cache
    cacheSave(topic, selected, accumulated);
    console.log("[cache] saved:", cacheKey(topic, selected));

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
