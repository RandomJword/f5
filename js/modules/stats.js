// F5 Stats — compute aggregates from game history

import * as storage from './storage.js?v=20260309e';

function compute() {
  const history = storage.getHistory();
  if (history.length === 0) return null;

  const totals = history.map(g => g.score.total);
  const validCounts = history.map(g => g.score.validCount);
  const best = Math.max(...totals);
  const avg = Math.round(totals.reduce((a, b) => a + b, 0) / totals.length);
  const avgFill = Math.round(validCounts.reduce((a, b) => a + b, 0) / validCounts.length * 4); // % of 25

  // Category performance: track how often each category yields valid answers
  const catStats = {};
  for (const game of history) {
    game.categories.forEach((cat, r) => {
      const name = typeof cat === 'string' ? cat : cat;
      if (!catStats[name]) catStats[name] = { valid: 0, total: 0 };
      for (let c = 0; c < 5; c++) {
        catStats[name].total++;
        if (game.results[r][c].valid) catStats[name].valid++;
      }
    });
  }

  const catEntries = Object.entries(catStats)
    .filter(([, s]) => s.total >= 5)
    .map(([name, s]) => ({ name, rate: s.valid / s.total, valid: s.valid, total: s.total }));
  catEntries.sort((a, b) => b.rate - a.rate);

  const bestCategories = catEntries.slice(0, 3);
  const worstCategories = catEntries.slice(-3).reverse();

  // Letter performance
  const letterStats = {};
  for (const game of history) {
    game.letters.forEach((letter, c) => {
      if (!letterStats[letter]) letterStats[letter] = { valid: 0, total: 0 };
      for (let r = 0; r < 5; r++) {
        letterStats[letter].total++;
        if (game.results[r][c].valid) letterStats[letter].valid++;
      }
    });
  }

  const letterEntries = Object.entries(letterStats)
    .map(([letter, s]) => ({ letter, rate: s.valid / s.total, valid: s.valid, total: s.total }))
    .sort((a, b) => b.rate - a.rate);

  // Score history (last 20 games, oldest first for chart)
  const recent = history.slice(0, 20).reverse();

  // Streak: consecutive days with a game (based on calendar date)
  const streak = computeStreak(history);

  return {
    totalGames: history.length,
    bestScore: best,
    avgScore: avg,
    avgFillPct: avgFill,
    bestCategories,
    worstCategories,
    letterEntries,
    recent,
    streak,
  };
}

function computeStreak(history) {
  if (history.length === 0) return 0;

  const days = new Set();
  for (const g of history) {
    const d = new Date(g.date);
    days.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
  }

  const sorted = [...days].sort().reverse();
  const today = new Date();
  const todayKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayKey = `${yesterday.getFullYear()}-${yesterday.getMonth()}-${yesterday.getDate()}`;

  // Streak must include today or yesterday
  if (sorted[0] !== todayKey && sorted[0] !== yesterdayKey) return 0;

  let streak = 1;
  let current = new Date(today);
  if (sorted[0] === yesterdayKey) {
    current = new Date(yesterday);
  }

  for (let i = 1; i < 365; i++) {
    current.setDate(current.getDate() - 1);
    const key = `${current.getFullYear()}-${current.getMonth()}-${current.getDate()}`;
    if (days.has(key)) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

export { compute };
