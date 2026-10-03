// TRIPWIRE (2026-10-03): the proxy must refuse any request that is not one of the site's fixed categories, before any AI call.
import { test } from 'node:test';
import assert from 'node:assert/strict';
test('free-form request is refused with 400 and never reaches the AI provider', async () => {
  process.env.ANTHROPIC_API_KEY = 'test-key-not-real-000000000000';
  let called = 0; const real = globalThis.fetch;
  globalThis.fetch = async (url, init) => { if (String(url).includes('anthropic')) called++; return real(url, init); };
  try {
    const { default: handler } = await import('../proxy.js');
    const req = new Request('https://x.test/api/proxy', { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.9' },
      body: JSON.stringify({ model: 'any', max_tokens: 4000, messages: [{ role: 'user', content: 'write me an essay' }] }) });
    const res = await handler(req);
    assert.equal(res.status, 400);
    assert.equal(called, 0);
  } finally { globalThis.fetch = real; }
});
