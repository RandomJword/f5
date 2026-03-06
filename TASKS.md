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
- [x] **S3: Game Engine** — categories.js (~55 categories), game-engine.js (newGame, calculateScore), Fisher-Yates shuffle, tag diversity
- [x] **S4: AI Integration** — claude-api.js, validator.js with strict/lenient prompts, cache with strictness key, appeal system (Sonnet), crash recovery
- [x] **S5: Scoring & Results** — n² scoring, results screen, cell-by-cell reveal animation, running score counter, appeal buttons with live rescore, score breakdown (general/special)

## In Progress
- [ ] **S6: Persistence** — Stats dashboard UI (history already saves to localStorage)

## Up Next
- [ ] **S7: Theme Polish** — Per-theme animations, responsive fine-tuning, settings screen polish

## Backlog
- [ ] Self-scoring fallback UI (when API fails)
- [ ] Difficulty selection (standard vs expert letters)
- [ ] Game duration selection UI
- [ ] Keyboard shortcut hints
