export const config = { runtime: 'edge' };
export default async function handler(req) {
  const h = { 'Content-Type':'application/json','Access-Control-Allow-Origin':'*' };
  const k = process.env.ANTHROPIC_API_KEY;
  if (!k) return new Response(JSON.stringify({status:'FAIL',reason:'ANTHROPIC_API_KEY not set in Vercel Environment Variables'}), {headers:h});
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':k,'anthropic-version':'2023-06-01','anthropic-beta':'web-search-2025-03-05'},body:JSON.stringify({model:'claude-sonnet-4-5',max_tokens:100,tools:[{type:'web_search_20250305',name:'web_search'}],messages:[{role:'user',content:'Search Bloomberg for todays top headline and tell me in one sentence.'}]})});
    const d = await r.json();
    if (d.type==='error') return new Response(JSON.stringify({status:'API_ERROR',error:d.error?.message,type:d.error?.type}),{headers:h});
    const txt=(d.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('');
    return new Response(JSON.stringify({status:'ALL WORKING',model:'claude-sonnet-4-5',key:k.slice(0,18)+'...',response:txt.slice(0,200)}),{headers:h});
  } catch(e) {
    return new Response(JSON.stringify({status:'ERROR',error:e.message}),{headers:h});
  }
}
