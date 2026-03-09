// F5 Share — canvas-rendered share image + Web Share API
// Renders a themed PNG of game results for native sharing.

function getThemeColors() {
  const s = getComputedStyle(document.body);
  return {
    bg:          s.getPropertyValue('--f5-bg').trim(),
    surface:     s.getPropertyValue('--f5-surface').trim(),
    border:      s.getPropertyValue('--f5-border').trim(),
    borderStrong:s.getPropertyValue('--f5-border-strong').trim(),
    text:        s.getPropertyValue('--f5-text').trim(),
    textBody:    s.getPropertyValue('--f5-text-body').trim(),
    textMuted:   s.getPropertyValue('--f5-text-muted').trim(),
    accent:      s.getPropertyValue('--f5-accent').trim(),
    valid:       s.getPropertyValue('--f5-valid').trim(),
    invalid:     s.getPropertyValue('--f5-invalid').trim(),
    fontHeading: s.getPropertyValue('--f5-font-heading').trim(),
    fontBody:    s.getPropertyValue('--f5-font-body').trim(),
    fontMono:    s.getPropertyValue('--f5-font-mono').trim(),
    fontUi:      s.getPropertyValue('--f5-font-ui').trim(),
    radius:      parseFloat(s.getPropertyValue('--f5-radius')) || 0,
    btnBg:       s.getPropertyValue('--f5-btn-bg').trim(),
    btnText:     s.getPropertyValue('--f5-btn-text').trim(),
    btnRadius:   parseFloat(s.getPropertyValue('--f5-btn-radius')) || 0,
  };
}

function roundRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

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

/**
 * Render a share image to a canvas and return it.
 * game = { score, validationResults, categories, letters, grid, difficulty }
 */
