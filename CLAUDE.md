# economyconsumer

<!-- sdlc:done-means -->
## Done means green (AI-native SDLC — rolled out 2026-09-23)
Do not say "done", "fixed" or "live" until every line below has run green in this session, and quote the last line of each:
- `node ~/projects/security-harness/run.mjs economyconsumer --quiet` → 0 FAIL (static tier, no network)
- `node --test api/_lib/ai-guard.test.mjs` → all pass (AI guard: Upstash path + `eco:` prefix tripwire, memory fallback)
- Production AI limits are durable only when the Upstash store is attached (KV_REST_API_URL). Check: Vercel → economyconsumer → Storage shows an Upstash/KV store connected (env names `KV_REST_API_URL` + `KV_REST_API_TOKEN` present, values never printed); without it `api/_lib/ai-guard.js` counts per instance in memory.
- UI change: open the changed page (local or preview) and look at it — a screenshot beats a claim.

A line that was already red before your change: say so with its output, never report it green. A line you skipped is reported as SKIPPED, not PASS.
Anything bigger than a one-file fix starts as a change folder `intent/<yyyy-mm-dd>-<slug>/` (intent.md → spec.md → plan.md; templates in `intent/README.md`; Khurram signs off the intent before the build). Reviews follow `REVIEW.md`.
<!-- /sdlc:done-means -->
