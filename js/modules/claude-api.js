// F5 Claude API — HTTP client for Anthropic Messages API
// Supports two modes:
//   1. Direct browser-to-API (player's own key)
//   2. Proxied via Cloudflare Worker (invite code, host's key)

import * as storage from './storage.js';

const DIRECT_API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';
const MODEL = 'claude-haiku-4-5-20251001';
const APPEAL_MODEL = 'claude-sonnet-4-6';

const PROXY_URL = 'https://f5-proxy.f5family.workers.dev';

async function call(systemPrompt, userMessage, maxTokens = 2000, { model } = {}) {
  const useModel = model || MODEL;
  const inviteCode = storage.getInviteCode();
  const apiKey = storage.getApiKey();

  if (!inviteCode && !apiKey) {
    throw new Error('No API key or invite code configured');
  }

  try {
    if (inviteCode && PROXY_URL) {
      return await callProxy(systemPrompt, userMessage, maxTokens, useModel, inviteCode);
    }
    return await callDirect(systemPrompt, userMessage, maxTokens, useModel, apiKey);
  } catch (err) {
    // Fallback to Sonnet on 5xx errors (only when originally using Haiku)
    if (useModel === MODEL && /5\d\d/.test(err.message)) {
      console.warn(`[F5 API] ${MODEL} failed (${err.message}), falling back to ${APPEAL_MODEL}`);
      if (inviteCode && PROXY_URL) {
        return callProxy(systemPrompt, userMessage, maxTokens, APPEAL_MODEL, inviteCode);
      }
      return callDirect(systemPrompt, userMessage, maxTokens, APPEAL_MODEL, apiKey);
    }
    throw err;
  }
}

async function callDirect(systemPrompt, userMessage, maxTokens, model, apiKey) {
  const res = await fetch(DIRECT_API_URL, {
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

async function callProxy(systemPrompt, userMessage, maxTokens, model, inviteCode) {
  const res = await fetch(PROXY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-invite-code': inviteCode,
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

function hasProxy() {
  return !!PROXY_URL;
}

export { call, MODEL, APPEAL_MODEL, hasProxy };
