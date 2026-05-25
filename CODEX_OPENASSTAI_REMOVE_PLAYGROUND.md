# Codex Mission: Remove mistaken OpenAsstAI Playground only

Working directory: /Users/minihanshi/project/openasstai
Target app: /Users/minihanshi/project/openasstai/openasstai-platform

Context:
The user clarified that the Cherry Studio-style Playground request belonged to SASSAI, not OpenAsstAI. OpenAsstAI should remain Agent-first. Remove the mistaken Playground feature from OpenAsstAI, but preserve the useful Agent-first platform shell and Railway app.

Preserve:
- `/openasstai-platform` as the Railway-runnable platform app.
- Agent-first navigation and pages: 我的 Agent, Agent 实例, 模型, 通道, 技能, OrcaTerm, 自动化, 账单/用量, 设置.
- Agent instance details, Hermes Agent config, model/channel/skill panels, logs, OpenNebula adapter skeleton, health endpoint.
- package.json/build/start, railway.json, .env.example, README general Railway instructions.

Remove only the mistaken Playground parts:
- Left nav item `Playground` / any route to `/playground` or `/console/playground`.
- Client-side `isPlaygroundPath`, `loadPlaygroundPage`, playground state, conversation localStorage (`openasstai.playground.conversations.v1`), model picker/chat UI specific to Playground.
- CSS classes only used by `.playground-*`.
- Server API routes under `/api/playground/*`.
- Mock data/functions only used by Playground: playgroundModels, playgroundServerConversations, findPlaygroundModel, etc.
- README references that claim OpenAsstAI has a Playground, if present.

Hard constraints:
- Do not remove Agent-first core pages.
- Do not revert the whole commit blindly.
- Do not touch SASSAI.
- Keep build passing.

Verification:
- Run `cd openasstai-platform && npm run build`.
- Search active OpenAsstAI app for `Playground`, `api/playground`, `openasstai.playground`, `playground-`. There should be no mistaken Playground routes/UI/API left. If README has generic word playground only if not feature claim; prefer none.
- Confirm nav still has Agent-first entries.
- Show git diff --stat.

Output:
Write `/Users/minihanshi/project/openasstai/.codex-openasstai-remove-playground-result.txt` summarizing files changed and verification.
Do not commit or push. Hermes will verify and push.