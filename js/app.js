// F5 — App Entry Point
// Init, screen routing, event wiring

import * as storage from './modules/storage.js';
import * as themeManager from './modules/theme-manager.js';
import * as grid from './modules/grid.js';
import { createTimer, formatTime } from './modules/timer.js';
import { newGame, calculateScore } from './modules/game-engine.js';
import { validate, appeal } from './modules/validator.js';
import { compute as computeStats } from './modules/stats.js';
import { hasProxy } from './modules/claude-api.js';

// Screen IDs
const SCREENS = ['setup', 'menu', 'play', 'validating', 'results', 'stats', 'settings'];

let currentScreen = null;
let activeTimer = null;
let activeGame = null;
let lastAnnouncedSeconds = null;

function init() {
  themeManager.init();

  // One-time cache clear for prompt v2 upgrade
  if (!storage.get('cache_v9')) {
    storage.clearCache();
    storage.set('cache_v9', true);
  }

  // Check for crash recovery
  const savedGame = storage.getGameState();
  if (savedGame && savedGame.status === 'validating') {
    // TODO: Re-submit validation in S4
    storage.clearGameState();
  }

  // Setup screen: show invite code form if proxy is configured
  initSetupForms();


  // Route to appropriate screen
  const authMode = storage.getAuthMode();
  if (!authMode) {
    showScreen('setup');
  } else {
    showScreen('menu');
  }

  bindGlobalEvents();
}

function showScreen(screenId) {
  SCREENS.forEach(id => {
    const el = document.getElementById(`screen-${id}`);
    if (el) {
      el.classList.toggle('active', id === screenId);
    }
  });
  currentScreen = screenId;

  // Allow pull-to-refresh on home screen only
  document.documentElement.style.overscrollBehaviorY = screenId === 'menu' ? 'auto' : 'none';

  // Hide kebab menu on settings screen
  const headerSettings = document.getElementById('btn-header-settings');
  if (headerSettings) {
    headerSettings.style.display = screenId === 'settings' ? 'none' : '';
  }
}

function initSetupForms() {
  const inviteForm = document.getElementById('setup-form-invite');
  const apikeyForm = document.getElementById('setup-form-apikey');
  const showApikeyBtn = document.getElementById('btn-show-apikey');
  const showInviteBtn = document.getElementById('btn-show-invite');
  const showInviteWrap = document.getElementById('btn-show-invite-wrap');

  if (hasProxy()) {
    // Proxy configured: show invite code form as primary
    inviteForm.style.display = '';
    apikeyForm.style.display = 'none';
    showInviteWrap.style.display = '';

    showApikeyBtn.addEventListener('click', () => {
      inviteForm.style.display = 'none';
      apikeyForm.style.display = '';
    });

    showInviteBtn.addEventListener('click', () => {
      apikeyForm.style.display = 'none';
      inviteForm.style.display = '';
    });
  }
  // If no proxy, API key form is already visible by default

  // Invite code submission
  inviteForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const code = document.getElementById('invite-code-input').value.trim();
    if (code) {
      storage.setInviteCode(code);
      storage.setApiKey(''); // clear any old API key
      showScreen('menu');
    }
  });

  // API key submission
  apikeyForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const key = document.getElementById('api-key-input').value.trim();
    if (key) {
      storage.setApiKey(key);
      storage.setInviteCode(''); // clear any old invite code
      showScreen('menu');
    }
  });
}


function bindGlobalEvents() {

  // Menu — new game
  const newGameBtn = document.getElementById('btn-new-game');
  if (newGameBtn) {
    newGameBtn.addEventListener('click', () => {
      startNewGame();
    });
  }

  // Menu — stats
  const statsBtn = document.getElementById('btn-stats');
  if (statsBtn) {
    statsBtn.addEventListener('click', () => {
      renderStats();
      showScreen('stats');
    });
  }

  // Menu — settings
  const settingsBtn = document.getElementById('btn-settings');
  if (settingsBtn) {
    settingsBtn.addEventListener('click', () => {
      showScreen('settings');
    });
  }

  // Settings — theme selector
  const themeSelect = document.getElementById('theme-select');
  if (themeSelect) {
    populateThemeSelect(themeSelect);
    themeSelect.addEventListener('change', (e) => {
      themeManager.apply(e.target.value);
      // Re-mark active
      populateThemeSelect(themeSelect);
    });
  }

  // Back buttons
  document.querySelectorAll('[data-navigate]').forEach(btn => {
    btn.addEventListener('click', () => {
      showScreen(btn.dataset.navigate);
    });
  });

  // Submit early
  const submitBtn = document.getElementById('btn-submit-early');
  if (submitBtn) {
    submitBtn.addEventListener('click', () => {
      if (activeTimer) activeTimer.stop();
      onTimeUp();
    });
  }

  // Results — view stats
  const resultsStatsBtn = document.getElementById('btn-results-stats');
  if (resultsStatsBtn) {
    resultsStatsBtn.addEventListener('click', () => {
      renderStats();
      showScreen('stats');
    });
  }

}

