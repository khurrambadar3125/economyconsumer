export const config = { runtime: 'edge' };

const SOURCES = {
  markets:    { label:'Markets & Finance',  pubs:['Bloomberg','Financial Times','Wall Street Journal','Reuters Markets','CNBC','MarketWatch'], q:['Bloomberg markets breaking news today','Financial Times markets news today','Reuters financial markets breaking today','WSJ markets news today'] },
  world:      { label:'World News',         pubs:['Reuters','Associated Press','BBC News','New York Times','Washington Post','Guardian'], q:['Reuters world breaking news today','BBC breaking news today','New York Times world news today','Washington Post breaking news today'] },
  technology: { label:'Technology',         pubs:['Bloomberg Technology','Wall Street Journal Tech','Reuters Technology','New York Times Tech','Financial Times Tech'], q:['Bloomberg technology breaking news today','Wall Street Journal tech news today','Reuters technology news today','NYT tech breaking today'] },
  politics:   { label:'Politics & Policy',  pubs:['New York Times','Washington Post','Reuters Politics','Financial Times','Politico','Bloomberg Politics'], q:['New York Times politics breaking today','Washington Post politics news today','Reuters politics breaking today','Politico breaking news today'] },
  energy:     { label:'Energy & Climate',   pubs:['Bloomberg Energy','Reuters Energy','Financial Times Energy','Wall Street Journal Energy','New York Times Climate'], q:['Bloomberg energy oil gas breaking today','Reuters energy news today','Financial Times energy climate today','WSJ energy breaking today'] },
  business:   { label:'Business & Economy', pubs:['Bloomberg','Financial Times','Wall Street Journal','Reuters Business','New York Times Business','The Economist'], q:['Bloomberg business breaking news today','Financial Times business today','Wall Street Journal business breaking today','Reuters business news today'] }
};

const SYSTEM = (cat, s) => `You are a senior editor at an independent global news platform. Current UTC time: ${new Date().toUTCString()}.

Search for the LATEST breaking ${s.label} news published TODAY from: ${s.pubs.join(', ')}.

Search queries to run:
- "${s.q[0]}"
- "${s.q[1]}"
- "${s.q[2]}"
- "${s.q[3]}"

LEGAL RULES — mandatory:
1. NEVER copy or quote any text from sources. Write 100% original prose.
2. Extract only facts (names, numbers, events) — these are not copyrightable.
3. Write each story from scratch in your own editorial voice.
4. Only use real verified news from TODAY.

Return ONLY a raw JSON array, nothing before [ or after ]:
[{"headline":"Original headline under 12 words","summary":"2-3 sentences original editorial prose with real facts in Financial Times style","source":"Publication name","category":"${cat}","urgency":"breaking|developing|analysis","age":"e.g. 1 hour ago"}]`;

export default async function handler(req) {
  const cors = { 'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type' };
  if (req.method === 'OPTIONS') return new Response(null, { status:200, headers:cors });
  if (req.method !== 'POST') return new Response(JSON.stringify({error:'Method not allowed'}), { status:405, headers:{...cors,'Content-Type':'application/json'} });

  try {
    const body = await req.json();
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return new Response(JSON.stringify({error:'ANTHROPIC_API_KEY not configured in Vercel Environment Variables'}), { status:500, headers:{...cors,'Content-Type':'application/json'} });

    const cat = body._category;
    if (cat && SOURCES[cat]) {
      const s = SOURCES[cat];
      body.system = SYSTEM(cat, s);
      body.messages = [{ role:'user', content:`Search these publications NOW: ${s.pubs.join(', ')}.\nQueries:\n"${s.q[0]}"\n"${s.q[1]}"\n"${s.q[2]}"\n"${s.q[3]}"\nReturn only the JSON array of 4 original stories.` }];
      delete body._category;
    }

    body.model = 'claude-sonnet-4-5';
    body.max_tokens = 2000;
    body.tools = [{ type:'web_search_20250305', name:'web_search' }];

    const upstream = await fetch('https://api.anthropic.com/v1/messages', {
      method:'POST',
      headers:{ 'Content-Type':'application/json','x-api-key':apiKey,'anthropic-version':'2023-06-01','anthropic-beta':'web-search-2025-03-05' },
      body: JSON.stringify(body),
    });

    const data = await upstream.json();
    return new Response(JSON.stringify(data), { status:upstream.status, headers:{...cors,'Content-Type':'application/json'} });
  } catch (err) {
    return new Response(JSON.stringify({error:err.message}), { status:500, headers:{...cors,'Content-Type':'application/json'} });
  }
}
