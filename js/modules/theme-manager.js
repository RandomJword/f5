// F5 Theme Manager — body class swap + lazy font loading

import * as storage from './storage.js';

const THEMES = {
  newspaper:  { class: '',                  label: 'Newspaper',         fonts: ['Playfair+Display:wght@700;900', 'Source+Serif+4:ital,wght@0,400;0,700;1,400', 'Courier+Prime'] },
  retro:      { class: 'theme-retro',       label: 'Retro Bookshelf',   fonts: ['Playfair+Display:wght@700;900', 'Libre+Franklin:wght@400;500;700', 'Courier+Prime'] },
  minimal:    { class: 'theme-minimal',     label: 'Minimal Modernist', fonts: ['Inter:wght@400;500;600;700'] },
  neon:       { class: 'theme-neon',        label: 'Neon Arcade',       fonts: ['Orbitron:wght@700;800', 'Exo+2:wght@400;500'] },
  library:    { class: 'theme-library',     label: 'Library Study',     fonts: ['EB+Garamond:ital,wght@0,400;0,500;0,600;1,400;1,500', 'Source+Serif+4:ital,wght@0,400;0,700;1,400', 'Courier+Prime'] },
  popart:     { class: 'theme-popart',      label: 'Pop Art',           fonts: ['Bangers', 'Archivo:wght@500;600;700'] },
  botanical:  { class: 'theme-botanical',   label: 'Botanical',         fonts: ['Cormorant+Garamond:ital,wght@0,300;0,400;0,500;1,400', 'Lato:wght@400;700', 'Courier+Prime'] },
  brutalist:  { class: 'theme-brutalist',   label: 'Brutalist Digital', fonts: ['Space+Mono:wght@400;700'] },
};

const DEFAULT_THEME = 'newspaper';
let currentTheme = DEFAULT_THEME;
const loadedFontSets = new Set();

function init() {
  const saved = storage.getTheme();
  const theme = (saved && THEMES[saved]) ? saved : DEFAULT_THEME;
  apply(theme);
}

function apply(themeId) {
  const theme = THEMES[themeId];
  if (!theme) return;

  // Remove all theme classes
  Object.values(THEMES).forEach(t => {
    if (t.class) document.body.classList.remove(t.class);
  });

  // Apply new theme class
  if (theme.class) {
    document.body.classList.add(theme.class);
  }

  currentTheme = themeId;
  storage.setTheme(themeId);
  loadFonts(themeId);
}

function loadFonts(themeId) {
  const theme = THEMES[themeId];
  if (!theme || loadedFontSets.has(themeId)) return;

  const families = theme.fonts.map(f => 'family=' + f).join('&');
  const url = `https://fonts.googleapis.com/css2?${families}&display=swap`;

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = url;
  document.head.appendChild(link);

  loadedFontSets.add(themeId);
}

function getThemeList() {
  return Object.entries(THEMES).map(([id, t]) => ({
    id,
    label: t.label,
    active: id === currentTheme,
  }));
}

function getCurrent() {
  return currentTheme;
}

export { init, apply, getThemeList, getCurrent, THEMES };
