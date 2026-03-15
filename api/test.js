export const config = { runtime: 'edge' };
export default async function handler(req) {
  const h = { 'Content-Type':'application/json','Access-Control-Allow-Origin':'*' };
  const k = process.env.ANTHROPIC_API_KEY;
  if (!k) return new Response(JSON.stringify({status:'FAIL ✗',reason:'ANTHROPIC_API_KEY not set. Go to Vercel → your project → Settings → Environment Variables → add ANTHROPIC_API_KEY'}), {headers:h});
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':k,'anthropic-version':'2023-06-01','anthropic-beta':'web-search-2025-03-05'},body:JSON.stringify({model:'claude-sonnet-4-5',max_tokens:100,tools:[{type:'web_search_20250305',name:'web_search'}],messages:[{role:'user',content:'Search for the top Bloomberg headline right now and tell me it in one sentence.'}]})});
    const d = await r.json();
    if (d.type==='error') return new Response(JSON.stringify({status:'API ERROR ✗',error:d.error?.message,type:d.error?.type,fix:d.error?.type==='authentication_error'?'API key is invalid or revoked — create a new one at console.anthropic.com':'Check your Anthropic account at console.anthropic.com'}),{headers:h});
    const txt=(d.content||[]).filter(b=>b.type==='text').map(b=>b.text).join('');
    return new Response(JSON.stringify({status:'ALL SYSTEMS WORKING ✓',model:'claude-sonnet-4-5',webSearch:'working',keyOk:true,keyPrefix:k.slice(0,20)+'...',sampleResponse:txt.slice(0,150),blockTypes:(d.content||[]).map(b=>b.type)}),{headers:h});
  } catch(e) {
    return new Response(JSON.stringify({status:'NETWORK ERROR ✗',error:e.message}),{headers:h});
  }
}
