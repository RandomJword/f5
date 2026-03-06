# F5 — Architecture Decisions

## ADR-001: Vanilla HTML/CSS/JS — No Framework
**Date:** 2026-03-06
**Choice:** Plain HTML, CSS, and JavaScript with ES Modules.
**Alternatives:** React, Svelte, Vue.
**Rationale:** A 5x5 grid with a timer is not complex enough to justify a framework. Zero build step means open `index.html` and play. Matches prior shipped projects (CPA Study Buddy, M3). Faster iteration. ES modules give clean separation without bundler overhead.
**Reversibility:** Easy — can wrap in React later if needed.

## ADR-002: Direct Browser API Calls (No Proxy Server)
**Date:** 2026-03-06
**Choice:** Browser fetches directly to `api.anthropic.com` with `anthropic-dangerous-direct-browser-access: true` header.
**Alternatives:** Vercel/Cloudflare serverless proxy, self-hosted Node server.
**Rationale:** No server to deploy or maintain. Player uses their own API key = zero hosting cost. Proven pattern from CPA Study Buddy. Key stored in localStorage via setup screen.
**Reversibility:** Easy — add a proxy in Phase 3 for multiplayer.
**Depends on:** Spike 1 validation (browser CORS behavior).

## ADR-003: Claude Haiku 4.5 for Validation
**Date:** 2026-03-06
**Choice:** `claude-haiku-4-5` at `temperature: 0`.
**Alternatives:** Sonnet (25x more expensive), client-side dictionary lookup.
**Rationale:** Classification task doesn't need creativity. Haiku is fast and cheap. Dictionary approach can't handle edge cases ("Is 'The Beatles' a valid Musical Artist starting with B?") or explain rulings. Temperature 0 maximizes consistency.
**Reversibility:** Easy — model ID is one constant in `claude-api.js`.

## ADR-004: Batch Validation at Round End
**Date:** 2026-03-06
**Choice:** All 25 answers validated in a single API call after the timer expires.
**Alternatives:** Real-time validation as the player types each answer.
**Rationale:** Preserves time pressure (the core fun). One API call instead of 25. No latency interrupting flow state. The uncertainty of "did I get that right?" is part of the game tension.
**Reversibility:** Medium — switching to real-time would require a validator.js refactor and UX changes.

## ADR-005: CSS Custom Properties for Theming
**Date:** 2026-03-06
**Choice:** `--f5-*` CSS variable contract. Theme classes on `<body>`. Components are theme-unaware.
**Alternatives:** CSS-in-JS, separate stylesheets per theme, Tailwind.
**Rationale:** Native browser feature. Zero runtime cost. One class swap changes the entire visual identity. Components only reference `var(--f5-*)`, never hard-coded values. Supports 8 radically different themes (not just recolors) through structural rules scoped to each theme class.
**Reversibility:** Easy — the variable contract is the API.

## ADR-006: n-squared Scoring (Original Game Formula)
**Date:** 2026-03-06
**Choice:** Each row total² + each column total². Max 250 points.
**Alternatives:** Flat scoring (1 point per valid answer, max 25).
**Rationale:** Mathematically elegant. Creates meaningful strategic decisions — completing 5/5 in a row (25 pts) is worth far more than 4/5 (16 pts). This is the original game's secret weapon. Every digital competitor abandoned it. Proven over 60 years of tournament play.
**Reversibility:** Easy — scoring is one pure function in `game-engine.js`.

## ADR-007: localStorage for Phase 1 Persistence
**Date:** 2026-03-06
**Choice:** All data in localStorage — settings, game history, validation cache, stats.
**Alternatives:** Supabase from day 1, IndexedDB, file export.
**Rationale:** Zero setup, no auth flow, no server. Sufficient for solo play. 5MB budget supports ~2000 games + thousands of cache entries. `storage.js` abstracts the backend so swapping to Supabase in Phase 2 changes only the implementation, not the interface.
**Reversibility:** Easy — swap implementation behind `storage.js` interface.

## ADR-008: Curated Category Pool (~60 categories)
**Date:** 2026-03-06
**Choice:** Hand-curated category pool with tags and difficulty ratings. No AI generation.
**Alternatives:** AI-generated categories per game.
**Rationale:** Zero latency at game start. Predictable quality and difficulty. No API call before the player even starts. AI-generated categories produce unpredictable difficulty and occasional nonsense. Can add AI generation as a future option.
**Reversibility:** Easy — add AI category generation alongside the curated pool.

## ADR-009: Validation Strictness Setting
**Date:** 2026-03-06
**Choice:** Player-configurable strict/lenient mode that adjusts the AI validation prompt.
**Alternatives:** Single strictness level for all players.
**Rationale:** Spike 2 showed Haiku is consistent but strict — rejects "JFK" for K (wants "Kennedy"), rejects "USA" for U (wants "United States"). Some players want pub trivia vibes, others want tournament precision. The prompt wording changes per mode; the cache key includes strictness level to prevent cross-contamination.
**Reversibility:** Easy — prompt wording is a string constant per mode.

## ADR-010: Cache Key Includes Strictness
**Date:** 2026-03-06
**Choice:** Validation cache key is `category|letter|normalize(answer)|strictness`.
**Alternatives:** `category|letter|answer` (original plan).
**Rationale:** The same answer can receive different rulings at different strictness levels. Without strictness in the key, switching modes would serve stale/wrong cached results. Normalization = `answer.trim().toLowerCase()` to avoid duplicate entries for case/whitespace variants.
**Reversibility:** Easy — key format is one function in validator.js.

## ADR-011: Crash Recovery via Pre-Validation Save
**Date:** 2026-03-06
**Choice:** Save full game state (grid, categories, letters, timestamp) to localStorage before making the validation API call.
**Alternatives:** No recovery — lost round on tab close.
**Rationale:** Timer expires → API call fires → player closes tab = lost round. By persisting state before the call, we can detect "validating" state on reload and re-submit. Minimal storage cost (~2KB).
**Reversibility:** Easy — just a storage.save() call before the fetch.

## ADR-012: Only Validate Non-Empty Cells
**Date:** 2026-03-06
**Choice:** Filter out blank cells before sending to the API. Mark empties as invalid client-side. Verify response completeness by checking every submitted ID has a result.
**Alternatives:** Send all 25 cells including blanks.
**Rationale:** Saves tokens (a grid with 15 blanks sends 10 items, not 25). After parsing the response, any missing IDs get one retry, then fall back to self-score for those cells.
**Reversibility:** Easy — filter logic is in validator.js.
