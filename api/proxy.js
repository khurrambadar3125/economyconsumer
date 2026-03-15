export const config = { runtime: 'edge' };

const SOURCES = {
  markets:    { label:'Markets & Finance',  pubs:['Bloomberg','Financial Times','Wall Street Journal','Reuters Markets','CNBC','MarketWatch','Barrons','Investor\'s Business Daily'], q:['markets finance breaking news today','stock market news today','financial markets analysis today','global markets update today'] },
  world:      { label:'World News',         pubs:['Reuters','Associated Press','BBC News','New York Times','Washington Post','The Guardian','Al Jazeera','AFP'], q:['world breaking news today','international news today','global news breaking today','world events today'] },
  technology: { label:'Technology',         pubs:['Bloomberg Technology','Wall Street Journal Tech','Reuters Technology','New York Times Tech','Financial Times Tech','Wired','TechCrunch','The Verge'], q:['technology breaking news today','tech industry news today','AI technology news today','technology business news today'] },
  politics:   { label:'Politics & Policy',  pubs:['New York Times','Washington Post','Reuters Politics','Financial Times','Politico','The Guardian','BBC Politics','AP Politics'], q:['politics breaking news today','government policy news today','international politics today','political news breaking today'] },
  energy:     { label:'Energy & Climate',   pubs:['Bloomberg Energy','Reuters Energy','Financial Times Energy','Wall Street Journal Energy','New York Times Climate','Guardian Environment','Axios Energy'], q:['energy oil gas breaking news today','climate energy news today','renewable energy news today','oil gas prices news today'] },
  business:   { label:'Business & Economy', pubs:['Bloomberg','Financial Times','Wall Street Journal','Reuters Business','New York Times Business','The Economist','Fortune','Forbes'], q:['business economy breaking news today','corporate news today','economy news breaking today','global business news today'] },
  science:    { label:'Science & Health',   pubs:['Reuters Health','BBC Science','New York Times Science','Washington Post Health','The Guardian Science','Nature News','AP Science'], q:['science health breaking news today','medical research news today','health news breaking today','science discovery news today'] },
  finance:    { label:'Personal Finance',   pubs:['Wall Street Journal','Financial Times','Reuters','Bloomberg','Kiplinger','Forbes Finance','MarketWatch Personal Finance'], q:['personal finance news today','interest rates inflation news today','banking consumer finance today','savings investment news today'] },
};

const SYSTEM = (cat, s) => `You are a senior editor at an independent global news platform. Current UTC time: ${new Date().toUTCString()}.

Your task: Search for the 8 most important ${s.label} news stories published in the LAST 12 HOURS. Read from top global publications: ${s.pubs.join(', ')}.

Run ALL of these searches to find stories:
- "${s.q[0]}"
- "${s.q[1]}"
- "${s.q[2]}"
- "${s.q[3]}"

MANDATORY LEGAL RULES — non-negotiable:
1. NEVER copy, quote, or reproduce ANY text from any source article. Write 100% original prose.
2. Extract only facts (names, numbers, events, dates) — these are not copyrightable.
3. Write every story completely from scratch in your own editorial voice.
4. Your summaries must be unrecognisable from the original source text.
5. Only use real verified news from TODAY or the last 12 hours. No old news.
6. Include specific names, companies, dollar amounts, percentages where available.
7. Each summary should be 3-4 sentences of rich, informative editorial prose.

Return ONLY a raw JSON array — absolutely nothing before [ or after ]. Exactly 8 objects:
[
  {
    "headline": "Specific original headline under 14 words with key fact or name",
    "summary": "3-4 sentences of rich original editorial prose with real specific facts, names, figures. Written in authoritative editorial style.",
    "source": "Primary publication name where story originated",
    "category": "${cat}",
    "urgency": "breaking|developing|analysis",
    "age": "e.g. 2 hours ago or this morning",
    "readTime": "e.g. 2 min read"
  }
]`;

export default async function handler(req) {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  };

  if (req.method === 'OPTIONS') return new Response(null, { status: 200, headers: cors });
  if (req.method !== 'POST') return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...cors, 'Content-Type': 'application/json' } });

  try {
    const body = await req.json();
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return new Response(JSON.stringify({
      error: 'ANTHROPIC_API_KEY not configured. Go to Vercel dashboard → your project → Settings → Environment Variables → add ANTHROPIC_API_KEY'
    }), { status: 500, headers: { ...cors, 'Content-Type': 'application/json' } });

    const cat = body._category;
    if (cat && SOURCES[cat]) {
      const s = SOURCES[cat];
      body.system = SYSTEM(cat, s);
      body.messages = [{
        role: 'user',
        content: `Search for the 8 most important ${s.label} news stories from the last 12 hours.\n\nRun all these searches:\n"${s.q[0]}"\n"${s.q[1]}"\n"${s.q[2]}"\n"${s.q[3]}"\n\nRead actual articles from: ${s.pubs.slice(0, 5).join(', ')}.\n\nExtract the facts. Write 8 completely original stories in your own words with 3-4 sentence summaries. Return ONLY the JSON array.`
      }];
      delete body._category;
    }

    // Correct Haiku model string
    body.model = 'claude-haiku-4-5-20251001';
    body.max_tokens = 4000;
    body.tools = [{ type: 'web_search_20250305', name: 'web_search' }];

    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'web-search-2025-03-05',
      },
      body: JSON.stringify(body),
    });

    const data = await upstream.json();
    return new Response(JSON.stringify(data), {
      status: upstream.status,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...cors, 'Content-Type': 'application/json' },
    });
  }
}
