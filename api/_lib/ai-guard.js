/**
 * AI route guard for economyconsumer (/api/proxy, /api/test) — per-IP rate limit + daily spend ledger.
 * Pattern copied from uae-intelligence-suite lib/security/ai-guard.js (2026-10-03, "fix this please": public AI
 * routes must keep their limits in a SHARED store, not per-instance memory).
 *
 * Store: Upstash Redis REST (plain fetch, no dependency) when KV_REST_API_URL + KV_REST_API_TOKEN (Vercel KV names)
 * or UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN are set; otherwise an in-memory map, which on Vercel is per
 * instance and resets on a cold start. Every key starts with `eco:` so a shared store never mixes two apps.
 * The `_lib` folder is not a route (Vercel skips underscore paths under api/). Runs on the Edge runtime: Web APIs only.
 *
 * Spend ledger: reserve the worst case before the model call, refuse when today's UTC ceiling would be crossed,
 * settle to the provider's real usage afterwards. An unsettled reservation stays charged (errs towards refusing).
 */

// claude-haiku-4-5 list price (USD per token) and the web search tool fee per search, as in the estate reference guard.
const PRICE_IN = 1 / 1_000_000;
const PRICE_OUT = 5 / 1_000_000;
const PRICE_SEARCH = 10 / 1000;

export const PREFIX = 'eco:';
const DEFAULT_DAILY_BUDGET_USD = 3;
export function dailyBudgetUsd(env = process.env) {
  const v = Number(env.AI_DAILY_BUDGET_USD);
  return Number.isFinite(v) && v > 0 ? v : DEFAULT_DAILY_BUDGET_USD;
}

/* ---------------- store ---------------- */

const mem = new Map();

export function upstashConfig(env = process.env) {
  const url = env.KV_REST_API_URL || env.UPSTASH_REDIS_REST_URL;
  const token = env.KV_REST_API_TOKEN || env.UPSTASH_REDIS_REST_TOKEN;
  return url && token ? { url: url.replace(/\/$/, ''), token } : null;
}

export function backend() {
  return upstashConfig() ? 'upstash' : 'memory';
}

/** One round trip: INCRBY then (first hit of the window only) EXPIRE, via the REST pipeline endpoint. */
async function upstashIncr(key, by, windowSec) {
  const cfg = upstashConfig();
  const call = async (cmds) => {
    const res = await fetch(`${cfg.url}/pipeline`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cfg.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(cmds),
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) throw new Error(`upstash ${res.status}`);
    const out = await res.json();
    if (!Array.isArray(out) || out.some((x) => x && x.error)) throw new Error('upstash error');
    return out.map((x) => x.result);
  };
  const [total] = await call([['INCRBY', key, String(by)]]);
  if (Number(total) === by) await call([['EXPIRE', key, String(windowSec)]]);
  return Number(total);
}

function memPurge(now) {
  if (mem.size < 5000) return;
  for (const [k, v] of mem) if (v.resetAt <= now) mem.delete(k);
}

/** Add `by` to `key` (prefixed `eco:`) inside a fixed window of `windowSec`. Returns { total, resetAt }. */
export async function incrBy(key, by, windowSec) {
  const now = Date.now();
  const k = PREFIX + key;
  if (backend() === 'upstash') {
    try {
      return { total: await upstashIncr(k, by, windowSec), resetAt: now + windowSec * 1000 };
    } catch {
      // The store's own outage must not take the site down nor become "no limit": fall back to memory.
    }
  }
  memPurge(now);
  const cur = mem.get(k);
  if (!cur || cur.resetAt <= now) {
    const entry = { total: by, resetAt: now + windowSec * 1000 };
    mem.set(k, entry);
    return entry;
  }
  cur.total += by;
  return cur;
}

/* ---------------- identity ---------------- */

export function clientIp(req) {
  const first = (v) => String(v || '').split(',')[0].trim();
  const h = req.headers;
  return first(h.get('x-vercel-forwarded-for')) || first(h.get('x-real-ip')) || first(h.get('x-forwarded-for')) || 'unknown';
}

async function hashIp(ip) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`economyconsumer:${ip}`));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 24);
}

/* ---------------- rate limit ---------------- */

/** Per-IP fixed windows; `limits` = [[max, windowSec], …], all enforced. */
export async function rateLimit(req, bucket, limits) {
  const id = await hashIp(clientIp(req));
  let retryAfter = 0;
  for (const [max, windowSec] of limits) {
    const { total, resetAt } = await incrBy(`rl:${bucket}:${windowSec}:${id}`, 1, windowSec);
    if (total > max) retryAfter = Math.max(retryAfter, Math.ceil((resetAt - Date.now()) / 1000), 1);
  }
  return { ok: retryAfter === 0, retryAfter };
}

/* ---------------- spend ledger ---------------- */

const MICRO = 1_000_000;
const dayKey = () => `spend:${new Date().toISOString().slice(0, 10)}`;
const DAY_SEC = 36 * 3600;

export function costUsd(inputTokens, outputTokens, searches = 0) {
  return inputTokens * PRICE_IN + outputTokens * PRICE_OUT + searches * PRICE_SEARCH;
}

/**
 * Reserve the worst case of one call. Web search pulls result pages into the input, so the caller passes a
 * generous input-token estimate and the number of searches to pre-pay.
 */
export async function reserveSpend(inputTokens, maxOutputTokens, searches = 0) {
  const reserved = Math.ceil(costUsd(inputTokens, maxOutputTokens, searches) * MICRO);
  const ceiling = Math.floor(dailyBudgetUsd() * MICRO);
  const { total } = await incrBy(dayKey(), reserved, DAY_SEC);
  if (total > ceiling) {
    await incrBy(dayKey(), -reserved, DAY_SEC);
    return { ok: false, reserved: 0 };
  }
  return { ok: true, reserved };
}

/** Replace a reservation with the real cost from Anthropic's usage block. */
export async function settleSpend(reserved, usage) {
  if (!reserved || !usage) return;
  const searches = usage.server_tool_use?.web_search_requests || 0;
  const actual = Math.ceil(costUsd(usage.input_tokens || 0, usage.output_tokens || 0, searches) * MICRO);
  const delta = actual - reserved;
  if (delta !== 0) await incrBy(dayKey(), delta, DAY_SEC);
}

export function bodyTooLarge(req, maxBytes) {
  const len = Number(req.headers.get('content-length') || 0);
  return Number.isFinite(len) && len > maxBytes;
}

/** Test seam. */
export function __resetMemory() {
  mem.clear();
}