function populateThemeSelect(select) {
  const themes = themeManager.getThemeList();
  select.innerHTML = themes.map(t =>
    `<option value="${t.id}" ${t.active ? 'selected' : ''}>${t.label}</option>`
  ).join('');
}

function startNewGame() {
  // Stop any existing timer
  if (activeTimer) activeTimer.stop();

  // Create game state
  activeGame = newGame();

  const gridContainer = document.getElementById('game-grid');
  grid.render(gridContainer, activeGame.categories, activeGame.letters);
  showScreen('play');

  // Reset timer display
  const digits = document.getElementById('timer-digits');
  const bar = document.getElementById('timer-bar');
  const announce = document.getElementById('timer-announce');
  lastAnnouncedSeconds = null;

  // Remove urgency classes
  digits.classList.remove('f5-timer--warning', 'f5-timer--critical');

  activeTimer = createTimer(activeGame.duration, (tick) => {
    // Update digits
    digits.textContent = formatTime(tick.seconds);

    // Update progress bar
    bar.style.width = (tick.fraction * 100) + '%';

    // Urgency classes
    digits.classList.toggle('f5-timer--warning', tick.isWarning);
    digits.classList.toggle('f5-timer--critical', tick.isCritical);

    // Accessible announcements at key intervals (not every second)
    if (announce && tick.seconds !== lastAnnouncedSeconds) {
      lastAnnouncedSeconds = tick.seconds;
      if (tick.seconds === 240 || tick.seconds === 180 || tick.seconds === 120 ||
          tick.seconds === 60 || tick.seconds === 30 || tick.seconds === 15 ||
          tick.seconds === 10 || tick.seconds <= 5) {
        announce.textContent = formatTime(tick.seconds) + ' remaining';
      }
    }
  }, () => {
    // Timer expired
    onTimeUp();
  });

  requestAnimationFrame(() => grid.focusFirst());
}

async function onTimeUp() {
  grid.lock();
  activeGame.grid = grid.getAnswers();
  activeGame.status = 'validating';

  // Save state for crash recovery (ADR-011)
  storage.saveGameState(activeGame);

  showScreen('validating');

  const results = await validate(
    activeGame.grid,
    activeGame.categories,
    activeGame.letters
  );

  storage.clearGameState();

  if (!results) {
    // API failed — TODO: self-scoring fallback in future
    activeGame.status = 'abandoned';
    alert('Validation failed — could not reach the AI judge. Returning to menu.');
    showScreen('menu');
    return;
  }

  activeGame.status = 'scored';
  activeGame.validationResults = results;
  activeGame.score = calculateScore(results);

  // Save for review from stats screen
  storage.setLastGame(activeGame);

  // Save to history
  storage.addToHistory({
    id: activeGame.id,
    categories: activeGame.categories.map(c => c.name),
    letters: activeGame.letters,
    grid: activeGame.grid,
    results,
    score: activeGame.score,
    date: Date.now(),
  });

  try {
    showResults(activeGame);
  } catch (err) {
    console.error('[F5] showResults error:', err);
    alert('Error displaying results: ' + err.message);
    showScreen('menu');
  }
}

