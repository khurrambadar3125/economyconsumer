#!/bin/bash
# Vercel ignoreCommand — returns exit 0 (skip build) if changes don't affect the deployed app
# Called by vercel.json ignoreCommand on every build attempt
#
# Exit 1 = run build (changes matter)
# Exit 0 = skip build (changes are docs/skills/memory only)

# Get the list of files changed since the previous successful deploy
CHANGED=$(git diff --name-only HEAD~1 HEAD 2>/dev/null)

# If we can't determine changes, build to be safe
[ -z "$CHANGED" ] && exit 1

# Check if ANY changed file is a real code file that needs deployment
# Code files = anything in these paths:
#   pages/, components/, utils/, styles/, public/, scripts/
#   package.json, package-lock.json, next.config.*, vercel.json, middleware.*
#   api/, .env files
#
# Doc/skill/memory files = safe to skip:
#   *.md (except in pages/)
#   .claude/*
#   .github/*
#   README*
#   CLAUDE.md
#   docs/

NEEDS_BUILD=0

while IFS= read -r file; do
  [ -z "$file" ] && continue

  # Files that ALWAYS trigger build
  case "$file" in
    pages/*|components/*|utils/*|styles/*|public/*|scripts/*)
      NEEDS_BUILD=1
      break
      ;;
    package.json|package-lock.json|next.config.js|next.config.mjs|vercel.json|middleware.js|middleware.ts|tsconfig.json|.env|.env.*)
      NEEDS_BUILD=1
      break
      ;;
  esac

  # Files that NEVER trigger build (docs, skills, memory, config for Claude Code)
  case "$file" in
    *.md|.claude/*|.github/*|README*|CLAUDE.md|docs/*|.gitignore|.vercelignore|.vercel-ignore-build.sh)
      continue
      ;;
  esac

  # Anything else — be safe and build
  NEEDS_BUILD=1
  break
done <<< "$CHANGED"

if [ "$NEEDS_BUILD" = "1" ]; then
  echo "✓ Code changes detected — proceeding with build"
  exit 1
else
  echo "⊘ Only docs/skills/memory changed — skipping build (saves money)"
  exit 0
fi
