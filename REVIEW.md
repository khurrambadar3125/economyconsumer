# REVIEW — economyconsumer

How to review a change in this repo (humans and Claude alike). Rolled out 2026-09-23 from Anthropic's AI-Native SDLC Playbook.
Merging and deploying stay Khurram's call: nothing is pushed or deployed unless he says "push" / "deploy".

## Passes
Run three passes, in order, and report each separately.
1. **Logic** — bugs, edge cases, regressions, empty/error states, time zones (PKT/GST), off-by-one on dates and marks.
2. **Security** —
   - Secrets: no key, token, service-role JWT or password in source, logs, client bundles or error messages. Server env names never shipped to the browser.
   - Every API route authenticates from the verified session/JWT, never from a body field or header the client controls. Crons check their secret. Malformed input → 400, not 500.
   - AI routes: calls go through the one gateway module, model pinned, max tokens and history capped, system prompts never reachable by a browser role, spend counted against the daily ceiling.
   - Injection: SQL/HTML/prompt injection, open redirects, SSRF on any fetched URL. PII never written to logs.
   - Public pages: nothing that names a provider, threshold, env name, file path, route map or an untested gap.
3. **Compliance** — against the change folder (`intent/<slug>/intent.md`, `spec.md`, `plan.md`) and the standing rules:
   - Data integrity first: no invented number, name, boundary or reading list — a gap stays empty and is said out loud. Extracted beats generated, with its source.
   - The "Done means green" block in CLAUDE.md was actually run, and its output quoted.

## What Important means here
Reserve **Important** for: behaviour that breaks for a real user, data shown that is not true, data leaked across users or to the public, a secret exposed, a cost that can run away, or a breach of a standing rule above. Everything else — style, naming, structure — is a **nit**.

## Cap the nits
At most 5 nits per review. Lead with the Important findings; if there are none, say so in one line.

## Do not report
- Generated or vendored files: `node_modules/`, `.next/`, `dist/`, `out/`, lockfiles, `security-reports/`.
- What the security harness already checks statically (secrets, bundle secrets, deps audit, env example, gateway-only, migrations lint, model pinning, private files, public report) — cite its result instead.
- Matters of taste already settled in CLAUDE.md.
