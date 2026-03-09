// F5 Validator — prompt builder, cache, JSON parser
// Sends non-empty answers to Claude for validation. Caches results.

import * as api from './claude-api.js';
import * as storage from './storage.js';

// Categories where answers are fictional — skip Wikipedia verification
const FICTION_CATEGORIES = new Set([
  'Cartoon Characters', 'Fictional Characters', 'Mythological Figures',
  'Superheroes', 'Video Game Characters', 'Literary Characters',
  'Disney Characters', 'Superhero Characters', 'Fictional Detectives',
]);

/**
 * Check if an answer exists on Wikipedia.
 * Returns true if found, false if not found, null on error (treat as found).
 */
async function wikiCheck(query) {
  try {
    const encoded = encodeURIComponent(query);
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}`,
      { headers: { 'Api-User-Agent': 'F5Game/1.0' } }
    );
    if (res.ok) return true;
    if (res.status === 404) {
      // Try search as fallback (handles alternate names)
      const searchRes = await fetch(
        `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encoded}&srlimit=1&format=json&origin=*`
      );
      if (searchRes.ok) {
        const data = await searchRes.json();
        return data.query.search.length > 0;
      }
    }
    return null; // Error — don't penalize
  } catch {
    return null; // Network error — don't penalize
  }
}

/**
 * Fetch a Wikipedia summary for an answer.
 * Returns { found, title, extract } or { found: false }.
 * Tries direct page lookup first, then search.
 * Optional categoryHint adds context to search queries (e.g., "mountain")
 * to disambiguate common words that have multiple meanings.
 */
async function wikiLookup(query, categoryHint) {
  try {
    // Strip parentheticals the player may have added
    const clean = query.replace(/\s*\(.*?\)\s*$/, '').trim();
    const encoded = encodeURIComponent(clean);

    // Try direct page summary
    const res = await fetch(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encoded}`,
      { headers: { 'Api-User-Agent': 'F5Game/1.0' } }
    );
    if (res.ok) {
      const data = await res.json();
      // If we got a result and have a category hint, check if it's relevant.
      // If the direct result doesn't seem related, also try a category-qualified search.
      if (categoryHint) {
        const contextResult = await wikiSearchWithContext(clean, categoryHint);
        if (contextResult.found) {
          // Return the context-aware result — more likely to be category-relevant
          return contextResult;
        }
      }
      return { found: true, title: data.title, extract: data.extract || '' };
    }

    // Try search fallback — with category context if available
    if (res.status === 404) {
      if (categoryHint) {
        const contextResult = await wikiSearchWithContext(clean, categoryHint);
        if (contextResult.found) return contextResult;
      }

      const searchRes = await fetch(
        `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encoded}&srlimit=1&format=json&origin=*`
      );
      if (searchRes.ok) {
        const data = await searchRes.json();
        if (data.query.search.length > 0) {
          const title = data.query.search[0].title;
          const summaryRes = await fetch(
            `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
            { headers: { 'Api-User-Agent': 'F5Game/1.0' } }
          );
          if (summaryRes.ok) {
            const summaryData = await summaryRes.json();
            return { found: true, title: summaryData.title, extract: summaryData.extract || '' };
          }
          return { found: true, title, extract: '' };
        }
      }
    }

    return { found: false };
  } catch {
    return { found: false };
  }
}

/**
 * Search Wikipedia with category context to find the right disambiguation.
 * E.g., "Geiger" + "Mountains" → search "Geiger mountain" → finds Großer Geiger.
 */
async function wikiSearchWithContext(answer, category) {
  try {
    const contextQuery = `${answer} ${category}`;
    const searchRes = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(contextQuery)}&srlimit=1&format=json&origin=*`
    );
    if (searchRes.ok) {
      const data = await searchRes.json();
      if (data.query.search.length > 0) {
        const title = data.query.search[0].title;
        const summaryRes = await fetch(
          `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
          { headers: { 'Api-User-Agent': 'F5Game/1.0' } }
        );
        if (summaryRes.ok) {
          const summaryData = await summaryRes.json();
          return { found: true, title: summaryData.title, extract: summaryData.extract || '' };
        }
        return { found: true, title, extract: '' };
      }
    }
    return { found: false };
  } catch {
    return { found: false };
  }
}

const SYSTEM_PROMPT = `You are the judge for "Facts in Five."
Rules:
1. Answer must belong to the category. Interpret categories BROADLY — do NOT split hairs:
   - A person who has EVER published written works counts as an "Author" — even if they are primarily known for something else. Newton (Principia Mathematica) = valid Author. Einstein = valid Author. Churchill = valid Author.
   - "Mythological Figures" includes figures from ALL mythological and religious traditions worldwide: Greek, Roman, Norse, Hindu, Buddhist, Shinto, Egyptian, Judeo-Christian, Islamic, Indigenous, African, etc. Biblical figures ARE mythological figures.
   - "Scientists" includes anyone who made significant contributions to any field of science.
   - "Team Sports" includes ANY sport played by teams, even if also categorizable as something else. Polo, rowing, relay races, doubles tennis — all valid.
   - CRITICAL: Do NOT reject because the answer is "primarily known as" something else. People and things belong to MULTIPLE categories. If the answer fits the category AT ALL, accept it.
   - However, the answer must actually BE the type of thing the category describes. A province is not a country. A lake is not an ocean. A city is not a state. Broad interpretation applies to borderline membership within a category, NOT to accepting answers that are fundamentally the wrong type of thing.
   - Apply this broad interpretation to ALL categories.
2. The letter check depends on the category type:
   - People (authors, scientists, athletes, etc.): the SURNAME determines the letter. Players may write first name, full name, or surname only. When a single name is given, ALWAYS check if it could be a valid surname — do NOT assume it is a first name. Example: "Tennessee Williams" is valid for W because surname "Williams" starts with W. "Einstein" and "Albert Einstein" are both valid for E. "Willis" is valid for W if there is a known person with surname Willis in the category (e.g., Kevin Willis in basketball).
   - Titles (movies, books, songs, etc.): ignore leading articles "The", "A", "An". Example: "The Godfather" is valid for G.
   - Geographic features (lakes, rivers, mountains, bays, capes, gulfs, etc.): IGNORE generic prefixes like "Lake", "River", "Mount", "Cape", "Bay", "Gulf", "Sea", "Ocean", "Isle". Use the proper name. Example: "Lake Erie" is valid for E (the lake's name is Erie). "Mount Everest" is valid for E. "River Thames" is valid for T.
   - Sports teams: the letter is determined by the team's DISTINCTIVE NAME, not the city. The test: would that word work on its own as an answer to "name a sports team"?
     (a) Real mascot/nickname → use it. "Chicago Bears" = B, "Toronto Maple Leafs" = M, "New York Yankees" = Y, "Green Bay Packers" = P. (Bears, Maple Leafs, Yankees, Packers all work as standalone team names.)
     (b) Generic suffix (City, United, Town, Rovers, Wanderers) → use the city/place name. "Manchester City" = M, "Manchester United" = M, "Newcastle United" = N. (City and United don't work as standalone team names.)
     (c) Title/corporate prefixes (FC, AC, Real, RB, Red Bull, Bayer, Club, Eintracht) → strip them. "Real Madrid" = M, "FC Barcelona" = B, "AC Milan" = M, "RB Leipzig" = L, "Red Bull Salzburg" = S. (But "Bayern Munich" = B — Bayern IS a distinctive identity.)
     (d) Shared prefixes used by many clubs (Dynamo, Maccabi, CSKA) → use the city. "Dynamo Kyiv" = K, "Maccabi Haifa" = H, "CSKA Sofia" = S. (The prefix alone doesn't identify the team.)
     When rejecting for letter mismatch, ALWAYS briefly explain the rule so the player learns. Format: "[Team] matches [correct letter], not [attempted letter]. [One sentence explaining why.]" Examples: "Toronto Maple Leafs matches M, not T. For sports teams, use the mascot (Maple Leafs = M), not the city." / "Manchester United matches M, not U. Generic suffixes like United don't count — use the city name." / "Real Madrid matches M, not R. Prefixes like Real, FC, and AC are ignored."
   - Places (cities, countries, states, etc.): use the first word. Example: "New York" is valid for N.
   - Everything else: use the first letter of the answer.
3. Must be real and verifiable. Fictional entries are OK only if the category is about fiction (e.g., Cartoon Characters, Mythological Figures).
4. IMPORTANT: Your training data has a knowledge cutoff. You may NOT know about recent movies, songs, books, athletes, events, etc. If an answer sounds plausible for its category but you don't recognize it, mark it VALID and set explanation to "Not recognized but plausible — pending verification." A separate system will verify existence. NEVER reject an answer solely because you haven't heard of it.
5. Common abbreviations and nicknames are accepted if widely recognized (e.g., "JFK" for Kennedy, "USA" for United States).
6. Spelling: ALWAYS attempt spelling correction BEFORE judging validity. If a close spelling variant fits the category, treat the answer AS the corrected word and accept it. This is non-negotiable.
   - The test is NOT "is this spelled correctly?" — it is "can I figure out what the player meant?"
   - If yes → accept it and set "canonical" to the correct spelling.
   - "Pokono" under Mountains → clearly "Pocono" → ACCEPT. "Flouride" under Chemical Elements → clearly "Fluoride" → ACCEPT. "Ghandi" → "Gandhi". "Tchaikovsky" → "Tchaikovskiy". "Reed" → "Reid". All valid.
   - CRITICAL: Use the CATEGORY as the strongest context clue. "Kawaii" under Islands = "Kauai". "Koalla" under Animals = "Koala". Do NOT match to an unrelated meaning when a category-relevant correction exists.
   - IMPORTANT: If you find yourself thinking "if the player intended X, I would accept it" — then ACCEPT IT AS X. That IS what they intended. A casual game player misspelling a word is not trying to submit a different answer; they just can't spell it. Give them the benefit of the doubt ALWAYS.
7. Players may add parenthetical notes to disambiguate, e.g., "Larson (Far Side)" or "Newton (gravity)". IGNORE the parenthetical completely — do NOT use it as evidence for or against the answer. It is just a hint to help you identify who/what the player means.
8. Be generous — if a reasonable person would accept the answer in a casual game, accept it.
9. For creative/subjective categories (e.g., "Things That Are Round", "Things That Are Blue", "Excuses to Skip Work", "Things at a Hardware Store", "Things at a Grocery Store", "Things in a Junk Drawer"): be EXTREMELY loose. Almost any answer that a person could reasonably argue fits should be accepted. These categories are meant to be fun — there are no wrong answers if the connection is defensible at all. "Sadness" for "Things That Are Blue"? Accept it (blue = sad). "Air" for "Things That Are White"? Accept it. Be playful and generous.
10. For slang categories (e.g., "GenX Slang", "Baby Boomer Slang", "Millennial Slang", "Gen Z Slang"): accept ANY word or phrase that was plausibly used as slang by that generation. Slang is informal and regional — do NOT reject because you don't recognize it or it seems too obscure. If it sounds like it could be slang, accept it. The player lived through that era and probably knows better than you.
11. For terminology categories (e.g., "Architecture Terminology", "Design Terminology", "Art Terminology", "Music Terminology"): accept technical terms, jargon, and common shorthand used by practitioners. Be generous with borderline terms.
12. For decade-specific categories (e.g., "80s Movies", "70s Songs"): accept the answer if it is plausibly from that era. Do not reject over borderline release dates.
13. When in doubt, accept it. The player is playing solo for fun.

Respond with a JSON array only. No markdown fences. No extra text.
Each element: {"id":"rXcY","valid":boolean,"explanation":"...","canonical":"..."}
ALWAYS set "canonical" to your best guess of the intended answer, even when rejecting. This helps with verification.`;

/**
 * Validate all answers in a game grid.
 * Returns a 5x5 array of { valid, explanation, canonical } objects.
 */
async function validate(answers, categories, letters) {
  const strictness = 'lenient';
  const systemPrompt = SYSTEM_PROMPT;

  // Build submission list (non-empty only) and check cache
  const toSubmit = [];
  const results = [];
  for (let r = 0; r < 5; r++) {
    results[r] = [];
    for (let c = 0; c < 5; c++) {
      const answer = (answers[r][c] || '').trim();
      if (!answer) {
        // Empty cell = invalid, no API call needed
        results[r][c] = { valid: false, explanation: 'No answer provided', canonical: '' };
        continue;
      }

      // Check cache
      const cached = storage.getCachedResult(categories[r].name, letters[c], answer, strictness);
      if (cached) {
        results[r][c] = cached;
        continue;
      }

      // Needs API validation
      toSubmit.push({
        id: `r${r}c${c}`,
        row: r,
        col: c,
        category: categories[r].name,
        letter: letters[c],
        answer,
      });
    }
  }

  // All cached or empty — no API call needed
  if (toSubmit.length === 0) {
    return results;
  }

  // Build API payload
  const payload = toSubmit.map(s => ({
    id: s.id,
    category: s.category,
    letter: s.letter,
    answer: s.answer,
  }));

  let apiResults;
  try {
    const responseText = await api.call(systemPrompt, `Validate:\n${JSON.stringify(payload)}`);
    apiResults = parseResponse(responseText);
  } catch (err) {
    // First retry with reinforcement
    try {
      const responseText = await api.call(
        systemPrompt,
        `Validate. Respond with a JSON array ONLY, no other text:\n${JSON.stringify(payload)}`
      );
      apiResults = parseResponse(responseText);
    } catch (retryErr) {
      // API failed — surface the error message
      console.error('[F5 Validator] API failed:', retryErr.message);
      throw new Error(`Can't reach the AI judge: ${retryErr.message}`);
    }
  }

  // Map API results back to the grid
  const resultMap = new Map();
  for (const r of apiResults) {
    resultMap.set(r.id, r);
  }

  // Map results and collect items needing Wikipedia verification
  const toVerify = [];   // valid answers — Wikipedia confirms existence
  const toRescue = [];   // rejected answers — Wikipedia may provide context for re-ruling

  for (const item of toSubmit) {
    const apiResult = resultMap.get(item.id);
    const result = apiResult
      ? { valid: apiResult.valid, explanation: apiResult.explanation || '', canonical: apiResult.canonical || '' }
      : { valid: false, explanation: 'No ruling received', canonical: '' };

    results[item.row][item.col] = result;

    // Skip Wikipedia verification for fiction and humor categories
    const itemTag = categories[item.row].tag;
    if (FICTION_CATEGORIES.has(item.category) || itemTag === 'humor') continue;

    if (result.valid) {
      // Verify valid answers actually exist
      toVerify.push({ item, result, query: result.canonical || item.answer });
    } else {
      // Queue rejected answers for Wikipedia-assisted re-validation
      toRescue.push({ item, result, query: result.canonical || item.answer });
    }
  }

  // Run Wikipedia checks in parallel: existence checks for valid, full lookups for rejected
  const verifyChecks = toVerify.length > 0
    ? Promise.all(toVerify.map(v => wikiCheck(v.query)))
    : Promise.resolve([]);
  const rescueLookups = toRescue.length > 0
    ? Promise.all(toRescue.map(v => wikiLookup(v.query, v.item.category)))
    : Promise.resolve([]);

  const [verifyResults, rescueResults] = await Promise.all([verifyChecks, rescueLookups]);

  // Process existence checks for valid answers
  for (let i = 0; i < toVerify.length; i++) {
    if (verifyResults[i] === false) {
      const v = toVerify[i];
      v.result.valid = false;
      v.result.explanation = `Could not verify "${v.query}" exists. If this is wrong, appeal.`;
      results[v.item.row][v.item.col] = v.result;
    }
  }

  // Process rescue: re-validate rejected answers with Wikipedia context
  const rescueItems = [];
  for (let i = 0; i < toRescue.length; i++) {
    const wiki = rescueResults[i];
    if (wiki.found && wiki.extract) {
      rescueItems.push({ ...toRescue[i], wiki });
    }
  }

  if (rescueItems.length > 0) {
    // Re-submit to Claude with Wikipedia context
    const rescuePayload = rescueItems.map(r => ({
      id: r.item.id,
      category: r.item.category,
      letter: r.item.letter,
      answer: r.item.answer,
      wikipedia_title: r.wiki.title,
      wikipedia_extract: r.wiki.extract.slice(0, 300),
    }));

    try {
      const rescueText = await api.call(
        systemPrompt,
        `Re-validate these previously rejected answers. Wikipedia has confirmed they exist. For each answer, a Wikipedia summary is provided. Use this information to judge category fit and letter match. Do NOT reject just because the answer was not in your training data.\n\n${JSON.stringify(rescuePayload)}`
      );
      const rescueApiResults = parseResponse(rescueText);
      const rescueMap = new Map();
      for (const r of rescueApiResults) {
        rescueMap.set(r.id, r);
      }

      for (const r of rescueItems) {
        const apiResult = rescueMap.get(r.item.id);
        if (apiResult) {
          const newResult = {
            valid: apiResult.valid,
            explanation: apiResult.explanation || '',
            canonical: apiResult.canonical || '',
          };
          results[r.item.row][r.item.col] = newResult;
        }
      }
    } catch {
      // Rescue API call failed — fall back to simple Wikipedia existence check
      for (const r of rescueItems) {
        r.result.valid = true;
        r.result.explanation = `Verified via Wikipedia (${r.wiki.title}).`;
        results[r.item.row][r.item.col] = r.result;
      }
    }
  }

  // Cache all results
  for (const item of toSubmit) {
    const result = results[item.row][item.col];
    storage.setCachedResult(item.category, item.letter, item.answer, strictness, result);
  }

  return results;
}

function parseResponse(text) {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // Strip markdown fences if present
    const cleaned = trimmed.replace(/^```(?:json)?\n?/m, '').replace(/\n?```$/m, '');
    return JSON.parse(cleaned);
  }
}

/**
 * Appeal a single rejected answer using Sonnet (smarter model).
 * Returns the new result, or null on failure.
 */
async function appeal(category, letter, answer) {
  const strictness = 'lenient';

  const prompt = `You are the appeals judge for "Facts in Five." A player's answer was rejected by the first judge and they are appealing.

Category: "${category}"
Required letter: "${letter}"
Player's answer: "${answer}"

Rules for judging:
- For people categories: the SURNAME determines the letter match. The player may write their full name, first name, or surname. Example: "Tennessee Williams" is valid for W (surname Williams). "Albert Einstein" is valid for E (surname Einstein).
- For titles: ignore leading "The", "A", "An". "The Godfather" = G.
- For sports teams: the letter is the team's DISTINCTIVE NAME, not the city. The test: would that word work alone as a team name? Real mascot (Bears, Maple Leafs, Yankees) → use it: "Chicago Bears" = B, "Toronto Maple Leafs" = M. Generic suffix (City, United) → use the city: "Manchester City" = M, "Manchester United" = M. Strip title/corporate prefixes (FC, AC, Real, RB, Red Bull): "Real Madrid" = M, "FC Barcelona" = B. But keep distinctive identities: "Bayern Munich" = B. Shared prefixes (Dynamo, Maccabi, CSKA) → use the city: "Dynamo Kyiv" = K, "Maccabi Haifa" = H. When rejecting, briefly explain the rule so the player learns.
- For places: first word counts. "New York" = N.
- For everything else: first letter of the answer.
- Must be real and verifiable (fictional OK if category is about fiction).
- If the answer includes a parenthetical note like "(gravity)" or "(Soviet leader)", IGNORE it completely. Do NOT fact-check it or use it for/against the answer. It is just a disambiguation hint.
- Do NOT reject because the person/thing is "primarily known as" something else. If it fits the category AT ALL, accept it.
- However, the answer must actually BE the type of thing the category describes. A province is not a country. A lake is not an ocean. A city is not a state. Broad interpretation applies to borderline membership, NOT to fundamentally wrong types.
- Geographic features: ignore "Lake", "River", "Mount" etc. — use the proper name for letter matching.
- Spelling: ALWAYS attempt spelling correction BEFORE judging validity. If a close spelling variant fits the category, treat the answer AS the corrected word and accept it. "Pokono" under Mountains = "Pocono" = ACCEPT. "Flouride" under Chemical Elements = "Fluoride" = ACCEPT. "Ghandi" = "Gandhi". "Reed" = "Reid". Set "canonical" to the correct spelling. CRITICAL: Use the CATEGORY as the strongest context clue — "Kawaii" under Islands = "Kauai". IMPORTANT: If you find yourself thinking "if the player intended X, I would accept it" — then ACCEPT IT AS X. That IS what they intended.
- Your training data has a knowledge cutoff. Do NOT reject answers just because you haven't heard of them. If it sounds plausible, accept it.
- Be generous. Accept common abbreviations, nicknames, and minor spelling errors if the intent is clear. When in doubt, accept it.
- For creative/subjective categories ("Things That Are ___", "Things at a ___", "Excuses to ___", etc.): be EXTREMELY loose. Almost any defensible answer should be accepted. These are meant to be fun.
- For slang categories ("GenX Slang", "Baby Boomer Slang", etc.): accept ANY word/phrase that was plausibly used as slang by that generation. The player lived through it and probably knows better than you.
- For terminology categories ("Architecture Terminology", "Design Terminology", etc.): accept technical terms, jargon, and common shorthand.
- For decade-specific categories ("80s Movies", "70s Songs", etc.): accept if plausibly from that era. Don't reject over borderline dates.

The first judge may have been wrong. Consider carefully whether this answer legitimately belongs to the category and matches the required letter. Players sometimes have creative, obscure, but perfectly valid answers.

Respond with JSON only. No markdown fences.
{"valid":boolean,"explanation":"...","canonical":"..."}`;

  // Try Sonnet first, fall back to Haiku if Sonnet model unavailable
  const modelsToTry = [api.APPEAL_MODEL, api.MODEL];

  for (const model of modelsToTry) {
    try {
      const responseText = await api.call(
        'You are a fair and thoughtful appeals judge.',
        prompt,
        500,
        { model }
      );
      const result = parseResponse(responseText);
      const parsed = Array.isArray(result) ? result[0] : result;

      const appealResult = {
        valid: parsed.valid,
        explanation: parsed.explanation || '',
        canonical: parsed.canonical || '',
        appealed: true,
      };

      storage.setCachedResult(category, letter, answer, strictness, appealResult);
      return appealResult;
    } catch (err) {
      console.error(`[F5 Appeal] ${model} failed:`, err.message);
      continue;
    }
  }

  return null;
}

export { validate, appeal };
