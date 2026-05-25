# Addendum: run it on Railway and keep Agent-first navigation

The user corrected the product direction and deployment priority while this Codex task was running.

Corrections:
1. Do NOT clone the full cloud-provider navigation. OpenAsstAI is basically an Agent platform. Remove/avoid nav entries like lightweight servers, generic servers, images, cloud disks, SSH keys, firewall templates, traffic packages, private networking, migration, domains, databases, object storage.
2. Keep navigation Agent-first and minimal:
   - 我的 Agent
   - Agent 实例
   - 模型
   - 通道
   - 技能
   - OrcaTerm
   - 自动化
   - 账单/用量
   - 设置
3. Server/IP/instance fields still exist, but only as the runtime carrier for the Agent, not as product categories.
4. The user said Railway currently cannot run it yet. Priority: make the platform app runnable/deployable on Railway first.

Railway run requirements:
- `/openasstai-platform` must have a clear `package.json` with `build` and `start` scripts.
- App must bind `0.0.0.0` and `process.env.PORT || 3000`.
- Add `railway.json` or README deployment instructions if needed.
- Add `/api/health` endpoint returning OK JSON.
- Avoid depending on root repo package-lock or OpenNebula build tooling.
- Keep app self-contained under `/openasstai-platform`.
- Verify with local `npm install`/`npm run build`; if possible start server and curl `/api/health`.

Please incorporate this before finishing.
