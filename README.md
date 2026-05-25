# OpenAsstAI

OpenAsstAI 是一个公开的 AI Agent Runtime Marketplace，目标是让用户可以租用长期在线、可配置、可远程管理的 Agent 工作空间。

第一阶段不做完整的第三方主机市场，而是先交付一个可内测的官方节点 MVP：

- 用户可以在市场中选择官方 Agent 模板。
- 用户可以创建 Linux Agent 实例。
- 用户可以在控制台配置 Models、Channels、Skills。
- 用户可以通过 Web Terminal 进入实例工作空间。
- 平台可以管理实例生命周期、日志、用量和基础订单。

## 文档

- [第一阶段目标](./docs/phase-1-goal.md)
- [第一阶段架构](./docs/phase-1-architecture.md)
- [第一阶段 Backlog](./docs/phase-1-backlog.md)

## 第一阶段一句话目标

在 6 周内完成一个可内测的官方节点 Agent 租用 MVP，让用户能在 5 分钟内创建一个运行中的 Linux Agent，并通过控制台完成模型、通道、技能和终端管理。

## 本地运行

当前仓库已实现第一阶段内测 MVP 的本地版本：市场、登录、实例创建、实例生命周期、Models、Channels、Skills、Web Chat、Web Terminal、Logs、Usage 估算和 Admin Console。

支付暂不接入；Usage 页面只做运行时长、Token 和费用估算。

```bash
npm install
npm run dev
```

访问：

- Web：http://127.0.0.1:5173
- API：http://127.0.0.1:4000

Demo 账号：

- 用户：`demo@openasst.ai` / `demo123`
- 管理员：`admin@openasst.ai` / `admin123`

## 当前 Runtime 说明

本机环境未检测到 Docker，因此第一阶段本地实现使用 `local-sandbox` Runtime：

- 每个实例有独立工作目录：`runtime/workspaces/<instance_id>`
- Web Terminal 通过 `node-pty` 连接实例工作目录
- 数据存储使用 Node 内置 SQLite：`data/openasstai.sqlite`
- Docker/microVM Runtime 边界已按架构保留，后续可替换沙箱适配器
