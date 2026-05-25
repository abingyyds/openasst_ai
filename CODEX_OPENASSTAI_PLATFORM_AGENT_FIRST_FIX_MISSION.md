# Codex Mission: Fix P0 platform to be Agent-first and Railway-runnable

Working directory: /Users/minihanshi/project/openasstai
Target app: /Users/minihanshi/project/openasstai/openasstai-platform

Context:
A previous Codex run created `/openasstai-platform` and it builds, but it ignored the user's key correction: OpenAsstAI is only/primarily an Agent platform, not a cloud-provider resource console. The current UI still has full cloud menu items such as 轻量应用服务器, 服务器, 镜像, 云硬盘, SSH密钥, 防火墙模板, 优选流量包, 内网互联, 迁移上云, 域名, 数据库, 对象存储. These must be removed.

User instruction:
- “这些基本不需要啊？只是Agent啊”
- “Railway目前还跑不起来，你先把它用Railway把这个平台跑起来再说吧”

Goals:
1. Fix `/openasstai-platform` UI to be Agent-first, not cloud-menu clone.
2. Ensure it remains buildable and Railway-runnable.
3. Add/verify Railway config if missing.
4. Do not touch upstream OpenNebula files outside `/openasstai-platform`, except updating result/report files if needed.

Required navigation:
Use this minimal nav only:
- 我的 Agent
- Agent 实例
- 模型
- 通道
- 技能
- OrcaTerm
- 自动化
- 账单/用量
- 设置

Forbidden nav/product labels in UI:
- 轻量应用服务器
- 服务器
- 镜像
- 云硬盘
- SSH密钥
- 防火墙模板
- 优选流量包
- 内网互联
- 迁移上云
- 轻量域名
- 域名
- 轻量数据库
- 数据库
- 轻量存储
- 对象存储
- Lightweight Server
- Servers
- Images
- Cloud Disks
- SSH Keys
- Firewall Templates
- Traffic Packs
- Private Network
- Cloud Migration
- Domains
- Databases
- Object Storage

Search placeholder:
Use “搜索 Agent、实例ID、IP、名称”. Do not use generic “搜索资源” as the main product frame.

Instance details:
It is OK to show server/IP/runtime carrier details because Agent needs a machine to run on. But present them as “Agent 运行环境 / 承载实例”, not as first-class cloud products.

Railway requirements:
- App must bind `0.0.0.0` and `process.env.PORT || 3000`.
- `/api/health` must return JSON `{ ok: true, ... }`.
- Add `/openasstai-platform/railway.json` if missing, with build/start commands appropriate for rootDirectory deployment.
- README must include Railway deployment instructions and mention service root directory `openasstai-platform`.
- `.env.example` should exist and include required envs.
- Avoid depending on the root OpenNebula package-lock or build system.

Verification:
Run inside `/openasstai-platform`:
- `npm run build`
- `node --check src/server/index.js`
- `node --check dist/server/index.js`
- Search the source for forbidden labels and confirm none remain in active UI source. If they are only in this mission/log/report, do not count those.
- If local socket binding is allowed, start with `PORT=3210 npm start` and curl `/api/health`; if blocked by sandbox, report that clearly but ensure code uses 0.0.0.0:$PORT.

Output:
Write `/Users/minihanshi/project/openasstai/.codex-openasstai-platform-agent-first-fix-result.txt` with:
- what changed;
- verification commands/results;
- whether Railway config exists;
- remaining limitations.

Do not commit or push. Hermes will review and push.
