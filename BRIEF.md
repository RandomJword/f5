# F5 — Project Brief

## Problem
There is no good digital version of Facts in Five. The original 1964 parlor game (5 categories, 5 letters, 5 minutes) is a brilliant design — but every digital attempt either dumbed it down (single-category Scattergories clones), abandoned the n² scoring, or shipped as a bloated mobile app with ads and gacha mechanics. The core game deserves a faithful, beautiful, AI-judged digital version.

## Users
Solo players who enjoy trivia, word games, and crossword puzzles. People who remember the original game or Scattergories. The kind of person who plays NYT Connections or Wordle daily and wants something with more depth.

## Core Flows
1. **Setup** — Pick difficulty (Standard/Expert), see 5 categories + 5 letters
2. **Play** — 5-minute countdown, fill in the 5x5 grid, navigate with Tab/Enter
3. **Validate** — Timer expires, AI judges all 25 answers in one batch call
4. **Score** — n² breakdown: each row² + each column², cell-by-cell reveal animation
5. **Review** — See explanations for why answers were accepted/rejected
6. **Stats** — Historical performance, best scores, category strengths

## Success Metrics
- A complete solo game takes < 7 minutes (5 min play + ~2 min validation/review)
- AI validation agrees with a reasonable human judge > 95% of the time
- All 8 themes are visually distinct and feel intentional (not just recolors)
- Zero server infrastructure — runs from a local file server

## Tech Stack
Vanilla HTML + CSS + JavaScript (ES Modules). No framework, no build step. Claude API (Haiku 4.5) for answer validation, called directly from the browser. localStorage for all persistence.

## Non-Goals (Phase 1)
- Multiplayer / competitive play (Phase 3)
- User accounts or cloud sync (Phase 2)
- Mobile app store distribution
- Monetization
- AI-generated categories (curated pool only)
- Real-time validation during play

## Key Differentiator
The n² scoring system. No competitor uses it. It creates meaningful strategic decisions about where to spend your 5 minutes — completing a full row (5² = 25 pts) is worth dramatically more than getting 4/5 in two rows (16 + 16 = 32 vs 25 + 25 = 50). This is the game's secret weapon and it's been abandoned by every digital clone.
