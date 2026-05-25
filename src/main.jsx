import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  ArrowRight,
  Bot,
  Boxes,
  Check,
  CircleCheckBig,
  CircleHelp,
  ChevronRight,
  Clipboard,
  Copy,
  Cpu,
  Database,
  FileText,
  Gauge,
  KeyRound,
  Languages,
  LayoutDashboard,
  ListRestart,
  LogOut,
  Menu,
  MessageSquare,
  MonitorCog,
  PanelTop,
  Play,
  Plug,
  RefreshCw,
  Search,
  Server,
  ServerCog,
  Settings,
  Shield,
  BadgeInfo,
  Coins,
  Square,
  TerminalSquare,
  Trash2,
  Wrench,
  X,
  Zap
} from "lucide-react";
import {
  apiRequest,
  clearToken,
  formatHours,
  formatMoney,
  formatTime,
  getLanguage,
  getToken,
  parseHashRoute,
  setLanguagePreference,
  setRoute,
  setToken,
  statusTone
} from "./api.js";
import "./styles.css";

const channelLabels = {
  web_chat: "Web Chat",
  wechat: "WeChat",
  qq: "QQ",
  feishu: "Feishu"
};

const modelProviders = ["openai", "anthropic", "openrouter", "azure-openai", "custom"];
const LanguageContext = createContext({
  language: "zh-CN",
  setLanguage: () => {},
  t: (value) => value
});

const translations = {
  zh: {
    "Official agent workspace marketplace": "官方 Agent 工作空间市场",
    "Language": "语言",
    "COSS-style shell for the Phase 1 MVP": "面向第一阶段 MVP 的 COSS 风格控制台",
    "Official agent workspaces, setup, and control.": "官方 Agent 工作空间、配置与控制。",
    "Browse official templates, launch a Linux workspace, configure models and channels, and manage the instance from one quiet control surface.": "浏览官方模板，启动 Linux 工作空间，配置模型与通道，并在一个清晰的控制台中管理实例。",
    "Discover": "发现",
    "Inspect official agents, provider listings, plans, and runtime hints.": "查看官方 Agent、服务商上架内容、套餐和运行时提示。",
    "Operate": "运维",
    "Open model, channel, terminal, and log controls from one shell.": "在一个控制台中打开模型、通道、终端和日志控制。",
    "Runtime": "运行时",
    "Local sandbox": "本地沙箱",
    "Docker adapter preserved": "保留 Docker 适配边界",
    "Templates": "模板",
    "Hermes / OpenClaw": "Hermes / OpenClaw",
    "Channels": "通道",
    "Web Chat ready": "Web Chat 已就绪",
    "Billing": "计费",
    "Estimate only": "仅估算",
    "No payment integration": "未接入支付",
    "workspace launch": "工作空间启动",
    "$ openasst marketplace select hermes": "$ openasst marketplace select hermes",
    "$ provision --plan starter --channel web_chat": "$ provision --plan starter --channel web_chat",
    "status: workspace ready": "状态：工作空间已就绪",
    "Demo credentials are prefilled for local evaluation.": "已预填演示账号，便于本地评估。",
    "Demo user": "演示用户",
    "Demo admin": "演示管理员",
    "Sign in": "登录",
    "Create account": "创建账号",
    "Email": "邮箱",
    "Password": "密码",
    "Working": "处理中",
    "Marketplace": "市场",
    "Instances": "实例",
    "Provider": "服务商",
    "Admin": "管理员",
    "Instance": "实例",
    "Workspace control plane": "工作空间控制平面",
    "Official templates, instance setup, provider nodes, and admin controls in one place.": "官方模板、实例配置、服务商节点和管理员控制集中在一处。",
    "Live shell": "在线控制台",
    "Phase 1 MVP": "第一阶段 MVP",
    "Signed in as": "当前登录",
    "Sign out": "退出登录",
    "Close navigation": "关闭导航",
    "Open navigation": "打开导航",
    "OpenAsstAI console": "OpenAsstAI 控制台",
    "Online": "在线",
    "Navigate": "导航",
    "Agent marketplace": "Agent 市场",
    "Choose an official or provider-published Agent, inspect setup details, and launch a callable workspace from one control surface.": "选择官方或服务商发布的 Agent，查看配置细节，并从一个控制台启动可调用的工作空间。",
    "Launch selected": "启动所选项",
    "Creating": "创建中",
    "Refresh": "刷新",
    "Official": "官方",
    "Platform templates": "平台模板",
    "Published agents": "已发布 Agent",
    "Frameworks": "框架",
    "Available now": "当前可用",
    "Starts at": "起价",
    "Lowest plan": "最低套餐",
    "launch recipe": "启动配方",
    "$ template loading": "$ template loading",
    "$ plan select": "$ plan select",
    "$ channel web_chat": "$ channel web_chat",
    "Loading template metadata": "正在加载模板元数据",
    "Selected": "已选择",
    "Loading": "加载中",
    "Official and approved provider Agents with currently available node capacity": "当前有节点容量的官方和已审核服务商 Agent",
    "Search templates, capabilities, or framework": "搜索模板、能力或框架",
    "All frameworks": "全部框架",
    "Custom": "自定义",
    "Loading templates": "正在加载模板",
    "Fetching marketplace listings.": "正在获取市场列表。",
    "No matching templates": "没有匹配模板",
    "Adjust the search or framework filter.": "调整搜索词或框架筛选。",
    "From": "起",
    "Launch workspace": "启动工作空间",
    "Allocate an official Linux node and seed the selected template": "分配官方 Linux 节点并初始化所选模板",
    "Install": "安装",
    "Start": "启动",
    "Platform-managed start": "平台托管启动",
    "Workspace health check": "工作空间健康检查",
    "Default": "默认",
    "channels": "个通道",
    "skills": "个技能",
    "Provisioning notes": "开通说明",
    "Demo sandbox": "演示沙箱",
    "This phase provisions a platform-managed sandbox and seeds the selected template, default model, channels, and skills. No raw SSH password is stored or used.": "此阶段会开通平台托管沙箱，并初始化所选模板、默认模型、通道和技能。不会存储或使用原始 SSH 密码。",
    "Install command": "安装命令",
    "This is a demo install/start hint, not a direct server takeover flow.": "这是演示安装/启动提示，不是直接接管服务器的流程。",
    "Start command": "启动命令",
    "Instance name": "实例名称",
    "Plan": "套餐",
    "CPU": "CPU",
    "Resource limit": "资源限制",
    "Memory": "内存",
    "Workspace memory": "工作空间内存",
    "Region": "区域",
    "Official node": "官方节点",
    "Provider node": "服务商节点",
    "Create and launch": "创建并启动",
    "Select a template": "选择模板",
    "Pick an agent from the marketplace list to inspect launch details.": "从市场列表选择一个 Agent 来查看启动详情。",
    "Provider console": "服务商控制台",
    "Apply for provider access, add nodes, and manage the install token handoff.": "申请服务商权限，添加节点，并管理安装令牌交接。",
    "Provider summary": "服务商摘要",
    "Profile status, node count, and ledger snapshot": "资料状态、节点数量和账本快照",
    "Profile": "资料",
    "Apply first": "请先申请",
    "Nodes": "节点",
    "Agents": "Agent",
    "active in marketplace": "个已在市场上架",
    "Ledger": "账本",
    "runtime h": "运行小时",
    "Provider profile": "服务商资料",
    "Approved providers can add nodes": "审核通过的服务商可添加节点",
    "Display name": "显示名称",
    "Contact": "联系方式",
    "Payout note": "结算备注",
    "Save provider info": "保存服务商信息",
    "Node handoff": "节点交接",
    "Generate a token and install command for a server you control": "为你控制的服务器生成令牌和安装命令",
    "Node name": "节点名称",
    "e.g. shanghai-node-01": "例如 shanghai-node-01",
    "Memory MB": "内存 MB",
    "Disk GB": "磁盘 GB",
    "Price / hour (cents)": "每小时价格（分）",
    "Public host": "公网主机",
    "optional public hostname": "可选公网主机名",
    "Create node token": "创建节点令牌",
    "Node registration is token-based. The server calls back to the platform with a node agent and heartbeat, and no SSH password is stored.": "节点注册基于令牌。服务器通过节点 Agent 和心跳回调平台，不会存储 SSH 密码。",
    "Publish Agent": "发布 Agent",
    "Create a provider-managed marketplace Agent that routes web chat to your healthy node": "创建服务商托管的市场 Agent，将 Web Chat 路由到你的健康节点",
    "Agent name": "Agent 名称",
    "e.g. Support Concierge": "例如 Support Concierge",
    "Framework": "框架",
    "Marketplace description": "市场描述",
    "What this Agent does for buyers": "这个 Agent 为买家做什么",
    "Default model provider": "默认模型供应商",
    "Default model": "默认模型",
    "Plan name": "套餐名称",
    "Agent price / hour (cents)": "Agent 每小时价格（分）",
    "Publish to marketplace": "发布到市场",
    "Active provider Agents appear in the marketplace immediately. Purchases are provisioned on provider nodes and Web Chat is dispatched as node tasks.": "启用状态的服务商 Agent 会立即出现在市场中。购买后会在服务商节点上开通，Web Chat 会作为节点任务派发。",
    "No provider Agents published yet.": "还没有发布服务商 Agent。",
    "No plan": "无套餐",
    "One-line callback install for the node agent": "节点 Agent 的一行回调安装命令",
    "Latest command": "最新命令",
    "Use this on the server you want to hand to the platform.": "在你要交给平台的服务器上使用此命令。",
    "After creating a node, copy the install command and run it on the target server.": "创建节点后，复制安装命令并在目标服务器上运行。",
    "This token is only recoverable from the command shown here. Rotate the token if this browser session is lost.": "此令牌只能从这里显示的命令中取回。如果浏览器会话丢失，请轮换令牌。",
    "Registration, heartbeat, and approval visibility": "注册、心跳和审核可见性",
    "No registered nodes yet.": "还没有注册节点。",
    "unknown": "未知",
    "no agent": "无 Agent",
    "Heartbeat": "心跳",
    "Rotate token": "轮换令牌",
    "Internal estimate only, no real payment": "仅内部估算，无真实支付",
    "Gross": "总额",
    "Platform fee": "平台费用",
    "Your instances": "你的实例",
    "Track lifecycle state, rough cost, and open the control console.": "跟踪生命周期状态、粗略费用，并打开控制台。",
    "New instance": "新建实例",
    "Instance list": "实例列表",
    "Open an instance to manage models, channels, skills, and terminal access": "打开实例以管理模型、通道、技能和终端访问",
    "Loading instances": "正在加载实例",
    "No instances yet": "还没有实例",
    "Start from the marketplace to provision a workspace.": "从市场开始开通一个工作空间。",
    "Open marketplace": "打开市场",
    "Instance console": "实例控制台",
    "Workspace tabs": "工作空间标签页",
    "Configure the instance, inspect logs, or open the terminal": "配置实例、查看日志或打开终端",
    "Overview": "概览",
    "Models": "模型",
    "Skills": "技能",
    "Terminal": "终端",
    "Logs": "日志",
    "Settings": "设置",
    "Setup Checklist": "配置检查清单",
    "Complete the setup path in order": "按顺序完成配置流程",
    "Done": "已完成",
    "In progress": "进行中",
    "Planned": "计划中",
    "Pick a provider and save the API key": "选择供应商并保存 API Key",
    "Web Chat is active": "Web Chat 已启用",
    "Enable Web Chat first": "请先启用 Web Chat",
    "enabled": "已启用",
    "messages": "条消息",
    "log entries": "条日志",
    "Status, plan, node, and current estimate": "状态、套餐、节点和当前估算",
    "Stop": "停止",
    "Restart": "重启",
    "Status": "状态",
    "runtime state": "运行状态",
    "Estimate": "估算",
    "runtime": "运行时",
    "Node": "节点",
    "chat/provision via node tasks": "通过节点任务聊天/开通",
    "Started": "启动时间",
    "Health": "健康",
    "Checks provider node reachability and instance state": "检查服务商节点可达性和实例状态",
    "The local sandbox checks workspace and instance state": "本地沙箱检查工作空间和实例状态",
    "Health check": "健康检查",
    "This Agent runs on the provider's registered node. Provisioning, lifecycle actions, and Web Chat are dispatched through node tasks; user-visible replies come from the provider runtime command.": "此 Agent 运行在服务商注册的节点上。开通、生命周期操作和 Web Chat 都通过节点任务派发；用户可见回复来自服务商运行时命令。",
    "This environment does not have Docker. The Phase 1 MVP uses isolated workspaces to simulate a Linux agent sandbox and keeps the Docker runtime adapter boundary intact.": "当前环境没有 Docker。第一阶段 MVP 使用隔离工作空间模拟 Linux Agent 沙箱，并保留 Docker 运行时适配边界。",
    "Billing mode": "计费模式",
    "Internal billing is estimated from runtime and chat tokens. No payment provider is connected.": "内部计费按运行时长和聊天 token 估算，尚未接入支付服务商。",
    "Next actions": "下一步",
    "Finish the setup flow in order": "按顺序完成配置流程",
    "Set the provider and API key in Models": "在模型页设置供应商和 API Key",
    "Turn on Web Chat in Channels": "在通道页启用 Web Chat",
    "Install and enable the skills this template expects": "安装并启用该模板所需技能",
    "Send one chat message to verify model and channel": "发送一条聊天消息来验证模型和通道",
    "Open Terminal and Logs to confirm runtime health": "打开终端和日志确认运行时健康",
    "Configure the default model and a user-provided API key": "配置默认模型和用户提供的 API Key",
    "Model": "模型",
    "User API key": "用户 API Key",
    "Clear saved API key": "清除已保存的 API Key",
    "Save default model": "保存默认模型",
    "Secret": "密钥",
    "Saved": "已保存",
    "Not configured": "未配置",
    "Web Chat is implemented; external channels remain adapter placeholders": "Web Chat 已实现；外部通道仍为适配器占位",
    "Console chat is available for this workspace.": "此工作空间可使用控制台聊天。",
    "Phase 1 keeps the adapter shape here; real external channel access comes later.": "第一阶段保留适配器结构；真实外部通道稍后接入。",
    "Enable": "启用",
    "Disable": "禁用",
    "Preview placeholder": "预览占位",
    "Dispatches messages to the provider node runtime": "将消息派发到服务商节点运行时",
    "Talk to the current agent workspace": "与当前 Agent 工作空间对话",
    "No messages yet": "还没有消息",
    "Type a message": "输入消息",
    "Send": "发送",
    "Waiting for provider runtime reply...": "正在等待服务商运行时回复...",
    "Provider runtime replied.": "服务商运行时已回复。",
    "Still waiting for the provider node; refresh chat to check for the reply.": "仍在等待服务商节点；刷新聊天查看回复。",
    "Task": "任务",
    "Install, enable, disable, and review built-in skill permissions": "安装、启用、禁用并查看内置技能权限",
    "Uninstall": "卸载",
    "Browser terminal connected to the current workspace directory": "连接到当前工作空间目录的浏览器终端",
    "loading terminal": "正在加载终端",
    "Reconnect": "重新连接",
    "Agent Logs": "Agent 日志",
    "Agent, runtime, deployment, and health-check logs": "Agent、运行时、部署和健康检查日志",
    "No logs yet": "还没有日志",
    "Audit Logs": "审计日志",
    "Important user actions and terminal session summaries": "重要用户操作和终端会话摘要",
    "No audit entries yet": "还没有审计记录",
    "system": "系统",
    "Rename, restart, stop, or destroy the instance": "重命名、重启、停止或销毁实例",
    "Save": "保存",
    "Destroy": "销毁",
    "Usage": "用量",
    "Runtime, tokens, and estimated cost": "运行时长、token 和估算费用",
    "Estimated": "已估算",
    "Tokens": "Token",
    "Quantity": "数量",
    "Time": "时间",
    "No usage records yet. Running instances show live estimates.": "还没有用量记录。运行中的实例会显示实时估算。",
    "Admin console": "管理员控制台",
    "Review nodes, templates, providers, instances, usage, and recent errors.": "查看节点、模板、服务商、实例、用量和近期错误。",
    "Platform summary": "平台摘要",
    "Counts for users, instances, and templates": "用户、实例和模板计数",
    "Users": "用户",
    "Official and provider node resources, heartbeat, and review status": "官方与服务商节点资源、心跳和审核状态",
    "Type": "类型",
    "Resources": "资源",
    "Recent errors": "近期错误",
    "Latest instance errors": "最新实例错误",
    "No recent errors": "没有近期错误",
    "Provider review": "服务商审核",
    "Approve or reject provider profiles and node handoff": "批准或拒绝服务商资料和节点交接",
    "No provider applications yet": "还没有服务商申请",
    "No payout note provided": "未提供结算备注",
    "nodes": "个节点",
    "Approve": "批准",
    "Reject": "拒绝",
    "Suspend": "暂停",
    "Template management": "模板管理",
    "Create, publish, and archive official templates": "创建、发布和归档官方模板",
    "Template name": "模板名称",
    "Template description": "模板描述",
    "Base price / hour (cents)": "基础每小时价格（分）",
    "Create template": "创建模板",
    "Publish": "发布",
    "Draft": "草稿",
    "Archive": "归档",
    "Instance management": "实例管理",
    "Review all platform instances": "查看所有平台实例",
    "User": "用户",
    "Starting OpenAsstAI": "正在启动 OpenAsstAI",
    "Admin access required": "需要管理员权限",
    "Copy": "复制",
    "Copied": "已复制",
    "Ready": "就绪",
    "Console": "控制台",
    "Loading instance": "正在加载实例",
    "Instance not found": "找不到实例",
    "Choose Agent": "选择 Agent",
    "Create Instance": "创建实例",
    "Configure Model": "配置模型",
    "Enable Channel": "启用通道",
    "Enable Skills": "启用技能",
    "Test Chat": "测试聊天",
    "Terminal / Logs": "终端 / 日志",
    "no required skills": "无必需技能",
    "required enabled": "项必需技能已启用",
    "waiting for assistant reply": "等待助手回复",
    "send a Web Chat message": "发送一条 Web Chat 消息",
    "Local sandbox Agent": "本地沙箱 Agent",
    "processed your Web Chat turn.": "已处理你的 Web Chat 消息。",
    "Enabled skills": "已启用技能",
    "Provider runtime failed to answer this chat turn": "服务商运行时未能回复本轮聊天",
    "消息已发送到 Provider 节点执行，稍后刷新聊天记录查看回复。": "消息已发送到服务商节点执行，稍后刷新聊天记录查看回复。",
    "Official Shanghai 1": "官方上海 1",
    "Official Singapore 1": "官方新加坡 1",
    "Hermes Research Agent": "Hermes 研究 Agent",
    "OpenClaw Ops Agent": "OpenClaw 运维 Agent",
    "Built for always-on research, source gathering, document organization, and light automation.": "面向持续研究、资料收集、文档整理和轻量自动化构建。",
    "An operations-focused agent for troubleshooting, log review, and command-line workflows.": "面向故障排查、日志审阅和命令行流程的运维 Agent。",
    "local-sandbox adapter": "本地沙箱适配器",
    "local-sandbox": "本地沙箱",
    "provider-managed": "服务商托管",
    "provider-node": "服务商节点",
    "workspace exists, model config present, web chat channel active": "工作空间存在，模型配置已就绪，Web Chat 通道已启用",
    "workspace exists, terminal helper installed, log channel enabled": "工作空间存在，终端助手已安装，日志通道已启用",
    "Start with Web Chat, then add external channels when adapters are ready": "先从 Web Chat 开始，适配器就绪后再添加外部通道",
    "Best for long-running document Q&A and research workflows": "适合长时间文档问答和研究流程",
    "Supports external model providers and user-provided API keys": "支持外部模型供应商和用户提供的 API Key",
    "Best for command-line diagnosis, log summaries, and quick operational tasks": "适合命令行诊断、日志摘要和快速运维任务",
    "Web Chat is available; Feishu is the first external-channel placeholder": "Web Chat 可用；飞书是首个外部通道占位",
    "Terminal and Logs are the primary operating surfaces": "终端和日志是主要操作界面",
    "File Manager": "文件管理器",
    "Scheduler": "调度器",
    "Terminal Helper": "终端助手",
    "Log Reader": "日志阅读器",
    "Read, organize, and write files inside the instance workspace.": "在实例工作空间内读取、整理和写入文件。",
    "Store lightweight scheduled tasks and reminders inside the instance.": "在实例内存储轻量级计划任务和提醒。",
    "Provide explanations, summaries, and safety notes for command-line work.": "为命令行操作提供解释、摘要和安全提示。",
    "Read instance logs and generate troubleshooting summaries.": "读取实例日志并生成故障排查摘要。",
    "running": "运行中",
    "active": "启用",
    "stopped": "已停止",
    "disabled": "已禁用",
    "draft": "草稿",
    "warning": "警告",
    "waitlist": "等待列表",
    "degraded": "降级",
    "pending": "待处理",
    "error": "错误",
    "destroyed": "已销毁",
    "offline": "离线",
    "archived": "已归档",
    "rejected": "已拒绝",
    "suspended": "已暂停",
    "approved": "已批准",
    "provisioning": "开通中",
    "not_installed": "未安装",
    "info": "信息",
    "warn": "警告",
    "user": "用户",
    "assistant": "助手",
    "hour": "小时",
    "token": "Token",
    "storage": "存储",
    "network": "网络",
    "official": "官方",
    "ready": "就绪",
    "missing": "缺失",
    "connected": "已连接",
    "connecting": "连接中",
    "disconnected": "已断开",
    "Agent Machines": "Agent 机器",
    "Sessions": "会话",
    "Agent Machine Marketplace": "Agent 机器市场",
    "Browse provider agent machines and rent access sessions": "浏览服务商 Agent 机器并租用访问会话",
    "API Key (BYOK, optional)": "API Key（自带，可选）",
    "No active listings available": "暂无可用上架项",
    "Title": "标题",
    "Agent": "Agent",
    "Access": "访问模式",
    "Price": "价格",
    "Free": "免费",
    "Rent": "租用",
    "Session": "会话",
    "Type a message...": "输入消息...",
    "Listing": "上架项",
    "Expires": "过期时间",
    "My Sessions": "我的会话",
    "Active access grants and sessions": "活跃的访问授权和会话",
    "No active sessions": "暂无活跃会话",
    "View": "查看",
    "Open Session": "打开会话",
    "Provider Workflow": "服务商工作流",
    "Machine Management": "机器管理",
    "Register Machine": "注册机器",
    "Machine Name": "机器名称",
    "OS": "操作系统",
    "CPU Cores": "CPU 核心",
    "Memory (MB)": "内存 (MB)",
    "Disk (GB)": "磁盘 (GB)",
    "GPU": "GPU",
    "Installed Agents": "已安装 Agent",
    "Register": "注册",
    "Run Check": "运行检查",
    "Create Listing": "创建上架项",
    "Description": "描述",
    "Agent Type": "Agent 类型",
    "Access Mode": "访问模式",
    "Isolation Mode": "隔离模式",
    "Concurrency Limit": "并发上限",
    "Price (cents/hour)": "价格（分/小时）",
    "Billing Unit": "计费单位",
    "Create": "创建",
    "My Listings": "我的上架项",
    "No machines registered": "暂无已注册机器",
    "No listings created": "暂无上架项",
    "Apply": "申请",
    "Approved": "已审核",
    "Pending": "待审核",
    "Verify Capability": "验证能力",
    "Monitor Sessions": "监控会话",
    "Step": "步骤",
    "Rent access to controlled agent machines": "租用受控 Agent 机器访问权",
    "Not raw VPS. Providers offer controlled access to agents they own.": "非裸 VPS。服务商提供其拥有的 Agent 的受控访问。",
    "BYOK": "自带密钥",
    "optional": "可选",
    "Start Session": "开始会话",
    "Isolation": "隔离",
    "Concurrency": "并发",
    "per hour": "每小时",
    "No messages yet. Send a message to start.": "暂无消息。发送消息开始对话。",
    "Stop Session": "停止会话",
    "Created": "创建时间"
  }
};