function showResults(game, animate = true) {
  const { score, validationResults, categories, letters, grid: answers } = game;

  // Score starts at 0 if animating, final value if re-rendering (appeal)
  const totalEl = document.getElementById('results-total');
  const subtitleEl = document.getElementById('results-subtitle');
  totalEl.textContent = animate ? '0' : score.total;
  subtitleEl.textContent = animate
    ? 'Revealing answers...'
    : `${score.validCount} of 25 correct — ${score.total} of ${score.max} points`;

  // Breakdown — hidden during animation, shown after
  const breakdown = document.getElementById('results-breakdown');
  breakdown.style.opacity = animate ? '0' : '1';
  breakdown.innerHTML = `
    <div>
      <div style="font-size: var(--f5-text-xl); font-weight: var(--f5-weight-bold);">${score.general}</div>
      <div style="font-size: var(--f5-text-xs); color: var(--f5-text-muted); text-transform: uppercase;">General (rows)</div>
    </div>
    <div>
      <div style="font-size: var(--f5-text-xl); font-weight: var(--f5-weight-bold);">${score.special}</div>
      <div style="font-size: var(--f5-text-xs); color: var(--f5-text-muted); text-transform: uppercase;">Special (columns)</div>
    </div>
  `;

  // Render both desktop grid and mobile cards (CSS toggles visibility)
  renderResultsGrid(game, animate);
  renderResultsCards(game);

  showScreen('results');

  // Desktop cell-by-cell reveal animation
  if (animate) {
    const resultsGrid = document.getElementById('results-grid');
    const resultCells = resultsGrid.querySelectorAll('.f5-result-cell');
    let runningScore = 0;
    const revealOrder = [];

    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 5; c++) {
        const idx = r * 5 + c;
        revealOrder.push({ cell: resultCells[idx], r, c });
      }
    }

    revealOrder.forEach(({ cell, r, c }, i) => {
      const delay = 120 * i;
      const result = validationResults[r][c];
      const answer = answers[r][c];

      setTimeout(() => {
        cell.style.opacity = '1';
        cell.style.background = result.valid
          ? 'rgba(45,106,45,0.15)'
          : answer ? 'rgba(200,16,46,0.12)' : 'transparent';

        setTimeout(() => {
          cell.style.background = result.valid
            ? 'rgba(45,106,45,0.08)'
            : answer ? 'rgba(200,16,46,0.06)' : 'transparent';
        }, 200);

        if (result.valid) {
          runningScore++;
          totalEl.textContent = runningScore;
        }

        if (i === revealOrder.length - 1) {
          setTimeout(() => {
            animateScore(totalEl, score.total);
            subtitleEl.textContent = `${score.validCount} of 25 correct — ${score.total} of ${score.max} points`;
            breakdown.style.opacity = '1';
            breakdown.style.transition = 'opacity 0.4s ease';
          }, 300);
        }
      }, delay);
    });

    // Mobile: just animate the score (no cell reveal)
    setTimeout(() => {
      animateScore(totalEl, score.total);
      subtitleEl.textContent = `${score.validCount} of 25 correct — ${score.total} of ${score.max} points`;
      breakdown.style.opacity = '1';
      breakdown.style.transition = 'opacity 0.4s ease';
    }, 400);
  }
}

