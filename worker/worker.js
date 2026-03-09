// F5 API Proxy — Cloudflare Worker
// Hides the Anthropic API key, validates invite codes, rate limits per IP
//
// Environment variables (set via `wrangler secret put`):
//   ANTHROPIC_API_KEY — your Anthropic API key
//   INVITE_CODE       — passphrase you share with players
//
// KV namespace binding (see wrangler.toml):
//   RATE_LIMIT        — stores per-IP request counters + usage analytics
//
// Endpoints:
//   POST /          — proxy Claude API calls
//   POST /rescue    — web-search-assisted answer verification
//   GET  /verify    — invite code check
//   GET  /stats     — usage dashboard

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

const ALLOWED_MODELS = [
  'claude-haiku-4-5-20251001',
  'claude-sonnet-4-6',
];
const MAX_TOKENS_CAP = 4000;
const MAX_REQUESTS_PER_DAY = 500;
const RATE_WINDOW_SECONDS = 24 * 60 * 60;

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return handleCors(request, env);
    }

    // GET /verify — lightweight invite code check
    if (request.method === 'GET' && url.pathname === '/verify') {
      const origin = request.headers.get('Origin') || '';
      const cors = corsHeaders(origin);
      const code = request.headers.get('x-invite-code');
      if (code && code === env.INVITE_CODE) {
        return new Response(JSON.stringify({ valid: true }), {
          headers: { 'Content-Type': 'application/json', ...cors },
        });
      }
      return jsonError('Invalid invite code', 401, cors);
    }

    // GET /stats — usage dashboard
    if (request.method === 'GET' && url.pathname === '/stats') {
      const code = url.searchParams.get('code');
      if (code !== env.INVITE_CODE) {
        return jsonError('Invalid code', 401);
      }
      return getStats(env);
    }

    // POST /rescue — web search verification for answers
    if (request.method === 'POST' && url.pathname === '/rescue') {
      return handleRescue(request, env);
    }

    // Only POST for API proxy
    if (request.method !== 'POST') {
      return jsonError('Method not allowed', 405);
    }

    // CORS origin check
    const origin = request.headers.get('Origin') || '';
    const allowed = getAllowedOrigins(env);
    if (!allowed.includes('*') && !allowed.includes(origin)) {
      return jsonError('Origin not allowed', 403);
    }

    // All error responses from here on must include CORS headers
    // so the browser can read the error (otherwise Safari shows "Load failed")
    const cors = corsHeaders(origin);

    // Validate invite code
    const inviteCode = request.headers.get('x-invite-code');
    if (!inviteCode || inviteCode !== env.INVITE_CODE) {
      return jsonError('Invalid invite code', 401, cors);
    }

    // Rate limit by IP
    const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
    const limitResult = await checkRateLimit(env, ip);
    if (!limitResult.ok) {
      return jsonError(limitResult.message, 429, {
        'Retry-After': String(limitResult.retryAfter),
        ...cors,
      });
    }

    // Track usage (non-blocking)
    const ctx = { waitUntil: (p) => p };
    try {
      ctx.waitUntil = request.cf ? undefined : undefined;
    } catch {}
    trackUsage(env, ip);

    // Parse and validate request body
    let body;
    try {
      body = await request.json();
    } catch {
      return jsonError('Invalid JSON body', 400, cors);
    }

    if (!body.model || !ALLOWED_MODELS.includes(body.model)) {
      return jsonError(`Model not allowed. Use: ${ALLOWED_MODELS.join(', ')}`, 400, cors);
    }

    if (body.max_tokens > MAX_TOKENS_CAP) {
      body.max_tokens = MAX_TOKENS_CAP;
    }

    // Proxy to Anthropic (server-side — no dangerous-direct-browser-access needed)
    let anthropicRes;
    try {
      anthropicRes = await fetch(ANTHROPIC_API_URL, {
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
    } catch (fetchErr) {
      // Anthropic unreachable or Worker timeout — return error WITH CORS headers
      return jsonError(`Upstream API error: ${fetchErr.message}`, 502, cors);
    }

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

// --- Web Search Rescue ---

async function handleRescue(request, env) {
  const origin = request.headers.get('Origin') || '';
  const allowed = getAllowedOrigins(env);
  if (!allowed.includes('*') && !allowed.includes(origin)) {
    return jsonError('Origin not allowed', 403);
  }
  const cors = corsHeaders(origin);

  const inviteCode = request.headers.get('x-invite-code');
  if (!inviteCode || inviteCode !== env.INVITE_CODE) {
    return jsonError('Invalid invite code', 401, cors);
  }

  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  const limitResult = await checkRateLimit(env, ip);
  if (!limitResult.ok) {
    return jsonError(limitResult.message, 429, { ...cors });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body', 400, cors);
  }

  const { answer, category, letter } = body;
  if (!answer || !category) {
    return jsonError('Missing answer or category', 400, cors);
  }

  try {
    const result = await webSearchVerify(env, answer, category, letter);

    // Track the search
    trackRescueSearch(env, ip, answer, category, result.found);
    trackUsage(env, ip);

    return new Response(JSON.stringify(result), {
      headers: { 'Content-Type': 'application/json', ...cors },
    });
  } catch (err) {
    return jsonError(`Rescue search failed: ${err.message}`, 502, cors);
  }
}

async function webSearchVerify(env, answer, category, letter) {
  const res = await fetch(ANTHROPIC_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': env.ANTHROPIC_API_KEY,
      'anthropic-version': ANTHROPIC_VERSION,
    },
    body: JSON.stringify({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 300,
      temperature: 0,
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 1 }],
      messages: [{
        role: 'user',
        content: `Search the web to verify: Is "${answer}" a real, existing ${category.toLowerCase()}? I need factual verification only. Respond with JSON only, no markdown fences: {"found":true/false,"title":"official name","extract":"one sentence summary of what this is"}`,
      }],
    }),
  });

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return { found: false, error: 'Non-JSON response' };
  }

  if (!res.ok) {
    return { found: false, error: data.error?.message || 'API error' };
  }

  // Count web searches used
  const searchCount = data.usage?.server_tool_use?.web_search_requests || 0;

  // Extract text blocks from response
  const textBlocks = (data.content || []).filter(b => b.type === 'text');
  const fullText = textBlocks.map(b => b.text).join('\n');

  // Try to parse JSON from Claude's response
  try {
    const jsonMatch = fullText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        found: !!parsed.found,
        title: parsed.title || answer,
        extract: parsed.extract || '',
        searchCount,
      };
    }
  } catch {}

  // Fallback: check if response mentions the answer exists
  const lowerText = fullText.toLowerCase();
  const found = lowerText.includes('yes') || lowerText.includes('is a real') || lowerText.includes('exists');
  return { found, title: answer, extract: fullText.slice(0, 300), searchCount };
}

