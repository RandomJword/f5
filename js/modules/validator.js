// F5 Validator — prompt builder, cache, JSON parser
// Sends non-empty answers to Claude for validation. Caches results per strictness level.

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

const SYSTEM_PROMPT_STRICT = `You are the judge for "Facts in Five."
Rules:
1. Answer must belong to the category. Interpret categories BROADLY — do NOT split hairs:
   - A person who has EVER published written works counts as an "Author" — even if they are primarily known for something else. Newton (Principia Mathematica) = valid Author. Einstein = valid Author. Churchill = valid Author.
   - "Mythological Figures" includes figures from ALL mythological and religious traditions worldwide: Greek, Roman, Norse, Hindu, Buddhist, Shinto, Egyptian, Judeo-Christian, Islamic, Indigenous, African, etc. Biblical figures ARE mythological figures.
   - "Scientists" includes anyone who made significant contributions to any field of science.
   - "Team Sports" includes ANY sport played by teams, even if also categorizable as something else. Polo, rowing, relay races, doubles tennis — all valid.
   - CRITICAL: Do NOT reject because the answer is "primarily known as" something else. People and things belong to MULTIPLE categories. If the answer fits the category AT ALL, accept it.
   - Apply this broad interpretation to ALL categories.
2. The letter check depends on the category type:
   - People (authors, scientists, athletes, etc.): the SURNAME determines the letter. Players may write first name, full name, or surname only. When a single name is given, ALWAYS check if it could be a valid surname — do NOT assume it is a first name. Example: "Tennessee Williams" is valid for W because surname "Williams" starts with W. "Einstein" and "Albert Einstein" are both valid for E. "Willis" is valid for W if there is a known person with surname Willis in the category (e.g., Kevin Willis in basketball).
   - Titles (movies, books, songs, etc.): ignore leading articles "The", "A", "An". Example: "The Godfather" is valid for G.
   - Geographic features (lakes, rivers, mountains, bays, capes, gulfs, etc.): IGNORE generic prefixes like "Lake", "River", "Mount", "Cape", "Bay", "Gulf", "Sea", "Ocean", "Isle". Use the proper name. Example: "Lake Erie" is valid for E (the lake's name is Erie). "Mount Everest" is valid for E. "River Thames" is valid for T.
   - Places (cities, countries, states, etc.): use the first word. Example: "New York" is valid for N.
   - Everything else: use the first letter of the answer.
3. Must be real and verifiable. Fictional entries are OK only if the category is about fiction (e.g., Cartoon Characters, Mythological Figures).
4. IMPORTANT: Your training data has a knowledge cutoff. You may NOT know about recent movies, songs, books, athletes, events, etc. If an answer sounds plausible for its category but you don't recognize it, mark it VALID and set explanation to "Not recognized but plausible — pending verification." A separate system will verify existence. NEVER reject an answer solely because you haven't heard of it.
5. Proper names and full words required. Abbreviations like "JFK" or "USA" are not accepted — write "Kennedy" or "United States."
6. Spelling must be correct or very close (one letter off is OK if clearly recognizable).
7. Players may add parenthetical notes to disambiguate, e.g., "Larson (Far Side)" or "Newton (gravity)". IGNORE the parenthetical completely — do NOT use it as evidence for or against the answer. It is just a hint to help you identify who/what the player means.
8. When in doubt about whether someone/something is real, give the benefit of the doubt if the answer is plausible and specific.

Respond with a JSON array only. No markdown fences. No extra text.
Each element: {"id":"rXcY","valid":boolean,"explanation":"...","canonical":"..."}`;

const SYSTEM_PROMPT_LENIENT = `You are the judge for "Facts in Five."
Rules:
1. Answer must belong to the category. Interpret categories BROADLY — do NOT split hairs:
   - A person who has EVER published written works counts as an "Author" — even if they are primarily known for something else. Newton (Principia Mathematica) = valid Author. Einstein = valid Author. Churchill = valid Author.
   - "Mythological Figures" includes figures from ALL mythological and religious traditions worldwide: Greek, Roman, Norse, Hindu, Buddhist, Shinto, Egyptian, Judeo-Christian, Islamic, Indigenous, African, etc. Biblical figures ARE mythological figures.
   - "Scientists" includes anyone who made significant contributions to any field of science.
   - "Team Sports" includes ANY sport played by teams, even if also categorizable as something else. Polo, rowing, relay races, doubles tennis — all valid.
   - CRITICAL: Do NOT reject because the answer is "primarily known as" something else. People and things belong to MULTIPLE categories. If the answer fits the category AT ALL, accept it.
   - Apply this broad interpretation to ALL categories.
2. The letter check depends on the category type:
   - People (authors, scientists, athletes, etc.): the SURNAME determines the letter. Players may write first name, full name, or surname only. When a single name is given, ALWAYS check if it could be a valid surname — do NOT assume it is a first name. Example: "Tennessee Williams" is valid for W because surname "Williams" starts with W. "Einstein" and "Albert Einstein" are both valid for E. "Willis" is valid for W if there is a known person with surname Willis in the category (e.g., Kevin Willis in basketball).
   - Titles (movies, books, songs, etc.): ignore leading articles "The", "A", "An". Example: "The Godfather" is valid for G.
   - Geographic features (lakes, rivers, mountains, bays, capes, gulfs, etc.): IGNORE generic prefixes like "Lake", "River", "Mount", "Cape", "Bay", "Gulf", "Sea", "Ocean", "Isle". Use the proper name. Example: "Lake Erie" is valid for E (the lake's name is Erie). "Mount Everest" is valid for E. "River Thames" is valid for T.
   - Places (cities, countries, states, etc.): use the first word. Example: "New York" is valid for N.
   - Everything else: use the first letter of the answer.
3. Must be real and verifiable. Fictional entries are OK only if the category is about fiction (e.g., Cartoon Characters, Mythological Figures).
4. IMPORTANT: Your training data has a knowledge cutoff. You may NOT know about recent movies, songs, books, athletes, events, etc. If an answer sounds plausible for its category but you don't recognize it, mark it VALID and set explanation to "Not recognized but plausible — pending verification." A separate system will verify existence. NEVER reject an answer solely because you haven't heard of it.
5. Common abbreviations and nicknames are accepted if widely recognized (e.g., "JFK" for Kennedy, "USA" for United States).
6. Minor spelling errors are accepted if the intended answer is clearly recognizable.
7. Players may add parenthetical notes to disambiguate, e.g., "Larson (Far Side)" or "Newton (gravity)". IGNORE the parenthetical completely — do NOT use it as evidence for or against the answer. It is just a hint to help you identify who/what the player means.
8. Be generous — if a reasonable person would accept the answer in a casual game, accept it.
9. When in doubt, accept it. The player is playing solo for fun.

Respond with a JSON array only. No markdown fences. No extra text.
Each element: {"id":"rXcY","valid":boolean,"explanation":"...","canonical":"..."}`;