const zhFallbacks = translations.zh;

function isChinese(language) {
  return language === "zh-CN";
}

function useI18n() {
  return useContext(LanguageContext);
}

function translate(language, value) {
  if (value === undefined || value === null) return value;
  const text = String(value);
  if (!isChinese(language)) return text;
  return zhFallbacks[text] || text;
}

function useTranslator() {
  return useI18n().t;
}

function translateStatus(status, language) {
  return translate(language, status || "unknown");
}

function translateErrorMessage(message, language) {
  if (!message || !isChinese(language)) return message;
  if (zhFallbacks[message]) return zhFallbacks[message];
  const requestFailed = message.match(/^Request failed \((\d+)\)$/);
  if (requestFailed) return `请求失败（${requestFailed[1]}）`;
  return message;
}

function translateLogMessage(message, language) {
  if (!message || !isChinese(language)) return message;
  const text = String(message);
  if (zhFallbacks[text]) return zhFallbacks[text];
  if (text.startsWith("Provider runtime failed to answer this chat turn:")) {
    return text.replace("Provider runtime failed to answer this chat turn:", "服务商运行时未能回复本轮聊天：");
  }
  if (text.startsWith("Local sandbox Agent ") && text.includes(" processed your Web Chat turn.")) {
    return text
      .replace("Local sandbox Agent ", "本地沙箱 Agent ")
      .replace(" processed your Web Chat turn.", " 已处理你的 Web Chat 消息。")
      .replace("Enabled skills:", "已启用技能：")
      .replace("none", "无");
  }
  return text;
}

function formatChannelsCount(count, language) {
  return isChinese(language) ? `${count} 个通道` : `${count} channels`;
}

function formatSkillsCount(count, language) {
  return isChinese(language) ? `${count} 个技能` : `${count} skills`;
}

function formatRuntimeHours(value, language) {
  return isChinese(language) ? `${Math.round(value || 0)} 运行小时` : `${Math.round(value || 0)} runtime h`;
}

function formatHourlyMoney(cents, language) {
  return `${formatMoney(cents)}${isChinese(language) ? "/小时" : "/h"}`;
}

function formatActiveAgents(value, language) {
  return isChinese(language) ? `${value} 个已在市场上架` : `${value} active in marketplace`;
}

function formatHealthyNodes(value, language) {
  return isChinese(language) ? `${value} 个健康` : `${value} healthy`;
}

function formatMessagesCount(value, language) {
  return isChinese(language) ? `${value} 条消息` : `${value} messages`;
}

function formatLogEntriesCount(value, language) {
  return isChinese(language) ? `${value} 条日志` : `${value} log entries`;
}

function formatRequiredEnabled(current, total, language) {
  return isChinese(language) ? `${current}/${total} 项必需技能已启用` : `${current}/${total} required enabled`;
}

function translateSetupNote(note, language) {
  if (!note) return note;
  const requiredMatch = String(note).match(/^(\d+)\/(\d+) required enabled$/);
  if (requiredMatch) return formatRequiredEnabled(Number(requiredMatch[1]), Number(requiredMatch[2]), language);
  return translate(language, note);
}