// --- Rescue Search Analytics ---

async function trackRescueSearch(env, ip, answer, category, found) {
  try {
    const day = todayKey();
    const key = `rescue:${day}`;
    const data = await env.RATE_LIMIT.get(key, 'json') || { searches: 0, found: 0, missed: 0, items: [] };

    data.searches++;
    if (found) data.found++;
    else data.missed++;
    data.items.push({ answer, category, found, ip: ip.split('.').pop(), time: new Date().toISOString().slice(11, 19) });

    // Keep last 50 items per day
    if (data.items.length > 50) data.items = data.items.slice(-50);

    await env.RATE_LIMIT.put(key, JSON.stringify(data), { expirationTtl: 90 * 86400 });
  } catch {
    // Analytics should never block requests
  }
}

// --- Usage Analytics ---

function todayKey() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

async function trackUsage(env, ip) {
  try {
    const day = todayKey();
    const key = `usage:${day}`;
    const data = await env.RATE_LIMIT.get(key, 'json') || { ips: {}, requests: 0 };

    data.requests++;
    data.ips[ip] = (data.ips[ip] || 0) + 1;

    // Keep daily stats for 90 days
    await env.RATE_LIMIT.put(key, JSON.stringify(data), { expirationTtl: 90 * 86400 });
  } catch {
    // Analytics should never block requests
  }
}

