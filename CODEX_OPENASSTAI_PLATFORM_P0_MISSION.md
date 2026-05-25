# Codex Mission: P0 user-first OpenAsstAI platform shell

Working directory: /Users/minihanshi/project/openasstai

Context:
This repository currently contains upstream OpenNebula/one plus planning docs. OpenAsstAI is being rebuilt on top of OpenNebula, but Railway should run only the OpenAsstAI platform application layer. External providers run real OpenNebula controllers/servers/VMs. The user explicitly wants to adapt slowly from the user's perspective, with a Tencent Cloud-like lightweight server console where each user configures their own Hermes Agent.

Primary goal:
Create an isolated `/openasstai-platform` app that can be deployed to Railway and demonstrates the P0 user-first console shell and Hermes Agent instance detail experience. This is not yet full OpenNebula provisioning. It should be a safe scaffold around mock/sample data plus API skeletons and an OpenNebula adapter boundary.

Hard constraints:
- Do NOT modify upstream OpenNebula runtime code under existing `src/`, `include/`, `share/`, `install.sh`, `SConstruct`, etc.
- Keep all new app code isolated under `/openasstai-platform`.
- Do NOT install or run OpenNebula.
- Do NOT introduce destructive git commands.
- Default UI language should be Simplified Chinese, with English-ready strings if you add a tiny i18n layer.
- The app must be Railway-friendly: bind to `0.0.0.0:$PORT`; include env example and deploy notes.
- Use a simple stack with minimal dependencies. Prefer Vite + React + Express or Next if you can keep it simple. Avoid heavy framework setup that may fail on this large monorepo.
- Verification must include install/build/start or at least `npm run build` inside `/openasstai-platform`.

User-facing UX requirements:
1. Agent-first console shell:
   - top bar with global Agent search placeholder: “搜索 Agent、实例ID、IP、名称”;
   - pressing `/` focuses the search input;
   - left nav should NOT clone a full cloud-provider resource menu. OpenAsstAI is primarily an Agent platform, not a generic cloud console;
   - use a minimal Agent-focused nav, for example: 我的 Agent, Agent 实例, 模型, 通道, 技能, OrcaTerm, 自动化, 账单/用量, 设置;
   - server/resource fields are shown only as the runtime carrier for an Agent, not as first-class product navigation.
2. User instance detail page:
   - show instance name e.g. “阿炳开的”;
   - show IPv4 e.g. `43.128.106.54`;
   - status “运行中”;
   - “AI助手” and “更多操作” quick actions.
3. Hermes Agent panel on the instance:
   - title `Hermes Agent`;
   - version/date e.g. `2026.4.30`;
   - status running;
   - models section with warning: 添加至少 1 个模型，Hermes 才能正常工作;
   - show a model plan card like 腾讯云 Hy Token Plan（个人版） / Hy3 preview;
   - show default model/provider `custom_subrouter` and a `切换模型` action;
   - channels section with 微信 and QQ connected;
   - skills section with SkillHub search, warning about unknown skills, and installed skills `teacher-ai-preparing-lesson 2.1.1`, `teacher-assistant 1.0.1`.
4. Make it look like a polished cloud console, not a raw demo: cards, side nav, responsive layout, mobile collapse/stacking, clean empty states.

API skeleton requirements:
Create backend endpoints with mock data under the platform app:
- `GET /api/health`
- `GET /api/resources/search?q=`
- `GET /api/instances`
- `GET /api/instances/:id`
- `GET /api/instances/:id/agent`
- `PATCH /api/instances/:id/agent/models/default`
- `POST /api/instances/:id/agent/channels`
- `POST /api/instances/:id/agent/skills`
- `POST /api/instances/:id/agent/actions/restart`
- `GET /api/instances/:id/agent/logs`

Adapter boundary:
Add an OpenNebula adapter skeleton under `/openasstai-platform/src/server/adapters/opennebula` or equivalent. It should not call real OpenNebula yet unless env vars are set. Include interface/stub methods such as:
- validateConnection
- listHosts
- listTemplates
- listVMs
- createVM
- getVM
- powerAction
- deleteVM
- injectHermesAgentBootstrap

Docs/config:
- Add `/openasstai-platform/.env.example` with Railway/platform vars:
  PORT, APP_BASE_URL, DATABASE_URL placeholder, SESSION_SECRET, ENCRYPTION_KEY, OPENNEBULA_XMLRPC_URL, OPENNEBULA_USERNAME, OPENNEBULA_PASSWORD, DEFAULT_MODEL_PROVIDER, SUBROUTER_API_BASE_URL, SKILLHUB_URL, WECHAT_CHANNEL_APP_ID, QQ_CHANNEL_APP_ID, AGENT_BOOTSTRAP_SIGNING_KEY, ORCATERM_GATEWAY_URL.
- Add `/openasstai-platform/README.md` explaining local run, Railway deploy, and that real OpenNebula servers remain external provider infrastructure.
- Add package scripts: dev, build, start.

Output/report:
Write `/Users/minihanshi/project/openasstai/.codex-openasstai-platform-p0-result.txt` summarizing:
- files created;
- UI routes/endpoints;
- verification commands and results;
- known limitations;
- next recommended P1 tasks.

Verification:
- Run package install/build if feasible.
- At minimum run `npm run build` in `/openasstai-platform` and report result.
- Show git status and diff stat at the end.
