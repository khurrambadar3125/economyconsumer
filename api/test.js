export const config = { runtime: 'edge' };

export default async function handler(req) {
  const cors = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  };

  const apiKey = process.env.ANTHROPIC_API_KEY;

  // Step 1: Check key exists
  if (!apiKey) {
    return new Response(JSON.stringify({
      step: 1, status: 'FAIL', error: 'ANTHROPIC_API_KEY is not set in Vercel environment variables'
    }), { headers: cors });
  }

  // Step 2: Test basic Anthropic connection (no tools)
  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 20,
        messages: [{ role: 'user', content: 'Say OK' }]
      }),
    });

    const data = await r.json();

    if (data.type === 'error') {
      return new Response(JSON.stringify({
        step: 2, status: 'FAIL', error: data.error?.message || 'API error', type: data.error?.type, httpStatus: r.status
      }), { headers: cors });
    }

    // Step 3: Test with web_search tool
    const r2 = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'web-search-2025-03-05',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 100,
        tools: [{ type: 'web_search_20250305', name: 'web_search' }],
        messages: [{ role: 'user', content: 'Search for todays date and tell me it' }]
      }),
    });

    const data2 = await r2.json();

    if (data2.type === 'error') {
      return new Response(JSON.stringify({
        step: 3, status: 'FAIL_WEB_SEARCH', error: data2.error?.message, basicApiWorks: true, httpStatus: r2.status
      }), { headers: cors });
    }

    return new Response(JSON.stringify({
      step: 3, status: 'ALL OK',
      basicApi: 'working',
      webSearch: 'working',
      keyPrefix: apiKey.substring(0, 20) + '...',
      response: data2.content?.[0]?.text?.substring(0, 100)
    }), { headers: cors });

  } catch (err) {
    return new Response(JSON.stringify({
      step: 2, status: 'EXCEPTION', error: err.message
    }), { headers: cors });
  }
}
