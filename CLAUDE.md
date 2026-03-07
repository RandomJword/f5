# F5 — Facts in Five, Reimagined

A modern digital version of the classic 1964 parlor game. 5 categories × 5 letters × 5 minutes. AI-judged.

## Architecture

**Vanilla HTML + CSS + JavaScript (ES Modules). No framework. No build step.**

- Open `index.html` and play. Use `python3 -m http.server 8000` for ES module imports.
- Claude API (Haiku) for answer validation, called directly from browser with `anthropic-dangerous-direct-browser-access: true`.
- API key stored in localStorage via setup screen (player's own key).
- All game logic in pure functions (`game-engine.js`) — no DOM, no side effects. This ports to server in Phase 3.

## Theming System

- **CSS Custom Properties** define a variable contract (`--f5-bg`, `--f5-text`, `--f5-accent`, `--f5-font-heading`, `--f5-radius`, etc.)
- **Theme classes on `<body>`** override variables + add scoped structural/animation rules
- **Components are theme-unaware** — they only reference `var(--f5-*)`, never hard-coded values
- **5 themes:** newspaper, retro, minimal, library, botanical
- **`theme-manager.js`** reads/writes preference to localStorage, swaps body class, lazy-loads Google Fonts

## Scoring System

Uses the original game's n² formula — NOT flat points:
- Each row total is squared (General Score — breadth per letter)
- Each column total is squared (Special Score — depth per category)
- Total = Σ(rows²) + Σ(columns²)
- Maximum: 250 points (all 25 cells valid)

## AI Validation

- **Model:** `claude-haiku-4-5` at `temperature: 0`
- **Timing:** Batch non-empty answers in one API call AFTER timer expires. Not real-time. Empty cells marked invalid client-side.
- **Cache:** `category|letter|normalize(answer)|strictness` → result in localStorage. Normalize = trim + lowercase. Facts don't expire.
- **Strictness:** Player-configurable strict/lenient mode. Adjusts the system prompt wording. Cache key includes strictness to prevent cross-contamination.
- **Fallback:** Self-scoring with checkboxes if API unavailable.
- **Keyword rules:** Surname for people, ignore articles (The/A/An) for titles, first word for places.
- **Crash recovery:** Save game state to localStorage before making the validation API call. On reload, detect "validating" state and re-submit.
- **Response verification:** After parsing, check every submitted ID has a result. Missing IDs → one retry, then self-score fallback for those cells.

## Key Patterns

- Timer: wall-clock `Date.now()` based, not interval counter. Handle `visibilitychange`.
- Grid navigation: Tab = next letter (right), Enter = next category (down), click any cell.
- Category selection: no two from same tag, difficulty distribution by mode.
- Default letter pool excludes Q, X, Z (Expert mode includes them).

## File Structure

```
f5/
├── index.html
├── css/
│   ├── reset.css
│   ├── tokens.css         # Variables + all theme overrides
│   ├── layout.css
│   ├── components.css
│   └── animations.css     # Theme-scoped @keyframes
├── js/
│   ├── app.js             # Init, routing, event wiring
│   └── modules/
│       ├── claude-api.js
│       ├── game-engine.js # Pure functions, zero side effects
│       ├── validator.js   # Prompt builder, cache, JSON parser
│       ├── timer.js
│       ├── categories.js  # ~60 curated categories
│       ├── storage.js     # localStorage wrapper
│       ├── theme-manager.js
│       ├── ui-controller.js
│       └── stats.js
├── assets/
│   └── favicon.svg
├── proposal.html          # Product proposal (reference only)
└── CLAUDE.md
```

## Do NOT

- Add React, Vue, or any framework
- Add a build step, bundler, or transpiler
- Use `setInterval` for timer counting
- Hard-code colors or fonts in component CSS
- Validate answers in real-time during play
- Add npm, package.json, or node_modules
