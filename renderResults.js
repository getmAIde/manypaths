// renderResults.js — BridgeMAIde
// Fixes empty cards bug by correctly mapping API response to UI
// Drop this into your project and call renderResults(data) from app.js

const TRADITIONS = [
  'christianity',
  'judaism',
  'islam',
  'buddhism',
  'hinduism',
  'taoism',
  'sikhism',
];

const TRADITION_LABELS = {
  christianity: 'Christianity',
  judaism: 'Judaism',
  islam: 'Islam',
  buddhism: 'Buddhism',
  hinduism: 'Hinduism',
  taoism: 'Taoism',
  sikhism: 'Sikhism',
};

const TRADITION_COLORS = {
  christianity: '#7F77DD',
  judaism: '#1D9E75',
  islam: '#378ADD',
  buddhism: '#EF9F27',
  hinduism: '#D85A30',
  taoism: '#5DCAA5',
  sikhism: '#D4537E',
};

export function renderResults(data) {
  const container = document.getElementById('results');
  if (!container) {
    console.error('[renderResults] No #results element found in DOM');
    return;
  }

  // Validate response shape
  if (!data || !data.religions || !data.commonGround) {
    console.error('[renderResults] Unexpected response shape:', data);
    container.innerHTML = '<p class="error">Something went wrong. Please try again.</p>';
    return;
  }

  // Clear previous results
  container.innerHTML = '';

  // Render tradition cards
  const grid = document.createElement('div');
  grid.className = 'traditions-grid';

  TRADITIONS.forEach((tradition) => {
    const religionData = data.religions[tradition];

    if (!religionData) {
      console.warn(`[renderResults] No data for tradition: ${tradition}`);
      return;
    }

    // Expected path: data.religions[tradition].teaching
    const teaching = religionData.teaching || 'No teaching found.';
    const scripture = religionData.scripture || '';
    const summary = religionData.summary || '';

    const card = document.createElement('div');
    card.className = 'tradition-card';
    card.style.borderTopColor = TRADITION_COLORS[tradition] || '#888';

    card.innerHTML = `
      <h3 class="tradition-name">${TRADITION_LABELS[tradition]}</h3>
      ${scripture ? `<p class="tradition-scripture">${scripture}</p>` : ''}
      <p class="tradition-teaching">${teaching}</p>
      ${summary ? `<p class="tradition-summary">${summary}</p>` : ''}
    `;

    grid.appendChild(card);
  });

  container.appendChild(grid);

  // Render common ground bridge
  // Expected path: data.commonGround.bridge
  if (data.commonGround.bridge) {
    const bridge = document.createElement('div');
    bridge.className = 'common-ground';

    bridge.innerHTML = `
      <h2 class="common-ground-title">Common Ground</h2>
      <p class="common-ground-bridge">${data.commonGround.bridge}</p>
      ${data.commonGround.themes
        ? `<ul class="common-ground-themes">
            ${data.commonGround.themes.map(t => `<li>${t}</li>`).join('')}
           </ul>`
        : ''}
    `;

    container.appendChild(bridge);
  }

  console.log('[renderResults] Rendered', TRADITIONS.length, 'tradition cards');
}

// Debug helper — call this if cards are empty to inspect raw response
export function debugResults(data) {
  console.group('[renderResults] Debug');
  console.log('Full response:', JSON.stringify(data, null, 2));
  TRADITIONS.forEach((t) => {
    const teaching = data?.religions?.[t]?.teaching;
    console.log(`${t}: teaching =`, teaching || 'MISSING');
  });
  console.log('commonGround.bridge:', data?.commonGround?.bridge || 'MISSING');
  console.groupEnd();
}
