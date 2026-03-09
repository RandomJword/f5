// F5 Game Engine — pure functions, zero side effects
// State creation, category/letter selection, scoring

import { CATEGORIES, STANDARD_LETTERS, EXPERT_LETTERS, EASY_LETTERS, getPool } from './categories.js?v=20260309g';
import * as storage from './storage.js?v=20260309g';

// Fisher-Yates shuffle (returns new array)
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Select 5 categories with tag diversity.
 * No two categories from the same tag.
 * If we can't fill 5 unique tags, allow duplicates for remaining slots.
 */
function selectCategories(difficulty = 'standard') {
  const pool = getPool(difficulty);

  // Shuffle-bag: exhaust all categories before any repeats.
  // Track used categories in current cycle. Reset when pool runs dry.
  // Separate bag per mode so switching doesn't reset progress.
  const usedNames = new Set(storage.getUsedCategoryCycle(difficulty));

  // Available = categories not yet used this cycle
  let available = pool.filter(c => !usedNames.has(c.name));

  // If fewer than 5 available (can't fill a game), start a new cycle
  if (available.length < 5) {
    storage.setUsedCategoryCycle([], difficulty);
    available = pool;
  }

  const shuffled = shuffle(available);

  const picked = [];
  const usedTags = new Set();

  // First pass: one per tag for diversity
  for (const cat of shuffled) {
    if (picked.length >= 5) break;
    if (!usedTags.has(cat.tag)) {
      picked.push(cat);
      usedTags.add(cat.tag);
    }
  }

  // Fill remaining if needed (relax tag constraint)
  if (picked.length < 5) {
    for (const cat of shuffled) {
      if (picked.length >= 5) break;
      if (!picked.includes(cat)) {
        picked.push(cat);
      }
    }
  }

  return picked;
}

/**
 * Select 5 random letters, avoiding letters from the last 2 games.
 */
function selectLetters(mode = 'standard') {
  const pool = mode === 'expert' ? EXPERT_LETTERS : mode === 'easy' ? EASY_LETTERS : STANDARD_LETTERS;
  const recentLetters = new Set();

  // Use dedicated recent-letters tracker (includes abandoned games)
  const recentSets = storage.getRecentLetters();
  for (const letters of recentSets) {
    letters.forEach(l => recentLetters.add(l));
  }

  // Prefer letters not used recently
  const fresh = pool.filter(l => !recentLetters.has(l));
  const stale = pool.filter(l => recentLetters.has(l));

  // Pick from fresh first, fill remainder from stale if needed
  const shuffledFresh = shuffle(fresh);
  const shuffledStale = shuffle(stale);
  const combined = [...shuffledFresh, ...shuffledStale];
  return combined.slice(0, 5);
}

/**
 * Create a new game state object.
 */
function newGame(options = {}) {
  const settings = storage.getSettings();
  const difficulty = options.difficulty || settings.difficulty || 'standard';
  const letterMode = options.letterMode || difficulty;

  const categories = selectCategories(difficulty);
  const letters = selectLetters(letterMode);

  // Record selections immediately (even if game is abandoned)
  const catNames = categories.map(c => c.name);
  const cycle = storage.getUsedCategoryCycle(difficulty);
  cycle.push(...catNames);
  storage.setUsedCategoryCycle(cycle, difficulty);
  storage.addRecentLetters([...letters]);

  // Empty 5x5 grid
  const grid = [];
  for (let r = 0; r < 5; r++) {
    grid[r] = [];
    for (let c = 0; c < 5; c++) {
      grid[r][c] = '';
    }
  }

  return {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    categories,
    letters,
    grid,
    difficulty,
    status: 'playing', // playing | validating | scored | abandoned
    startedAt: Date.now(),
    duration: options.duration || 300,
  };
}

/**
 * Calculate n-squared score from validation results.
 * validationResults[row][col] = { valid: boolean }
 * Max score: 250 (all 25 valid → 5 rows of 5² + 5 cols of 5² = 125 + 125)
 */
function calculateScore(validationResults) {
  const rowTotals = [0, 0, 0, 0, 0];
  const colTotals = [0, 0, 0, 0, 0];

  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      if (validationResults[r] && validationResults[r][c] && validationResults[r][c].valid) {
        rowTotals[r]++;
        colTotals[c]++;
      }
    }
  }

  const rowScores = rowTotals.map(n => n * n);
  const colScores = colTotals.map(n => n * n);
  const general = rowScores.reduce((a, b) => a + b, 0);
  const special = colScores.reduce((a, b) => a + b, 0);

  return {
    rowTotals,
    colTotals,
    rowScores,
    colScores,
    general,
    special,
    total: general + special,
    max: 250,
    validCount: rowTotals.reduce((a, b) => a + b, 0),
    totalCells: 25,
  };
}

export { newGame, calculateScore, selectCategories, selectLetters };
