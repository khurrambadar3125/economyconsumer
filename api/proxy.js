export const config = { runtime: 'edge' };

const SOURCES = {
  markets:    { label:'Markets & Finance',  pubs:['Bloomberg','Financial Times','Wall Street Journal','Reuters Markets','CNBC','MarketWatch','Barrons'], q:['Bloomberg markets breaking news today','Financial Times markets news today','Reuters financial markets breaking today','WSJ markets news today'] },
  world:      { label:'World News',         pubs:['Reuters','Associated Press','BBC News','New York Times','Washington Post','Guardian','Financial Times'], q:['Reuters world breaking news today','BBC breaking news today','New York Times world news today','Washington Post breaking news today'] },
  technology: { label:'Technology',         pubs:['Bloomberg Technology','Wall Street Journal Tech','Reuters Technology','New York Times Tech','Financial Times Tech','Wired'], q:['Bloomberg technology breaking news today','Wall Street Journal tech news today','Reuters technology news today','NYT tech breaking today'] },
  politics:   { label:'Politics & Policy',  pubs:['New York Times','Washington Post','Reuters Politics','Financial Times Politics','Politico','Bloomberg Politics'], q:['New York Times politics breaking today','Washington Post politics news today','Reuters politics breaking today','Politico breaking news today'] },
  energy:     { label:'Energy & Climate',   pubs:['Bloomberg Energy','Reuters Energy','Financial Times Energy','Wall Street Journal Energy','New York Times Climate'], q:['Bloomberg energy oil gas breaking today','Reuters energy news today','Financial Times energy climate today','WSJ energy breaking today'] },
  business:   { label:'Business & Economy', pubs:['Bloomberg','Financial Times','Wall Street Journal','Reuters Business','New York Times Business','The Economist','Fortune'], q:['Bloomberg business breaking news today','Financial Times business today','Wall Street Journal business breaking today','Reuters business news today'] }
};

const SYSTEM = (cat, s) => `You are a senior editor at an independent global news platform. Current UTC time: ${new Date().toUTCString()}.

TASK: Search for the very latest breaking ${s.label} news published TODAY from these publications: ${s.pubs.join(', ')}.

Run multiple searches using these queries:
- "${s.q[0]}"
- "${s.q[1]}"
- "${s.q[2]}"
- "${s.q[3]}"

STRICT EDITORIAL RULES — these are legal requirements:
1. NEVER copy, quote, or reproduce ANY text from any source article. Not even a single phrase.
2. After reading source articles, write ENTIRELY NEW original prose in your own editorial voice.
3. Extract only the factual information (names, numbers, dates, events) — these facts are not copyrightable.
4. Rewrite every story completely from scratch as if you are an independent journalist who read the source and is now writing their own original story.
5. Your summaries must be unrecognisable compared to the original source text.
6. Only use real verified facts from today's news. Never invent details.
7. Include specific names, companies, dollar amounts, percentages where reported.
8. Classify urgency honestly: "breaking" = happened in last 2 hours, "developing" = ongoing story, "analysis" = expert commentary or trend piece.

OUTPUT FORMAT: Return ONLY a raw JSON array — absolutely nothing before [ or after ] — with exactly 4 objects:
[{"headline":"Original headline under 12 words with key fact","summary":"2-3 sentences of original editorial prose with specific real facts. Written in your own voice, not copied from any source.","source":"Publication name where story was first reported","category":"${cat}","urgency":"breaking|developing|analysis","age":"e.g. 1 hour ago or 3 hours ago"}]`;

export default async function handler(req) {
  const cors = { 'Access-Control-Allow-Origin':'*','Access-Control-Allow-Methods':'POST,OPTIONS','Access-Control-Allow-Headers':'Content-Type' };
  if (req.method === 'OPTIONS') return new Response(null, { status:200, headers:cors });
  if (req.method !== 'POST') return new Response(JSON.stringify({error:'Method not allowed'}), { status:405, headers:{...cors,'Content-Type':'application/json'} });

  try {
    const body = await req.json();
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return new Response(JSON.stringify({error:'ANTHROPIC_API_KEY not set in Vercel Environment Variables. Go to Vercel dashboard → your project → Settings → Environment Variables.'}), { status:500, headers:{...cors,'Content-Type':'application/json'} });

    const cat = body._category;
    if (cat && SOURCES[cat]) {
      const s = SOURCES[cat];
      body.system = SYSTEM(cat, s);
      body.messages = [{ role:'user', content:`Search these publications RIGHT NOW for breaking ${s.label} news: ${s.pubs.join(', ')}.\n\nSearch for:\n"${s.q[0]}"\n"${s.q[1]}"\n"${s.q[2]}"\n"${s.q[3]}"\n\nRead the actual articles. Extract the facts. Write 4 completely original stories in your own words. Return only the JSON array.` }];
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
