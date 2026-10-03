export const config = { runtime: 'edge' };
import { rateLimit, reserveSpend, settleSpend, bodyTooLarge } from './_lib/ai-guard.js';

const SOURCES = {
  markets:    { label:'Markets & Finance',  q:'stock market financial news breaking today' },
  world:      { label:'World News',         q:'world international breaking news today' },
  technology: { label:'Technology',         q:'technology tech industry news today' },
  politics:   { label:'Politics & Policy',  q:'politics government policy breaking news today' },
  energy:     { label:'Energy & Climate',   q:'energy oil gas climate news today' },
  business:   { label:'Business & Economy', q:'business economy corporate news today' },
  science:    { label:'Science & Health',   q:'science health medical news today' },
  finance:    { label:'Personal Finance',   q:'personal finance interest rates banking today' },
};

export default async function handler(req) {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: cors });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...cors, 'Content-Type': 'application/json' } });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({
      type: 'error',
      error: { type: 'unavailable', message: 'News is unavailable right now.' }
    }), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } });
  }

  const deny = (status, type, message, extra = {}) => new Response(JSON.stringify({ type: 'error', error: { type, message } }),
    { status, headers: { ...cors, 'Content-Type': 'application/json', ...extra } });
  if (bodyTooLarge(req, 16_000)) return deny(413, 'too_large', 'Request too large.');
  // One page load fetches 8 categories ~3 s apart; 10/min + 80/day per IP covers ten loads a day.
  const rl = await rateLimit(req, 'proxy', [[10, 60], [80, 86400]]);
  if (!rl.ok) return deny(429, 'rate_limited', 'Too many requests. Please try again later.', { 'Retry-After': String(rl.retryAfter) });

  let reserved = 0;
  try {
    const body = await req.json();
    const cat = body._category;
    let requestBody;

    if (cat && SOURCES[cat]) {
      const s = SOURCES[cat];
      // Compact prompt - stays well under 50k token rate limit
      requestBody = {
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1500,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        system: `News editor. Search for 6 recent ${s.label} stories. Write original prose only - never copy source text. Return ONLY a raw JSON array: [{"headline":"under 12 words","summary":"2 sentences with real facts","source":"publication","category":"${cat}","urgency":"breaking|developing|analysis","age":"e.g. 1 hour ago"}]`,
        messages: [{ role: 'user', content: `Search: "${s.q}" and return 6 stories as JSON array only, nothing else.` }]
      };
    } else {
      // Closed 2026-10-03 (his ruling "switch off and fix it"): the free-form branch forwarded ANY client-built request to the
      // AI provider on our key. The page only ever sends {_category}; anything else is refused.
      return new Response(JSON.stringify({ type: 'error', error: { type: 'bad_request', message: 'Unknown category.' } }), { status: 400, headers: { ...cors, 'Content-Type': 'application/json' } });
    }

    // Worst case: prompt + up to 20k tokens of search results in, full max_tokens out, 5 searches.
    const maxOut = Math.min(Number(requestBody.max_tokens) || 1500, 1500);
    const spend = await reserveSpend(Math.ceil(JSON.stringify(requestBody).length / 2) + 20_000, maxOut, 5);
    if (!spend.ok) return deny(503, 'daily_budget', 'News is paused for today. Please come back tomorrow.');
    reserved = spend.reserved;

    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'web-search-2025-03-05',
      },
      body: JSON.stringify(requestBody),
    });

    const data = await upstream.json();
    await settleSpend(reserved, data.usage);
    return new Response(JSON.stringify(data), {
      status: upstream.status,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    return new Response(JSON.stringify({
      type: 'error',
      error: { type: 'unavailable', message: 'News is unavailable right now.' }
    }), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
}