function renderResultsGrid(game, animate) {
  const { score, validationResults, categories, letters, grid: answers } = game;
  const resultsGrid = document.getElementById('results-grid');
  resultsGrid.innerHTML = '';

  const corner = document.createElement('div');
  corner.className = 'f5-grid__corner';
  resultsGrid.appendChild(corner);

  letters.forEach((letter, c) => {
    const header = document.createElement('div');
    header.className = 'f5-grid__letter-header';
    header.innerHTML = `${letter}<br><span style="font-size:var(--f5-text-xs);color:var(--f5-text-muted)">${score.colTotals[c]}×${score.colTotals[c]} = ${score.colScores[c]}</span>`;
    resultsGrid.appendChild(header);
  });

  categories.forEach((cat, r) => {
    const catHeader = document.createElement('div');
    catHeader.className = 'f5-grid__category-header';
    catHeader.innerHTML = `
      <div>
        <div>${cat.name}</div>
        <div style="font-size:var(--f5-text-xs);color:var(--f5-text-muted)">${score.rowTotals[r]}×${score.rowTotals[r]} = ${score.rowScores[r]}</div>
      </div>`;
    resultsGrid.appendChild(catHeader);

    const rejectedCells = [];

    letters.forEach((letter, c) => {
      const result = validationResults[r][c];
      const answer = answers[r][c];
      const cell = document.createElement('div');
      cell.className = 'f5-grid__cell f5-result-cell';
      cell.dataset.row = r;
      cell.dataset.col = c;
      cell.style.padding = 'var(--f5-space-xs) var(--f5-space-sm)';
      cell.style.display = 'flex';
      cell.style.flexDirection = 'column';
      cell.style.justifyContent = 'center';
      cell.style.transition = 'background 0.3s ease, opacity 0.3s ease';

      if (animate && !result.appealed) {
        cell.style.opacity = '0';
        cell.style.background = 'var(--f5-grid-cell-bg)';
      } else {
        cell.style.background = result.valid
          ? 'rgba(45,106,45,0.08)'
          : answer ? 'rgba(200,16,46,0.06)' : 'transparent';
      }

      const answerEl = document.createElement('div');
      answerEl.style.fontSize = 'var(--f5-text-sm)';
      answerEl.style.fontWeight = 'var(--f5-weight-medium)';
      answerEl.textContent = answer || '—';

      const badge = document.createElement('div');
      badge.style.fontSize = 'var(--f5-text-xs)';
      badge.style.marginTop = '2px';
      badge.style.lineHeight = '1.4';
      badge.style.wordBreak = 'break-word';
      if (result.valid) {
        badge.style.color = 'var(--f5-valid)';
        badge.textContent = result.canonical || 'Valid';
      } else if (answer) {
        badge.style.color = 'var(--f5-invalid)';
        badge.textContent = result.appealed ? 'Appeal denied' : 'Invalid';
      } else {
        badge.style.color = 'var(--f5-text-muted)';
        badge.textContent = 'Empty';
      }

      cell.appendChild(answerEl);
      cell.appendChild(badge);

      if (!result.valid && answer && !result.appealed) {
        const appealBtn = document.createElement('button');
        appealBtn.textContent = 'Appeal';
        appealBtn.style.cssText = `
          font-size: var(--f5-text-xs);
          color: var(--f5-accent);
          background: none;
          border: 1px solid var(--f5-accent);
          border-radius: var(--f5-radius-sm);
          padding: 1px 6px;
          margin-top: 3px;
          cursor: pointer;
          font-family: var(--f5-font-ui);
        `;
        appealBtn.addEventListener('click', async () => {
          appealBtn.disabled = true;
          appealBtn.textContent = 'Reviewing...';
          const newResult = await appeal(cat.name, letter, answer);
          if (newResult) {
            game.validationResults[r][c] = newResult;
            game.score = calculateScore(game.validationResults);
            storage.setLastGame(game);
            showResults(game, false);
          } else {
            appealBtn.textContent = 'Error — retry';
            appealBtn.disabled = false;
          }
        });
        cell.appendChild(appealBtn);
      }

      if (result.appealed && result.valid) {
        const overturnedEl = document.createElement('div');
        overturnedEl.style.fontSize = 'var(--f5-text-xs)';
        overturnedEl.style.color = 'var(--f5-valid)';
        overturnedEl.style.fontStyle = 'italic';
        overturnedEl.textContent = 'Overturned on appeal';
        cell.appendChild(overturnedEl);
      }

      if (!result.valid && answer && result.explanation) {
        rejectedCells.push({ letter, answer, explanation: result.explanation });
      }

      resultsGrid.appendChild(cell);
    });

    for (const da of rejectedCells) {
      const spacer = document.createElement('div');
      spacer.style.cssText = `
        background: var(--f5-grid-header-bg);
        border-right: var(--f5-border-width) solid var(--f5-grid-cell-border);
        border-bottom: var(--f5-border-width) solid var(--f5-grid-cell-border);
      `;
      resultsGrid.appendChild(spacer);

      const explRow = document.createElement('div');
      explRow.style.cssText = `
        grid-column: span 5;
        padding: var(--f5-space-sm) var(--f5-space-md);
        font-size: var(--f5-text-xs);
        line-height: 1.5;
        color: var(--f5-text-muted);
        background: var(--f5-grid-cell-bg);
        border-bottom: var(--f5-border-width) solid var(--f5-grid-cell-border);
        border-left: 3px solid var(--f5-invalid);
      `;
      explRow.innerHTML = `<span style="color:var(--f5-invalid);font-weight:var(--f5-weight-bold);">${da.letter}: ${escapeHtml(da.answer)}</span> — ${escapeHtml(da.explanation)}`;
      resultsGrid.appendChild(explRow);
    }
  });
}

