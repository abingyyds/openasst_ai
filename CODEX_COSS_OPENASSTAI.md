# OpenAsstAI COSS UI Rewrite — Phase 2 Frontend Shell and Pages

Working directory: /Users/minihanshi/project/openasstai

## What the user actually wants
Rebuild OpenAsstAI frontend UI using the real COSS UI design-system vocabulary and component philosophy, not just a visual reference.

## What we learned from coss.com/ui
- `@coss/ui` is a Base UI + Tailwind design system.
- Key local patterns: rounded-2xl cards, border-first controls, sticky translucent header, page headers, sidebar/mobile sheet nav, card-frame tables, quiet muted surfaces, and responsive shells.

## Scope you own
- Frontend shell / layout.
- Marketplace / instance setup / onboarding surfaces.
- Auth and dashboard panels if they are frontend-driven.
- Any page content that can be reorganized into COSS-like cards, headers, and responsive sections.
- Shared CSS and local component wrappers that help the whole app match the COSS design language.

## Hard constraints
- Do not change backend contracts, auth/session semantics, db schema, or smoke-test expectations.
- Preserve the existing Phase 1 API behavior.
- English-first product UI.
- Performance matters: keep the app fast, defer heavy/rare panels, and avoid unnecessary initial bundle growth.

## Style target
- Make the app feel like the COSS UI system: neutral surfaces, subtle borders, precise spacing, compact buttons, clean page headers.
- Build local equivalents; do not import remote runtime assets.
- If a page has dense data, use responsive card layouts or table/card hybrids.

## Verification
1. `npm run db:migrate`
2. `npm run build`
3. `npm run smoke`
4. note any bundle or route split follow-up.

## Deliverable
Write the result to `.codex-openasstai-coss-result.txt` with changed files, verification results, and follow-up items.
