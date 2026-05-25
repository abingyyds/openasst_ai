# Codex Mission: OpenAsstAI homepage/component-library style upgrade

Working directory: /Users/minihanshi/project/openasstai

Role: You are the coding worker. Hermes supervises; implement code changes directly in this non-git project.

Product goal:
Upgrade OpenAsstAI's landing/market/shell UI with modern component-library patterns inspired by rust-ui.com's component/examples library (not by copying its homepage). The user specifically means reusable, polished components: glass cards, command panels, status pills, gradient/spotlight surfaces, responsive side navigation, clean empty states, compact metric cards, and developer-console style blocks.

Current app notes:
- Main React file is src/main.jsx (large single-file app).
- Styles are in src/styles.css.
- Routes are hash-based; preserve existing route names and API calls.
- This is not a git repo, so report changed files explicitly.

Hard constraints:
- Do not change server API routes/contracts, auth/session, DB, runtime workspace semantics, terminal websocket semantics, or package scripts.
- Do not add heavyweight dependencies unless absolutely necessary. Prefer existing React + lucide + CSS.
- Keep page-load/perceived performance fast: no giant remote assets, no blocking animations, no unnecessary network calls.
- Maintain mobile responsiveness; ensure shell/nav and market cards work on narrow screens.

Scope allowed:
- src/main.jsx UI components/landing/market/shell markup
- src/styles.css visual system/responsive styles
- small helper components inside src/main.jsx only if useful

Suggested direction:
- Add a reusable `SurfaceCard` / `FeatureTile` / `CommandPreview` style if it reduces duplication.
- Polish Shell navigation/header and MarketPage hero/cards so it feels like a cohesive component-library dashboard.
- Improve instance/console panels only where low-risk and shared components make it cleaner.

Verification required:
- npm run build
- If possible, run a quick static grep to confirm no server files changed.

Reporting:
Write final summary to /Users/minihanshi/project/openasstai/.codex-home-ui-result.txt with files changed and verification result.