function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(getLanguage);

  const setLanguage = useCallback((nextLanguage) => {
    const normalized = nextLanguage === "en" ? "en" : "zh-CN";
    setLanguagePreference(normalized);
    setLanguageState(normalized);
  }, []);

  const t = useCallback((value) => translate(language, value), [language]);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const value = useMemo(() => ({ language, setLanguage, t }), [language, setLanguage, t]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

function LanguageSwitcher({ className = "" }) {
  const { language, setLanguage, t } = useI18n();
  const isZh = isChinese(language);

  return (
    <div className={`language-switcher ${className}`.trim()} role="group" aria-label={t("Language")}>
      <Languages size={16} aria-hidden="true" />
      <button type="button" className={isZh ? "active" : ""} onClick={() => setLanguage("zh-CN")} aria-pressed={isZh}>
        中文
      </button>
      <button type="button" className={!isZh ? "active" : ""} onClick={() => setLanguage("en")} aria-pressed={!isZh}>
        English
      </button>
    </div>
  );
}

function IconButton({ title, children, ...props }) {
  const t = useTranslator();
  return (
    <button className="icon" type="button" title={t(title)} aria-label={t(title)} {...props}>
      {children}
    </button>
  );
}

function Pill({ children, tone }) {
  return <span className={`pill ${tone || "neutral"}`}>{children}</span>;
}

function StatusPill({ status }) {
  const { language } = useI18n();
  return <Pill tone={statusTone(status)}>{translateStatus(status, language)}</Pill>;
}

function Metric({ label, value, note, icon, tone = "neutral" }) {
  const t = useTranslator();
  return (
    <div className={`metric ${tone}`.trim()}>
      <div className="metric-top">
        <div className="metric-label">{t(label)}</div>
        {icon ? <div className="metric-icon">{icon}</div> : null}
      </div>
      <div className="metric-value">{typeof value === "string" ? t(value) : value}</div>
      {note ? <div className="metric-note">{typeof note === "string" ? t(note) : note}</div> : null}
    </div>
  );
}

function SurfaceCard({ children, className = "", as: Component = "section" }) {
  return <Component className={`surface-card ${className}`.trim()}>{children}</Component>;
}

function FeatureTile({ icon, title, description, meta, tone = "neutral" }) {
  const t = useTranslator();
  return (
    <div className={`feature-tile ${tone}`.trim()}>
      <div className="feature-icon">{icon}</div>
      <div>
        <strong>{t(title)}</strong>
        <p>{t(description)}</p>
        {meta ? <span>{t(meta)}</span> : null}
      </div>
    </div>
  );
}

function CommandPreview({ title, lines, footer, status = "Ready" }) {
  const t = useTranslator();
  return (
    <div className="command-preview">
      <div className="command-preview-bar">
        <div className="window-dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <strong>{t(title)}</strong>
        <Pill tone="success">{t(status)}</Pill>
      </div>
      <div className="command-preview-body">
        {lines.map((line, index) => (
          <pre className="code-block" key={`${line}-${index}`}>{line}</pre>
        ))}
      </div>
      {footer ? <div className="command-preview-footer">{typeof footer === "string" ? t(footer) : footer}</div> : null}
    </div>
  );
}

function PageHeader({ eyebrow, title, subtitle, actions }) {
  const t = useTranslator();
  return (
    <div className="page-header">
      <div>
        {eyebrow ? <div className="page-eyebrow">{t(eyebrow)}</div> : null}
        <h1>{typeof title === "string" ? t(title) : title}</h1>
        {subtitle ? <p>{typeof subtitle === "string" ? t(subtitle) : subtitle}</p> : null}
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </div>
  );
}

function Panel({ title, subtitle, icon, actions, children, className = "" }) {
  const t = useTranslator();
  return (
    <section className={`surface-card panel ${className}`.trim()}>
      <div className="panel-header">
        <div>
          <div className="section-title">
            {icon} {t(title)}
          </div>
          {subtitle ? <div className="section-subtitle">{typeof subtitle === "string" ? t(subtitle) : subtitle}</div> : null}
        </div>
        {actions ? <div className="toolbar">{actions}</div> : null}
      </div>
      <div className="panel-body">{children}</div>
    </section>
  );
}

function Empty({ children, title, icon, action }) {
  const t = useTranslator();
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon || <CircleHelp size={16} />}</div>
      <div className="empty-copy">
        <strong>{typeof (title || children) === "string" ? t(title || children) : title || children}</strong>
        {title && children ? <p>{typeof children === "string" ? t(children) : children}</p> : null}
      </div>
      {action ? <div className="empty-action">{action}</div> : null}
    </div>
  );
}

const secretPreviewLabels = {
  "\u5df2\u4fdd\u5b58": "Saved",
  "\u672a\u914d\u7f6e": "Not configured"
};

function formatSecretPreview(value) {
  return secretPreviewLabels[value] || value || "Not configured";
}

function hasSavedSecret(value) {
  return formatSecretPreview(value) === "Saved";
}

function copyText(value) {
  if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(value);
  }
  return Promise.resolve();
}

