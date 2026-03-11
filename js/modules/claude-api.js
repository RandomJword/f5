// F5 Claude API — HTTP client for Anthropic Messages API
// Supports two modes:
//   1. Direct browser-to-API (player's own key)
//   2. Proxied via Cloudflare Worker (invite code, host's key)

import * as storage from './storage.js?v=20260311a';

const DIRECT_API_URL = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2023-06-01';
const MODEL = 'claude-haiku-4-5-20251001';
const APPEAL_MODEL = 'claude-sonnet-4-6';

const PROXY_URL = 'https://f5-proxy.f5family.workers.dev';
const RETRY_DELAY_MS = 3000;

function isNetworkError(err) {
  const msg = err.message?.toLowerCase() || '';
  return msg.includes('load failed') || msg.includes('failed to fetch') || msg.includes('networkerror');
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function callWithRetry(systemPrompt, userMessage, maxTokens, model, inviteCode, apiKey) {
  const doCall = () => inviteCode && PROXY_URL
    ? callProxy(systemPrompt, userMessage, maxTokens, model, inviteCode)
    : callDirect(systemPrompt, userMessage, maxTokens, model, apiKey);

  try {
    return await doCall();
  } catch (err) {
    // Retry once after delay on network errors (Load failed, Failed to fetch)
    if (isNetworkError(err)) {
      console.warn(`[F5 API] ${model} network error (${err.message}), retrying in ${RETRY_DELAY_MS}ms...`);
      await wait(RETRY_DELAY_MS);
      return await doCall();
    }
    throw err;
  }
}

async function call(systemPrompt, userMessage, maxTokens = 2000, { model } = {}) {
  const useModel = model || MODEL;
  const inviteCode = storage.getInviteCode();
  const apiKey = storage.getApiKey();

  if (!inviteCode && !apiKey) {
    throw new Error('No API key or invite code configured');
  }

  try {
    return await callWithRetry(systemPrompt, userMessage, maxTokens, useModel, inviteCode, apiKey);
  } catch (err) {
    // Fallback to Sonnet on any error (only when originally using Haiku)
    if (useModel === MODEL) {
      console.warn(`[F5 API] ${MODEL} failed (${err.message}), falling back to ${APPEAL_MODEL}`);
      try {
        return await callWithRetry(systemPrompt, userMessage, maxTokens, APPEAL_MODEL, inviteCode, apiKey);
      } catch (fallbackErr) {
        console.error(`[F5 API] ${APPEAL_MODEL} also failed:`, fallbackErr.message);
        throw new Error(`Both models failed. Haiku: ${err.message} | Sonnet: ${fallbackErr.message}`);
      }
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

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`API returned non-JSON (${res.status}): ${text.slice(0, 200)}`);
  }

  if (!res.ok) {
    throw new Error(`API ${res.status}: ${data.error?.message || 'Unknown error'}`);
  }

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

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`Proxy returned non-JSON (${res.status}): ${text.slice(0, 200)}`);
  }

  if (!res.ok) {
    throw new Error(`API ${res.status}: ${data.error?.message || 'Unknown error'}`);
  }

  return data.content[0].text;
}

/**
 * Web search rescue — ask proxy to verify an answer via Claude web search.
 * Only works with invite code (proxy mode). Returns { found, title, extract }.
 */
async function rescueSearch(answer, category, letter) {
  const inviteCode = storage.getInviteCode();
  if (!inviteCode || !PROXY_URL) {
    return { found: false, error: 'No proxy available' };
  }

  const res = await fetch(`${PROXY_URL}/rescue`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-invite-code': inviteCode,
    },
    body: JSON.stringify({ answer, category, letter }),
  });

  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { found: false, error: 'Non-JSON response' };
  }
}

async function verifyInviteCode(code) {
  const res = await fetch(`${PROXY_URL}/verify`, {
    method: 'GET',
    headers: { 'x-invite-code': code },
  });
  return res.ok;
}

function hasProxy() {
  return !!PROXY_URL;
}

export { call, MODEL, APPEAL_MODEL, hasProxy, verifyInviteCode, rescueSearch };
