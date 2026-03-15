export const config = { runtime: 'edge' };

const SOURCES = {
  markets:    { label:'Markets & Finance',  q:['stock market breaking news today','financial markets update today','global markets news today','economy finance news today'] },
  world:      { label:'World News',         q:['world breaking news today','international news today','global news breaking today','world events today'] },
  technology: { label:'Technology',         q:['technology breaking news today','tech industry news today','AI technology news today','technology business news today'] },
  politics:   { label:'Politics & Policy',  q:['politics breaking news today','government policy news today','international politics today','political news today'] },
  energy:     { label:'Energy & Climate',   q:['energy oil gas news today','climate energy news today','oil prices news today','renewable energy news today'] },
  business:   { label:'Business & Economy', q:['business economy news today','corporate news today','economy news today','global business news today'] },
  science:    { label:'Science & Health',   q:['science health news today','medical news today','health breaking news today','science discovery today'] },
  finance:    { label:'Personal Finance',   q:['personal finance news today','interest rates news today','banking finance news today','consumer finance today'] },
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
      error: { type: 'no_api_key', message: 'ANTHROPIC_API_KEY is not set in Vercel Environment Variables. Go to vercel.com → your project → Settings → Environment Variables → add it.' }
    }), { status: 200, headers: { ...cors, 'Content-Type': 'application/json' } });
  }

  try {
    const body = await req.json();
    const cat = body._category;

    let requestBody;

    if (cat && SOURCES[cat]) {
      const s = SOURCES[cat];
      requestBody = {
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4000,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        system: `You are a senior news editor. Today's date: ${new Date().toUTCString()}. Search for the 8 most important ${s.label} stories from the last 12 hours. RULES: Write 100% original prose. Never copy source text. Only use real facts from today. Return ONLY a raw JSON array with no text before or after it: [{"headline":"headline under 14 words","summary":"3 sentences of original editorial prose with specific facts","source":"publication name","category":"${cat}","urgency":"breaking|developing|analysis","age":"e.g. 2 hours ago","readTime":"e.g. 2 min read"}]`,
        messages: [{
          role: 'user',
          content: `Search for the latest ${s.label} news now:\n"${s.q[0]}"\n"${s.q[1]}"\n"${s.q[2]}"\nReturn only the JSON array of 8 stories, nothing else.`
        }]
      };
    } else {
      // Pass through as-is (for markets fetch)
      requestBody = { ...body };
      requestBody.model = 'claude-haiku-4-5-20251001';
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
