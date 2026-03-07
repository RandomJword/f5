# F5 — Task Backlog

## Done
- [x] Product research (web search + Gemini monograph)
- [x] Competitive landscape analysis (7 competitors)
- [x] Product proposal with UX theme exploration (proposal.html)
- [x] CLAUDE.md with conventions and constraints
- [x] Architecture discovery with Mermaid diagrams (f5-discovery.html)
- [x] Sprint planning kanban (f5-kanban.html)
- [x] BRIEF.md — north star doc
- [x] DECISIONS.md — 12 architecture decisions logged
- [x] Git repo initialized
- [x] Spike 1: Browser API access — PASS
- [x] Spike 2: Validation consistency — PASS (100% JSON parse, 100% ruling consistency)
- [x] Spike 3: Category viability — PASS (3.6% dead cells)
- [x] Adversarial review — 4 design changes (ADR-009 through ADR-012)
- [x] Blind spot audit — security, accessibility, edge cases
- [x] **S0: Foundation** — HTML shell, tokens.css, storage.js, theme-manager.js, layout.css, components.css, reset.css
- [x] **S1: The Grid** — 5x5 grid render, textarea cells, keyboard nav (Tab/Enter/Arrow), autoGrow, lock/unlock
- [x] **S2: The Clock** — wall-clock timer, visibilitychange, urgency states (warning/critical), progress bar
- [x] **S3: Game Engine** — categories.js (~120 categories), game-engine.js (newGame, calculateScore), Fisher-Yates shuffle, tag diversity
- [x] **S4: AI Integration** — claude-api.js, validator.js with strict/lenient prompts, cache with strictness key, appeal system (Sonnet), crash recovery
- [x] **S5: Scoring & Results** — n² scoring, results screen, cell-by-cell reveal animation, running score counter, appeal buttons with live rescore, score breakdown (general/special)
- [x] **S6: Persistence** — Stats dashboard (summary cards, score sparkline, best/worst categories, letter performance, game history list), stats.js aggregation
- [x] Prompt tuning — broad category interpretation, geographic prefix handling, parenthetical disambiguation, "do not split hairs" rule, multi-category membership
- [x] Appeal system fix — corrected Sonnet model ID (claude-sonnet-4-6), Haiku fallback, error vs denial UX
- [x] Wikipedia verification — post-validation fact-check for hallucinated answers, fiction category skip list
- [x] Mobile responsive — card mode (one category at a time), swipe navigation, dot indicators, touch-friendly inputs
- [x] Categories expanded — 55 → 120 categories across 9 tags (interactive picker tool built)
- [x] **Cloudflare Worker proxy** — secure API proxy (f5-proxy.f5family.workers.dev), invite code auth, rate limiting (100/day/IP), CORS origin locking, usage analytics dashboard (GET /stats?code=)
- [x] **Dual auth mode** — invite code (proxied) or own API key (direct browser-to-API)
- [x] **Mobile UX polish** — iOS Safari focus ring fix, overflow fix, vertical spacing tightened, bottom prev/next nav bar replacing top dots
- [x] **WCAG AA contrast audit** — 16 fixes across all 5 themes
- [x] **Defaults** — Library Study theme, lenient judging
- [x] **Anti-repetition** — categories avoid last 25 games, letters avoid last 3 games, tracked at game creation (not just scoring)
- [x] **Knowledge cutoff handling** — prompt tells Claude to accept plausible unknowns; Wikipedia-informed re-validation fetches summaries and re-submits to Claude with context
- [x] **Prompt tuning v2** — single-name surname detection (Willis case), knowledge cutoff instruction, spelling rule rewrite ("if you can identify intent, accept it")
- [x] **Themes reduced** — 8 → 5 (removed Pop Art, Brutalist Digital, one other)
- [x] **GitHub Pages deploy** — https://randomjword.github.io/f5/
- [x] **View Stats on results screen**

## Backlog
- [ ] Self-scoring fallback UI (when API fails)
- [ ] Difficulty selection (standard vs expert letters)
- [ ] Game duration selection UI
- [ ] Keyboard shortcut hints
