// F5 — App Entry Point
// Init, screen routing, event wiring

import * as storage from './modules/storage.js';
import * as themeManager from './modules/theme-manager.js';
import * as grid from './modules/grid.js';
import { createTimer, formatTime } from './modules/timer.js';
import { newGame, calculateScore } from './modules/game-engine.js';
import { validate, appeal } from './modules/validator.js';

// Screen IDs
const SCREENS = ['setup', 'menu', 'play', 'validating', 'results', 'stats', 'settings'];

let currentScreen = null;
let activeTimer = null;
let activeGame = null;
let lastAnnouncedSeconds = null;

function init() {
  themeManager.init();

  // Check if we have an API key
  const apiKey = storage.getApiKey();

  // One-time cache clear for prompt v2 upgrade
  if (!storage.get('cache_v3')) {
    storage.clearCache();
    storage.set('cache_v3', true);
  }

  // Check for crash recovery
  const savedGame = storage.getGameState();
  if (savedGame && savedGame.status === 'validating') {
    // TODO: Re-submit validation in S4
    storage.clearGameState();
  }

  // Show masked API key in settings
  updateApiKeyDisplay(apiKey);

  // Route to appropriate screen
  if (!apiKey) {
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

  // Announce screen change to assistive tech
  const heading = document.querySelector(`#screen-${screenId} h1, #screen-${screenId} h2, #screen-${screenId} .f5-screen-title`);
  if (heading) {
    heading.focus();
  }
}

function bindGlobalEvents() {
  // Setup screen — save API key
  const setupForm = document.getElementById('setup-form');
  if (setupForm) {
    setupForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const input = document.getElementById('api-key-input');
      const key = input.value.trim();
      if (key) {
        storage.setApiKey(key);
        showScreen('menu');
      }
    });
  }

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

  // Settings — strictness
  const strictnessSelect = document.getElementById('strictness-select');
  if (strictnessSelect) {
    strictnessSelect.value = storage.getStrictness();
    strictnessSelect.addEventListener('change', (e) => {
      storage.setStrictness(e.target.value);
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

  // Settings — clear API key
  const clearKeyBtn = document.getElementById('btn-clear-key');
  if (clearKeyBtn) {
    clearKeyBtn.addEventListener('click', () => {
      storage.setApiKey('');
      showScreen('setup');
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
    showScreen('menu');
    return;
  }

  activeGame.status = 'scored';
  activeGame.validationResults = results;
  activeGame.score = calculateScore(results);

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

  showResults(activeGame);
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

  // Results grid
  const resultsGrid = document.getElementById('results-grid');
  resultsGrid.innerHTML = '';

  // Corner
  const corner = document.createElement('div');
  corner.className = 'f5-grid__corner';
  resultsGrid.appendChild(corner);

  // Letter headers with column scores
  letters.forEach((letter, c) => {
    const header = document.createElement('div');
    header.className = 'f5-grid__letter-header';
    header.innerHTML = `${letter}<br><span style="font-size:var(--f5-text-xs);color:var(--f5-text-muted)">${score.colTotals[c]}/5 = ${score.colScores[c]}</span>`;
    resultsGrid.appendChild(header);
  });

  // Rows
  categories.forEach((cat, r) => {
    // Category header with row score
    const catHeader = document.createElement('div');
    catHeader.className = 'f5-grid__category-header';
    catHeader.innerHTML = `
      <div>
        <div>${cat.name}</div>
        <div style="font-size:var(--f5-text-xs);color:var(--f5-text-muted)">${score.rowTotals[r]}/5 = ${score.rowScores[r]}</div>
      </div>`;
    resultsGrid.appendChild(catHeader);

    // Cells
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

      // Start hidden if animating
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
        badge.textContent = result.explanation || 'Invalid';
      } else {
        badge.style.color = 'var(--f5-text-muted)';
        badge.textContent = 'Empty';
      }

      cell.appendChild(answerEl);
      cell.appendChild(badge);

      // Appeal button for rejected non-empty cells
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
            showResults(game, false);
          } else {
            appealBtn.textContent = 'Appeal failed';
          }
        });
        cell.appendChild(appealBtn);
      }

      // Show "Overturned" label for successful appeals
      if (result.appealed && result.valid) {
        const overturnedEl = document.createElement('div');
        overturnedEl.style.fontSize = 'var(--f5-text-xs)';
        overturnedEl.style.color = 'var(--f5-valid)';
        overturnedEl.style.fontStyle = 'italic';
        overturnedEl.textContent = 'Overturned on appeal';
        cell.appendChild(overturnedEl);
      }

      resultsGrid.appendChild(cell);
    });
  });

  showScreen('results');

  // Cell-by-cell reveal animation
  if (animate) {
    const resultCells = resultsGrid.querySelectorAll('.f5-result-cell');
    let runningScore = 0;
    const revealOrder = [];

    // Build reveal order: row by row, left to right
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

        // Flash then settle
        setTimeout(() => {
          cell.style.background = result.valid
            ? 'rgba(45,106,45,0.08)'
            : answer ? 'rgba(200,16,46,0.06)' : 'transparent';
        }, 200);

        // Count up score as valid cells are revealed
        if (result.valid) {
          runningScore++;
          // Simple running count display (final n² score shown at end)
          totalEl.textContent = runningScore;
        }

        // After last cell, show final score
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
  }
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

function updateApiKeyDisplay(key) {
  const display = document.getElementById('api-key-display');
  if (display && key) {
    display.textContent = key.slice(0, 7) + '...' + key.slice(-4);
  } else if (display) {
    display.textContent = 'No key set';
  }
}

// Boot
document.addEventListener('DOMContentLoaded', init);
