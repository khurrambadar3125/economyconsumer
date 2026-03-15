export const config = { runtime: 'edge' };
export default async function handler(req) {
  const h = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
  const k = process.env.ANTHROPIC_API_KEY;
  if (!k) return new Response(JSON.stringify({
    status: 'FAIL ✗',
    reason: 'ANTHROPIC_API_KEY not set in Vercel Environment Variables',
    fix: 'Go to vercel.com → your project → Settings → Environment Variables → add ANTHROPIC_API_KEY'
  }), { headers: h });

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': k,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'web-search-2025-03-05',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 200,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{ role: 'user', content: 'Search for the top business news headline today and tell me it in one sentence.' }]
      })
    });
    const d = await r.json();
    if (d.type === 'error') return new Response(JSON.stringify({
      status: 'API ERROR ✗',
      error: d.error?.message,
      type: d.error?.type,
      fix: d.error?.type === 'authentication_error'
        ? 'API key is invalid or revoked. Create a new one at console.anthropic.com → API Keys'
        : 'Check your account at console.anthropic.com'
    }), { headers: h });

    const txt = (d.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
    const searched = (d.content || []).some(b => b.type === 'tool_use');
    return new Response(JSON.stringify({
      status: '✅ ALL SYSTEMS WORKING',
      model: 'claude-haiku-4-5-20251001',
      webSearch: searched ? '✅ working' : '⚠ check',
      keyPrefix: k.slice(0, 20) + '...',
      response: txt.slice(0, 300),
      blockTypes: (d.content || []).map(b => b.type),
    }), { headers: h });
  } catch (e) {
    return new Response(JSON.stringify({ status: 'NETWORK ERROR ✗', error: e.message }), { headers: h });
  }
}