function renderResultsCards(game) {
  const { score, validationResults, categories, letters, grid: answers } = game;
  const container = document.getElementById('results-cards');
  container.innerHTML = '';

  categories.forEach((cat, r) => {
    const card = document.createElement('div');
    card.className = 'f5-results-card';

    const header = document.createElement('div');
    header.className = 'f5-results-card__header';
    header.innerHTML = `
      <div class="f5-results-card__category">${escapeHtml(cat.name)}</div>
      <div class="f5-results-card__score">${score.rowTotals[r]}×${score.rowTotals[r]} = ${score.rowScores[r]}</div>
    `;
    card.appendChild(header);

    letters.forEach((letter, c) => {
      const result = validationResults[r][c];
      const answer = answers[r][c];

      const row = document.createElement('div');
      row.className = 'f5-results-card__row';
      if (!answer) row.classList.add('f5-results-card__row--empty');
      else if (result.valid) row.classList.add('f5-results-card__row--valid');
      else row.classList.add('f5-results-card__row--invalid');

      // Letter badge
      const letterEl = document.createElement('div');
      letterEl.className = 'f5-results-card__letter';
      letterEl.textContent = letter;
      row.appendChild(letterEl);

      // Content
      const content = document.createElement('div');
      content.className = 'f5-results-card__content';

      const answerEl = document.createElement('div');
      answerEl.className = 'f5-results-card__answer';
      answerEl.textContent = answer || '\u2014';
      content.appendChild(answerEl);

      const status = document.createElement('div');
      status.className = 'f5-results-card__status';
      if (result.valid) {
        status.style.color = 'var(--f5-valid)';
        if (result.appealed) {
          status.textContent = result.canonical ? `${result.canonical} \u2014 Overturned on appeal` : 'Overturned on appeal';
        } else {
          status.textContent = result.canonical || 'Valid';
        }
      } else if (answer) {
        status.style.color = 'var(--f5-invalid)';
        status.textContent = result.appealed ? 'Appeal denied' : 'Invalid';
      } else {
        status.style.color = 'var(--f5-text-muted)';
        status.textContent = 'Empty';
      }
      content.appendChild(status);

      // Explanation for rejected answers (including appeal denied)
      if (!result.valid && answer && result.explanation) {
        const expl = document.createElement('div');
        expl.className = 'f5-results-card__explanation';
        expl.textContent = result.explanation;
        content.appendChild(expl);
      }

      // Appeal button
      if (!result.valid && answer && !result.appealed) {
        const appealBtn = document.createElement('button');
        appealBtn.textContent = 'Appeal';
        appealBtn.style.cssText = `
          font-size: var(--f5-text-xs);
          color: var(--f5-accent);
          background: none;
          border: 1px solid var(--f5-accent);
          border-radius: var(--f5-radius-sm);
          padding: 2px 10px;
          margin-top: var(--f5-space-xs);
          cursor: pointer;
          font-family: var(--f5-font-ui);
        `;
        appealBtn.addEventListener('click', async () => {
          appealBtn.disabled = true;
          appealBtn.textContent = 'Reviewing...';
          const newResult = await appeal(cat.name, letter, answer);
          if (newResult) {
            game.validationResults[r][c] = newResult;
            game.score = calculateScore(game.validationResults);
            storage.setLastGame(game);
            showResults(game, false);
          } else {
            appealBtn.textContent = 'Error — retry';
            appealBtn.disabled = false;
          }
        });
        content.appendChild(appealBtn);
      }

      row.appendChild(content);

      // Checkmark / X icon
      const icon = document.createElement('div');
      icon.className = 'f5-results-card__icon';
      if (answer) {
        const circle = document.createElement('div');
        circle.className = 'f5-results-card__icon-circle';
        if (result.valid) {
          circle.classList.add('f5-results-card__icon-circle--valid');
          circle.textContent = '\u2713';
        } else {
          circle.classList.add('f5-results-card__icon-circle--invalid');
          circle.textContent = '\u2717';
        }
        icon.appendChild(circle);
      }
      row.appendChild(icon);

      card.appendChild(row);
    });

    container.appendChild(card);
  });
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function animateScore(el, target) {
  const duration = 600;
  const start = performance.now();
  const from = parseInt(el.textContent) || 0;

  function tick(now) {
    const progress = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
    el.textContent = Math.round(from + (target - from) * eased);
    if (progress < 1) requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}


function renderStats() {
  const container = document.getElementById('stats-content');
  const stats = computeStats();

  if (!stats) {
    container.innerHTML = '<p style="color: var(--f5-text-muted);">No games played yet.</p>';
    return;
  }

  // Hero high score
  let html = `<div class="f5-card f5-stat-card f5-stat-hero">
      <div class="f5-stat-value">${stats.bestScore}</div>
      <div class="f5-stat-label">High Score</div>
    </div>
    <div class="f5-stats-cards" style="margin-top: var(--f5-space-md);">
    <div class="f5-card f5-stat-card">
      <div class="f5-stat-value">${stats.avgScore}</div>
      <div class="f5-stat-label">Average</div>
    </div>
    <div class="f5-card f5-stat-card">
      <div class="f5-stat-value">${stats.streak}</div>
      <div class="f5-stat-label">Streak</div>
    </div>
  </div>`;

  // Score trend (sparkline bar chart)
  if (stats.recent.length > 1) {
    const max = 250;
    html += `<div class="f5-card" style="margin-top: var(--f5-space-lg);">
      <div class="f5-stat-label" style="margin-bottom: var(--f5-space-md);">Score History</div>
      <div class="f5-sparkline">
        ${stats.recent.map(g => {
          const pct = Math.max((g.score.total / max) * 100, 2);
          return `<div class="f5-sparkline__bar" style="height: ${pct}%" title="${g.score.total} pts"></div>`;
        }).join('')}
      </div>
    </div>`;
  }

  // Best/worst categories
  if (stats.bestCategories.length > 0) {
    html += `<div class="f5-card" style="margin-top: var(--f5-space-lg);">
      <div class="f5-stat-label" style="margin-bottom: var(--f5-space-sm);">Best Categories</div>
      ${stats.bestCategories.map(c =>
        `<div class="f5-stat-row">
          <span>${c.name}</span>
          <span style="color: var(--f5-valid); font-weight: var(--f5-weight-bold);">${Math.round(c.rate * 100)}%</span>
        </div>`
      ).join('')}
    </div>`;

    if (stats.worstCategories.length > 0 && stats.worstCategories[0].rate < 1) {
      html += `<div class="f5-card" style="margin-top: var(--f5-space-md);">
        <div class="f5-stat-label" style="margin-bottom: var(--f5-space-sm);">Toughest Categories</div>
        ${stats.worstCategories.map(c =>
          `<div class="f5-stat-row">
            <span>${c.name}</span>
            <span style="color: var(--f5-invalid); font-weight: var(--f5-weight-bold);">${Math.round(c.rate * 100)}%</span>
          </div>`
        ).join('')}
      </div>`;
    }
  }

  // Letter performance
  if (stats.letterEntries.length > 0) {
    html += `<div class="f5-card" style="margin-top: var(--f5-space-md);">
      <div class="f5-stat-label" style="margin-bottom: var(--f5-space-sm);">Letters</div>
      <div class="f5-letter-grid">
        ${stats.letterEntries.map(l => {
          const pct = Math.round(l.rate * 100);
          const color = pct >= 70 ? 'var(--f5-valid)' : pct >= 40 ? 'var(--f5-text-muted)' : 'var(--f5-invalid)';
          return `<div class="f5-letter-stat">
            <div style="font-weight: var(--f5-weight-bold);">${l.letter}</div>
            <div style="font-size: var(--f5-text-xs); color: ${color};">${pct}%</div>
          </div>`;
        }).join('')}
      </div>
    </div>`;
  }

  // Recent games list
  const lastGame = storage.getLastGame();
  html += `<div style="margin-top: var(--f5-space-xl);">
    <div class="f5-stat-label" style="margin-bottom: var(--f5-space-md);">Recent Games</div>
    ${lastGame ? `<button class="f5-btn f5-btn--outline" id="btn-review-last" style="width: 100%; margin-bottom: var(--f5-space-md);">Review Last Game</button>` : ''}
    ${stats.recent.slice().reverse().map(g => {
      const date = new Date(g.date);
      const dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
      const timeStr = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
      return `<div class="f5-card f5-history-row">
        <div>
          <div style="font-weight: var(--f5-weight-medium);">${g.score.total} pts</div>
          <div style="font-size: var(--f5-text-xs); color: var(--f5-text-muted);">${g.score.validCount}/25 correct</div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: var(--f5-text-sm);">${dateStr}</div>
          <div style="font-size: var(--f5-text-xs); color: var(--f5-text-muted);">${timeStr}</div>
        </div>
      </div>`;
    }).join('')}
  </div>`;

  container.innerHTML = html;

  // Wire up review button
  const reviewBtn = document.getElementById('btn-review-last');
  if (reviewBtn) {
    reviewBtn.addEventListener('click', () => {
      const game = storage.getLastGame();
      if (game) showResults(game, false);
    });
  }
}

// Boot
document.addEventListener('DOMContentLoaded', init);