async function getStats(env) {
  try {
    // Scan last 30 days
    const days = [];
    let totalRequests = 0;
    const allIps = {};
    let totalRescueSearches = 0;
    let totalRescueFound = 0;
    let totalRescueMissed = 0;
    const rescueDays = [];
    const recentRescueItems = [];

    for (let i = 0; i < 30; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const day = d.toISOString().slice(0, 10);

      const data = await env.RATE_LIMIT.get(`usage:${day}`, 'json');
      if (data) {
        const uniqueIps = Object.keys(data.ips).length;
        days.push({ date: day, requests: data.requests, uniquePlayers: uniqueIps });
        totalRequests += data.requests;
        for (const [ip, count] of Object.entries(data.ips)) {
          allIps[ip] = (allIps[ip] || 0) + count;
        }
      }

      const rescue = await env.RATE_LIMIT.get(`rescue:${day}`, 'json');
      if (rescue) {
        rescueDays.push({ date: day, ...rescue });
        totalRescueSearches += rescue.searches;
        totalRescueFound += rescue.found;
        totalRescueMissed += rescue.missed;
        recentRescueItems.push(...(rescue.items || []));
      }
    }

    const uniquePlayersAllTime = Object.keys(allIps).length;
    const estimatedCost = (totalRescueSearches * 0.01).toFixed(2);

    const players = Object.entries(allIps)
      .map(([ip, count]) => ({ ip: '*.*.*.'+ip.split('.').pop(), requests: count }))
      .sort((a, b) => b.requests - a.requests);

    const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>F5 Usage Stats</title>
<style>
  body { font-family: system-ui; max-width: 700px; margin: 2rem auto; padding: 0 1rem; background: #1E1209; color: #E8DCC8; }
  h1 { font-size: 1.5rem; }
  h2 { font-size: 1.2rem; margin-top: 2rem; color: #B8860B; }
  .card { background: #2A1F14; border-radius: 8px; padding: 1rem; margin-bottom: 1rem; }
  .cards { display: flex; gap: 1rem; flex-wrap: wrap; }
  .cards .card { flex: 1; min-width: 120px; }
  .big { font-size: 2rem; font-weight: bold; color: #B8860B; }
  .mid { font-size: 1.4rem; font-weight: bold; color: #B8860B; }
  .green { color: #4a8; }
  .red { color: #c44; }
  .muted { color: #A8956E; font-size: 0.85rem; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 0.4rem 0.6rem; border-bottom: 1px solid #3A2A18; }
  th { color: #A8956E; font-size: 0.85rem; text-transform: uppercase; }
  .badge { display: inline-block; padding: 1px 6px; border-radius: 4px; font-size: 0.75rem; }
  .badge-found { background: #1a3a1a; color: #4a8; }
  .badge-miss { background: #3a1a1a; color: #c44; }
</style></head><body>
<h1>F5 Dashboard</h1>

<div class="cards">
  <div class="card">
    <div class="big">${uniquePlayersAllTime}</div>
    <div>unique players (30d)</div>
  </div>
  <div class="card">
    <div class="big">${totalRequests}</div>
    <div>API requests (30d)</div>
  </div>
</div>

<h2>Web Search Rescue</h2>
<div class="cards">
  <div class="card">
    <div class="mid">${totalRescueSearches}</div>
    <div>searches (30d)</div>
  </div>
  <div class="card">
    <div class="mid green">${totalRescueFound}</div>
    <div>found</div>
  </div>
  <div class="card">
    <div class="mid red">${totalRescueMissed}</div>
    <div>missed</div>
  </div>
  <div class="card">
    <div class="mid">$${estimatedCost}</div>
    <div>est. cost</div>
  </div>
</div>

${recentRescueItems.length > 0 ? `
<h2>Recent Rescue Searches</h2>
<table>
  <tr><th>Answer</th><th>Category</th><th>Result</th><th>Time</th></tr>
  ${recentRescueItems.slice(-20).reverse().map(r =>
    `<tr><td>${esc(r.answer)}</td><td>${esc(r.category)}</td><td><span class="badge ${r.found ? 'badge-found' : 'badge-miss'}">${r.found ? 'Found' : 'Miss'}</span></td><td class="muted">${r.time || ''}</td></tr>`
  ).join('')}
</table>` : ''}

${rescueDays.length > 0 ? `
<h2>Rescue by Day</h2>
<table>
  <tr><th>Date</th><th>Searches</th><th>Found</th><th>Missed</th><th>Cost</th></tr>
  ${rescueDays.map(d =>
    `<tr><td>${d.date}</td><td>${d.searches}</td><td class="green">${d.found}</td><td class="red">${d.missed}</td><td>$${(d.searches * 0.01).toFixed(2)}</td></tr>`
  ).join('')}
</table>` : ''}

<h2>API Requests by Day</h2>
<table>
  <tr><th>Date</th><th>Requests</th><th>Players</th></tr>
  ${days.map(d => `<tr><td>${d.date}</td><td>${d.requests}</td><td>${d.uniquePlayers}</td></tr>`).join('')}
</table>
<h2>Players</h2>
<table>
  <tr><th>IP (masked)</th><th>Requests</th></tr>
  ${players.map(p => `<tr><td>${p.ip}</td><td>${p.requests}</td></tr>`).join('')}
</table>
</body></html>`;

    return new Response(html, {
      headers: { 'Content-Type': 'text/html' },
    });
  } catch (err) {
    return jsonError('Failed to read stats: ' + err.message, 500);
  }
}

function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

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
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
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