function CopyableCommand({ label, value, helper }) {
  const [copied, setCopied] = useState(false);
  const t = useTranslator();

  async function handleCopy() {
    await copyText(value);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  return (
    <div className="command-box">
      <div className="item-row">
        <strong>{t(label)}</strong>
        <button type="button" onClick={handleCopy}>
          {copied ? <Clipboard size={16} /> : <Copy size={16} />} {copied ? t("Copied") : t("Copy")}
        </button>
      </div>
      <pre className="code-block">{value}</pre>
      {helper ? <div className="muted">{t(helper)}</div> : null}
    </div>
  );
}

function FlowStepList({ steps }) {
  const t = useTranslator();
  return (
    <div className="flow-step-list">
      {steps.map((step, index) => {
        const icon = step.state === "done" ? <CircleCheckBig size={16} /> : step.state === "active" ? <ArrowRight size={16} /> : <CircleHelp size={16} />;
        return (
          <div className={`flow-step ${step.state}`} key={step.key || index}>
            <div className="flow-step-mark">{icon}</div>
            <div className="flow-step-body">
              <div className="item-row">
                <strong>{t(step.label)}</strong>
                <Pill tone={step.state === "done" ? "success" : step.state === "active" ? "warning" : "neutral"}>
                  {step.state === "done" ? t("Done") : step.state === "active" ? t("In progress") : t("Planned")}
                </Pill>
              </div>
              <div className="muted">{typeof step.note === "string" ? t(step.note) : step.note}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function useRoute() {
  const [route, setRouteState] = useState(parseHashRoute);
  useEffect(() => {
    const onHashChange = () => setRouteState(parseHashRoute());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);
  return route;
}

function useApi(token, onAuthError) {
  return useCallback(
    async (path, options = {}) => {
      try {
        return await apiRequest(path, { ...options, token });
      } catch (error) {
        if (error.status === 401) onAuthError?.();
        throw error;
      }
    },
    [token, onAuthError]
  );
}

function AuthPage({ onAuth }) {
  const [mode, setMode] = useState("login");
  const [email, setEmail] = useState("demo@openasst.ai");
  const [password, setPassword] = useState("demo123");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { language, t } = useI18n();

  async function submit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);
    try {
      const payload = await apiRequest(`/api/auth/${mode}`, {
        method: "POST",
        body: { email, password }
      });
      onAuth(payload.token, payload.user);
      setRoute("market");
    } catch (err) {
      setError(translateErrorMessage(err.message, language));
    } finally {
      setLoading(false);
    }
  }

  function useDemo(kind) {
    if (kind === "admin") {
      setEmail("admin@openasst.ai");
      setPassword("admin123");
    } else {
      setEmail("demo@openasst.ai");
      setPassword("demo123");
    }
    setMode("login");
  }

  return (
    <div className="auth-wrap">
      <div className="auth-panel">
        <section className="auth-hero surface-card spotlight-surface">
          <div className="brand">
            <div className="brand-mark">OA</div>
            <div>
              <div className="brand-name">OpenAsstAI</div>
              <div className="brand-tag">{t("Official agent workspace marketplace")}</div>
            </div>
          </div>
          <div className="auth-kicker">{t("COSS-style shell for the Phase 1 MVP")}</div>
          <h1 className="auth-title">{t("Official agent workspaces, setup, and control.")}</h1>
          <p className="auth-note">
            {t("Browse official templates, launch a Linux workspace, configure models and channels, and manage the instance from one quiet control surface.")}
          </p>
          <div className="feature-grid">
            <FeatureTile
              icon={<Search size={17} />}
              title="Discover"
              description="Inspect official agents, provider listings, plans, and runtime hints."
              meta="Marketplace"
              tone="blue"
            />
            <FeatureTile
              icon={<TerminalSquare size={17} />}
              title="Operate"
              description="Open model, channel, terminal, and log controls from one shell."
              meta="Console"
              tone="green"
            />
          </div>
          <div className="kpi-strip">
            <Metric label="Runtime" value="Local sandbox" note="Docker adapter preserved" icon={<Server size={15} />} />
            <Metric label="Templates" value="2" note="Hermes / OpenClaw" icon={<Bot size={15} />} />
            <Metric label="Channels" value="4" note="Web Chat ready" icon={<Plug size={15} />} />
            <Metric label="Billing" value="Estimate only" note="No payment integration" icon={<Coins size={15} />} />
          </div>
          <CommandPreview
            title="workspace launch"
            lines={[
              "$ openasst marketplace select hermes",
              "$ provision --plan starter --channel web_chat",
              "status: workspace ready"
            ]}
            footer="Demo credentials are prefilled for local evaluation."
          />
          <div className="toolbar">
            <button type="button" onClick={() => useDemo("user")}>
              <Bot size={16} /> {t("Demo user")}
            </button>
            <button type="button" onClick={() => useDemo("admin")}>
              <Shield size={16} /> {t("Demo admin")}
            </button>
            <LanguageSwitcher />
          </div>
        </section>
        <form className="auth-form surface-card stack" onSubmit={submit}>
          <div className="tabbar">
            <button type="button" className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>
              {t("Sign in")}
            </button>
            <button type="button" className={mode === "register" ? "active" : ""} onClick={() => setMode("register")}>
              {t("Create account")}
            </button>
          </div>
          <label className="section">
            <span className="section-title">{t("Email")}</span>
            <input value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" />
          </label>
          <label className="section">
            <span className="section-title">{t("Password")}</span>
            <input
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
            />
          </label>
          {error ? <Pill tone="danger">{error}</Pill> : null}
          <button className="primary" type="submit" disabled={loading}>
            <KeyRound size={16} /> {loading ? t("Working") : mode === "login" ? t("Sign in") : t("Create account")}
          </button>
        </form>
      </div>
    </div>
  );
}

function Shell({ user, onLogout, route, children }) {
  const [navOpen, setNavOpen] = useState(false);
  const { t } = useI18n();
  const nav = [
    { id: "market", label: "Marketplace", icon: <Search size={16} /> },
    { id: "agent-market", label: "Agent Machines", icon: <Zap size={16} /> },
    { id: "sessions", label: "Sessions", icon: <Activity size={16} /> },
    { id: "instances", label: "Instances", icon: <Boxes size={16} /> },
    { id: "provider", label: "Provider", icon: <ServerCog size={16} /> }
  ];
  if (user?.role === "admin") nav.push({ id: "admin", label: "Admin", icon: <Shield size={16} /> });

  const current = nav.find((item) => item.id === route.page);
  const pageLabel =
    route.page === "instance"
      ? "Instance"
      : current?.label || "Marketplace";
  const translatedPageLabel = t(pageLabel);

  useEffect(() => {
    setNavOpen(false);
  }, [route.page, route.id]);

  return (
    <div className="shell">
      <aside className={`shell-sidebar ${navOpen ? "open" : ""}`}>
        <div className="sidebar-card surface-card">
          <button className="brand ghost sidebar-brand" type="button" onClick={() => setRoute("market")}>
            <div className="brand-mark">OA</div>
            <div>
              <div className="brand-name">OpenAsstAI</div>
              <div className="brand-tag">{t("Workspace control plane")}</div>
            </div>
          </button>
          <div className="sidebar-copy">
            {t("Official templates, instance setup, provider nodes, and admin controls in one place.")}
          </div>
          <div className="sidebar-status">
            <Pill tone="success">{t("Live shell")}</Pill>
            <span>{t("Phase 1 MVP")}</span>
          </div>
        </div>
        <nav className="nav-rail">
          {nav.map((item) => (
            <button
              type="button"
              key={item.id}
              className={route.page === item.id ? "active" : ""}
              onClick={() => setRoute(item.id)}
            >
              {item.icon}
              <span>{t(item.label)}</span>
              <ChevronRight className="nav-chevron" size={15} />
            </button>
          ))}
        </nav>
        <div className="sidebar-card surface-card user-card">
          <div className="sidebar-meta">
            <span className="muted">{t("Signed in as")}</span>
            <strong>{user.email}</strong>
            <Pill tone={user.role === "admin" ? "success" : "neutral"}>{t(user.role)}</Pill>
          </div>
          <button type="button" className="ghost" onClick={onLogout}>
            <LogOut size={16} /> {t("Sign out")}
          </button>
        </div>
      </aside>
      {navOpen ? <button type="button" className="shell-backdrop" aria-label={t("Close navigation")} onClick={() => setNavOpen(false)} /> : null}
      <div className="shell-main">
        <header className="topbar">
          <div className="topbar-left">
            <IconButton title={navOpen ? "Close navigation" : "Open navigation"} onClick={() => setNavOpen((value) => !value)}>
              {navOpen ? <X size={16} /> : <Menu size={16} />}
            </IconButton>
            <button className="brand ghost shell-brand" type="button" onClick={() => setRoute("market")}>
              <div className="brand-mark">OA</div>
              <div>
                <div className="brand-name">OpenAsstAI</div>
                <div className="brand-tag">{translatedPageLabel}</div>
              </div>
            </button>
          </div>
          <div className="topbar-center">
            <div className="topbar-kicker">{t("OpenAsstAI console")}</div>
            <div className="topbar-label">{translatedPageLabel}</div>
          </div>
          <div className="topbar-right">
            <LanguageSwitcher className="topbar-language" />
            <span className="topbar-status">
              <Activity size={15} /> {t("Online")}
            </span>
            <span className="user-chip">
              <Shield size={15} /> {user.email}
            </span>
            <IconButton title="Sign out" onClick={onLogout}>
              <LogOut size={16} />
            </IconButton>
          </div>
        </header>
        <main className="content">{children}</main>
      </div>
      <div className={`mobile-sheet ${navOpen ? "open" : ""}`}>
        <div className="mobile-sheet-panel surface-card">
          <div className="item-row">
            <strong>{t("Navigate")}</strong>
            <IconButton title="Close navigation" onClick={() => setNavOpen(false)}>
              <X size={16} />
            </IconButton>
          </div>
          <nav className="nav-rail">
            {nav.map((item) => (
              <button
                type="button"
                key={item.id}
                className={route.page === item.id ? "active" : ""}
                onClick={() => setRoute(item.id)}
              >
                {item.icon}
                <span>{t(item.label)}</span>
              </button>
            ))}
          </nav>
          <LanguageSwitcher />
        </div>
      </div>
    </div>
  );
}

function MarketPage({ api, onInstanceCreated }) {
  const [templates, setTemplates] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [selectedPlanId, setSelectedPlanId] = useState("");
  const [name, setName] = useState("");
  const [query, setQuery] = useState("");
  const [framework, setFramework] = useState("all");
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");
  const { language, t } = useI18n();

  const selected = templates.find((template) => template.id === selectedId) || templates[0];
  const selectedPlan =
    selected?.plans?.find((plan) => plan.id === selectedPlanId) || selected?.plans?.[0] || null;
  const marketStats = useMemo(() => {
    const officialCount = templates.filter((template) => template.official).length;
    const providerCount = Math.max(templates.length - officialCount, 0);
    const frameworks = new Set(templates.map((template) => template.framework).filter(Boolean));
    const lowPrice = templates.length
      ? Math.min(...templates.map((template) => displayHourlyPrice(template)))
      : 0;
    return { officialCount, providerCount, frameworkCount: frameworks.size, lowPrice };
  }, [templates]);

  const filtered = useMemo(() => {
    return templates.filter((template) => {
      const matchQuery = [template.name, template.description, template.framework]
        .join(" ")
        .toLowerCase()
        .includes(query.toLowerCase());
      const matchFramework = framework === "all" || template.framework === framework;
      return matchQuery && matchFramework;
    });
  }, [templates, query, framework]);

  function displayHourlyPrice(template) {
    const planPrices = (template.plans || [])
      .map((plan) => Number(plan.pricePerHourCents || 0))
      .filter((price) => price > 0);
    if (planPrices.length > 0) return Math.min(...planPrices);
    return Number(template.basePriceCents || 0);
  }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await api("/api/templates");
      setTemplates(payload.templates);
      if (!selectedId && payload.templates[0]) {
        setSelectedId(payload.templates[0].id);
        setSelectedPlanId(payload.templates[0].plans?.[0]?.id || "");
        setName(`${payload.templates[0].name} Instance`);
      }
    } catch (err) {
      setError(translateErrorMessage(err.message, language));
    } finally {
      setLoading(false);
    }
  }, [api, language, selectedId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (selected && !selected.plans.some((plan) => plan.id === selectedPlanId)) {
      setSelectedPlanId(selected.plans?.[0]?.id || "");
    }
  }, [selected, selectedPlanId]);

  async function createInstance() {
    if (!selected || !selectedPlan) return;
    setError("");
    setCreating(true);
    try {
      const payload = await api("/api/instances", {
        method: "POST",
        body: {
          templateId: selected.id,
          planId: selectedPlan.id,
          name: name || `${selected.name} Instance`
        }
      });
      onInstanceCreated?.(payload.instance);
      setRoute(`instance/${payload.instance.id}`);
    } catch (err) {
      setError(translateErrorMessage(err.message, language));
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="page-stack">
      <section className="market-hero spotlight-surface surface-card">
        <div className="market-hero-copy">
          <div className="page-eyebrow">{t("Marketplace")}</div>
          <h1>{t("Agent marketplace")}</h1>
          <p>{t("Choose an official or provider-published Agent, inspect setup details, and launch a callable workspace from one control surface.")}</p>
          <div className="hero-actions">
            <button type="button" className="primary" onClick={createInstance} disabled={creating || !selected || !selectedPlan}>
              <Zap size={16} /> {creating ? t("Creating") : t("Launch selected")}
            </button>
            <button type="button" onClick={load} disabled={loading}>
              <RefreshCw size={16} /> {t("Refresh")}
            </button>
          </div>
        </div>
        <div className="market-hero-panel">
          <div className="kpi-strip">
            <Metric label="Official" value={marketStats.officialCount} note="Platform templates" icon={<Shield size={15} />} tone="success" />
            <Metric label="Provider" value={marketStats.providerCount} note="Published agents" icon={<ServerCog size={15} />} />
            <Metric label="Frameworks" value={marketStats.frameworkCount || "-"} note="Available now" icon={<Cpu size={15} />} />
            <Metric label="Starts at" value={formatHourlyMoney(marketStats.lowPrice, language)} note="Lowest plan" icon={<Coins size={15} />} tone="warning" />
          </div>
          <CommandPreview
            title="launch recipe"
            lines={[
              selected ? `$ template ${selected.framework}/${selected.name}` : "$ template loading",
              selectedPlan ? `$ plan ${selectedPlan.name} --${selectedPlan.cpu}cpu --${selectedPlan.memoryMb}mb` : "$ plan select",
              selected ? `$ channel ${(selected.defaultChannels || []).map((channel) => channelLabels[channel] || channel).join(", ") || "web_chat"}` : "$ channel web_chat"
            ]}
            footer={selected ? <>{selected.runtimeKind}</> : "Loading template metadata"}
            status={selected ? "Selected" : "Loading"}
          />
        </div>
      </section>

      <div className="grid-2">
        <Panel title="Templates" subtitle="Official and approved provider Agents with currently available node capacity" icon={<Bot size={16} />}>
          <div className="stack">
            <div className="form-2">
              <input placeholder={t("Search templates, capabilities, or framework")} value={query} onChange={(event) => setQuery(event.target.value)} />
              <select value={framework} onChange={(event) => setFramework(event.target.value)}>
                <option value="all">{t("All frameworks")}</option>
                <option value="hermes">Hermes</option>
                <option value="openclaw">OpenClaw</option>
                <option value="custom">{t("Custom")}</option>
              </select>
            </div>
            {error ? <Pill tone="danger">{error}</Pill> : null}
            {loading ? (
              <Empty title="Loading templates">Fetching marketplace listings.</Empty>
            ) : filtered.length === 0 ? (
              <Empty title="No matching templates">Adjust the search or framework filter.</Empty>
            ) : (
              <div className="template-list">
                {filtered.map((template) => (
                  <button
                    type="button"
                    key={template.id}
                    className={`item template-card ${selected?.id === template.id ? "selected" : ""}`}
                    onClick={() => {
                      setSelectedId(template.id);
                      setSelectedPlanId(template.plans?.[0]?.id || "");
                      setName(`${template.name} Instance`);
                    }}
                  >
                    <div className="item-row template-card-top">
                      <div className="template-title">
                        <span className="template-glyph"><Bot size={16} /></span>
                        <strong>{template.name}</strong>
                      </div>
                      <span className="toolbar">
                        <Pill tone={template.official ? "success" : "warning"}>{template.official ? t("Official") : t("Provider")}</Pill>
                        <Pill>{template.framework}</Pill>
                        <Pill tone="neutral">{template.runtimeKind}</Pill>
                      </span>
                    </div>
                    <div className="muted">{template.description}</div>
                    <div className="chip-row">
                      {(template.capabilities?.models || []).map((cap) => (
                        <span className="chip" key={cap}>{cap}</span>
                      ))}
                      {(template.capabilities?.channels || []).slice(0, 3).map((cap) => (
                        <span className="chip" key={cap}>{cap}</span>
                      ))}
                      <span className="chip">{template.installMethod}</span>
                    </div>
                    <div className="item-row template-card-foot">
                      <span className="muted">
                        {template.defaultModel.provider}/{template.defaultModel.model}
                      </span>
                      <strong>{t("From")} {formatHourlyMoney(displayHourlyPrice(template), language)}</strong>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </Panel>

        <Panel title="Launch workspace" subtitle="Allocate an official Linux node and seed the selected template" icon={<Server size={16} />}>
          {selected ? (
            <div className="stack">
              <div className="section">
                <div className="section-title">{selected.name}</div>
                <div className="section-subtitle">{selected.description}</div>
              </div>
              <div className="grid-3">
                <Metric label="Install" value={<>{selected.installMethod}</>} note={<>{selected.runtimeKind}</>} />
                <Metric
                  label="Start"
                  value={selected.startCommand ? <>{selected.startCommand}</> : t("Platform-managed start")}
                  note={selected.healthCheck ? <>{selected.healthCheck}</> : t("Workspace health check")}
                />
                <Metric label="Default" value={`${selected.defaultModel.provider}/${selected.defaultModel.model}`} note={`${formatChannelsCount(selected.defaultChannels.length, language)} · ${formatSkillsCount(selected.defaultSkills.length, language)}`} />
              </div>
              <div className="item">
                <div className="item-row">
                  <strong>{t("Provisioning notes")}</strong>
                  <Pill tone="warning">{t("Demo sandbox")}</Pill>
                </div>
                <div className="muted">
                  {t("This phase provisions a platform-managed sandbox and seeds the selected template, default model, channels, and skills. No raw SSH password is stored or used.")}
                </div>
              </div>
              <CopyableCommand
                label="Install command"
                value={selected.installCommand || `install via ${selected.runtimeKind}`}
                helper="This is a demo install/start hint, not a direct server takeover flow."
              />
              <CopyableCommand
                label="Start command"
                value={selected.startCommand || "Platform-managed start"}
                helper={selected.healthCheck || "Workspace health check"}
              />
              <div className="form-grid">
                <label className="section">
                  <span className="section-title">{t("Instance name")}</span>
                  <input value={name} onChange={(event) => setName(event.target.value)} />
                </label>
                <label className="section">
                  <span className="section-title">{t("Plan")}</span>
                  <select value={selectedPlanId} onChange={(event) => setSelectedPlanId(event.target.value)}>
                    {(selected.plans || []).map((plan) => (
                      <option key={plan.id} value={plan.id}>
                        {plan.name} · {plan.cpu} CPU · {plan.memoryMb} MB · {plan.diskGb} GB · {plan.region} · {formatHourlyMoney(plan.pricePerHourCents, language)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              {selectedPlan ? (
                <div className="grid-3">
                  <Metric label="CPU" value={selectedPlan.cpu} note="Resource limit" />
                  <Metric label="Memory" value={`${selectedPlan.memoryMb} MB`} note="Workspace memory" />
                  <Metric label="Region" value={selectedPlan.region} note={selected.official ? "Official node" : "Provider node"} />
                </div>
              ) : null}
              <div className="chip-row">
                {(selected.defaultChannels || []).map((channel) => (
                  <span className="chip" key={channel}>{channelLabels[channel] || channel}</span>
                ))}
                {(selected.capabilities?.skills || []).map((skill) => (
                  <span className="chip" key={skill}>{skill}</span>
                ))}
                {(selected.configHints || []).slice(0, 2).map((hint) => (
                  <span className="chip" key={hint}>{hint}</span>
                ))}
              </div>
              <button className="primary" type="button" onClick={createInstance} disabled={creating || !selectedPlan}>
                <Zap size={16} /> {creating ? t("Creating") : t("Create and launch")}
              </button>
            </div>
          ) : (
              <Empty title="Select a template">Pick an agent from the marketplace list to inspect launch details.</Empty>
          )}
        </Panel>
      </div>
    </div>
  );
}

function ProviderPage({ api }) {
  const [profile, setProfile] = useState(null);
  const [nodes, setNodes] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [machines, setMachines] = useState([]);
  const [providerListings, setProviderListings] = useState([]);
  const [ledger, setLedger] = useState({ summary: {}, entries: [] });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [installCommand, setInstallCommand] = useState("");
  const [installToken, setInstallToken] = useState("");
  const { language, t } = useI18n();
  const [tab, setTab] = useState("overview");
  const [draft, setDraft] = useState({
    displayName: "",
    contact: "",
    payoutNote: "",
    nodeName: "",
    region: "cn-shanghai",
    totalCpu: 4,
    totalMemoryMb: 8192,
    totalDiskGb: 120,
    pricePerHourCents: 18,
    publicHost: "",
    templateName: "",
    templateDescription: "",
    templateFramework: "custom",
    templateStatus: "active",
    templateModelProvider: "openai",
    templateModel: "gpt-4.1-mini",
    templatePlanName: "Starter",
    templateCpu: 1,
    templateMemoryMb: 1024,
    templateDiskGb: 10,
    templatePricePerHourCents: 18
  });
  const [machDraft, setMachDraft] = useState({ name: "", os: "linux", cpu: 4, memoryMb: 8192, diskGb: 100, gpu: "", installedAgents: "echo-agent" });
  const [listDraft, setListDraft] = useState({ machineId: "", title: "", description: "", agentType: "echo-agent", accessMode: "chat", isolationMode: "trusted", concurrencyLimit: 1, pricePerHourCents: 0, billingUnit: "session" });

  const load = useCallback(async () => {
    setError("");
    try {
      const payload = await api("/api/provider/profile");
      setProfile(payload.profile);
      setNodes(payload.nodes);
      setLedger(payload.ledger);
      if (payload.profile) {
        const templatePayload = await api("/api/provider/templates");
        setTemplates(templatePayload.templates || []);
        try {
          const machPayload = await api("/api/machines");
          setMachines(machPayload.machines || []);
        } catch {}
        try {
          const lstPayload = await api("/api/provider/listings");
          setProviderListings(lstPayload.listings || []);
        } catch {}
      } else {
        setTemplates([]);
      }
      if (payload.nodes.length === 0 && payload.profile) {
        setInstallCommand(`curl -fsSL ${window.location.origin}/install-node.sh | sh -s -- --token <token>`);
      }
      if (payload.profile) {
        setDraft((current) => ({
          ...current,
          displayName: payload.profile.displayName || current.displayName,
          contact: payload.profile.contact || current.contact,
          payoutNote: payload.profile.payoutNote || current.payoutNote
        }));
      }
    } catch (err) {
      setError(translateErrorMessage(err.message, language));
    }
  }, [api, language]);

  useEffect(() => {
    load();
  }, [load]);

  async function saveProfile(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const payload = await api("/api/provider/apply", {
        method: "POST",
        body: {
          displayName: draft.displayName,
          contact: draft.contact,
          payoutNote: draft.payoutNote
        }
      });
      setProfile(payload.profile);
      await load();
    } catch (err) {
      setError(translateErrorMessage(err.message, language));
    } finally {
      setBusy(false);
    }
  }

  async function registerNode(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const payload = await api("/api/provider/nodes", {
        method: "POST",
        body: {
          name: draft.nodeName,
          region: draft.region,
          totalCpu: Number(draft.totalCpu),
          totalMemoryMb: Number(draft.totalMemoryMb),
          totalDiskGb: Number(draft.totalDiskGb),
          pricePerHourCents: Number(draft.pricePerHourCents),
          publicHost: draft.publicHost || undefined
        }
      });
      setInstallCommand(payload.installCommand || "");
      setInstallToken(payload.nodeToken || payload.token || "");
      await load();
    } catch (err) {
      setError(translateErrorMessage(err.message, language));
    } finally {
      setBusy(false);
    }
  }

  async function rotateToken(nodeId) {
    setBusy(true);
    try {
      const payload = await api(`/api/provider/nodes/${nodeId}/rotate-token`, { method: "POST" });
      setInstallCommand(payload.installCommand || installCommand);
      setInstallToken(payload.nodeToken || payload.token || "");
      await load();
    } catch (err) {
      setError(translateErrorMessage(err.message, language));
    } finally {
      setBusy(false);
    }
  }

  async function registerMachine(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/api/machines", {
        method: "POST",
        body: {
          name: machDraft.name,
          os: machDraft.os,
          cpu: Number(machDraft.cpu),
          memoryMb: Number(machDraft.memoryMb),
          diskGb: Number(machDraft.diskGb),
          gpu: machDraft.gpu || undefined,
          installedAgents: machDraft.installedAgents
        }
      });
      setMachDraft({ name: "", os: "linux", cpu: 4, memoryMb: 8192, diskGb: 100, gpu: "", installedAgents: "echo-agent" });
      await load();
    } catch (err) {
      setError(translateErrorMessage(err.message, language));
    } finally {
      setBusy(false);
    }
  }

  async function createListing(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/api/listings", {
        method: "POST",
        body: {
          machineId: listDraft.machineId,
          title: listDraft.title,
          description: listDraft.description,
          agentType: listDraft.agentType,
          accessMode: listDraft.accessMode,
          isolationMode: listDraft.isolationMode,
          concurrencyLimit: Number(listDraft.concurrencyLimit),
          pricePerHourCents: Number(listDraft.pricePerHourCents),
          billingUnit: listDraft.billingUnit
        }
      });
      setListDraft({ machineId: "", title: "", description: "", agentType: "echo-agent", accessMode: "chat", isolationMode: "trusted", concurrencyLimit: 1, pricePerHourCents: 0, billingUnit: "session" });
      await load();
    } catch (err) {
      setError(translateErrorMessage(err.message, language));
    } finally {
      setBusy(false);
    }
  }

  const tabs = [
    { id: "overview", label: t("Provider") },
    { id: "machines", label: t("Machine Management") },
    { id: "listings", label: t("My Listings") }
  ];

  return (
    <div className="page-content">
      <PageHeader
        title={t("Provider Workflow")}
        subtitle="Apply for provider access, register machines, create listings, and manage nodes."
        actions={<button type="button" onClick={load}><RefreshCw size={16} /> {t("Refresh")}</button>}
      />

      <div className="tabbar">
        {tabs.map(tb => (
          <button key={tb.id} className={tab === tb.id ? "active" : ""} onClick={() => setTab(tb.id)}>{tb.label}</button>
        ))}
      </div>

      {error && <Pill tone="danger">{error}</Pill>}

      {tab === "overview" && (
        <>
          <Panel title="Provider summary" subtitle="Profile status, node count, and ledger snapshot" icon={<ServerCog size={16} />}>
            <div className="grid-3">
              <Metric label="Profile" value={translateStatus(profile?.status || "none", language)} note={profile ? profile.displayName : "Apply first"} icon={<BadgeInfo size={15} />} />
              <Metric label="Nodes" value={nodes.length} note={formatHealthyNodes(nodes.filter((node) => node.status === "healthy").length, language)} icon={<Server size={15} />} tone="success" />
              <Metric label="Agents" value={templates.length} note={formatActiveAgents(templates.filter((template) => template.status === "active").length, language)} icon={<Bot size={15} />} />
              <Metric label="Ledger" value={formatMoney(ledger?.summary?.providerCents || 0)} note={formatRuntimeHours(ledger?.summary?.runtimeHours || 0, language)} icon={<Coins size={15} />} tone="warning" />
            </div>
          </Panel>

          <Panel title={t("Apply")} subtitle="Register or update your provider profile" icon={<BadgeInfo size={16} />}>
            <form onSubmit={saveProfile} className="form-grid">
              <label className="section">
                <span className="section-title">Display name</span>
                <input value={draft.displayName} onChange={(e) => setDraft({ ...draft, displayName: e.target.value })} required />
              </label>
              <label className="section">
                <span className="section-title">Contact</span>
                <input value={draft.contact} onChange={(e) => setDraft({ ...draft, contact: e.target.value })} />
              </label>
              <label className="section">
                <span className="section-title">Payout note</span>
                <input value={draft.payoutNote} onChange={(e) => setDraft({ ...draft, payoutNote: e.target.value })} />
              </label>
              <button className="primary" type="submit" disabled={busy}><BadgeInfo size={14} /> {busy ? "..." : t("Apply")}</button>
            </form>
          </Panel>

          <Panel title="Nodes" subtitle="Registration, heartbeat, and approval visibility" icon={<Server size={16} />}>
            <div className="stack">
              {nodes.length === 0 ? <Empty>No registered nodes yet.</Empty> : null}
              {nodes.map((node) => (
                <div className="item" key={node.id}>
                  <div className="item-row">
                    <div>
                      <strong>{node.name}</strong>
                      <div className="muted">{node.region} &middot; {translateStatus(node.providerStatus || "unknown", language)} &middot; {translateStatus(node.dockerStatus || "unknown", language)}</div>
                    </div>
                    <StatusPill status={node.status} />
                  </div>
                  <div className="chip-row">
                    <span className="chip">{node.totalCpu} CPU</span>
                    <span className="chip">{node.totalMemoryMb} MB</span>
                    <span className="chip">{node.totalDiskGb} GB</span>
                    <span className="chip">{node.agentVersion || t("no agent")}</span>
                  </div>
                  <div className="item-row">
                    <span className="muted">{t("Heartbeat")} {formatTime(node.lastHeartbeatAt)}</span>
                    <button type="button" onClick={() => rotateToken(node.id)} disabled={busy}><RefreshCw size={14} /> {t("Rotate token")}</button>
                  </div>
                </div>
              ))}
            </div>
            <form onSubmit={registerNode} className="form-grid" style={{ marginTop: 16 }}>
              <label className="section"><span className="section-title">Node name</span><input value={draft.nodeName} onChange={(e) => setDraft({ ...draft, nodeName: e.target.value })} required /></label>
              <label className="section"><span className="section-title">Region</span><input value={draft.region} onChange={(e) => setDraft({ ...draft, region: e.target.value })} /></label>
              <div className="form-row">
                <label className="section"><span className="section-title">CPU</span><input type="number" value={draft.totalCpu} onChange={(e) => setDraft({ ...draft, totalCpu: e.target.value })} /></label>
                <label className="section"><span className="section-title">Memory (MB)</span><input type="number" value={draft.totalMemoryMb} onChange={(e) => setDraft({ ...draft, totalMemoryMb: e.target.value })} /></label>
                <label className="section"><span className="section-title">Disk (GB)</span><input type="number" value={draft.totalDiskGb} onChange={(e) => setDraft({ ...draft, totalDiskGb: e.target.value })} /></label>
              </div>
              <button className="primary" type="submit" disabled={busy}><Server size={14} /> {busy ? "..." : t("Register")}</button>
            </form>
            {installCommand && <CopyableCommand label="Install command" value={installCommand} helper="Run this on the target server." />}
          </Panel>

          <Panel title="Ledger" subtitle="Internal estimate only, no real payment" icon={<Coins size={16} />}>
            <div className="grid-3">
              <Metric label="Gross" value={formatMoney(ledger?.summary?.grossCents || 0)} icon={<Coins size={15} />} />
              <Metric label="Platform fee" value={formatMoney(ledger?.summary?.platformFeeCents || 0)} icon={<Gauge size={15} />} />
              <Metric label="Provider" value={formatMoney(ledger?.summary?.providerCents || 0)} icon={<ServerCog size={15} />} tone="success" />
            </div>
          </Panel>
        </>
      )}

      {tab === "machines" && (
        <>
          <Panel title={t("Register Machine")} subtitle="Add a new machine to your fleet" icon={<MonitorCog size={16} />}>
            <form onSubmit={registerMachine} className="form-grid">
              <label className="section"><span className="section-title">{t("Machine Name")}</span><input value={machDraft.name} onChange={(e) => setMachDraft({ ...machDraft, name: e.target.value })} required /></label>
              <div className="form-row">
                <label className="section"><span className="section-title">{t("OS")}</span><select value={machDraft.os} onChange={(e) => setMachDraft({ ...machDraft, os: e.target.value })}><option value="linux">Linux</option><option value="windows">Windows</option></select></label>
                <label className="section"><span className="section-title">{t("CPU Cores")}</span><input type="number" value={machDraft.cpu} onChange={(e) => setMachDraft({ ...machDraft, cpu: e.target.value })} /></label>
                <label className="section"><span className="section-title">{t("Memory (MB)")}</span><input type="number" value={machDraft.memoryMb} onChange={(e) => setMachDraft({ ...machDraft, memoryMb: e.target.value })} /></label>
              </div>
              <div className="form-row">
                <label className="section"><span className="section-title">{t("Disk (GB)")}</span><input type="number" value={machDraft.diskGb} onChange={(e) => setMachDraft({ ...machDraft, diskGb: e.target.value })} /></label>
                <label className="section"><span className="section-title">{t("GPU")}</span><input value={machDraft.gpu} onChange={(e) => setMachDraft({ ...machDraft, gpu: e.target.value })} placeholder="optional" /></label>
                <label className="section"><span className="section-title">{t("Installed Agents")}</span><input value={machDraft.installedAgents} onChange={(e) => setMachDraft({ ...machDraft, installedAgents: e.target.value })} /></label>
              </div>
              <button className="primary" type="submit" disabled={busy}><MonitorCog size={14} /> {busy ? "..." : t("Register")}</button>
            </form>
          </Panel>

          <Panel title={t("Machine Management")} subtitle="Your registered machines" icon={<Server size={16} />}>
            {machines.length === 0 ? <Empty icon={<Server size={20} />}>{t("No machines registered")}</Empty> : (
              <div className="stack">
                {machines.map(m => (
                  <div className="item" key={m.id}>
                    <div className="item-row">
                      <div><strong>{m.name}</strong><div className="muted">{m.os} &middot; {m.cpu} CPU &middot; {m.memoryMb} MB</div></div>
                      <StatusPill status={m.status || "active"} />
                    </div>
                    <div className="chip-row">
                      <span className="chip">{m.diskGb} GB disk</span>
                      {m.gpu && <span className="chip">{m.gpu}</span>}
                      <span className="chip">{m.installedAgents}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </>
      )}

      {tab === "listings" && (
        <>
          <Panel title={t("Create Listing")} subtitle="Publish a new agent listing for users to rent" icon={<Zap size={16} />}>
            <form onSubmit={createListing} className="form-grid">
              <div className="form-row">
                <label className="section"><span className="section-title">{t("Title")}</span><input value={listDraft.title} onChange={(e) => setListDraft({ ...listDraft, title: e.target.value })} required /></label>
                <label className="section"><span className="section-title">{t("Agent Type")}</span><input value={listDraft.agentType} onChange={(e) => setListDraft({ ...listDraft, agentType: e.target.value })} /></label>
              </div>
              <label className="section"><span className="section-title">{t("Description")}</span><textarea value={listDraft.description} onChange={(e) => setListDraft({ ...listDraft, description: e.target.value })} style={{ minHeight: 60 }} /></label>
              <div className="form-row">
                <label className="section"><span className="section-title">{t("Access Mode")}</span><select value={listDraft.accessMode} onChange={(e) => setListDraft({ ...listDraft, accessMode: e.target.value })}><option value="chat">Chat</option><option value="api">API</option></select></label>
                <label className="section"><span className="section-title">{t("Isolation Mode")}</span><select value={listDraft.isolationMode} onChange={(e) => setListDraft({ ...listDraft, isolationMode: e.target.value })}><option value="trusted">Trusted</option><option value="sandboxed">Sandboxed</option></select></label>
                <label className="section"><span className="section-title">{t("Concurrency Limit")}</span><input type="number" value={listDraft.concurrencyLimit} onChange={(e) => setListDraft({ ...listDraft, concurrencyLimit: e.target.value })} /></label>
              </div>
              <div className="form-row">
                <label className="section"><span className="section-title">{t("Price (cents/hour)")}</span><input type="number" value={listDraft.pricePerHourCents} onChange={(e) => setListDraft({ ...listDraft, pricePerHourCents: e.target.value })} /></label>
                <label className="section"><span className="section-title">{t("Billing Unit")}</span><select value={listDraft.billingUnit} onChange={(e) => setListDraft({ ...listDraft, billingUnit: e.target.value })}><option value="session">Session</option><option value="hour">Hour</option></select></label>
                {machines.length > 0 && (
                  <label className="section"><span className="section-title">Machine</span><select value={listDraft.machineId} onChange={(e) => setListDraft({ ...listDraft, machineId: e.target.value })}><option value="">Auto</option>{machines.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}</select></label>
                )}
              </div>
              <button className="primary" type="submit" disabled={busy}><Zap size={14} /> {busy ? "..." : t("Create")}</button>
            </form>
          </Panel>

          <Panel title={t("My Listings")} subtitle="Your published agent listings" icon={<Bot size={16} />}>
            {providerListings.length === 0 ? <Empty icon={<Bot size={20} />}>{t("No listings created")}</Empty> : (
              <div className="stack">
                {providerListings.map(l => (
                  <div className="item" key={l.id}>
                    <div className="item-row">
                      <div><strong>{l.title}</strong><div className="muted">{l.agent_type} &middot; {l.access_mode}</div></div>
                      <StatusPill status={l.status || "active"} />
                    </div>
                    <div className="chip-row">
                      <span className="chip">{l.isolation_mode || "trusted"}</span>
                      <span className="chip">{l.price_per_hour_cents ? formatMoney(l.price_per_hour_cents) + "/h" : t("Free")}</span>
                      {l.concurrency_limit && <span className="chip">{t("Concurrency")}: {l.concurrency_limit}</span>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Templates" subtitle="Published agent templates" icon={<Bot size={16} />}>
            <div className="stack">
              {templates.length === 0 ? <Empty>No templates yet.</Empty> : null}
              {templates.map((template) => (
                <div className="item" key={template.id}>
                  <div className="item-row">
                    <div><strong>{template.name}</strong><div className="muted">{template.framework} &middot; {template.runtimeKind || "provider-node"}</div></div>
                    <StatusPill status={template.status} />
                  </div>
                  <div className="chip-row">
                    <span className="chip">{template.plans?.[0]?.name || t("No plan")}</span>
                    <span className="chip">{formatHourlyMoney(template.plans?.[0]?.pricePerHourCents || 0, language)}</span>
                    <span className="chip">{t("Web Chat")}</span>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </>
      )}
    </div>
  );
}

function InstancesPage({ api }) {
  const [instances, setInstances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { language, t } = useI18n();

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const payload = await api("/api/instances");
      setInstances(payload.instances);
    } catch (err) {
      setError(translateErrorMessage(err.message, language));
    } finally {
      setLoading(false);
    }
  }, [api, language]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Instances"
        title="Your instances"
        subtitle="Track lifecycle state, rough cost, and open the control console."
        actions={
          <>
            <button type="button" onClick={() => setRoute("market")}>
              <Zap size={16} /> {t("New instance")}
            </button>
            <button type="button" onClick={load}>
              <RefreshCw size={16} /> {t("Refresh")}
            </button>
          </>
        }
      />

      <Panel title="Instance list" subtitle="Open an instance to manage models, channels, skills, and terminal access" icon={<Boxes size={16} />}>
        <div className="stack">
          {error ? <Pill tone="danger">{error}</Pill> : null}
          {loading ? (
            <Empty>Loading instances</Empty>
          ) : instances.length === 0 ? (
            <Empty
              title="No instances yet"
              action={
                <button type="button" onClick={() => setRoute("market")}>
                  <Zap size={16} /> {t("Open marketplace")}
                </button>
              }
            >
              Start from the marketplace to provision a workspace.
            </Empty>
          ) : (
            <div className="instance-list">
              {instances.map((instance) => (
                <button type="button" key={instance.id} className="item instance-card" onClick={() => setRoute(`instance/${instance.id}`)}>
                  <div className="item-row">
                    <div className="template-title">
                      <span className="template-glyph"><Boxes size={16} /></span>
                      <strong>{instance.name}</strong>
                    </div>
                    <StatusPill status={instance.status} />
                  </div>
                  <div className="chip-row">
                    <span className="chip">{instance.templateName}</span>
                    <span className="chip">{instance.planName}</span>
                    <span className="chip">{instance.region}</span>
                    <span className="chip">{formatMoney(instance.usage?.estimatedCents || 0)}</span>
                  </div>
                  <div className="item-row instance-card-foot">
                    <span className="muted">{instance.id}</span>
                    <ChevronRight size={16} />
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </Panel>
    </div>
  );
}

function InstanceConsole({ api, token, id }) {
  const [instance, setInstance] = useState(null);
  const [setup, setSetup] = useState(null);
  const [tab, setTab] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const { language, t } = useI18n();

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [instancePayload, setupPayload] = await Promise.all([
        api(`/api/instances/${id}`),
        api(`/api/instances/${id}/setup`)
      ]);
      setInstance(instancePayload.instance);
      setSetup(setupPayload.setup);
    } catch (err) {
      setError(translateErrorMessage(err.message, language));
    } finally {
      setLoading(false);
    }
  }, [api, id, language]);

  useEffect(() => {
    load();
  }, [load]);

  async function lifecycle(action) {
    if (!instance) return;
    setError("");
    try {
      const payload = await api(`/api/instances/${instance.id}/${action}`, { method: "POST" });
      setInstance(payload.instance);
    } catch (err) {
      setError(translateErrorMessage(err.message, language));
    }
  }

  if (loading) return <Empty>Loading instance</Empty>;
  if (error && !instance) return <Empty>{error}</Empty>;
  if (!instance) return <Empty>Instance not found</Empty>;
  const tabs = [
    { id: "overview", label: "Overview", icon: <LayoutDashboard size={16} /> },
    { id: "models", label: "Models", icon: <Cpu size={16} /> },
    { id: "channels", label: "Channels", icon: <Plug size={16} /> },
    { id: "skills", label: "Skills", icon: <Wrench size={16} /> },
    { id: "terminal", label: "Terminal", icon: <TerminalSquare size={16} /> },
    { id: "logs", label: "Logs", icon: <FileText size={16} /> },
    { id: "settings", label: "Settings", icon: <Settings size={16} /> }
  ];

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Instance console"
        title={instance.name}
        subtitle={`${instance.templateName} · ${instance.id}`}
        actions={
          <>
            <StatusPill status={instance.status} />
            <button type="button" onClick={load}>
              <RefreshCw size={16} /> {t("Refresh")}
            </button>
          </>
        }
      />
      <Panel
        title="Workspace tabs"
        subtitle="Configure the instance, inspect logs, or open the terminal"
        icon={<Bot size={16} />}
      >
        <div className="tabbar">
          {tabs.map((item) => (
            <button type="button" key={item.id} className={tab === item.id ? "active" : ""} onClick={() => setTab(item.id)}>
              {item.icon} {t(item.label)}
            </button>
          ))}
        </div>
        {error ? <div className="panel-error"><Pill tone="danger">{error}</Pill></div> : null}
      </Panel>

      {setup ? (
        <Panel title="Setup Checklist" subtitle="Complete the setup path in order" icon={<PanelTop size={16} />}>
          <FlowStepList
            steps={setup.steps.map((step, index) => ({
              key: step.key,
              label: step.label,
              state: step.done ? "done" : index === setup.steps.findIndex((item) => !item.done) ? "active" : "todo",
              note:
                step.key === "configure_model"
                  ? setup.model
                    ? `${setup.model.provider}/${setup.model.model} · ${t(formatSecretPreview(setup.model.credentialPreview))}`
                    : "Pick a provider and save the API key"
                  : step.key === "enable_channel"
                    ? setup.channels.find((channel) => channel.type === "web_chat")?.status === "active"
                      ? "Web Chat is active"
                      : "Enable Web Chat first"
                      : step.key === "enable_skills"
                        ? step.note === "no required skills"
                          ? step.note
                          : translateSetupNote(step.note, language)
                      : step.key === "test_chat"
                        ? formatMessagesCount(setup.recentChatCount, language)
                        : step.key === "terminal_logs"
                          ? formatLogEntriesCount(setup.recentLogCount, language)
                          : instance.templateName
            }))}
          />
        </Panel>
      ) : null}

      {tab === "overview" ? (
        <OverviewTab instance={instance} api={api} onUpdate={setInstance} onLifecycle={lifecycle} setup={setup} />
      ) : null}
      {tab === "models" ? <ModelsTab api={api} instance={instance} /> : null}
      {tab === "channels" ? <ChannelsTab api={api} instance={instance} /> : null}
      {tab === "skills" ? <SkillsTab api={api} instance={instance} /> : null}
      {tab === "terminal" ? <TerminalTab token={token} instance={instance} /> : null}
      {tab === "logs" ? <LogsTab api={api} instance={instance} /> : null}
      {tab === "settings" ? (
        <SettingsTab api={api} instance={instance} onUpdate={setInstance} onLifecycle={lifecycle} />
      ) : null}
    </div>
  );
}

function OverviewTab({ instance, api, onUpdate, onLifecycle, setup }) {
  const [healthBusy, setHealthBusy] = useState(false);
  const nextStepIndex = (setup?.steps || []).findIndex((item) => !item.done);
  const { language, t } = useI18n();

  async function healthCheck() {
    setHealthBusy(true);
    try {
      const payload = await api(`/api/instances/${instance.id}/health-check`, { method: "POST" });
      onUpdate(payload.instance);
    } finally {
      setHealthBusy(false);
    }
  }

  return (
    <div className="grid-2">
      <Panel
        title="Overview"
        subtitle="Status, plan, node, and current estimate"
        icon={<Gauge size={16} />}
        actions={
          <>
            <button type="button" onClick={() => onLifecycle("start")} disabled={instance.status === "running" || instance.status === "destroyed"}>
              <Play size={16} /> {t("Start")}
            </button>
            <button type="button" onClick={() => onLifecycle("stop")} disabled={instance.status !== "running"}>
              <Square size={16} /> {t("Stop")}
            </button>
            <button type="button" onClick={() => onLifecycle("restart")} disabled={instance.status === "destroyed"}>
              <ListRestart size={16} /> {t("Restart")}
            </button>
          </>
        }
      >
        <div className="grid-3">
          <Metric label="Status" value={<StatusPill status={instance.status} />} note={instance.errorReason || "runtime state"} icon={<Activity size={15} />} tone={instance.status === "running" ? "success" : "neutral"} />
          <Metric label="Plan" value={<>{instance.planName}</>} note={`${instance.cpu} CPU · ${instance.memoryMb} MB · ${instance.diskGb} GB`} icon={<Cpu size={15} />} />
          <Metric label="Estimate" value={formatMoney(instance.usage?.estimatedCents || 0)} note={formatHours(instance.usage?.runtimeHours || 0)} icon={<Coins size={15} />} tone="warning" />
          <Metric label="Node" value={<>{instance.nodeName}</>} note={`${instance.region} · ${translateStatus(instance.nodeStatus, language)}`} icon={<Server size={15} />} />
          <Metric
            label="Runtime"
            value={instance.nodeType === "provider" ? "Provider node" : "Local sandbox"}
            note={instance.nodeType === "provider" ? "chat/provision via node tasks" : instance.workspacePath.split("/").slice(-2).join("/")}
            icon={<TerminalSquare size={15} />}
          />
          <Metric label="Started" value={formatTime(instance.startedAt)} note={formatTime(instance.createdAt)} icon={<Gauge size={15} />} />
        </div>
      </Panel>
      <Panel
        title="Health"
        subtitle={instance.nodeType === "provider" ? "Checks provider node reachability and instance state" : "The local sandbox checks workspace and instance state"}
        icon={<Activity size={16} />}
        actions={
            <button type="button" onClick={healthCheck} disabled={healthBusy}>
              <Check size={16} /> {t("Health check")}
            </button>
        }
      >
        <div className="stack">
          <div className="item health-card">
            <div className="item-row">
              <strong>{instance.nodeType === "provider" ? t("Provider node") : t("Local sandbox")}</strong>
              <Pill tone={instance.nodeStatus === "offline" ? "danger" : "success"}>{translateStatus(instance.nodeStatus || instance.status, language)}</Pill>
            </div>
            <div className="muted">
              {t(instance.nodeType === "provider"
                ? "This Agent runs on the provider's registered node. Provisioning, lifecycle actions, and Web Chat are dispatched through node tasks; user-visible replies come from the provider runtime command."
                : "This environment does not have Docker. The Phase 1 MVP uses isolated workspaces to simulate a Linux agent sandbox and keeps the Docker runtime adapter boundary intact.")}
            </div>
          </div>
          <div className="item health-card">
            <div className="item-row">
              <strong>{t("Billing mode")}</strong>
              <Pill tone="success">{t("Estimate")}</Pill>
            </div>
            <div className="muted">{t("Internal billing is estimated from runtime and chat tokens. No payment provider is connected.")}</div>
          </div>
        </div>
      </Panel>
      <Panel title="Next actions" subtitle="Finish the setup flow in order" icon={<BadgeInfo size={16} />}>
        <div className="stack">
          {(setup?.steps || []).map((step, index) => (
            <div className="item" key={step.key}>
              <div className="item-row">
                <strong>{index + 1}. {t(step.label)}</strong>
                <StatusPill status={step.done ? "running" : index === nextStepIndex ? "pending" : "draft"} />
              </div>
              <div className="muted">
                {step.key === "choose_agent"
                  ? instance.templateName
                  : step.key === "create_instance"
                    ? `${instance.nodeName} · ${instance.planName}`
                    : step.key === "configure_model"
                      ? setup?.model
                        ? `${setup.model.provider}/${setup.model.model}`
                        : t("Set the provider and API key in Models")
                      : step.key === "enable_channel"
                        ? t("Turn on Web Chat in Channels")
                      : step.key === "enable_skills"
                        ? t("Install and enable the skills this template expects")
                      : step.key === "test_chat"
                            ? t("Send one chat message to verify model and channel")
                            : t("Open Terminal and Logs to confirm runtime health")}
              </div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function ModelsTab({ api, instance }) {
  const [modelConfig, setModelConfig] = useState(null);
  const [provider, setProvider] = useState("openai");
  const [model, setModel] = useState("gpt-4.1-mini");
  const [apiKey, setApiKey] = useState("");
  const [clearApiKey, setClearApiKey] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const { language, t } = useI18n();

  const load = useCallback(async () => {
    const payload = await api(`/api/instances/${instance.id}/model`);
    setModelConfig(payload.modelConfig);
    if (payload.modelConfig) {
      setProvider(payload.modelConfig.provider);
      setModel(payload.modelConfig.model);
    }
  }, [api, instance.id]);

  useEffect(() => {
    load().catch((err) => setError(translateErrorMessage(err.message, language)));
  }, [load]);

  async function save(event) {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = await api(`/api/instances/${instance.id}/model`, {
        method: "PUT",
        body: { provider, model, apiKey, clearApiKey }
      });
      setModelConfig(payload.modelConfig);
      setApiKey("");
      setClearApiKey(false);
    } catch (err) {
      setError(translateErrorMessage(err.message, language));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Panel title="Models" subtitle="Configure the default model and a user-provided API key" icon={<Cpu size={16} />}>
      <form className="stack" onSubmit={save}>
        {error ? <Pill tone="danger">{error}</Pill> : null}
        <div className="form-2">
          <label className="section">
            <span className="section-title">{t("Provider")}</span>
            <select value={provider} onChange={(event) => setProvider(event.target.value)}>
              {modelProviders.map((item) => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </label>
          <label className="section">
            <span className="section-title">{t("Model")}</span>
            <input value={model} onChange={(event) => setModel(event.target.value)} />
          </label>
        </div>
        <label className="section">
          <span className="section-title">{t("User API key")}</span>
          <input
            value={apiKey}
            onChange={(event) => setApiKey(event.target.value)}
            type="password"
            placeholder={t(formatSecretPreview(modelConfig?.credentialPreview))}
          />
        </label>
        <label className="inline-check">
          <input
            type="checkbox"
            checked={clearApiKey}
            onChange={(event) => setClearApiKey(event.target.checked)}
          />
          <span>{t("Clear saved API key")}</span>
        </label>
        <div className="toolbar">
          <button className="primary" type="submit" disabled={saving}>
            <Check size={16} /> {t("Save default model")}
          </button>
          <Pill tone={hasSavedSecret(modelConfig?.credentialPreview) ? "success" : "neutral"}>
            {t("Secret")}: {t(formatSecretPreview(modelConfig?.credentialPreview))}
          </Pill>
        </div>
      </form>
    </Panel>
  );
}

function ChannelsTab({ api, instance }) {
  const [channels, setChannels] = useState([]);
  const [error, setError] = useState("");
  const [chatMessages, setChatMessages] = useState([]);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [queuedTaskId, setQueuedTaskId] = useState("");
  const [chatStatus, setChatStatus] = useState("");
  const { language, t } = useI18n();

  const load = useCallback(async () => {
    const [channelsPayload, chatPayload] = await Promise.all([
      api(`/api/instances/${instance.id}/channels`),
      api(`/api/instances/${instance.id}/chat`)
    ]);
    setChannels(channelsPayload.channels);
    setChatMessages(chatPayload.messages);
  }, [api, instance.id]);

  useEffect(() => {
    load().catch((err) => setError(translateErrorMessage(err.message, language)));
  }, [load]);

  async function updateChannel(type, status) {
    setError("");
    try {
      const payload = await api(`/api/instances/${instance.id}/channels/${type}`, {
        method: "PUT",
        body: { status, config: { adapterReady: type === "web_chat" } }
      });
      setChannels(payload.channels);
    } catch (err) {
      setError(translateErrorMessage(err.message, language));
    }
  }

  async function sendMessage(event) {
    event.preventDefault();
    if (!message.trim()) return;
    setSending(true);
    setError("");
    const outgoing = {
      id: `local-${Date.now()}`,
      role: "user",
      content: message,
      createdAt: new Date().toISOString()
    };
    setChatMessages((items) => [...items, outgoing]);
    try {
      const payload = await api(`/api/instances/${instance.id}/chat`, {
        method: "POST",
        body: { message }
      });
      if (payload.message) {
        setChatMessages((items) => [...items, payload.message]);
      }
      setMessage("");

      if (payload.status === "queued") {
        setQueuedTaskId(payload.taskId || "");
        setChatStatus("Waiting for provider runtime reply...");
        for (let attempt = 0; attempt < 15; attempt += 1) {
          await new Promise((resolve) => window.setTimeout(resolve, 1000));
          const chatPayload = await api(`/api/instances/${instance.id}/chat`);
          setChatMessages(chatPayload.messages);
          const hasAssistantReply = chatPayload.messages.some(
            (item) => item.role === "assistant" && new Date(item.createdAt).getTime() >= new Date(outgoing.createdAt).getTime()
          );
          if (hasAssistantReply) {
            setChatStatus("Provider runtime replied.");
            setQueuedTaskId("");
            break;
          }
        }
        setChatStatus((current) => current === "Provider runtime replied." ? current : "Still waiting for the provider node; refresh chat to check for the reply.");
      } else {
        setQueuedTaskId("");
        setChatStatus("");
      }
    } catch (err) {
      setError(translateErrorMessage(err.message, language));
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="grid-2">
      <Panel title="Channels" subtitle="Web Chat is implemented; external channels remain adapter placeholders" icon={<Plug size={16} />}>
        <div className="stack">
          {error ? <Pill tone="danger">{error}</Pill> : null}
          {channels.map((channel) => (
            <div className="item" key={channel.type}>
              <div className="item-row">
                <strong>{translate(language, channelLabels[channel.type] || channel.type)}</strong>
                <StatusPill status={channel.status} />
              </div>
              <div className="muted">
                {t(channel.type === "web_chat"
                  ? "Console chat is available for this workspace."
                  : "Phase 1 keeps the adapter shape here; real external channel access comes later.")}
              </div>
              <div className="toolbar">
                <button type="button" onClick={() => updateChannel(channel.type, "active")} disabled={channel.type !== "web_chat" && channel.status === "waitlist"}>
                  <Check size={16} /> {t("Enable")}
                </button>
                <button type="button" onClick={() => updateChannel(channel.type, "disabled")}>
                  <Square size={16} /> {t("Disable")}
                </button>
                {channel.type !== "web_chat" ? <Pill tone="warning">{t("Preview placeholder")}</Pill> : null}
              </div>
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="Web Chat" subtitle={instance.nodeType === "provider" ? "Dispatches messages to the provider node runtime" : "Talk to the current agent workspace"} icon={<MessageSquare size={16} />}>
        <div className="chat-window">
          {chatStatus ? (
            <div className="provider-note">
              {t(chatStatus)}{queuedTaskId ? ` ${t("Task")}: ${queuedTaskId}` : ""}
            </div>
          ) : null}
          <div className="chat-log">
            {chatMessages.length === 0 ? <Empty>No messages yet</Empty> : null}
            {chatMessages.map((item, index) => (
              <div className={`chat-bubble ${item.role}`} key={item.id || index}>
                <div className="log-meta">
                  <strong>{t(item.role)}</strong>
                  <span>{formatTime(item.createdAt)}</span>
                </div>
                <pre className="code-block">{item.content}</pre>
              </div>
            ))}
          </div>
          <form className="chat-form" onSubmit={sendMessage}>
            <textarea value={message} onChange={(event) => setMessage(event.target.value)} placeholder={t("Type a message")} />
            <button className="primary" type="submit" disabled={sending || instance.status !== "running"}>
              <MessageSquare size={16} /> {t("Send")}
            </button>
          </form>
        </div>
      </Panel>
    </div>
  );
}

function SkillsTab({ api, instance }) {
  const [skills, setSkills] = useState([]);
  const [error, setError] = useState("");
  const { language, t } = useI18n();

  const load = useCallback(async () => {
    const payload = await api(`/api/instances/${instance.id}/skills`);
    setSkills(payload.skills);
  }, [api, instance.id]);

  useEffect(() => {
    load().catch((err) => setError(translateErrorMessage(err.message, language)));
  }, [load]);

  async function install(skill) {
    try {
      await api(`/api/instances/${instance.id}/skills/${skill.id}/install`, { method: "POST" });
      await load();
    } catch (err) {
      setError(translateErrorMessage(err.message, language));
    }
  }

  async function setStatus(skill, status) {
    try {
      await api(`/api/instances/${instance.id}/skills/${skill.id}`, { method: "PATCH", body: { status } });
      await load();
    } catch (err) {
      setError(translateErrorMessage(err.message, language));
    }
  }

  async function uninstall(skill) {
    try {
      await api(`/api/instances/${instance.id}/skills/${skill.id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(translateErrorMessage(err.message, language));
    }
  }

  return (
    <Panel title="Skills" subtitle="Install, enable, disable, and review built-in skill permissions" icon={<Wrench size={16} />}>
      <div className="stack">
        {error ? <Pill tone="danger">{error}</Pill> : null}
        {skills.map((skill) => (
          <div className="item" key={skill.id}>
            <div className="item-row">
              <div>
                <strong>{skill.name}</strong>
                <span className="muted"> · v{skill.version}</span>
              </div>
              <StatusPill status={skill.status} />
            </div>
            <div className="muted">{skill.description}</div>
            <div className="chip-row">
              {skill.permissions.map((permission) => (
                <span className="chip" key={permission}>{permission}</span>
              ))}
            </div>
            <div className="toolbar">
              {!skill.installed ? (
                <button type="button" onClick={() => install(skill)}>
                  <Zap size={16} /> {t("Install")}
                </button>
              ) : (
                <>
                  <button type="button" onClick={() => setStatus(skill, skill.status === "enabled" ? "disabled" : "enabled")}>
                    {skill.status === "enabled" ? <Square size={16} /> : <Check size={16} />}
                    {skill.status === "enabled" ? t("Disable") : t("Enable")}
                  </button>
                  <button type="button" onClick={() => uninstall(skill)}>
                    <Trash2 size={16} /> {t("Uninstall")}
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function TerminalTab({ token, instance }) {
  const hostRef = useRef(null);
  const [status, setStatus] = useState("disconnected");
  const [reloadKey, setReloadKey] = useState(0);
  const { language } = useI18n();

  const connect = useCallback(() => {
    if (!hostRef.current || !token || !instance?.id) return;
    let cancelled = false;
    let cleanup = () => {};
    setStatus("loading terminal");
    import("./terminal-session.js")
      .then(({ mountTerminal }) => {
        if (cancelled) return;
        cleanup = mountTerminal({
          host: hostRef.current,
          token,
          instanceId: instance.id,
          onStatus: setStatus
        });
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });

    return () => {
      cancelled = true;
      cleanup();
    };
  }, [instance?.id, token, reloadKey]);

  useEffect(() => {
    const cleanup = connect();
    return cleanup;
  }, [connect]);

  return (
    <Panel title="Terminal" subtitle="Browser terminal connected to the current workspace directory" icon={<TerminalSquare size={16} />}>
      <div className="terminal-shell">
        <div className="terminal-toolbar">
          <div className="toolbar">
            <strong>{instance.name}</strong>
            <span className="terminal-status">{instance.workspacePath}</span>
          </div>
          <div className="toolbar">
            <Pill tone={status === "connected" ? "success" : status === "error" ? "danger" : "warning"}>{translateStatus(status, language)}</Pill>
            <IconButton title="Reconnect" onClick={() => setReloadKey((value) => value + 1)}>
              <RefreshCw size={16} />
            </IconButton>
          </div>
        </div>
        <div className="terminal-host" ref={hostRef} />
      </div>
    </Panel>
  );
}

function LogsTab({ api, instance }) {
  const [payload, setPayload] = useState({ logs: [], audits: [] });
  const [error, setError] = useState("");
  const { language, t } = useI18n();

  const load = useCallback(async () => {
    const next = await api(`/api/instances/${instance.id}/logs`);
    setPayload(next);
  }, [api, instance.id]);

  useEffect(() => {
    load().catch((err) => setError(translateErrorMessage(err.message, language)));
  }, [load]);

  return (
    <div className="grid-2">
      <Panel
        title="Agent Logs"
        subtitle="Agent, runtime, deployment, and health-check logs"
        icon={<FileText size={16} />}
        actions={<button type="button" onClick={load}><RefreshCw size={16} /> {t("Refresh")}</button>}
      >
        <div className="log-list">
          {error ? <Pill tone="danger">{error}</Pill> : null}
          {payload.logs.length === 0 ? <Empty>No logs yet</Empty> : null}
          {payload.logs.map((log) => (
            <div className="log-item" key={log.id}>
              <div className="log-meta">
                <StatusPill status={log.level} />
                <span>{log.source}</span>
                <span>{formatTime(log.createdAt)}</span>
              </div>
              <div>{log.message}</div>
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="Audit Logs" subtitle="Important user actions and terminal session summaries" icon={<Shield size={16} />}>
        <div className="log-list">
          {payload.audits.length === 0 ? <Empty>No audit entries yet</Empty> : null}
          {payload.audits.map((audit) => (
            <div className="log-item" key={audit.id}>
              <div className="log-meta">
                <strong>{audit.action}</strong>
                <span>{audit.actorEmail || t("system")}</span>
                <span>{formatTime(audit.createdAt)}</span>
              </div>
              <pre className="code-block">{JSON.stringify(audit.metadata, null, 2)}</pre>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function SettingsTab({ api, instance, onUpdate, onLifecycle }) {
  const [name, setName] = useState(instance.name);
  const [usage, setUsage] = useState(null);
  const [error, setError] = useState("");
  const { language, t } = useI18n();

  const loadUsage = useCallback(async () => {
    const payload = await api(`/api/instances/${instance.id}/usage`);
    setUsage(payload);
  }, [api, instance.id]);

  useEffect(() => {
    loadUsage().catch((err) => setError(translateErrorMessage(err.message, language)));
  }, [loadUsage]);

  async function saveName(event) {
    event.preventDefault();
    setError("");
    try {
      const payload = await api(`/api/instances/${instance.id}`, {
        method: "PATCH",
        body: { name }
      });
      onUpdate(payload.instance);
    } catch (err) {
      setError(translateErrorMessage(err.message, language));
    }
  }

  return (
    <div className="grid-2">
      <Panel title="Settings" subtitle="Rename, restart, stop, or destroy the instance" icon={<Settings size={16} />}>
        <form className="stack" onSubmit={saveName}>
          {error ? <Pill tone="danger">{error}</Pill> : null}
          <label className="section">
            <span className="section-title">{t("Instance name")}</span>
            <input value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <div className="toolbar">
            <button className="primary" type="submit">
              <Check size={16} /> {t("Save")}
            </button>
            <button type="button" onClick={() => onLifecycle("restart")} disabled={instance.status === "destroyed"}>
              <ListRestart size={16} /> {t("Restart")}
            </button>
            <button type="button" onClick={() => onLifecycle("stop")} disabled={instance.status !== "running"}>
              <Square size={16} /> {t("Stop")}
            </button>
            <button type="button" className="danger" onClick={() => onLifecycle("destroy")} disabled={instance.status === "destroyed"}>
              <Trash2 size={16} /> {t("Destroy")}
            </button>
          </div>
        </form>
      </Panel>
      <Panel
        title="Usage"
        subtitle="Runtime, tokens, and estimated cost"
        icon={<Database size={16} />}
        actions={<button type="button" onClick={loadUsage}><RefreshCw size={16} /> {t("Refresh")}</button>}
      >
        <div className="stack">
          <div className="grid-3">
            <Metric label="Estimated" value={formatMoney(usage?.summary?.estimatedCents || instance.usage?.estimatedCents || 0)} />
            <Metric label="Runtime" value={formatHours(usage?.summary?.runtimeHours || instance.usage?.runtimeHours || 0)} />
            <Metric label="Tokens" value={Math.round(usage?.summary?.tokenCount || 0)} />
          </div>
          <div className="scroll-x">
            <table className="table">
              <thead>
                <tr>
                  <th>{t("Type")}</th>
                  <th>{t("Quantity")}</th>
                  <th>{t("Estimate")}</th>
                  <th>{t("Time")}</th>
                </tr>
              </thead>
              <tbody>
                {(usage?.records || []).map((record) => (
                  <tr key={record.id}>
                    <td>{translateStatus(record.type, language)}</td>
                    <td>{Number(record.quantity).toFixed(record.type === "token" ? 0 : 4)} {translateStatus(record.unit, language)}</td>
                    <td>{formatMoney(record.priceEstimateCents)}</td>
                    <td>{formatTime(record.createdAt)}</td>
                  </tr>
                ))}
                {(usage?.records || []).length === 0 ? (
                  <tr><td colSpan="4" className="muted">{t("No usage records yet. Running instances show live estimates.")}</td></tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </div>
      </Panel>
    </div>
  );
}

function AdminPage({ api }) {
  const [overview, setOverview] = useState(null);
  const [instances, setInstances] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [providers, setProviders] = useState([]);
  const [error, setError] = useState("");
  const { language, t } = useI18n();
  const [draft, setDraft] = useState({
    name: "",
    framework: "custom",
    description: "",
    status: "draft",
    basePriceCents: 20
  });

  const load = useCallback(async () => {
    setError("");
    try {
      const [overviewPayload, instancesPayload, templatesPayload] = await Promise.all([
        api("/api/admin/overview"),
        api("/api/admin/instances"),
        api("/api/templates?includeAll=1")
      ]);
      const providersPayload = await api("/api/admin/providers");
      setOverview(overviewPayload);
      setInstances(instancesPayload.instances);
      setTemplates(templatesPayload.templates);
      setProviders(providersPayload.providers);
    } catch (err) {
      setError(translateErrorMessage(err.message, language));
    }
  }, [api, language]);

  useEffect(() => {
    load();
  }, [load]);

  async function createTemplate(event) {
    event.preventDefault();
    setError("");
    try {
      await api("/api/admin/templates", { method: "POST", body: draft });
      setDraft({ name: "", framework: "custom", description: "", status: "draft", basePriceCents: 20 });
      await load();
    } catch (err) {
      setError(translateErrorMessage(err.message, language));
    }
  }

  async function updateTemplate(template, status) {
    try {
      await api(`/api/admin/templates/${template.id}`, {
        method: "PATCH",
        body: { status }
      });
      await load();
    } catch (err) {
      setError(translateErrorMessage(err.message, language));
    }
  }

  async function updateProvider(provider, status) {
    try {
      await api(`/api/admin/providers/${provider.id}`, {
        method: "PATCH",
        body: { status }
      });
      await load();
    } catch (err) {
      setError(translateErrorMessage(err.message, language));
    }
  }

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Admin"
        title="Admin console"
        subtitle="Review nodes, templates, providers, instances, usage, and recent errors."
        actions={<button type="button" onClick={load}><RefreshCw size={16} /> {t("Refresh")}</button>}
      />

      <Panel title="Platform summary" subtitle="Counts for users, instances, and templates" icon={<Shield size={16} />}>
        {error ? <Pill tone="danger">{error}</Pill> : null}
        <div className="grid-3">
          <Metric label="Users" value={overview?.counts?.users ?? "—"} icon={<Shield size={15} />} />
          <Metric label="Instances" value={overview?.counts?.instances ?? "—"} note={`${overview?.counts?.runningInstances ?? 0} ${t("running")}`} icon={<Boxes size={15} />} tone="success" />
          <Metric label="Templates" value={overview?.counts?.templates ?? "—"} icon={<Bot size={15} />} />
        </div>
      </Panel>

      <div className="grid-2">
        <Panel title="Nodes" subtitle="Official and provider node resources, heartbeat, and review status" icon={<Server size={16} />}>
          <div className="scroll-x">
            <table className="table">
              <thead>
                <tr>
                  <th>{t("Node")}</th>
                  <th>{t("Type")}</th>
                  <th>{t("Region")}</th>
                  <th>{t("Status")}</th>
                  <th>{t("Provider")}</th>
                  <th>{t("Resources")}</th>
                  <th>{t("Heartbeat")}</th>
                </tr>
              </thead>
              <tbody>
                {(overview?.nodes || []).map((node) => (
                  <tr key={node.id}>
                    <td>{node.name}</td>
                    <td>{translateStatus(node.type, language)}</td>
                    <td>{node.region}</td>
                    <td><StatusPill status={node.status} /></td>
                    <td>{node.provider_display_name ? `${node.provider_display_name} / ${translateStatus(node.provider_status, language)}` : t("official")}</td>
                    <td>{node.available_cpu}/{node.total_cpu} CPU · {node.available_memory_mb}/{node.total_memory_mb} MB</td>
                    <td>{formatTime(node.last_heartbeat_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel title="Recent errors" subtitle="Latest instance errors" icon={<FileText size={16} />}>
          <div className="log-list">
            {(overview?.recentErrors || []).length === 0 ? <Empty>No recent errors</Empty> : null}
            {(overview?.recentErrors || []).map((log) => (
              <div className="log-item" key={log.id}>
                <div className="log-meta">
                  <strong>{log.instanceName || log.instanceId}</strong>
                  <span>{log.source}</span>
                  <span>{formatTime(log.createdAt)}</span>
                </div>
                <div>{log.message}</div>
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <Panel title="Provider review" subtitle="Approve or reject provider profiles and node handoff" icon={<ServerCog size={16} />}>
        <div className="stack">
          {providers.length === 0 ? <Empty>No provider applications yet</Empty> : null}
          {providers.map((provider) => (
            <div className="item" key={provider.id}>
              <div className="item-row">
                <div>
                  <strong>{provider.displayName}</strong>
                  <div className="muted">{provider.userEmail} · {provider.contact}</div>
                </div>
                <StatusPill status={provider.status} />
              </div>
              <div className="chip-row">
                <span className="chip">{isChinese(language) ? `${provider.nodeCount} 个节点` : `${provider.nodeCount} nodes`}</span>
                <span className="chip">{formatHealthyNodes(provider.healthyNodeCount, language)}</span>
                <span className="chip">{formatMoney(provider.providerCents || 0)}</span>
              </div>
              <div className="muted">{provider.payoutNote || t("No payout note provided")}</div>
              <div className="toolbar">
                <button type="button" onClick={() => updateProvider(provider, "approved")}>
                  <Check size={16} /> {t("Approve")}
                </button>
                <button type="button" onClick={() => updateProvider(provider, "rejected")}>
                  <Square size={16} /> {t("Reject")}
                </button>
                <button type="button" onClick={() => updateProvider(provider, "suspended")}>
                  <Trash2 size={16} /> {t("Suspend")}
                </button>
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <div className="grid-2">
        <Panel title="Template management" subtitle="Create, publish, and archive official templates" icon={<Bot size={16} />}>
          <form className="stack" onSubmit={createTemplate}>
            <div className="form-2">
              <input placeholder={t("Template name")} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })} />
              <select value={draft.framework} onChange={(event) => setDraft({ ...draft, framework: event.target.value })}>
                <option value="hermes">Hermes</option>
                <option value="openclaw">OpenClaw</option>
                <option value="custom">{t("Custom")}</option>
              </select>
            </div>
            <textarea placeholder={t("Template description")} value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} />
            <div className="form-2">
              <select value={draft.status} onChange={(event) => setDraft({ ...draft, status: event.target.value })}>
                <option value="draft">{t("draft")}</option>
                <option value="active">{t("active")}</option>
                <option value="archived">{t("archived")}</option>
              </select>
              <label className="section">
                <span className="section-title">{t("Base price / hour (cents)")}</span>
                <input
                  type="number"
                  value={draft.basePriceCents}
                  onChange={(event) => setDraft({ ...draft, basePriceCents: Number(event.target.value) })}
                />
              </label>
            </div>
            <button className="primary" type="submit">
              <Zap size={16} /> {t("Create template")}
            </button>
          </form>
          <div className="template-list admin-template-list">
            {templates.map((template) => (
              <div className="item" key={template.id}>
                <div className="item-row">
                  <strong>{template.name}</strong>
                  <StatusPill status={template.status} />
                </div>
                <div className="muted">{template.framework} · {t("From")} {formatHourlyMoney(template.basePriceCents, language)}</div>
                <div className="toolbar">
                  <button type="button" onClick={() => updateTemplate(template, "active")}>{t("Publish")}</button>
                  <button type="button" onClick={() => updateTemplate(template, "draft")}>{t("Draft")}</button>
                  <button type="button" onClick={() => updateTemplate(template, "archived")}>{t("Archive")}</button>
                </div>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Instance management" subtitle="Review all platform instances" icon={<Boxes size={16} />}>
          <div className="scroll-x">
            <table className="table">
              <thead>
                <tr>
                  <th>{t("Instance")}</th>
                  <th>{t("User")}</th>
                  <th>{t("Status")}</th>
                  <th>{t("Node")}</th>
                  <th>{t("Estimate")}</th>
                </tr>
              </thead>
              <tbody>
                {instances.map((instance) => (
                  <tr key={instance.id}>
                    <td>
                      <button type="button" className="ghost" onClick={() => setRoute(`instance/${instance.id}`)}>
                        {instance.name}
                      </button>
                    </td>
                    <td>{instance.userId}</td>
                    <td><StatusPill status={instance.status} /></td>
                    <td>{instance.nodeName}</td>
                    <td>{formatMoney(instance.usage?.estimatedCents || 0)}</td>
                  </tr>
                ))}
                {instances.length === 0 ? <tr><td colSpan="5" className="muted">{t("No instances yet")}</td></tr> : null}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function AgentMarketPage({ api }) {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [renting, setRenting] = useState(null);
  const [apiKey, setApiKey] = useState("");
  const { t } = useI18n();

  useEffect(() => {
    api("/api/listings").then(d => setListings(d.listings || [])).finally(() => setLoading(false));
  }, [api]);

  async function rent(listing) {
    setRenting(listing.id);
    try {
      const { grant } = await api("/api/grants", { method: "POST", body: { listingId: listing.id, apiKey: apiKey || undefined } });
      const { session } = await api("/api/sessions", { method: "POST", body: { grantId: grant.id } });
      setRoute(`session/${session.id}`);
    } catch (err) {
      alert(err.message);
    } finally {
      setRenting(null);
    }
  }

  if (loading) return <Empty>{t("Loading")}</Empty>;

  return (
    <div className="page-content">
      <PageHeader
        title={t("Agent Machine Marketplace")}
        subtitle={t("Rent access to controlled agent machines")}
      />
      <Panel title={t("BYOK")} subtitle={t("API Key (BYOK, optional)")} icon={<KeyRound size={16} />}>
        <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)} placeholder="sk-..." style={{ maxWidth: 360 }} />
        <div className="muted" style={{ marginTop: 6, fontSize: "0.78rem" }}>{t("Not raw VPS. Providers offer controlled access to agents they own.")}</div>
      </Panel>
      {listings.length === 0 ? (
        <Empty title={t("No active listings available")} icon={<Zap size={20} />}>{t("No active listings available")}</Empty>
      ) : (
        <div className="listing-grid">
          {listings.map(l => (
            <div className="listing-card" key={l.id}>
              <div className="listing-card-header">
                <div className="listing-card-icon"><Bot size={20} /></div>
                <div>
                  <div className="listing-card-title">{l.title}</div>
                  <div className="muted" style={{ fontSize: "0.78rem" }}>{l.provider_name}</div>
                </div>
              </div>
              {l.description && <div className="muted" style={{ fontSize: "0.8rem" }}>{l.description}</div>}
              <div className="chip-row">
                <span className="chip">{l.agent_type}</span>
                <span className="chip">{l.access_mode}</span>
                <span className="chip">{l.isolation_mode || "trusted"}</span>
                {l.concurrency_limit && <span className="chip">{t("Concurrency")}: {l.concurrency_limit}</span>}
              </div>
              <div className="listing-card-footer">
                <strong>{l.price_per_hour_cents ? formatMoney(l.price_per_hour_cents) + "/" + t("per hour") : t("Free")}</strong>
                <button className="primary" disabled={renting === l.id} onClick={() => rent(l)}>
                  <Play size={14} /> {renting === l.id ? "..." : t("Start Session")}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AgentSessionPage({ api, token, id }) {
  const [session, setSession] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [logs, setLogs] = useState([]);
  const { t } = useI18n();
  const chatEndRef = useRef(null);

  const load = useCallback(async () => {
    const { session: s } = await api(`/api/sessions/${id}`);
    setSession(s);
    const { messages: m } = await api(`/api/sessions/${id}/messages`);
    setMessages(m || []);
    try {
      const { logs: l } = await api(`/api/sessions/${id}/logs`);
      setLogs(l || []);
    } catch {}
  }, [api, id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  async function send(e) {
    e.preventDefault();
    if (!input.trim()) return;
    setSending(true);
    try {
      const { message } = await api(`/api/sessions/${id}/chat`, { method: "POST", body: { message: input } });
      setMessages(prev => [...prev, { role: "user", content: input, created_at: new Date().toISOString() }, message]);
      setInput("");
    } catch (err) {
      alert(err.message);
    } finally {
      setSending(false);
    }
  }

  async function stop() {
    await api(`/api/sessions/${id}/stop`, { method: "POST" });
    load();
  }

  if (!session) return <Empty>{t("Loading")}</Empty>;

  return (
    <div className="page-content">
      <div className="session-header">
        <div>
          <h2 style={{ margin: 0, fontSize: "1.1rem" }}>{t("Session")}</h2>
          <div className="muted" style={{ fontSize: "0.78rem" }}>{session.agent_type} &middot; {session.id.slice(0, 12)}</div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Pill tone={statusTone(session.status)}>{session.status}</Pill>
          {session.status === "active" && (
            <button className="danger" onClick={stop}><Square size={14} /> {t("Stop Session")}</button>
          )}
        </div>
      </div>

      <div className="chat-container">
        <div className="chat-messages">
          {messages.length === 0 && (
            <div className="chat-empty">
              <MessageSquare size={24} style={{ opacity: 0.3 }} />
              <div className="muted">{t("No messages yet. Send a message to start.")}</div>
            </div>
          )}
          {messages.map((m, i) => (
            <div key={i} className={`chat-bubble ${m.role}`}>
              <div className="chat-bubble-role">{m.role === "user" ? t("user") : t("assistant")}</div>
              <div className="chat-bubble-content">{m.content}</div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>
        {session.status === "active" && (
          <form className="chat-input-bar" onSubmit={send}>
            <input value={input} onChange={e => setInput(e.target.value)} placeholder={t("Type a message...")} />
            <button className="primary" type="submit" disabled={sending}>
              {sending ? "..." : t("Send")}
            </button>
          </form>
        )}
      </div>

      {logs.length > 0 && (
        <Panel title={t("Logs")} icon={<FileText size={16} />}>
          <div className="session-logs">
            {logs.map((l, i) => <div key={i} className="log-line"><span className="log-src">[{l.src}]</span> {l.msg}</div>)}
          </div>
        </Panel>
      )}
    </div>
  );
}

function SessionsPage({ api }) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const { t } = useI18n();

  useEffect(() => {
    api("/api/sessions").then(d => setSessions(d.sessions || [])).finally(() => setLoading(false));
  }, [api]);

  if (loading) return <Empty>{t("Loading")}</Empty>;

  return (
    <div className="page-content">
      <PageHeader title={t("My Sessions")} subtitle={t("Active access grants and sessions")} />
      {sessions.length === 0 ? (
        <Empty title={t("No active sessions")} icon={<Activity size={20} />}>
          {t("No active sessions")}
        </Empty>
      ) : (
        <div className="sessions-grid">
          {sessions.map(s => (
            <div className="session-card" key={s.id}>
              <div className="session-card-top">
                <div>
                  <div style={{ fontWeight: 600 }}>{s.listing_title || s.agent_type}</div>
                  <div className="muted" style={{ fontSize: "0.78rem" }}>{s.agent_type}</div>
                </div>
                <Pill tone={statusTone(s.status)}>{s.status}</Pill>
              </div>
              <div className="chip-row">
                {s.created_at && <span className="chip">{t("Created")}: {formatTime(s.created_at)}</span>}
                {s.started_at && <span className="chip">{t("Started")}: {formatTime(s.started_at)}</span>}
              </div>
              <button className="primary" onClick={() => setRoute(`session/${s.id}`)}>
                <MessageSquare size={14} /> {t("Open Session")}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function App() {
  const route = useRoute();
  const [token, setTokenState] = useState(getToken);
  const [user, setUser] = useState(null);
  const [booting, setBooting] = useState(true);

  const logout = useCallback(() => {
    clearToken();
    setTokenState("");
    setUser(null);
    setRoute("auth");
  }, []);

  const api = useApi(token, logout);

  useEffect(() => {
    if (!token) {
      setBooting(false);
      return;
    }
    apiRequest("/api/me", { token })
      .then((payload) => setUser(payload.user))
      .catch(() => logout())
      .finally(() => setBooting(false));
  }, [token, logout]);

  function handleAuth(nextToken, nextUser) {
    setToken(nextToken);
    setTokenState(nextToken);
    setUser(nextUser);
  }

  if (booting) return <div className="auth-wrap"><Empty>Starting OpenAsstAI</Empty></div>;
  if (!token || !user || route.page === "auth") return <AuthPage onAuth={handleAuth} />;

  let page = null;
  if (route.page === "agent-market") page = <AgentMarketPage api={api} />;
  else if (route.page === "session" && route.id) page = <AgentSessionPage api={api} token={token} id={route.id} />;
  else if (route.page === "sessions") page = <SessionsPage api={api} />;
  else if (route.page === "instances") page = <InstancesPage api={api} />;
  else if (route.page === "instance" && route.id) page = <InstanceConsole api={api} token={token} id={route.id} />;
  else if (route.page === "provider") page = <ProviderPage api={api} />;
  else if (route.page === "admin") page = user.role === "admin" ? <AdminPage api={api} /> : <Empty>Admin access required</Empty>;
  else page = <MarketPage api={api} />;

  return (
    <Shell user={user} onLogout={logout} route={route}>
      {page}
    </Shell>
  );
}

createRoot(document.getElementById("root")).render(
  <LanguageProvider>
    <App />
  </LanguageProvider>
);