/**
 * Validate all answers in a game grid.
 * Returns a 5x5 array of { valid, explanation, canonical } objects.
 */
async function validate(answers, categories, letters) {
  const strictness = storage.getStrictness();
  const systemPrompt = strictness === 'lenient' ? SYSTEM_PROMPT_LENIENT : SYSTEM_PROMPT_STRICT;

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
    } catch {
      // API failed — return null to trigger self-scoring fallback
      return null;
    }
  }

  // Map API results back to the grid
  const resultMap = new Map();
  for (const r of apiResults) {
    resultMap.set(r.id, r);
  }

  // Map results and collect items needing Wikipedia verification
  const toVerify = [];   // valid answers — Wikipedia confirms existence
  const toRescue = [];   // rejected answers — Wikipedia may override Claude

  for (const item of toSubmit) {
    const apiResult = resultMap.get(item.id);
    const result = apiResult
      ? { valid: apiResult.valid, explanation: apiResult.explanation || '', canonical: apiResult.canonical || '' }
      : { valid: false, explanation: 'No ruling received', canonical: '' };

    results[item.row][item.col] = result;

    if (FICTION_CATEGORIES.has(item.category)) continue;

    if (result.valid) {
      // Verify valid answers actually exist
      toVerify.push({ item, result, query: result.canonical || item.answer });
    } else {
      // Rescue rejected answers if Wikipedia confirms they exist
      toRescue.push({ item, result, query: item.answer });
    }
  }

  // Run all Wikipedia checks in parallel
  const allChecks = [...toVerify, ...toRescue];
  if (allChecks.length > 0) {
    const checks = await Promise.all(
      allChecks.map(v => wikiCheck(v.query))
    );

    for (let i = 0; i < allChecks.length; i++) {
      const found = checks[i];
      const v = allChecks[i];
      const isRescue = i >= toVerify.length;

      if (isRescue && found === true) {
        // Wikipedia found it — Claude was wrong (likely knowledge cutoff)
        // Override to valid: it exists, letter/category check was based on bad premise
        v.result.valid = true;
        v.result.explanation = `Verified via Wikipedia. Claude did not recognize this answer (likely released after its knowledge cutoff).`;
        results[v.item.row][v.item.col] = v.result;
      } else if (!isRescue && found === false) {
        // Wikipedia couldn't find it — override to invalid
        v.result.valid = false;
        v.result.explanation = `Could not verify "${v.query}" exists. If this is wrong, appeal.`;
        results[v.item.row][v.item.col] = v.result;
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
  const strictness = storage.getStrictness();

  const prompt = `You are the appeals judge for "Facts in Five." A player's answer was rejected by the first judge and they are appealing.

Category: "${category}"
Required letter: "${letter}"
Player's answer: "${answer}"

Rules for judging:
- For people categories: the SURNAME determines the letter match. The player may write their full name, first name, or surname. Example: "Tennessee Williams" is valid for W (surname Williams). "Albert Einstein" is valid for E (surname Einstein).
- For titles: ignore leading "The", "A", "An". "The Godfather" = G.
- For places: first word counts. "New York" = N.
- For everything else: first letter of the answer.
- Must be real and verifiable (fictional OK if category is about fiction).
- If the answer includes a parenthetical note like "(gravity)" or "(Soviet leader)", IGNORE it completely. Do NOT fact-check it or use it for/against the answer. It is just a disambiguation hint.
- Do NOT reject because the person/thing is "primarily known as" something else. If it fits the category AT ALL, accept it.
- Geographic features: ignore "Lake", "River", "Mount" etc. — use the proper name for letter matching.
${strictness === 'lenient'
  ? '- Be generous. Accept common abbreviations, nicknames, and minor spelling errors if the intent is clear. When in doubt, accept it.'
  : '- Be fair but precise. Accept answers that genuinely fit the category and letter, even if unusual or obscure.'}

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
