export const config = { runtime: 'edge' };
import { rateLimit, reserveSpend, settleSpend } from './_lib/ai-guard.js';
export default async function handler(req) {
  const h = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
  const k = process.env.ANTHROPIC_API_KEY;

  if (!k) return new Response(JSON.stringify({
    status: 'FAIL', problem: 'ANTHROPIC_API_KEY not set',
    fix: 'Go to vercel.com → your project → Settings → Environment Variables → Add: Name=ANTHROPIC_API_KEY Value=your-key → Save → Redeploy'
  }), { headers: h });

  // Every hit is a paid model call with web search: keep it to a status check, not a free endpoint.
  const rl = await rateLimit(req, 'test', [[2, 60], [10, 86400]]);
  if (!rl.ok) return new Response(JSON.stringify({ status: 'RATE LIMITED', retryAfter: rl.retryAfter }), { status: 429, headers: { ...h, 'Retry-After': String(rl.retryAfter) } });
  const spend = await reserveSpend(20_000, 100, 2);
  if (!spend.ok) return new Response(JSON.stringify({ status: 'PAUSED', problem: 'daily AI budget reached' }), { status: 503, headers: h });

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': k, 'anthropic-version': '2023-06-01', 'anthropic-beta': 'web-search-2025-03-05' },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 100,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{ role: 'user', content: 'What is the top business news today? One sentence.' }]
      })
    });
    const d = await r.json();
    await settleSpend(spend.reserved, d.usage);
    if (d.type === 'error') return new Response(JSON.stringify({
      status: 'FAIL',
      problem: d.error?.type,
      message: d.error?.message,
      fix: d.error?.type === 'authentication_error'
        ? 'Your API key is INVALID or REVOKED. Go to console.anthropic.com → API Keys → Create a new key → Update it in Vercel Environment Variables → Redeploy'
        : d.error?.type === 'permission_error'
          ? 'Web search not enabled for this key. Go to console.anthropic.com and check your account permissions.'
          : 'Check console.anthropic.com for your account status'
    }), { headers: h });

    const txt = (d.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
    return new Response(JSON.stringify({
      status: 'ALL WORKING ✓',
      model: 'claude-haiku-4-5-20251001',
      keyOk: true,
      webSearch: (d.content || []).some(b => b.type === 'tool_use') ? 'working ✓' : 'no search performed',
      response: txt.slice(0, 200),
    }), { headers: h });
  } catch (e) {
    return new Response(JSON.stringify({ status: 'NETWORK ERROR', error: e.message }), { headers: h });
  }
}
