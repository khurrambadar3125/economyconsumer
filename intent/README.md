# intent/ — one folder per change

AI-native SDLC (Anthropic's playbook, rolled out 2026-09-23). Humans own three checkpoints — **requirements, review, release**; Claude builds.
Anything bigger than a one-file fix gets a folder `intent/<yyyy-mm-dd>-<slug>/` holding up to three files, written in this order:

| File | Answers | Who |
|---|---|---|
| `intent.md` | **why** — the problem and the outcome, in plain language | Khurram + Claude (`/intent` interviews him) — he signs it off |
| `spec.md` | **what** — behaviour, data, routes, UI states, security, acceptance checks | Claude (`/spec`), from intent + this codebase |
| `plan.md` | **how** — files that change, order of work, risks, proof | Claude (`/plan`), then builds it |

Rules: write only what Khurram said — anything he did not say goes under **Open questions**, never invented. The repo is the source of truth (no second copy in a tracker). A production anomaly re-opens the loop with a new `intent.md`.

## intent.md template
```markdown
# Intent: <name of change>
Author: <who asked>. Status: draft | agreed | built | live.

## Problem
## Proposed outcome
## Affected users and systems
## Constraints
## Open questions
```

## plan.md template
```markdown
# Plan: <name of change> (from intent.md <date>)

## Files that change
## Order of work
## Risks
## Proof
```
Each step in *Order of work* is small (2–5 minutes): failing test or check → minimal code → check passes → commit. *Proof* names the exact commands and pages that show it works — the same ones as the "Done means green" block in CLAUDE.md.
