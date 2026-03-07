// F5 API Proxy — Cloudflare Worker
// Hides the Anthropic API key, validates invite codes, rate limits per IP
//
// Environment variables (set via `wrangler secret put`):
//   ANTHROPIC_API_KEY — your Anthropic API key
//   INVITE_CODE       — passphrase you share with players
//
// KV namespace binding (see wrangler.toml):
//   RATE_LIMIT        — stores per-IP request counters

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

const ALLOWED_MODELS = [
  'claude-haiku-4-5-20251001',
  'claude-sonnet-4-6',
];
const MAX_TOKENS_CAP = 4000;
const MAX_REQUESTS_PER_DAY = 100;
const RATE_WINDOW_SECONDS = 24 * 60 * 60;

export default {
  async fetch(request, env) {
    // CORS preflight
    if (request.method === 'OPTIONS') {
      return handleCors(request, env);
    }

    // Only POST allowed
    if (request.method !== 'POST') {
      return jsonError('Method not allowed', 405);
    }

    // CORS origin check
    const origin = request.headers.get('Origin') || '';
    const allowed = getAllowedOrigins(env);
    if (!allowed.includes('*') && !allowed.includes(origin)) {
      return jsonError('Origin not allowed', 403);
    }

    // Validate invite code
    const inviteCode = request.headers.get('x-invite-code');
    if (!inviteCode || inviteCode !== env.INVITE_CODE) {
      return jsonError('Invalid invite code', 401);
    }

    // Rate limit by IP
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const limitResult = await checkRateLimit(env, ip);
    if (!limitResult.ok) {
      return jsonError(limitResult.message, 429, {
        'Retry-After': String(limitResult.retryAfter),
      });
    }

    // Parse and validate request body
    let body;
    try {
      body = await request.json();
    } catch {
      return jsonError('Invalid JSON body', 400);
    }

    if (!body.model || !ALLOWED_MODELS.includes(body.model)) {
      return jsonError(`Model not allowed. Use: ${ALLOWED_MODELS.join(', ')}`, 400);
    }

    if (body.max_tokens > MAX_TOKENS_CAP) {
      body.max_tokens = MAX_TOKENS_CAP;
    }

    // Proxy to Anthropic (server-side — no dangerous-direct-browser-access needed)
    const anthropicRes = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': ANTHROPIC_VERSION,
      },
      body: JSON.stringify({
        model: body.model,
        max_tokens: body.max_tokens || 2000,
        temperature: body.temperature ?? 0,
        system: body.system,
        messages: body.messages,
      }),
    });

    const responseBody = await anthropicRes.text();

    return new Response(responseBody, {
      status: anthropicRes.status,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders(origin),
      },
    });
  },
};

// --- Rate Limiting ---

async function checkRateLimit(env, ip) {
  const key = `rate:${ip}`;
  const now = Math.floor(Date.now() / 1000);

  let data;
  try {
    data = await env.RATE_LIMIT.get(key, 'json');
  } catch {
    // KV read failed — allow the request (fail open for availability)
    return { ok: true };
  }

  if (data && (now - data.windowStart) < RATE_WINDOW_SECONDS) {
    if (data.count >= MAX_REQUESTS_PER_DAY) {
      const retryAfter = RATE_WINDOW_SECONDS - (now - data.windowStart);
      return { ok: false, message: 'Rate limit exceeded. Try again tomorrow.', retryAfter };
    }
    // Increment
    await env.RATE_LIMIT.put(key, JSON.stringify({
      windowStart: data.windowStart,
      count: data.count + 1,
    }), { expirationTtl: RATE_WINDOW_SECONDS });
  } else {
    // New window
    await env.RATE_LIMIT.put(key, JSON.stringify({
      windowStart: now,
      count: 1,
    }), { expirationTtl: RATE_WINDOW_SECONDS });
  }

  return { ok: true };
}

// --- CORS ---

function getAllowedOrigins(env) {
  return (env.ALLOWED_ORIGINS || '*').split(',').map(o => o.trim());
}

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-invite-code',
  };
}

function handleCors(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowed = getAllowedOrigins(env);

  if (!allowed.includes('*') && !allowed.includes(origin)) {
    return new Response(null, { status: 403 });
  }

  return new Response(null, {
    headers: {
      ...corsHeaders(origin),
      'Access-Control-Max-Age': '86400',
    },
  });
}

// --- Helpers ---

function jsonError(message, status, extraHeaders = {}) {
  return new Response(JSON.stringify({ error: { message } }), {
    status,
    headers: { 'Content-Type': 'application/json', ...extraHeaders },
  });
}
