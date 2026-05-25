# OpenAsstAI Codex Mission

Working directory: /Users/minihanshi/project/openasstai

## Goal
Turn the current OpenAsstAI Phase 1 MVP into a cleaner, more complete, internally-demoable foundation by reconciling the documented requirements with the codebase and implementing the highest-priority gaps.

## Current facts
- Frontend and backend exist in src/ and server/.
- The app is NOT currently running.
- The repo is not a git repository, so verify with package scripts and file outputs instead of git status.
- Existing docs define Phase 1 as an official-node AI Agent rental MVP.
- DB file exists at data/openasstai.sqlite.
- Prior audit found missing provider tables and recommended db migration, API restart, smoke tests, and a public marketplace shell.

## Hard constraints
- Do not remove or break current auth/session semantics.
- Do not invent production-grade sandbox isolation; keep runtime claims honest.
- Preserve current API routes unless a new route is explicitly needed.
- Keep changes focused on Phase 1 requirements and foundational improvements, not a full platform rewrite.
- Keep user-facing text Chinese where the app already uses Chinese.

## Scope
Focus on the following:
1. Inspect the current Phase 1 docs and code against reality.
2. Implement the smallest high-value improvements that move the MVP closer to the documented requirements.
3. Add or repair smoke tests or verification scripts if missing.
4. Improve the public/marketplace-facing shell only if it can be done without destabilizing the existing app.
5. Make sure mobile and desktop layouts stay usable.

## Non-goals
- No public launch hardening beyond what is necessary for internal demo readiness.
- No payment integration.
- No third-party provider marketplace expansion unless required by the existing docs.

## Recommended first checks
- npm run build
- npm run db:migrate
- npm run dev:api
- Verify /api/health, auth, templates, instances, admin endpoints.

## Expected output
Return a concise summary with:
- what you inspected,
- what you changed,
- what still blocks Phase 1 completeness,
- exact verification commands run and their results,
- file list of changes.
