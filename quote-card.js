// quote-card.js
// Generates a 1080x1080 PNG quote card using Canvas API.
// Shared by app.js (Compare) and research-ui.js (Research).

window.QuoteCard = (function () {
  const W = 1080, H = 1080;
  const PAD = 64;
  const BG      = '#130d04';
  const GOLD    = '#c8900e';
  const MUTED   = '#9e8860';
  const FG      = '#f5edd8';

  function wrapText(ctx, text, maxWidth) {
    const words = text.split(' ');
    const lines = [];
    let line = '';
    for (const word of words) {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width > maxWidth && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    if (line) lines.push(line);
    return lines;
  }

  function draw(quote, label, topic) {
    const canvas = document.createElement('canvas');
    canvas.width  = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);

    // Outer gold border
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 3;
    ctx.strokeRect(PAD, PAD, W - PAD * 2, H - PAD * 2);

    // Inner hairline
    ctx.strokeStyle = 'rgba(200,144,14,0.22)';
    ctx.lineWidth = 1;
    ctx.strokeRect(PAD + 14, PAD + 14, W - (PAD + 14) * 2, H - (PAD + 14) * 2);

    // Label (tradition or "Common Ground")
    const labelText = (label || topic || 'Many Paths').toUpperCase();
    ctx.font = '600 28px "Helvetica Neue", Arial, sans-serif';
    ctx.fillStyle = GOLD;
    ctx.textAlign = 'center';
    ctx.fillText(labelText, W / 2, PAD + 82);

    // Top divider
    ctx.strokeStyle = 'rgba(200,144,14,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(W/2 - 70, PAD + 106); ctx.lineTo(W/2 + 70, PAD + 106); ctx.stroke();

    // Quote — italic serif, wrapped
    const displayQuote = quote.length > 280 ? quote.slice(0, 277) + '…' : quote;
    const maxW = W - PAD * 2 - 80;
    ctx.font = 'italic 40px Georgia, "Times New Roman", serif';
    ctx.fillStyle = FG;
    ctx.textAlign = 'center';
    const lines = wrapText(ctx, `\u201C${displayQuote}\u201D`, maxW);
    const lineH = 60;
    let y = H / 2 - (lines.length * lineH) / 2 + lineH * 0.4;
    for (const ln of lines) { ctx.fillText(ln, W / 2, y); y += lineH; }

    // Topic line (if label and topic are different)
    if (topic && label && label.toLowerCase() !== topic.toLowerCase()) {
      ctx.font = '300 24px "Helvetica Neue", Arial, sans-serif';
      ctx.fillStyle = MUTED;
      ctx.fillText(`on \u201C${topic}\u201D`, W / 2, y + 18);
    }

    // Bottom divider
    ctx.strokeStyle = 'rgba(200,144,14,0.35)';
    ctx.lineWidth = 1;
    const botY = H - PAD - 88;
    ctx.beginPath(); ctx.moveTo(W/2 - 70, botY); ctx.lineTo(W/2 + 70, botY); ctx.stroke();

    // Brand
    ctx.font = '600 26px "Helvetica Neue", Arial, sans-serif';
    ctx.fillStyle = GOLD;
    ctx.fillText('MANY PATHS', W / 2, H - PAD - 52);
    ctx.font = '300 21px "Helvetica Neue", Arial, sans-serif';
    ctx.fillStyle = MUTED;
    ctx.fillText('manypaths.one', W / 2, H - PAD - 22);

    return canvas;
  }

  function download(quote, label, topic) {
    const canvas = draw(quote, label, topic);
    const slug = (label || topic || 'quote').toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 30);
    canvas.toBlob(blob => {
      const url = URL.createObjectURL(blob);
      const a = Object.assign(document.createElement('a'), {
        href: url,
        download: `manypaths-${slug}.png`,
      });
      a.click();
      URL.revokeObjectURL(url);
    }, 'image/png');
  }

  return { download };
})();
