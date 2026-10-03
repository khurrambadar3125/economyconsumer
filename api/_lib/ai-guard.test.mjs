// Tripwire: with the Upstash/KV env set the guard counts in the shared store with `eco:`-prefixed keys; without it, memory.
// Run: node --test api/_lib/
import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import * as guard from './ai-guard.js';

const ENV = ['KV_REST_API_URL', 'KV_REST_API_TOKEN', 'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN', 'AI_DAILY_BUDGET_USD'];
const realFetch = globalThis.fetch;
let calls;
const req = (ip = '203.0.113.7') => new Request('https://x.test/api/proxy', { method: 'POST', headers: { 'x-forwarded-for': ip } });

beforeEach(() => {
  for (const k of ENV) delete process.env[k];
  guard.__resetMemory();
  calls = [];
  const store = new Map();
  globalThis.fetch = async (url, init) => {
    const cmds = JSON.parse(init.body);
    calls.push({ url, auth: init.headers.Authorization, cmds });
    return new Response(JSON.stringify(cmds.map(([op, key, arg]) => {
      if (op === 'INCRBY') { store.set(key, (store.get(key) || 0) + Number(arg)); return { result: store.get(key) }; }
      return { result: 1 };
    })));
  };
});
afterEach(() => { globalThis.fetch = realFetch; for (const k of ENV) delete process.env[k]; });

test('KV env set → Upstash pipeline is used and every key is eco:-prefixed', async () => {
  process.env.KV_REST_API_URL = 'https://kv.example.upstash.io';
  process.env.KV_REST_API_TOKEN = 'test-token';
  assert.equal(guard.backend(), 'upstash');
  const rl = await guard.rateLimit(req(), 'proxy', [[2, 60]]);
  assert.ok(rl.ok);
  const s = await guard.reserveSpend(1000, 100);
  assert.ok(s.ok);
  assert.ok(calls.length >= 2, 'store was called');
  assert.ok(calls.every((c) => c.url === 'https://kv.example.upstash.io/pipeline' && c.auth === 'Bearer test-token'));
  const keys = calls.flatMap((c) => c.cmds.map((x) => x[1]));
  assert.ok(keys.every((k) => k.startsWith('eco:')), keys.join(','));
  assert.ok(keys.some((k) => /^eco:rl:proxy:60:[0-9a-f]{24}$/.test(k)));
  assert.ok(keys.some((k) => /^eco:spend:\d{4}-\d{2}-\d{2}$/.test(k)));
  assert.ok(!keys.some((k) => k.includes('203.0.113.7')), 'raw IP never reaches the store');
  assert.ok(calls.some((c) => c.cmds[0][0] === 'EXPIRE'), 'first hit sets the window TTL');
});

test('UPSTASH_* names also select the store', async () => {
  process.env.UPSTASH_REDIS_REST_URL = 'https://u.example.upstash.io';
  process.env.UPSTASH_REDIS_REST_TOKEN = 't';
  await guard.rateLimit(req(), 'test', [[2, 60]]);
  assert.ok(calls.length > 0 && calls[0].url.startsWith('https://u.example.upstash.io'));
});

test('no env → memory path, no fetch; limits and the daily ceiling still bite', async () => {
  assert.equal(guard.backend(), 'memory');
  assert.ok((await guard.rateLimit(req(), 'proxy', [[2, 60]])).ok);
  assert.ok((await guard.rateLimit(req(), 'proxy', [[2, 60]])).ok);
  assert.equal((await guard.rateLimit(req(), 'proxy', [[2, 60]])).ok, false, 'third call in the window is refused');
  assert.ok((await guard.rateLimit(req('198.51.100.1'), 'proxy', [[2, 60]])).ok, 'other IPs unaffected');
  process.env.AI_DAILY_BUDGET_USD = '0.01';
  assert.ok((await guard.reserveSpend(0, 1000)).ok); // $0.005
  assert.equal((await guard.reserveSpend(0, 2000)).ok, false); // would cross $0.01
  assert.equal(calls.length, 0);
});

test('store outage falls back to memory instead of "no limit"', async () => {
  process.env.KV_REST_API_URL = 'https://kv.example.upstash.io';
  process.env.KV_REST_API_TOKEN = 't';
  globalThis.fetch = async () => new Response('down', { status: 500 });
  assert.ok((await guard.rateLimit(req(), 'proxy', [[1, 60]])).ok);
  assert.equal((await guard.rateLimit(req(), 'proxy', [[1, 60]])).ok, false);
});
