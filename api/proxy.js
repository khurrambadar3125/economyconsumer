export const config = { runtime: 'edge' };

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
      error: { type: 'no_api_key', message: 'ANTHROPIC_API_KEY is not set in Vercel Environment Variables.' }
    }), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } });
  }

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
      requestBody = { ...body };
      requestBody.model = 'claude-haiku-4-5-20251001';
      if (requestBody.max_tokens > 600) requestBody.max_tokens = 600;
      delete requestBody._category;
    }

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
    return new Response(JSON.stringify(data), {
      status: upstream.status,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    return new Response(JSON.stringify({
      type: 'error',
      error: { type: 'proxy_exception', message: err.message }
    }), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } });
  }
}