function renderShareImage(game) {
  const c = getThemeColors();
  const { score, validationResults: results, categories, letters, grid: answers } = game;
  const difficulty = game.difficulty || 'standard';

  // Layout constants
  const W = 720;
  const dotSize = 46;
  const dotGap = 10;
  const dotsWidth = 5 * dotSize + 4 * dotGap;  // 270
  const scoreGap = 14;
  const cardPad = 16;
  const cardRadius = Math.max(c.radius, 8);
  const nameFont = `500 21px ${c.fontBody}`;
  const nameLead = 26;
  const nameToDotsGap = 6;
  const catSpacing = 14;

  // Create offscreen canvas for measuring
  const canvas = document.createElement('canvas');
  canvas.width = W;
  const ctx = canvas.getContext('2d');

  // Measure category blocks
  ctx.font = nameFont;
  const innerWidth = dotsWidth + scoreGap + 36;
  const catBlocks = categories.map((cat, r) => {
    const name = cat.name || cat;
    const lines = wrapText(ctx, name, innerWidth);
    return {
      name,
      nameLines: lines,
      nameH: lines.length * nameLead,
      totalH: lines.length * nameLead + nameToDotsGap + dotSize,
    };
  });

  // Calculate total height
  const cardWidth = innerWidth + cardPad * 2;
  const gridH = catBlocks.reduce((s, b) => s + b.totalH + cardPad * 2, 0) + catSpacing * (catBlocks.length - 1);
  const headerH = 230;
  const headerGridGap = 32;
  const gridFooterGap = 28;
  const footerH = 65;
  const totalH = headerH + headerGridGap + gridH + gridFooterGap + footerH;

  // Set canvas height with padding
  const vertPad = 48;
  canvas.height = totalH + vertPad * 2;
  const H = canvas.height;

  // Re-acquire context after height change
  const cx = canvas.getContext('2d');

  let y = (H - totalH) / 2;
  const cardLeft = (W - cardWidth) / 2;
  const contentLeft = cardLeft + cardPad;

  // Background
  cx.fillStyle = c.bg;
  cx.fillRect(0, 0, W, H);

  // === HEADER ===
  cx.textAlign = 'center';

  // Brand
  y += 12;
  cx.fillStyle = c.textMuted;
  cx.font = `900 22px ${c.fontHeading}`;
  cx.letterSpacing = '3px';
  cx.fillText('FACTS IN FIVE', W / 2, y + 22);
  cx.letterSpacing = '0px';
  y += 36;

  // Score
  cx.fillStyle = c.text;
  cx.font = `900 110px ${c.fontHeading}`;
  cx.fillText(String(score.total), W / 2, y + 100);
  y += 118;

  // "out of 250"
  cx.fillStyle = c.textMuted;
  cx.font = `400 22px ${c.fontBody}`;
  cx.fillText('out of 250', W / 2, y + 18);
  y += 26;

  // "X of 25 correct · Easy/Standard"
  cx.fillStyle = c.textBody;
  cx.font = `500 20px ${c.fontUi}`;
  const diffLabel = difficulty === 'easy' ? 'Easy' : 'Standard';
  cx.fillText(`${score.validCount} of 25 correct  \u00b7  ${diffLabel}`, W / 2, y + 18);
  y += 32 + headerGridGap;

  // === GRID — SURFACE CARDS ===
  cx.textAlign = 'left';

  catBlocks.forEach((block, r) => {
    const cardH = block.totalH + cardPad * 2;

    // Card background
    cx.fillStyle = c.surface;
    roundRect(cx, cardLeft, y, cardWidth, cardH, cardRadius);
    cx.fill();

    // Card border
    cx.strokeStyle = c.border;
    cx.lineWidth = 1;
    roundRect(cx, cardLeft, y, cardWidth, cardH, cardRadius);
    cx.stroke();

    let cy = y + cardPad;

    // Category name
    cx.fillStyle = c.textBody;
    cx.font = nameFont;
    block.nameLines.forEach((line, i) => {
      cx.fillText(line, contentLeft, cy + (i + 1) * nameLead - 4);
    });
    cy += block.nameH + nameToDotsGap;

    // Dots with letters
    letters.forEach((l, col) => {
      const dx = contentLeft + col * (dotSize + dotGap);
      const answer = answers[r][col];
      const valid = results[r] && results[r][col] && results[r][col].valid;

      cx.fillStyle = !answer ? c.border : valid ? c.valid : c.invalid;
      cx.globalAlpha = !answer ? 0.3 : valid ? 1 : 0.75;
      roundRect(cx, dx, cy, dotSize, dotSize, Math.min(c.radius, 6));
      cx.fill();
      cx.globalAlpha = 1;

      cx.fillStyle = '#fff';
      cx.font = `700 21px ${c.fontHeading}`;
      cx.textAlign = 'center';
      cx.fillText(l, dx + dotSize / 2, cy + dotSize / 2 + 7);
      cx.textAlign = 'left';
    });

    // Row score
    cx.fillStyle = c.textMuted;
    cx.font = `400 18px ${c.fontBody}`;
    cx.fillText(String(score.rowScores[r]), contentLeft + dotsWidth + scoreGap, cy + dotSize / 2 + 6);

    y += cardH + catSpacing;
  });

  y += gridFooterGap - catSpacing;

  // === FOOTER ===
  cx.textAlign = 'center';

  cx.fillStyle = c.border;
  cx.fillRect(W / 2 - 40, y, 80, 1);
  y += 23;

  cx.fillStyle = c.accent;
  cx.font = `700 22px ${c.fontUi}`;
  cx.fillText('Play F5', W / 2, y);
  y += 22;

  cx.fillStyle = c.textMuted;
  cx.font = `400 15px ${c.fontMono}`;
  cx.fillText('randomjword.github.io/f5', W / 2, y);

  return canvas;
}

/**
 * Share game results via Web Share API (image + link) or download fallback.
 */
async function shareGame(game) {
  const canvas = renderShareImage(game);
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  const file = new File([blob], 'f5-score.png', { type: 'image/png' });

  const shareData = {
    files: [file],
    text: `F5 \u2014 ${game.score.total}/250\nrandomjword.github.io/f5`,
    url: 'https://randomjword.github.io/f5',
  };

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share(shareData);
      return true;
    } catch (e) {
      if (e.name === 'AbortError') return false;
      console.error('[F5 Share]', e);
    }
  }

  // Fallback: download the image
  const a = document.createElement('a');
  a.href = canvas.toDataURL('image/png');
  a.download = 'f5-score.png';
  a.click();
  return true;
}

export { shareGame };
