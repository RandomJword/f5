// F5 Claude API — HTTP client for Anthropic Messages API
// Direct browser-to-API with dangerous-direct-browser-access header

import * as storage from './storage.js';

const API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-haiku-4-5-20251001';
const APPEAL_MODEL = 'claude-sonnet-4-6-20250514';
const API_VERSION = '2023-06-01';

async function call(systemPrompt, userMessage, maxTokens = 2000, { model } = {}) {
  const apiKey = storage.getApiKey();
  if (!apiKey) {
    throw new Error('No API key configured');
  }

  const res = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': API_VERSION,
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model: model || MODEL,
      max_tokens: maxTokens,
      temperature: 0,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`API ${res.status}: ${err.error?.message || 'Unknown error'}`);
  }

  const data = await res.json();
  return data.content[0].text;
}

export { call, MODEL, APPEAL_MODEL };
