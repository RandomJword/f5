// F5 Storage — localStorage abstraction
// All reads/writes go through this module.
// Swap implementation here to migrate to Supabase in Phase 2.

const PREFIX = 'f5_';

function key(name) {
  return PREFIX + name;
}

function get(name, fallback = null) {
  try {
    const raw = localStorage.getItem(key(name));
    if (raw === null) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function set(name, value) {
  try {
    localStorage.setItem(key(name), JSON.stringify(value));
  } catch (e) {
    console.error('[F5 Storage] Write failed:', e.message);
  }
}

function remove(name) {
  localStorage.removeItem(key(name));
}

function getApiKey() {
  return get('api_key', '');
}

function setApiKey(apiKey) {
  set('api_key', apiKey);
}

function getInviteCode() {
  return get('invite_code', '');
}

function setInviteCode(code) {
  set('invite_code', code);
}

function getAuthMode() {
  if (getApiKey()) return 'apikey';
  if (getInviteCode()) return 'invite';
  return null;
}

function getTheme() {
  return get('theme', '');
}

function setTheme(theme) {
  set('theme', theme);
}

function getStrictness() {
  return get('strictness', 'strict');
}

function setStrictness(level) {
  set('strictness', level);
}

function getSettings() {
  return get('settings', {
    theme: '',
    strictness: 'strict',
    difficulty: 'standard',
  });
}

function setSettings(settings) {
  set('settings', settings);
}

// Validation cache
function getCacheKey(category, letter, answer, strictness) {
  return `cache_${category}|${letter}|${answer.trim().toLowerCase()}|${strictness}`;
}

function getCachedResult(category, letter, answer, strictness) {
  return get(getCacheKey(category, letter, answer, strictness));
}

function setCachedResult(category, letter, answer, strictness, result) {
  set(getCacheKey(category, letter, answer, strictness), result);
}

// Game state (for crash recovery)
function saveGameState(state) {
  set('active_game', state);
}

function getGameState() {
  return get('active_game');
}

function clearGameState() {
  remove('active_game');
}

// Game history
function getHistory() {
  return get('history', []);
}

function addToHistory(game) {
  const history = getHistory();
  history.unshift(game);
  set('history', history);
}

function clearCache() {
  const toRemove = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k.startsWith('f5_cache_')) {
      toRemove.push(k);
    }
  }
  toRemove.forEach(k => localStorage.removeItem(k));
}

// Storage size check
function getUsageEstimate() {
  let total = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k.startsWith(PREFIX)) {
      total += k.length + localStorage.getItem(k).length;
    }
  }
  return { bytes: total * 2, formatted: formatBytes(total * 2) };
}

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

export {
  get,
  set,
  remove,
  getApiKey,
  setApiKey,
  getInviteCode,
  setInviteCode,
  getAuthMode,
  getTheme,
  setTheme,
  getStrictness,
  setStrictness,
  getSettings,
  setSettings,
  getCachedResult,
  setCachedResult,
  saveGameState,
  getGameState,
  clearGameState,
  getHistory,
  addToHistory,
  clearCache,
  getUsageEstimate,
};
