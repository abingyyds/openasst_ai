import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import express from "express";
import pty from "node-pty";
import { WebSocketServer } from "ws";
import { config, rootDir } from "./config.js";
import { writeAudit, writeInstanceLog } from "./audit.js";
import {
  createId,
  db,
  fromJson,
  initDatabase,
  now,
  toJson
} from "./db.js";
import {
  encryptSecret,
  generateNodeToken,
  hashNodeToken,
  hashPassword,
  secretPreview,
  signToken,
  verifyPassword,
  verifyToken
} from "./security.js";
import { provisionWorkspace, workspacePathFor } from "./runtime/localSandbox.js";

initDatabase();
fs.mkdirSync(config.runtimeWorkspaceDir, { recursive: true });

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ noServer: true });
const isMainModule = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

app.use(express.json({ limit: "1mb" }));
app.use((req, res, next) => {
  if (req.body === undefined || req.body === null) req.body = {};
  next();
});
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Node-Token");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  if (req.method === "OPTIONS") return res.sendStatus(204);
  next();
});

function sendError(res, status, message, details = null) {
  res.status(status).json({ error: { message, details } });
}

function requireAuth(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return sendError(res, 401, "需要登录");

  try {
    const payload = verifyToken(token);
    const user = db.prepare("SELECT id, email, role, created_at FROM users WHERE id = ?").get(payload.sub);
    if (!user) return sendError(res, 401, "登录已失效");
    req.user = user;
    next();
  } catch {
    return sendError(res, 401, "登录已失效");
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== "admin") return sendError(res, 403, "需要管理员权限");
  next();
}

function getProviderProfileByUserId(userId) {
  return db.prepare(`
    SELECT p.*, u.email AS user_email
    FROM provider_profiles p
    JOIN users u ON u.id = p.user_id
    WHERE p.user_id = ?
  `).get(userId);
}

function getProviderProfileById(id) {
  return db.prepare(`
    SELECT p.*, u.email AS user_email
    FROM provider_profiles p
    JOIN users u ON u.id = p.user_id
    WHERE p.id = ?
  `).get(id);
}

function getNodeById(nodeId) {
  return db.prepare(`
    SELECT
      n.*,
      p.user_id AS provider_user_id,
      p.display_name AS provider_display_name,
      p.contact AS provider_contact,
      p.status AS provider_status,
      p.platform_fee_percent AS provider_platform_fee_percent,
      p.payout_note AS provider_payout_note,
      p.rejection_reason AS provider_rejection_reason
    FROM nodes n
    LEFT JOIN provider_profiles p ON p.id = n.provider_profile_id
    WHERE n.id = ?
  `).get(nodeId);
}

function getNodeByToken(token) {
  if (!token) return null;
  const tokenHash = hashNodeToken(token);
  return db.prepare(`
    SELECT
      n.*,
      p.user_id AS provider_user_id,
      p.display_name AS provider_display_name,
      p.contact AS provider_contact,
      p.status AS provider_status,
      p.platform_fee_percent AS provider_platform_fee_percent,
      p.payout_note AS provider_payout_note,
      p.rejection_reason AS provider_rejection_reason
    FROM nodes n
    LEFT JOIN provider_profiles p ON p.id = n.provider_profile_id
    WHERE n.agent_token_hash = ?
  `).get(tokenHash);
}

function parseNodeAuthToken(req) {
  const raw = String(req.headers["x-node-token"] || req.headers.authorization || "");
  if (raw.startsWith("Node ")) return raw.slice(5);
  if (raw.startsWith("Bearer ")) return raw.slice(7);
  return String(req.headers["x-node-token"] || raw || "");
}

function requireNodeAuth(req, res, next) {
  const node = getNodeByToken(parseNodeAuthToken(req));
  if (!node) return sendError(res, 401, "节点令牌无效");
  req.node = node;
  next();
}

function serializeProviderProfile(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    userEmail: row.user_email,
    displayName: row.display_name,
    contact: row.contact,
    status: row.status,
    platformFeePercent: row.platform_fee_percent,
    payoutNote: row.payout_note,
    rejectionReason: row.rejection_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    reviewedAt: row.reviewed_at,
    reviewedBy: row.reviewed_by
  };
}

function serializeNode(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    providerProfileId: row.provider_profile_id,
    providerDisplayName: row.provider_display_name || null,
    providerStatus: row.provider_status || null,
    region: row.region,
    status: row.status,
    totalCpu: row.total_cpu,
    totalMemoryMb: row.total_memory_mb,
    totalDiskGb: row.total_disk_gb,
    availableCpu: row.available_cpu,
    availableMemoryMb: row.available_memory_mb,
    availableDiskGb: row.available_disk_gb,
    pricePerHourCents: row.price_per_hour_cents,
    platformFeePercent: row.platform_fee_percent,
    publicHost: row.public_host,
    dockerStatus: row.docker_status,
    agentVersion: row.agent_version,
    agentTokenConfigured: Boolean(row.agent_token_hash),
    metadata: fromJson(row.metadata_json, {}),
    lastHeartbeatAt: row.last_heartbeat_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function serializeNodeTask(row) {
  return {
    id: row.id,
    nodeId: row.node_id,
    instanceId: row.instance_id,
    action: row.action,
    status: row.status,
    payload: fromJson(row.payload_json, {}),
    result: fromJson(row.result_json, {}),
    errorMessage: row.error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    pickedAt: row.picked_at,
    completedAt: row.completed_at
  };
}

function serializeLedgerEntry(row) {
  return {
    id: row.id,
    providerProfileId: row.provider_profile_id,
    nodeId: row.node_id,
    instanceId: row.instance_id,
    type: row.type,
    status: row.status,
    runtimeHours: row.runtime_hours,
    grossCents: row.gross_cents,
    platformFeeCents: row.platform_fee_cents,
    providerCents: row.provider_cents,
    metadata: fromJson(row.metadata_json, {}),
    createdAt: row.created_at
  };
}

function getInstance(instanceId, user) {
  const row = db.prepare(`
    SELECT
      i.*,
      t.name AS template_name,
      t.framework AS template_framework,
      t.description AS template_description,
      t.default_skills_json AS template_default_skills_json,
      p.name AS plan_name,
      p.price_per_hour_cents,
      n.type AS node_type,
      n.name AS node_name,
      n.status AS node_status,
      n.price_per_hour_cents AS node_price_per_hour_cents,
      n.platform_fee_percent AS node_platform_fee_percent,
      n.public_host AS node_public_host,
      n.docker_status AS node_docker_status,
      n.agent_version AS node_agent_version,
      n.metadata_json AS node_metadata_json,
      n.provider_profile_id AS node_provider_profile_id,
      n.last_heartbeat_at AS node_last_heartbeat_at
    FROM instances i
    JOIN agent_templates t ON t.id = i.template_id
    JOIN price_plans p ON p.id = i.plan_id
    JOIN nodes n ON n.id = i.node_id
    WHERE i.id = ?
  `).get(instanceId);

  if (!row) return null;
  if (user.role !== "admin" && row.user_id !== user.id) return null;
  return row;
}

function requireInstance(req, res, next) {
  const instance = getInstance(req.params.id, req.user);
  if (!instance) return sendError(res, 404, "实例不存在");
  req.instance = instance;
  next();
}

function serializeTemplate(row) {
  return {
    id: row.id,
    name: row.name,
    framework: row.framework,
    description: row.description,
    official: Boolean(row.official),
    status: row.status,
    basePriceCents: row.base_price_cents,
    providerProfileId: row.provider_profile_id || null,
    defaultModel: {
      provider: row.default_model_provider,
      model: row.default_model
    },
    capabilities: fromJson(row.capabilities_json, {}),
    defaultChannels: fromJson(row.default_channels_json, []),
    defaultSkills: fromJson(row.default_skills_json, []),
    installMethod: row.install_method || "local-sandbox adapter",
    runtimeKind: row.runtime_kind || "local-sandbox",
    installCommand: row.install_command || "",
    startCommand: row.start_command || "",
    healthCheck: row.health_check || "",
    configHints: fromJson(row.config_hints_json, []),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function serializePlan(row) {
  return {
    id: row.id,
    templateId: row.template_id,
    name: row.name,
    cpu: row.cpu,
    memoryMb: row.memory_mb,
    diskGb: row.disk_gb,
    region: row.region,
    pricePerHourCents: row.price_per_hour_cents
  };
}

function getTemplateWithPlans(templateId) {
  const template = db.prepare("SELECT * FROM agent_templates WHERE id = ?").get(templateId);
  if (!template) return null;
  const plans = db.prepare("SELECT * FROM price_plans WHERE template_id = ? ORDER BY price_per_hour_cents ASC").all(templateId);
  return { ...serializeTemplate(template), plans: plans.map(serializePlan) };
}

function getProviderTemplates(providerProfileId) {
  const rows = db.prepare(`
    SELECT *
    FROM agent_templates
    WHERE provider_profile_id = ?
    ORDER BY created_at DESC
  `).all(providerProfileId);
  return rows.map((template) => ({
    ...serializeTemplate(template),
    plans: db.prepare("SELECT * FROM price_plans WHERE template_id = ? ORDER BY price_per_hour_cents ASC").all(template.id).map(serializePlan)
  }));
}

function estimateInstanceUsage(instance) {
  const rows = db.prepare(`
    SELECT type, SUM(quantity) AS quantity, SUM(price_estimate_cents) AS price
    FROM usage_records
    WHERE instance_id = ?
    GROUP BY type
  `).all(instance.id);

  const summary = {
    runtimeHours: 0,
    tokenCount: 0,
    storageGbHours: 0,
    networkGb: 0,
    recordedCents: 0,
    liveRuntimeHours: 0,
    liveRuntimeCents: 0,
    estimatedCents: 0
  };

  for (const row of rows) {
    summary.recordedCents += Number(row.price || 0);
    if (row.type === "runtime") summary.runtimeHours += Number(row.quantity || 0);
    if (row.type === "token") summary.tokenCount += Number(row.quantity || 0);
    if (row.type === "storage") summary.storageGbHours += Number(row.quantity || 0);
    if (row.type === "network") summary.networkGb += Number(row.quantity || 0);
  }

  if (instance.status === "running" && instance.started_at) {
    const elapsedMs = Math.max(0, Date.now() - new Date(instance.started_at).getTime());
    summary.liveRuntimeHours = elapsedMs / 3600000;
    summary.liveRuntimeCents = summary.liveRuntimeHours * Number(instance.price_per_hour_cents || 0);
  }

  summary.runtimeHours += summary.liveRuntimeHours;
  summary.estimatedCents = summary.recordedCents + summary.liveRuntimeCents;
  return summary;
}

function estimateProviderEarnings(instance) {
  if (instance.node_type !== "provider") {
    return {
      grossCents: 0,
      platformFeeCents: 0,
      providerCents: 0,
      runtimeHours: 0
    };
  }

  const rows = db.prepare(`
    SELECT
      SUM(runtime_hours) AS runtime_hours,
      SUM(gross_cents) AS gross_cents,
      SUM(platform_fee_cents) AS platform_fee_cents,
      SUM(provider_cents) AS provider_cents
    FROM provider_ledger_entries
    WHERE instance_id = ?
  `).get(instance.id);

  let runtimeHours = Number(rows?.runtime_hours || 0);
  let grossCents = Number(rows?.gross_cents || 0);
  let platformFeeCents = Number(rows?.platform_fee_cents || 0);
  let providerCents = Number(rows?.provider_cents || 0);
  if (instance.status === "running" && instance.started_at) {
    const liveHours = Math.max(0, (Date.now() - new Date(instance.started_at).getTime()) / 3600000);
    const liveGross = liveHours * Number(instance.price_per_hour_cents || 0);
    const livePlatformFeePercent = Number(instance.node_platform_fee_percent ?? 20);
    const livePlatformFee = liveGross * (livePlatformFeePercent / 100);
    runtimeHours += liveHours;
    grossCents += liveGross;
    platformFeeCents += livePlatformFee;
    providerCents += Math.max(0, liveGross - livePlatformFee);
  }

  return {
    runtimeHours,
    grossCents,
    platformFeeCents,
    providerCents
  };
}

function serializeInstance(row) {
  return {
    id: row.id,
    userId: row.user_id,
    templateId: row.template_id,
    templateName: row.template_name,
    templateFramework: row.template_framework,
    nodeId: row.node_id,
    nodeType: row.node_type,
    nodeName: row.node_name,
    nodeStatus: row.node_status,
    nodePricePerHourCents: row.node_price_per_hour_cents,
    nodePlatformFeePercent: row.node_platform_fee_percent,
    nodePublicHost: row.node_public_host,
    nodeDockerStatus: row.node_docker_status,
    nodeAgentVersion: row.node_agent_version,
    nodeProviderProfileId: row.node_provider_profile_id,
    nodeLastHeartbeatAt: row.node_last_heartbeat_at,
    planId: row.plan_id,
    planName: row.plan_name,
    pricePerHourCents: row.price_per_hour_cents,
    name: row.name,
    status: row.status,
    cpu: row.cpu,
    memoryMb: row.memory_mb,
    diskGb: row.disk_gb,
    region: row.region,
    workspacePath: row.workspace_path,
    startedAt: row.started_at,
    stoppedAt: row.stopped_at,
    destroyedAt: row.destroyed_at,
    errorReason: row.error_reason,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    usage: estimateInstanceUsage(row),
    providerEarnings: estimateProviderEarnings(row)
  };
}

function buildInstanceSetupStatus(instance) {
  const model = db.prepare("SELECT * FROM model_configs WHERE instance_id = ? AND is_default = 1").get(instance.id);
  const channels = db.prepare("SELECT * FROM channel_configs WHERE instance_id = ? ORDER BY type ASC").all(instance.id);
  const skills = db.prepare(`
    SELECT si.*, s.name, s.slug
    FROM skill_installs si
    JOIN skills s ON s.id = si.skill_id
    WHERE si.instance_id = ?
    ORDER BY s.name ASC
  `).all(instance.id);
  const webChat = channels.find((channel) => channel.type === "web_chat");
  const requiredSkillSlugs = fromJson(instance.template_default_skills_json, []);
  const enabledSkillSlugs = new Set(skills.filter((skill) => skill.status === "enabled").map((skill) => skill.slug));
  const requiredSkillsReady = requiredSkillSlugs.length === 0 || requiredSkillSlugs.every((slug) => enabledSkillSlugs.has(slug));

  return {
    steps: [
      {
        key: "choose_agent",
        label: "Choose Agent",
        done: Boolean(instance.template_id)
      },
      {
        key: "create_instance",
        label: "Create Instance",
        done: Boolean(instance.id && instance.status)
      },
      {
        key: "configure_model",
        label: "Configure Model",
        done: Boolean(model?.provider && model?.model)
      },
      {
        key: "enable_channel",
        label: "Enable Channel",
        done: Boolean(webChat && webChat.status === "active"),
        note: webChat ? webChat.status : "missing"
      },
      {
        key: "enable_skills",
        label: "Enable Skills",
        done: requiredSkillsReady,
        note: requiredSkillSlugs.length === 0
          ? "no required skills"
          : `${requiredSkillSlugs.filter((slug) => enabledSkillSlugs.has(slug)).length}/${requiredSkillSlugs.length} required enabled`
      },
      {
        key: "test_chat",
        label: "Test Chat",
        done: db.prepare("SELECT 1 FROM chat_messages WHERE instance_id = ? AND role = 'assistant' LIMIT 1").get(instance.id) !== undefined,
        note: db.prepare("SELECT 1 FROM chat_messages WHERE instance_id = ? AND role = 'user' LIMIT 1").get(instance.id) !== undefined
          ? "waiting for assistant reply"
          : "send a Web Chat message"
      },
      {
        key: "terminal_logs",
        label: "Terminal / Logs",
        done: db.prepare("SELECT 1 FROM instance_logs WHERE instance_id = ? LIMIT 1").get(instance.id) !== undefined
      }
    ],
    model: model
      ? {
          provider: model.provider,
          model: model.model,
          credentialPreview: secretPreview(model.credential_ref),
          updatedAt: model.updated_at
        }
      : null,
    channels: channels.map((channel) => ({
      type: channel.type,
      status: channel.status,
      config: fromJson(channel.config_json, {})
    })),
    skills: skills.map((skill) => ({
      id: skill.skill_id,
      name: skill.name,
      slug: skill.slug,
      status: skill.status
    })),
    recentChatCount: db.prepare("SELECT COUNT(*) AS n FROM chat_messages WHERE instance_id = ?").get(instance.id).n,
    recentLogCount: db.prepare("SELECT COUNT(*) AS n FROM instance_logs WHERE instance_id = ?").get(instance.id).n
  };
}

function allocateNode(plan, template = null) {
  const providerProfileId = template?.provider_profile_id || null;
  return db.prepare(`
    SELECT
      n.*,
      p.user_id AS provider_user_id,
      p.display_name AS provider_display_name,
      p.contact AS provider_contact,
      p.status AS provider_status,
      p.platform_fee_percent AS provider_platform_fee_percent,
      p.payout_note AS provider_payout_note,
      p.rejection_reason AS provider_rejection_reason
    FROM nodes n
    LEFT JOIN provider_profiles p ON p.id = n.provider_profile_id
    WHERE n.status = 'healthy'
      AND n.region = ?
      AND n.available_cpu >= ?
      AND n.available_memory_mb >= ?
      AND n.available_disk_gb >= ?
      AND (? IS NULL OR n.provider_profile_id = ?)
      AND (
        n.type = 'official'
        OR (
          n.type = 'provider'
          AND p.status = 'approved'
          AND COALESCE(n.price_per_hour_cents, 0) <= ?
        )
      )
    ORDER BY CASE WHEN n.type = 'provider' THEN 0 ELSE 1 END,
      n.price_per_hour_cents ASC,
      n.created_at DESC,
      n.available_cpu DESC,
      n.available_memory_mb DESC
    LIMIT 1
  `).get(plan.region, plan.cpu, plan.memory_mb, plan.disk_gb, providerProfileId, providerProfileId, plan.price_per_hour_cents);
}

function createNodeProvisionTask(node, instance, templateRow, plan) {
  return enqueueNodeTask(node.id, "provision", buildProvisionPayload(instance, serializeTemplate(templateRow), serializePlan(plan)), instance.id);
}

function settleRuntimeUsage(instance, action) {
  if (instance.status !== "running" || !instance.started_at) return;
  const elapsedHours = Math.max(0, (Date.now() - new Date(instance.started_at).getTime()) / 3600000);
  if (elapsedHours <= 0) return;
  const cents = elapsedHours * Number(instance.price_per_hour_cents || 0);
  db.prepare(`
    INSERT INTO usage_records (
      id, user_id, instance_id, type, quantity, unit, price_estimate_cents, metadata_json, created_at
    )
    VALUES (?, ?, ?, 'runtime', ?, 'hour', ?, ?, ?)
  `).run(
    createId("use"),
    instance.user_id,
    instance.id,
    elapsedHours,
    cents,
    toJson({ action, planId: instance.plan_id }),
    now()
  );
}

function settleProviderLedger(instance, action) {
  if (instance.node_type !== "provider" || !instance.started_at) return;
  const elapsedHours = Math.max(0, (Date.now() - new Date(instance.started_at).getTime()) / 3600000);
  if (elapsedHours <= 0) return;
  const grossCents = elapsedHours * Number(instance.price_per_hour_cents || 0);
  const platformFeePercent = Number(instance.node_platform_fee_percent ?? 20);
  const platformFeeCents = grossCents * (platformFeePercent / 100);
  const providerCents = Math.max(0, grossCents - platformFeeCents);
  db.prepare(`
    INSERT INTO provider_ledger_entries (
      id, provider_profile_id, node_id, instance_id, type, status,
      runtime_hours, gross_cents, platform_fee_cents, provider_cents,
      metadata_json, created_at
    )
    VALUES (?, ?, ?, ?, 'runtime', 'available', ?, ?, ?, ?, ?, ?)
  `).run(
    createId("led"),
    instance.node_provider_profile_id,
    instance.node_id,
    instance.id,
    elapsedHours,
    grossCents,
    platformFeeCents,
    providerCents,
    toJson({
      action,
      planId: instance.plan_id,
      platformFeePercent,
      providerAskCents: instance.node_price_per_hour_cents
    }),
    now()
  );
}

function settleInstanceUsage(instance, action) {
  settleRuntimeUsage(instance, action);
  settleProviderLedger(instance, action);
}

function recordTokenUsage(instance, tokens, metadata) {
  const cents = (tokens / 1000) * 2;
  db.prepare(`
    INSERT INTO usage_records (
      id, user_id, instance_id, type, quantity, unit, price_estimate_cents, metadata_json, created_at
    )
    VALUES (?, ?, ?, 'token', ?, 'token', ?, ?, ?)
  `).run(createId("use"), instance.user_id, instance.id, tokens, cents, toJson(metadata), now());
}

function estimateTokens(text) {
  return Math.max(1, Math.ceil(String(text || "").length / 2));
}

function releaseInstanceResources(instance) {
  db.prepare(`
    UPDATE nodes
    SET available_cpu = MIN(total_cpu, available_cpu + ?),
        available_memory_mb = MIN(total_memory_mb, available_memory_mb + ?),
        available_disk_gb = MIN(total_disk_gb, available_disk_gb + ?),
        last_heartbeat_at = ?,
        updated_at = ?
    WHERE id = ?
  `).run(instance.cpu, instance.memory_mb, instance.disk_gb, now(), now(), instance.node_id);
}

function debitNodeResources(nodeId, cpu, memoryMb, diskGb) {
  db.prepare(`
    UPDATE nodes
    SET available_cpu = available_cpu - ?,
        available_memory_mb = available_memory_mb - ?,
        available_disk_gb = available_disk_gb - ?,
        updated_at = ?
    WHERE id = ?
  `).run(cpu, memoryMb, diskGb, now(), nodeId);
}

function getReservedNodeResources(nodeId) {
  const row = db.prepare(`
    SELECT
      COALESCE(SUM(cpu), 0) AS cpu,
      COALESCE(SUM(memory_mb), 0) AS memory_mb,
      COALESCE(SUM(disk_gb), 0) AS disk_gb
    FROM instances
    WHERE node_id = ?
      AND status IN ('provisioning', 'running')
  `).get(nodeId);
  return {
    cpu: Number(row?.cpu || 0),
    memoryMb: Number(row?.memory_mb || 0),
    diskGb: Number(row?.disk_gb || 0)
  };
}

function clampNodeAvailability(nodeId, patch) {
  const node = getNodeById(nodeId);
  if (!node) return patch;
  const reserved = getReservedNodeResources(nodeId);
  const totalCpu = patch.totalCpu === undefined ? Number(node.total_cpu || 0) : Number(patch.totalCpu || 0);
  const totalMemoryMb = patch.totalMemoryMb === undefined ? Number(node.total_memory_mb || 0) : Number(patch.totalMemoryMb || 0);
  const totalDiskGb = patch.totalDiskGb === undefined ? Number(node.total_disk_gb || 0) : Number(patch.totalDiskGb || 0);
  const currentAvailableCpu = patch.availableCpu === undefined ? Number(node.available_cpu || 0) : Number(patch.availableCpu || 0);
  const currentAvailableMemoryMb = patch.availableMemoryMb === undefined ? Number(node.available_memory_mb || 0) : Number(patch.availableMemoryMb || 0);
  const currentAvailableDiskGb = patch.availableDiskGb === undefined ? Number(node.available_disk_gb || 0) : Number(patch.availableDiskGb || 0);
  return {
    ...patch,
    availableCpu: Math.min(Math.max(0, totalCpu - reserved.cpu), Math.max(0, currentAvailableCpu)),
    availableMemoryMb: Math.min(Math.max(0, totalMemoryMb - reserved.memoryMb), Math.max(0, currentAvailableMemoryMb)),
    availableDiskGb: Math.min(Math.max(0, totalDiskGb - reserved.diskGb), Math.max(0, currentAvailableDiskGb))
  };
}

function setNodeHeartbeat(nodeId, patch = {}) {
  patch = clampNodeAvailability(nodeId, patch);
  const columns = [];
  const values = [];
  if (patch.status) {
    columns.push("status = ?");
    values.push(patch.status);
  }
  if (patch.dockerStatus) {
    columns.push("docker_status = ?");
    values.push(patch.dockerStatus);
  }
  if (patch.agentVersion !== undefined) {
    columns.push("agent_version = ?");
    values.push(patch.agentVersion);
  }
  if (patch.publicHost !== undefined) {
    columns.push("public_host = ?");
    values.push(patch.publicHost);
  }
  if (patch.metadata !== undefined) {
    columns.push("metadata_json = ?");
    values.push(toJson(patch.metadata));
  }
  if (patch.availableCpu !== undefined) {
    columns.push("available_cpu = ?");
    values.push(Math.max(0, Number(patch.availableCpu)));
  }
  if (patch.availableMemoryMb !== undefined) {
    columns.push("available_memory_mb = ?");
    values.push(Math.max(0, Number(patch.availableMemoryMb)));
  }
  if (patch.availableDiskGb !== undefined) {
    columns.push("available_disk_gb = ?");
    values.push(Math.max(0, Number(patch.availableDiskGb)));
  }
  columns.push("last_heartbeat_at = ?");
  values.push(now());
  columns.push("updated_at = ?");
  values.push(now());
  values.push(nodeId);
  db.prepare(`UPDATE nodes SET ${columns.join(", ")} WHERE id = ?`).run(...values);
}

function enqueueNodeTask(nodeId, action, payload = {}, instanceId = null) {
  const taskId = createId("tsk");
  db.prepare(`
    INSERT INTO node_tasks (
      id, node_id, instance_id, action, status, payload_json, result_json,
      created_at, updated_at
    )
    VALUES (?, ?, ?, ?, 'queued', ?, '{}', ?, ?)
  `).run(taskId, nodeId, instanceId, action, toJson(payload), now(), now());
  return taskId;
}

function buildNodeInstallCommand(baseUrl, token) {
  return `curl -fsSL ${baseUrl.replace(/\/$/, "")}/api/provider/nodes/install.sh | sh -s -- --token ${token}`;
}

function renderNodeInstallScript(baseUrl, token = "") {
  return `#!/bin/sh
set -eu
BASE_URL="${baseUrl.replace(/\/$/, "")}"

TOKEN=""
while [ $# -gt 0 ]; do
  case "$1" in
    --token)
      TOKEN="\${2:-}"
      shift 2
      ;;
    *)
      shift
      ;;
  esac
done

if [ -z "$TOKEN" ]; then
  TOKEN="${token.replaceAll('"', '\\"')}"
fi

if [ -z "$TOKEN" ]; then
  echo "missing --token" >&2
  exit 1
fi

NODE_HOME="/opt/openasst-node"
if [ "$(id -u 2>/dev/null || echo 1)" != "0" ]; then
  NODE_HOME="\${OPENASST_NODE_HOME:-$HOME/.openasst-node}"
fi
mkdir -p "$NODE_HOME"
cat >"$NODE_HOME/openasst-node-agent.py" <<'PYAGENT'
#!/usr/bin/env python3
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

BASE_URL = sys.argv[1].rstrip('/')
TOKEN = sys.argv[2]
NODE_HOME = Path(os.environ.get('OPENASST_NODE_HOME', str(Path.home() / '.openasst-node')))
WORKSPACES = NODE_HOME / 'workspaces'
WORKSPACES.mkdir(parents=True, exist_ok=True)
HEADERS = {'Content-Type': 'application/json', 'X-Node-Token': TOKEN}


def post(path, payload):
    data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(BASE_URL + path, data=data, headers=HEADERS, method='POST')
    with urllib.request.urlopen(req, timeout=20) as resp:
        return json.loads(resp.read().decode('utf-8') or '{}')


def get(path):
    req = urllib.request.Request(BASE_URL + path, headers={'X-Node-Token': TOKEN}, method='GET')
    with urllib.request.urlopen(req, timeout=20) as resp:
        return json.loads(resp.read().decode('utf-8') or '{}')


def complete(task_id, ok=True, result=None, error=''):
    return post('/api/node/tasks/' + task_id + '/complete', {
        'ok': ok,
        'result': result or {},
        'error': error,
    })


def handle_task(task):
    action = task.get('action')
    payload = task.get('payload') or {}
    instance_id = task.get('instanceId') or payload.get('instanceId') or 'unknown'
    workspace = WORKSPACES / instance_id
    if action == 'provision':
        workspace.mkdir(parents=True, exist_ok=True)
        (workspace / 'agent.json').write_text(json.dumps(payload, indent=2), encoding='utf-8')
        return {'workspace': str(workspace), 'status': 'provisioned'}
    if action in ('start', 'restart'):
        workspace.mkdir(parents=True, exist_ok=True)
        (workspace / 'state').write_text('running\n', encoding='utf-8')
        return {'workspace': str(workspace), 'status': 'running'}
    if action == 'stop':
        workspace.mkdir(parents=True, exist_ok=True)
        (workspace / 'state').write_text('stopped\n', encoding='utf-8')
        return {'workspace': str(workspace), 'status': 'stopped'}
    if action == 'destroy':
        workspace.mkdir(parents=True, exist_ok=True)
        (workspace / 'state').write_text('destroyed\n', encoding='utf-8')
        return {'workspace': str(workspace), 'status': 'destroyed'}
    if action == 'chat':
        model = payload.get('model') or {}
        skills = payload.get('enabledSkills') or []
        channel = str(payload.get('channel') or 'unknown')
        history = payload.get('messages') or []
        requested_message = str(payload.get('message') or '')
        prompt_path = workspace / 'last-chat-request.txt'
        response_path = workspace / 'last-chat-response.txt'
        prompt_path.write_text(requested_message + '\n', encoding='utf-8')

        command = os.environ.get('OPENASST_CHAT_COMMAND', '').strip()
        if command:
            env = dict(os.environ)
            env.update({
                'OPENASST_INSTANCE_ID': instance_id,
                'OPENASST_MESSAGE': requested_message,
                'OPENASST_MODEL_PROVIDER': str(model.get('provider') or ''),
                'OPENASST_MODEL': str(model.get('model') or ''),
                'OPENASST_CHANNEL': channel,
                'OPENASST_ENABLED_SKILLS': json.dumps(skills),
                'OPENASST_MESSAGES': json.dumps(history),
                'OPENASST_WORKSPACE': str(workspace),
            })
            completed = subprocess.run(
                command,
                input=json.dumps(payload),
                text=True,
                shell=True,
                cwd=str(workspace),
                env=env,
                capture_output=True,
                timeout=int(os.environ.get('OPENASST_CHAT_TIMEOUT_SECONDS', '120')),
            )
            if completed.returncode != 0:
                raise RuntimeError((completed.stderr or completed.stdout or 'chat command failed').strip()[:500])
            answer = (completed.stdout or '').strip()
            if not answer and response_path.exists():
                answer = response_path.read_text(encoding='utf-8').strip()
            if not answer:
                raise RuntimeError('chat command produced no answer')
            response_path.write_text(answer + '\n', encoding='utf-8')
            return {'answer': answer, 'status': 'completed', 'runtime': 'provider-command'}

        if response_path.exists():
            answer = response_path.read_text(encoding='utf-8').strip()
            if answer:
                return {'answer': answer, 'status': 'completed', 'runtime': 'provider-workspace-file'}

        answer = (
            'Provider node received this Web Chat turn for instance {instance_id}, but no runtime command is configured on the node. '
            'Set OPENASST_CHAT_COMMAND to your Agent entrypoint; the request JSON is passed on stdin, key fields are exposed as OPENASST_* environment variables, '
            'and the command stdout becomes the user-visible assistant reply. Message: {message}'
        ).format(instance_id=instance_id, message=requested_message)
        return {'answer': answer, 'status': 'configuration_required', 'runtime': 'provider-node'}
    return {'status': 'ignored', 'action': action}


def main():
    hostname = os.uname().nodename if hasattr(os, 'uname') else 'unknown'
    cpu = os.cpu_count() or 1
    total_memory_mb = int(os.environ.get('OPENASST_NODE_MEMORY_MB', '1024'))
    total_disk_gb = int(os.environ.get('OPENASST_NODE_DISK_GB', '10'))
    docker_status = 'ready' if os.system('docker info >/dev/null 2>&1') == 0 else 'missing'
    register_payload = {
        'hostname': hostname,
        'agentVersion': 'mvp-python-0.2',
        'totalCpu': cpu,
        'totalMemoryMb': total_memory_mb,
        'totalDiskGb': total_disk_gb,
        'dockerStatus': docker_status,
    }
    while True:
        try:
            post('/api/node/register', register_payload)
            break
        except Exception as exc:
            print('register failed:', exc, file=sys.stderr)
            time.sleep(10)
    while True:
        try:
            post('/api/node/heartbeat', {
                'status': 'healthy',
                'dockerStatus': docker_status,
                'agentVersion': 'mvp-python-0.2',
                'availableCpu': cpu,
                'availableMemoryMb': total_memory_mb,
                'availableDiskGb': total_disk_gb,
            })
            task = (get('/api/node/tasks/poll') or {}).get('task')
            if task:
                try:
                    result = handle_task(task)
                    complete(task['id'], True, result)
                except Exception as exc:
                    complete(task['id'], False, {}, str(exc))
        except (urllib.error.URLError, TimeoutError, OSError) as exc:
            print('agent loop error:', exc, file=sys.stderr)
        time.sleep(5)


if __name__ == '__main__':
    main()
PYAGENT
chmod +x "$NODE_HOME/openasst-node-agent.py"
cat >"$NODE_HOME/openasst-node-agent.sh" <<'AGENT'
#!/bin/sh
set -eu
BASE_URL="$1"
TOKEN="$2"
if command -v python3 >/dev/null 2>&1; then
  exec python3 "$(dirname "$0")/openasst-node-agent.py" "$BASE_URL" "$TOKEN"
fi

echo "OpenAsstAI node agent requires python3 so it can poll and complete provision/chat tasks." >&2
echo "Install python3, then rerun this installer. Refusing to start a heartbeat-only node." >&2
exit 1
AGENT
chmod +x "$NODE_HOME/openasst-node-agent.sh"

if command -v systemctl >/dev/null 2>&1 && [ "$(id -u)" = "0" ]; then
  cat >/etc/systemd/system/openasst-node-agent.service <<SERVICE
[Unit]
Description=OpenAsstAI Node Agent MVP
After=network-online.target

[Service]
ExecStart=$NODE_HOME/openasst-node-agent.sh "$BASE_URL" "$TOKEN"
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
SERVICE
  systemctl daemon-reload
  systemctl enable --now openasst-node-agent.service
else
  nohup "$NODE_HOME/openasst-node-agent.sh" "$BASE_URL" "$TOKEN" >"$NODE_HOME/agent.log" 2>&1 &
fi

echo "OpenAsstAI node agent installed. Node will appear online after the first heartbeat."
`;
}

function buildProvisionPayload(instance, template, plan) {
  return {
    instanceId: instance.id,
    name: instance.name,
    template: {
      id: template.id,
      name: template.name,
      framework: template.framework,
      defaultModel: template.defaultModel,
      defaultChannels: template.defaultChannels,
      defaultSkills: template.defaultSkills,
      installMethod: template.installMethod,
      runtimeKind: template.runtimeKind,
      installCommand: template.installCommand,
      startCommand: template.startCommand,
      healthCheck: template.healthCheck,
      configHints: template.configHints
    },
    resources: {
      cpu: plan.cpu,
      memoryMb: plan.memoryMb,
      diskGb: plan.diskGb,
      region: plan.region
    },
    runtime: {
      kind: template.runtimeKind || "local-sandbox",
      network: "egress-limited",
      hostSsh: false
    }
  };
}

app.get("/api/health", (req, res) => {
  res.json({
    ok: true,
    runtime: "local-sandbox",
    dockerAvailable: false,
    time: now()
  });
});

app.get("/install-node.sh", (req, res) => {
  res.type("text/x-shellscript");
  res.send(renderNodeInstallScript(config.publicBaseUrl, String(req.query.token || "").trim()));
});

app.post("/api/auth/register", (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  if (!email.includes("@")) return sendError(res, 400, "邮箱格式不正确");
  if (password.length < 6) return sendError(res, 400, "密码至少 6 位");

  const exists = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
  if (exists) return sendError(res, 409, "邮箱已注册");

  const user = {
    id: createId("usr"),
    email,
    role: "user",
    created_at: now()
  };
  db.prepare(`
    INSERT INTO users (id, email, password_hash, role, created_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(user.id, email, hashPassword(password), user.role, user.created_at);

  writeAudit(user.id, null, "auth.register", { email });
  res.status(201).json({ token: signToken(user), user });
});

app.post("/api/auth/login", (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  const row = db.prepare("SELECT * FROM users WHERE email = ?").get(email);
  if (!row || !verifyPassword(password, row.password_hash)) {
    return sendError(res, 401, "邮箱或密码错误");
  }

  const user = { id: row.id, email: row.email, role: row.role, created_at: row.created_at };
  writeAudit(user.id, null, "auth.login", { email });
  res.json({ token: signToken(user), user });
});

app.get("/api/me", requireAuth, (req, res) => {
  res.json({ user: req.user });
});

app.get("/api/provider/profile", requireAuth, (req, res) => {
  const profile = getProviderProfileByUserId(req.user.id);
  if (!profile) {
    return res.json({
      profile: null,
      nodes: [],
      ledger: {
        summary: {
          grossCents: 0,
          platformFeeCents: 0,
          providerCents: 0,
          runtimeHours: 0,
          entries: 0
        },
        entries: []
      }
    });
  }

  const nodes = db.prepare(`
    SELECT
      n.*,
      p.display_name AS provider_display_name,
      p.status AS provider_status
    FROM nodes n
    JOIN provider_profiles p ON p.id = n.provider_profile_id
    WHERE n.provider_profile_id = ?
    ORDER BY n.created_at DESC
  `).all(profile.id);
  const entries = db.prepare(`
    SELECT *
    FROM provider_ledger_entries
    WHERE provider_profile_id = ?
    ORDER BY created_at DESC
    LIMIT 100
  `).all(profile.id);
  const summary = db.prepare(`
    SELECT
      COUNT(*) AS entries,
      SUM(runtime_hours) AS runtime_hours,
      SUM(gross_cents) AS gross_cents,
      SUM(platform_fee_cents) AS platform_fee_cents,
      SUM(provider_cents) AS provider_cents
    FROM provider_ledger_entries
    WHERE provider_profile_id = ?
  `).get(profile.id);

  res.json({
    profile: serializeProviderProfile(profile),
    nodes: nodes.map(serializeNode),
    ledger: {
      summary: {
        entries: Number(summary.entries || 0),
        runtimeHours: Number(summary.runtime_hours || 0),
        grossCents: Number(summary.gross_cents || 0),
        platformFeeCents: Number(summary.platform_fee_cents || 0),
        providerCents: Number(summary.provider_cents || 0)
      },
      entries: entries.map(serializeLedgerEntry)
    }
  });
});

app.post("/api/provider/apply", requireAuth, (req, res) => {
  const displayName = String(req.body.displayName || "").trim().slice(0, 80);
  const contact = String(req.body.contact || "").trim().slice(0, 160);
  const payoutNote = String(req.body.payoutNote || "").trim().slice(0, 500);
  if (!displayName || !contact) return sendError(res, 400, "Provider 名称和联系方式不能为空");

  const existing = getProviderProfileByUserId(req.user.id);
  const stamp = now();
  if (existing) {
    const nextStatus = existing.status === "rejected" ? "pending" : existing.status;
    db.prepare(`
      UPDATE provider_profiles
      SET display_name = ?, contact = ?, payout_note = ?, status = ?, rejection_reason = NULL, updated_at = ?
      WHERE id = ?
    `).run(displayName, contact, payoutNote || null, nextStatus, stamp, existing.id);
    writeAudit(req.user.id, null, "provider.apply.update", { providerProfileId: existing.id, status: nextStatus });
    return res.json({ profile: serializeProviderProfile(getProviderProfileByUserId(req.user.id)) });
  }

  const id = createId("prv");
  db.prepare(`
    INSERT INTO provider_profiles (
      id, user_id, display_name, contact, status, platform_fee_percent,
      payout_note, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, 'pending', 20, ?, ?, ?)
  `).run(id, req.user.id, displayName, contact, payoutNote || null, stamp, stamp);
  writeAudit(req.user.id, null, "provider.apply", { providerProfileId: id });
  res.status(201).json({ profile: serializeProviderProfile(getProviderProfileByUserId(req.user.id)) });
});

app.get("/api/provider/templates", requireAuth, (req, res) => {
  const profile = getProviderProfileByUserId(req.user.id);
  if (!profile) return res.json({ templates: [] });
  res.json({ templates: getProviderTemplates(profile.id) });
});

app.post("/api/provider/templates", requireAuth, (req, res) => {
  const profile = getProviderProfileByUserId(req.user.id);
  if (!profile) return sendError(res, 409, "请先申请 Provider 账号");
  if (profile.status !== "approved") return sendError(res, 403, "Provider 通过审核后才能发布 Agent");

  const name = String(req.body.name || "").trim();
  const framework = String(req.body.framework || "custom");
  const description = String(req.body.description || "").trim();
  const status = String(req.body.status || "draft");
  const runtimeKind = String(req.body.runtimeKind || "provider-node");
  const cpu = Number(req.body.cpu || 0);
  const memoryMb = Number(req.body.memoryMb || 0);
  const diskGb = Number(req.body.diskGb || 0);
  const pricePerHourCents = Number(req.body.pricePerHourCents || 0);
  if (!name || !description) return sendError(res, 400, "模板名称和描述不能为空");
  if (!["hermes", "openclaw", "custom"].includes(framework)) return sendError(res, 400, "框架不合法");
  if (!["draft", "active", "archived"].includes(status)) return sendError(res, 400, "模板状态不合法");
  if (!["provider-node", "local-sandbox"].includes(runtimeKind)) return sendError(res, 400, "运行时类型不合法");
  if (cpu <= 0 || memoryMb < 512 || diskGb < 5) return sendError(res, 400, "套餐资源规格不合法");
  if (pricePerHourCents <= 0) return sendError(res, 400, "Agent 售价必须大于 0");

  const id = createId("tpl");
  const stamp = now();
  db.prepare(`
    INSERT INTO agent_templates (
      id, name, framework, description, official, status, base_price_cents, provider_profile_id,
      default_model_provider, default_model, capabilities_json, default_channels_json, default_skills_json,
      install_method, runtime_kind, install_command, start_command, health_check, config_hints_json,
      created_at, updated_at
    )
    VALUES (?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    name,
    framework,
    description,
    status,
    Number(req.body.basePriceCents || 0),
    profile.id,
    String(req.body.defaultModelProvider || "openai"),
    String(req.body.defaultModel || "gpt-4.1-mini"),
    toJson(req.body.capabilities || {}),
    toJson(req.body.defaultChannels || ["web_chat"]),
    toJson(req.body.defaultSkills || []),
    String(req.body.installMethod || "provider-managed"),
    runtimeKind,
    String(req.body.installCommand || ""),
    String(req.body.startCommand || ""),
    String(req.body.healthCheck || ""),
    toJson(req.body.configHints || []),
    stamp,
    stamp
  );
  db.prepare(`
    INSERT INTO price_plans (id, template_id, name, cpu, memory_mb, disk_gb, region, price_per_hour_cents, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    createId("plan"),
    id,
    String(req.body.planName || "Starter"),
    cpu,
    memoryMb,
    diskGb,
    String(req.body.region || "cn-shanghai"),
    pricePerHourCents,
    stamp
  );
  writeAudit(req.user.id, null, "provider.template.create", { templateId: id, status: String(req.body.status || "draft") });
  res.status(201).json({ template: getTemplateWithPlans(id) });
});

app.patch("/api/provider/templates/:id", requireAuth, (req, res) => {
  const profile = getProviderProfileByUserId(req.user.id);
  if (!profile) return sendError(res, 409, "请先申请 Provider 账号");
  const template = db.prepare("SELECT * FROM agent_templates WHERE id = ?").get(req.params.id);
  if (!template || template.provider_profile_id !== profile.id) return sendError(res, 404, "模板不存在");

  const nextStatus = req.body.status === undefined ? template.status : String(req.body.status);
  if (!["draft", "active", "archived"].includes(nextStatus)) return sendError(res, 400, "模板状态不合法");
  db.prepare(`
    UPDATE agent_templates
    SET name = ?, description = ?, status = ?, base_price_cents = ?, updated_at = ?
    WHERE id = ?
  `).run(
    req.body.name === undefined ? template.name : String(req.body.name).trim(),
    req.body.description === undefined ? template.description : String(req.body.description).trim(),
    nextStatus,
    req.body.basePriceCents === undefined ? template.base_price_cents : Number(req.body.basePriceCents),
    now(),
    template.id
  );
  writeAudit(req.user.id, null, "provider.template.update", { templateId: template.id, status: nextStatus });
  res.json({ template: getTemplateWithPlans(template.id) });
});

app.post("/api/provider/nodes", requireAuth, (req, res) => {
  const profile = getProviderProfileByUserId(req.user.id);
  if (!profile) return sendError(res, 409, "请先申请 Provider 账号");
  if (!["pending", "approved"].includes(profile.status)) return sendError(res, 403, "Provider 当前状态不能创建节点");
  const name = String(req.body.name || "").trim().slice(0, 80);
  const region = String(req.body.region || "").trim().slice(0, 48);
  const totalCpu = Number(req.body.totalCpu || 0);
  const totalMemoryMb = Number(req.body.totalMemoryMb || 0);
  const totalDiskGb = Number(req.body.totalDiskGb || 0);
  const pricePerHourCents = Number(req.body.pricePerHourCents || 0);
  const publicHost = String(req.body.publicHost || "").trim().slice(0, 160) || null;
  if (!name || !region) return sendError(res, 400, "节点名称和区域不能为空");
  if (totalCpu <= 0 || totalMemoryMb < 512 || totalDiskGb < 5) return sendError(res, 400, "资源规格不合法");
  if (pricePerHourCents <= 0) return sendError(res, 400, "Provider 售价必须大于 0");

  const token = generateNodeToken();
  const stamp = now();
  const nodeId = createId("node");
  db.prepare(`
    INSERT INTO nodes (
      id, name, type, provider_profile_id, region, status,
      total_cpu, total_memory_mb, total_disk_gb,
      available_cpu, available_memory_mb, available_disk_gb,
      price_per_hour_cents, platform_fee_percent, public_host,
      docker_status, agent_version, agent_token_hash, metadata_json,
      last_heartbeat_at, created_at, updated_at
    )
    VALUES (
      ?, ?, 'provider', ?, ?, 'offline',
      ?, ?, ?,
      ?, ?, ?,
      ?, ?, ?,
      'unknown', NULL, ?, '{}',
      ?, ?, ?
    )
  `).run(
    nodeId,
    name,
    profile.id,
    region,
    totalCpu,
    totalMemoryMb,
    totalDiskGb,
    totalCpu,
    totalMemoryMb,
    totalDiskGb,
    pricePerHourCents,
    profile.platform_fee_percent,
    publicHost,
    hashNodeToken(token),
    stamp,
    stamp,
    stamp
  );

  writeAudit(req.user.id, null, "provider.node.create", { providerProfileId: profile.id, nodeId });
  const node = getNodeById(nodeId);
  res.status(201).json({
    node: serializeNode(node),
    token,
    installCommand: buildNodeInstallCommand(config.publicBaseUrl, token),
    installScriptUrl: `${config.publicBaseUrl.replace(/\/$/, "")}/api/provider/nodes/install.sh`
  });
});

app.post("/api/provider/nodes/:id/rotate-token", requireAuth, (req, res) => {
  const node = getNodeById(req.params.id);
  if (!node || node.type !== "provider") return sendError(res, 404, "Provider 节点不存在");
  if (req.user.role !== "admin" && node.provider_user_id !== req.user.id) return sendError(res, 403, "无权操作该节点");
  const token = generateNodeToken();
  db.prepare("UPDATE nodes SET agent_token_hash = ?, status = 'offline', updated_at = ? WHERE id = ?")
    .run(hashNodeToken(token), now(), node.id);
  writeAudit(req.user.id, null, "provider.node.rotate_token", { nodeId: node.id });
  res.json({
    node: serializeNode(getNodeById(node.id)),
    token,
    installCommand: buildNodeInstallCommand(config.publicBaseUrl, token),
    installScriptUrl: `${config.publicBaseUrl.replace(/\/$/, "")}/api/provider/nodes/install.sh`
  });
});

app.get("/api/provider/nodes/install.sh", (req, res) => {
  res.type("text/x-shellscript");
  res.send(renderNodeInstallScript(config.publicBaseUrl, String(req.query.token || "").trim()));
});

app.post("/api/node/register", requireNodeAuth, (req, res) => {
  const metrics = {
    hostname: String(req.body.hostname || "").slice(0, 160),
    totalCpu: Number(req.body.totalCpu || req.node.total_cpu || 0),
    totalMemoryMb: Number(req.body.totalMemoryMb || req.node.total_memory_mb || 0),
    totalDiskGb: Number(req.body.totalDiskGb || req.node.total_disk_gb || 0),
    dockerStatus: String(req.body.dockerStatus || "unknown").slice(0, 40),
    agentVersion: String(req.body.agentVersion || "unknown").slice(0, 80),
    publicHost: req.body.publicHost === undefined ? req.node.public_host : String(req.body.publicHost || "").slice(0, 160)
  };
  const status = req.node.provider_status === "approved" ? "healthy" : "degraded";
  db.prepare(`
    UPDATE nodes
    SET status = ?,
        total_cpu = ?,
        total_memory_mb = ?,
        total_disk_gb = ?,
        available_cpu = MIN(available_cpu, ?),
        available_memory_mb = MIN(available_memory_mb, ?),
        available_disk_gb = MIN(available_disk_gb, ?),
        docker_status = ?,
        agent_version = ?,
        public_host = COALESCE(NULLIF(?, ''), public_host),
        metadata_json = ?,
        last_heartbeat_at = ?,
        updated_at = ?
    WHERE id = ?
  `).run(
    status,
    metrics.totalCpu,
    metrics.totalMemoryMb,
    metrics.totalDiskGb,
    metrics.totalCpu,
    metrics.totalMemoryMb,
    metrics.totalDiskGb,
    metrics.dockerStatus,
    metrics.agentVersion,
    metrics.publicHost,
    toJson({ hostname: metrics.hostname, registeredAt: now() }),
    now(),
    now(),
    req.node.id
  );
  res.json({
    ok: true,
    node: serializeNode(getNodeById(req.node.id)),
    providerStatus: req.node.provider_status
  });
});

app.post("/api/node/heartbeat", requireNodeAuth, (req, res) => {
  const status = String(req.body.status || "healthy");
  const nextStatus = ["healthy", "degraded", "offline"].includes(status) ? status : "degraded";
  setNodeHeartbeat(req.node.id, {
    status: req.node.provider_status === "approved" ? nextStatus : "degraded",
    dockerStatus: String(req.body.dockerStatus || req.node.docker_status || "unknown").slice(0, 40),
    agentVersion: String(req.body.agentVersion || req.node.agent_version || "unknown").slice(0, 80),
    publicHost: req.body.publicHost === undefined ? undefined : String(req.body.publicHost || "").slice(0, 160),
    availableCpu: req.body.availableCpu,
    availableMemoryMb: req.body.availableMemoryMb,
    availableDiskGb: req.body.availableDiskGb,
    metadata: {
      ...(fromJson(req.node.metadata_json, {})),
      ...(req.body.metadata || {}),
      heartbeatAt: now()
    }
  });
  res.json({ ok: true, node: serializeNode(getNodeById(req.node.id)) });
});

app.get("/api/node/tasks/poll", requireNodeAuth, (req, res) => {
  const task = db.prepare(`
    SELECT *
    FROM node_tasks
    WHERE node_id = ? AND status = 'queued'
    ORDER BY created_at ASC
    LIMIT 1
  `).get(req.node.id);
  if (!task) return res.json({ task: null });
  db.prepare("UPDATE node_tasks SET status = 'running', picked_at = ?, updated_at = ? WHERE id = ?")
    .run(now(), now(), task.id);
  res.json({ task: serializeNodeTask({ ...task, status: "running", picked_at: now() }) });
});

app.post("/api/node/tasks/:taskId/complete", requireNodeAuth, (req, res) => {
  const task = db.prepare("SELECT * FROM node_tasks WHERE id = ? AND node_id = ?").get(req.params.taskId, req.node.id);
  if (!task) return sendError(res, 404, "任务不存在");
  if (["succeeded", "failed"].includes(task.status)) {
    return res.json({ ok: true, task: serializeNodeTask(task), duplicate: true });
  }
  if (task.status !== "running") {
    return sendError(res, 409, "任务尚未被节点领取");
  }
  const ok = Boolean(req.body.ok);
  const result = req.body.result || {};
  const errorMessage = ok ? null : String(req.body.error || "任务执行失败").slice(0, 500);
  db.prepare(`
    UPDATE node_tasks
    SET status = ?, result_json = ?, error_message = ?, completed_at = ?, updated_at = ?
    WHERE id = ?
  `).run(ok ? "succeeded" : "failed", toJson(result), errorMessage, now(), now(), task.id);

  if (task.instance_id) {
    if (ok && ["start", "restart", "provision"].includes(task.action)) {
      db.prepare("UPDATE instances SET status = 'running', started_at = COALESCE(started_at, ?), stopped_at = NULL, error_reason = NULL, updated_at = ? WHERE id = ?")
        .run(now(), now(), task.instance_id);
      writeInstanceLog(task.instance_id, "info", "node-agent", `${task.action} 任务执行成功`, result);
    } else if (ok && task.action === "chat") {
      const answer = String(result.answer || result.message || "").trim();
      if (answer) {
        const assistantTokens = estimateTokens(answer);
        db.prepare(`
          INSERT INTO chat_messages (id, instance_id, role, content, token_estimate, created_at)
          VALUES (?, ?, 'assistant', ?, ?, ?)
        `).run(createId("msg"), task.instance_id, answer, assistantTokens, now());
        const instance = getInstance(task.instance_id, { id: "__system__", role: "admin" });
        if (instance) {
          const payload = fromJson(task.payload_json, {});
          recordTokenUsage(instance, Number(payload.userTokens || 0) + assistantTokens, {
            provider: payload.model?.provider,
            model: payload.model?.model,
            channel: "web_chat",
            nodeTaskId: task.id
          });
        }
      }
      writeInstanceLog(task.instance_id, "info", "node-agent", "chat 任务执行成功", result);
    } else if (!ok) {
      if (task.action === "chat") {
        const failureNotice = `Provider runtime failed to answer this chat turn: ${errorMessage}`;
        db.prepare(`
          INSERT INTO chat_messages (id, instance_id, role, content, token_estimate, created_at)
          VALUES (?, ?, 'assistant', ?, 0, ?)
        `).run(createId("msg"), task.instance_id, failureNotice, now());
        writeInstanceLog(task.instance_id, "error", "node-agent", "chat 任务执行失败", { error: errorMessage });
      } else {
        db.prepare("UPDATE instances SET status = 'error', error_reason = ?, updated_at = ? WHERE id = ?")
          .run(errorMessage, now(), task.instance_id);
        writeInstanceLog(task.instance_id, "error", "node-agent", `${task.action} 任务执行失败`, { error: errorMessage });
      }
    }
  }

  res.json({ ok: true, task: serializeNodeTask(db.prepare("SELECT * FROM node_tasks WHERE id = ?").get(task.id)) });
});

app.get("/api/templates", requireAuth, (req, res) => {
  const includeAll = req.user.role === "admin" && req.query.includeAll === "1";
  const rows = db.prepare(`
    SELECT *
    FROM agent_templates
    ${includeAll ? "" : "WHERE status = 'active'"}
    ORDER BY created_at ASC
  `).all();
  const visibleRows = includeAll
    ? rows
    : rows.filter((row) => {
        if (!row.provider_profile_id) return true;
        const plans = db.prepare("SELECT * FROM price_plans WHERE template_id = ?").all(row.id);
        return plans.some((plan) => allocateNode(plan, row));
      });
  res.json({ templates: visibleRows.map((row) => getTemplateWithPlans(row.id)) });
});

app.get("/api/templates/:id", requireAuth, (req, res) => {
  const template = getTemplateWithPlans(req.params.id);
  if (!template || (template.status !== "active" && req.user.role !== "admin")) {
    return sendError(res, 404, "模板不存在");
  }
  res.json({ template });
});

app.get("/api/instances", requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT
      i.*,
      t.name AS template_name,
      t.framework AS template_framework,
      t.description AS template_description,
      t.default_skills_json AS template_default_skills_json,
      p.name AS plan_name,
      p.price_per_hour_cents,
      n.name AS node_name,
      n.type AS node_type,
      n.status AS node_status,
      n.provider_profile_id AS node_provider_profile_id,
      n.price_per_hour_cents AS node_price_per_hour_cents,
      n.platform_fee_percent AS node_platform_fee_percent
    FROM instances i
    JOIN agent_templates t ON t.id = i.template_id
    JOIN price_plans p ON p.id = i.plan_id
    JOIN nodes n ON n.id = i.node_id
    WHERE i.user_id = ?
    ORDER BY i.created_at DESC
  `).all(req.user.id);
  res.json({ instances: rows.map(serializeInstance) });
});

app.post("/api/instances", requireAuth, (req, res) => {
  const templateId = String(req.body.templateId || "");
  const planId = String(req.body.planId || "");
  const name = String(req.body.name || "").trim().slice(0, 80) || "OpenAsst Agent";

  const templateRow = db.prepare("SELECT * FROM agent_templates WHERE id = ? AND status = 'active'").get(templateId);
  if (!templateRow) return sendError(res, 404, "模板不存在");
  const plan = db.prepare("SELECT * FROM price_plans WHERE id = ? AND template_id = ?").get(planId, templateId);
  if (!plan) return sendError(res, 400, "套餐不存在");
  const node = allocateNode(plan, templateRow);
  if (!node) {
    return sendError(
      res,
      409,
      templateRow.provider_profile_id
        ? "该 Provider 发布的 Agent 当前没有可用节点资源"
        : "当前没有可用节点资源"
    );
  }

  const instanceId = createId("ins");
  const stamp = now();
  const workspacePath = workspacePathFor(instanceId);

  try {
    db.exec("BEGIN");
    db.prepare(`
      INSERT INTO instances (
        id, user_id, template_id, node_id, plan_id, name, status, cpu, memory_mb, disk_gb,
        region, workspace_path, started_at, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, 'provisioning', ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      instanceId,
      req.user.id,
      templateId,
      node.id,
      planId,
      name,
      plan.cpu,
      plan.memory_mb,
      plan.disk_gb,
      plan.region,
      workspacePath,
      stamp,
      stamp,
      stamp
    );

    debitNodeResources(node.id, plan.cpu, plan.memory_mb, plan.disk_gb);

    db.prepare(`
      INSERT INTO model_configs (
        id, instance_id, provider, model, credential_ref, is_default, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, NULL, 1, ?, ?)
    `).run(
      createId("mod"),
      instanceId,
      templateRow.default_model_provider,
      templateRow.default_model,
      stamp,
      stamp
    );

    const channelTypes = Array.from(new Set(["web_chat", "wechat", "qq", "feishu"]));
    const insertChannel = db.prepare(`
      INSERT INTO channel_configs (
        id, instance_id, type, status, config_json, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    for (const type of channelTypes) {
      insertChannel.run(
        createId("chn"),
        instanceId,
        type,
        type === "web_chat" ? "active" : "waitlist",
        toJson({ label: type, adapterReady: type === "web_chat" }),
        stamp,
        stamp
      );
    }

    const defaultSkillSlugs = fromJson(templateRow.default_skills_json, []);
    for (const slug of defaultSkillSlugs) {
      const skill = db.prepare("SELECT * FROM skills WHERE slug = ?").get(slug);
      if (!skill) continue;
      db.prepare(`
        INSERT OR IGNORE INTO skill_installs (
          id, instance_id, skill_id, version, status, permissions_json, created_at, updated_at
        )
        VALUES (?, ?, ?, ?, 'enabled', ?, ?, ?)
      `).run(
        createId("ski"),
        instanceId,
        skill.id,
        skill.version,
        skill.permissions_json,
        stamp,
        stamp
      );
    }

    db.exec("COMMIT");
  } catch (error) {
    db.exec("ROLLBACK");
    return sendError(res, 500, "创建实例失败", error.message);
  }

  const inserted = getInstance(instanceId, req.user);
  try {
    const provisionTaskId = createNodeProvisionTask(node, inserted, templateRow, plan);
    provisionWorkspace(inserted, serializeTemplate(templateRow), serializePlan(plan));
    if (node.type === "provider") {
      db.prepare("UPDATE instances SET status = 'provisioning', started_at = NULL, updated_at = ? WHERE id = ?")
        .run(now(), instanceId);
    } else {
      db.prepare("UPDATE instances SET status = 'running', started_at = ?, updated_at = ? WHERE id = ?")
        .run(now(), now(), instanceId);
    }
    writeInstanceLog(instanceId, "info", "orchestrator", node.type === "provider" ? "实例已分配到 Provider 节点并创建任务" : "实例已在本地沙箱启动", {
      nodeId: node.id,
      nodeType: node.type,
      provisionTaskId,
      workspacePath
    });
    writeAudit(req.user.id, instanceId, "instance.create", { templateId, planId, nodeId: node.id });
  } catch (error) {
    releaseInstanceResources(inserted);
    db.prepare("UPDATE instances SET status = 'error', error_reason = ?, updated_at = ? WHERE id = ?")
      .run(error.message, now(), instanceId);
    writeInstanceLog(instanceId, "error", "orchestrator", "实例启动失败", { error: error.message });
  }

  res.status(201).json({ instance: serializeInstance(getInstance(instanceId, req.user)) });
});

app.get("/api/instances/:id", requireAuth, requireInstance, (req, res) => {
  res.json({ instance: serializeInstance(req.instance) });
});

app.get("/api/instances/:id/setup", requireAuth, requireInstance, (req, res) => {
  res.json({ setup: buildInstanceSetupStatus(req.instance) });
});

app.patch("/api/instances/:id", requireAuth, requireInstance, (req, res) => {
  const name = String(req.body.name || "").trim().slice(0, 80);
  if (!name) return sendError(res, 400, "实例名称不能为空");
  db.prepare("UPDATE instances SET name = ?, updated_at = ? WHERE id = ?").run(name, now(), req.instance.id);
  writeAudit(req.user.id, req.instance.id, "instance.rename", { name });
  res.json({ instance: serializeInstance(getInstance(req.instance.id, req.user)) });
});

app.post("/api/instances/:id/start", requireAuth, requireInstance, (req, res) => {
  if (req.instance.status === "destroyed") return sendError(res, 409, "已销毁实例不能启动");
  if (req.instance.status !== "running") {
    if (req.instance.node_type === "provider") {
      const taskId = enqueueNodeTask(req.instance.node_id, "start", { instanceId: req.instance.id }, req.instance.id);
      db.prepare("UPDATE instances SET status = 'provisioning', stopped_at = NULL, error_reason = NULL, updated_at = ? WHERE id = ?")
        .run(now(), req.instance.id);
      writeInstanceLog(req.instance.id, "info", "runtime", "实例启动任务已派发到 Provider 节点", { taskId });
    } else {
      db.prepare("UPDATE instances SET status = 'running', started_at = ?, stopped_at = NULL, error_reason = NULL, updated_at = ? WHERE id = ?")
        .run(now(), now(), req.instance.id);
      writeInstanceLog(req.instance.id, "info", "runtime", "实例已启动");
    }
    writeAudit(req.user.id, req.instance.id, "instance.start");
  }
  res.json({ instance: serializeInstance(getInstance(req.instance.id, req.user)) });
});

app.post("/api/instances/:id/stop", requireAuth, requireInstance, (req, res) => {
  if (req.instance.status === "destroyed") return sendError(res, 409, "实例已销毁");
  settleInstanceUsage(req.instance, "stop");
  if (req.instance.node_type === "provider") {
    enqueueNodeTask(req.instance.node_id, "stop", { instanceId: req.instance.id }, req.instance.id);
  }
  db.prepare("UPDATE instances SET status = 'stopped', started_at = NULL, stopped_at = ?, updated_at = ? WHERE id = ?")
    .run(now(), now(), req.instance.id);
  writeInstanceLog(req.instance.id, "info", "runtime", "实例已停止");
  writeAudit(req.user.id, req.instance.id, "instance.stop");
  res.json({ instance: serializeInstance(getInstance(req.instance.id, req.user)) });
});

app.post("/api/instances/:id/restart", requireAuth, requireInstance, (req, res) => {
  if (req.instance.status === "destroyed") return sendError(res, 409, "已销毁实例不能重启");
  settleInstanceUsage(req.instance, "restart");
  if (req.instance.node_type === "provider") {
    const taskId = enqueueNodeTask(req.instance.node_id, "restart", { instanceId: req.instance.id }, req.instance.id);
    db.prepare("UPDATE instances SET status = 'provisioning', started_at = NULL, stopped_at = NULL, error_reason = NULL, updated_at = ? WHERE id = ?")
      .run(now(), req.instance.id);
    writeInstanceLog(req.instance.id, "info", "runtime", "实例重启任务已派发到 Provider 节点", { taskId });
  } else {
    db.prepare("UPDATE instances SET status = 'running', started_at = ?, stopped_at = NULL, error_reason = NULL, updated_at = ? WHERE id = ?")
      .run(now(), now(), req.instance.id);
    writeInstanceLog(req.instance.id, "info", "runtime", "实例已重启");
  }
  writeAudit(req.user.id, req.instance.id, "instance.restart");
  res.json({ instance: serializeInstance(getInstance(req.instance.id, req.user)) });
});

app.post("/api/instances/:id/destroy", requireAuth, requireInstance, (req, res) => {
  if (req.instance.status !== "destroyed") {
    settleInstanceUsage(req.instance, "destroy");
    if (req.instance.node_type === "provider") {
      enqueueNodeTask(req.instance.node_id, "destroy", { instanceId: req.instance.id }, req.instance.id);
    }
    releaseInstanceResources(req.instance);
    db.prepare("UPDATE instances SET status = 'destroyed', started_at = NULL, destroyed_at = ?, updated_at = ? WHERE id = ?")
      .run(now(), now(), req.instance.id);
    writeInstanceLog(req.instance.id, "warn", "runtime", "实例已销毁，工作目录保留用于审计");
    writeAudit(req.user.id, req.instance.id, "instance.destroy");
  }
  res.json({ instance: serializeInstance(getInstance(req.instance.id, req.user)) });
});

app.post("/api/instances/:id/health-check", requireAuth, requireInstance, (req, res) => {
  const nodeOk = req.instance.node_type === "provider"
    ? req.instance.node_status !== "offline"
    : fs.existsSync(req.instance.workspace_path);
  const ok = nodeOk && req.instance.status !== "destroyed";
  if (!ok && req.instance.status !== "destroyed") {
    db.prepare("UPDATE instances SET status = 'error', error_reason = ?, updated_at = ? WHERE id = ?")
      .run(req.instance.node_type === "provider" ? "Provider 节点不可用" : "工作目录不可用", now(), req.instance.id);
    writeInstanceLog(req.instance.id, "error", "health", req.instance.node_type === "provider" ? "健康检查失败：Provider 节点不可用" : "健康检查失败：工作目录不可用");
  } else {
    writeInstanceLog(req.instance.id, "info", "health", "健康检查通过");
  }
  writeAudit(req.user.id, req.instance.id, "instance.health_check", { ok });
  res.json({ ok, instance: serializeInstance(getInstance(req.instance.id, req.user)) });
});

app.get("/api/instances/:id/model", requireAuth, requireInstance, (req, res) => {
  const row = db.prepare("SELECT * FROM model_configs WHERE instance_id = ? AND is_default = 1").get(req.instance.id);
  res.json({
    modelConfig: row
      ? {
          id: row.id,
          provider: row.provider,
          model: row.model,
          credentialPreview: secretPreview(row.credential_ref),
          isDefault: Boolean(row.is_default),
          updatedAt: row.updated_at
        }
      : null
  });
});

app.put("/api/instances/:id/model", requireAuth, requireInstance, (req, res) => {
  const provider = String(req.body.provider || "").trim();
  const model = String(req.body.model || "").trim();
  const apiKey = String(req.body.apiKey || "");
  const clearApiKey = Boolean(req.body.clearApiKey);
  if (!provider || !model) return sendError(res, 400, "模型供应商和模型名不能为空");

  const existing = db.prepare("SELECT * FROM model_configs WHERE instance_id = ? AND is_default = 1").get(req.instance.id);
  const credentialRef = clearApiKey
    ? null
    : apiKey
      ? encryptSecret(apiKey)
      : existing?.credential_ref || null;

  if (existing) {
    db.prepare(`
      UPDATE model_configs
      SET provider = ?, model = ?, credential_ref = ?, updated_at = ?
      WHERE id = ?
    `).run(provider, model, credentialRef, now(), existing.id);
  } else {
    db.prepare(`
      INSERT INTO model_configs (
        id, instance_id, provider, model, credential_ref, is_default, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, 1, ?, ?)
    `).run(createId("mod"), req.instance.id, provider, model, credentialRef, now(), now());
  }

  writeAudit(req.user.id, req.instance.id, "model.update", {
    provider,
    model,
    credential: credentialRef ? "configured" : "empty"
  });
  writeInstanceLog(req.instance.id, "info", "model", `默认模型已更新为 ${provider}/${model}`);
  const row = db.prepare("SELECT * FROM model_configs WHERE instance_id = ? AND is_default = 1").get(req.instance.id);
  res.json({
    modelConfig: {
      id: row.id,
      provider: row.provider,
      model: row.model,
      credentialPreview: secretPreview(row.credential_ref),
      isDefault: Boolean(row.is_default),
      updatedAt: row.updated_at
    }
  });
});

app.get("/api/instances/:id/channels", requireAuth, requireInstance, (req, res) => {
  const rows = db.prepare("SELECT * FROM channel_configs WHERE instance_id = ? ORDER BY type ASC").all(req.instance.id);
  res.json({
    channels: rows.map((row) => ({
      id: row.id,
      type: row.type,
      status: row.status,
      config: fromJson(row.config_json, {}),
      updatedAt: row.updated_at
    }))
  });
});

app.put("/api/instances/:id/channels/:type", requireAuth, requireInstance, (req, res) => {
  const type = String(req.params.type || "");
  if (!["web_chat", "wechat", "qq", "feishu"].includes(type)) return sendError(res, 400, "不支持的通道类型");
  const status = String(req.body.status || "disabled");
  if (!["active", "disabled", "waitlist"].includes(status)) return sendError(res, 400, "通道状态不合法");
  const configJson = toJson(req.body.config || {});
  const existing = db.prepare("SELECT * FROM channel_configs WHERE instance_id = ? AND type = ?").get(req.instance.id, type);
  if (existing) {
    db.prepare("UPDATE channel_configs SET status = ?, config_json = ?, updated_at = ? WHERE id = ?")
      .run(status, configJson, now(), existing.id);
  } else {
    db.prepare(`
      INSERT INTO channel_configs (id, instance_id, type, status, config_json, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(createId("chn"), req.instance.id, type, status, configJson, now(), now());
  }
  writeAudit(req.user.id, req.instance.id, "channel.update", { type, status });
  writeInstanceLog(req.instance.id, "info", "channel", `${type} 通道已更新为 ${status}`);
  const rows = db.prepare("SELECT * FROM channel_configs WHERE instance_id = ? ORDER BY type ASC").all(req.instance.id);
  res.json({
    channels: rows.map((row) => ({
      id: row.id,
      type: row.type,
      status: row.status,
      config: fromJson(row.config_json, {}),
      updatedAt: row.updated_at
    }))
  });
});

app.get("/api/instances/:id/chat", requireAuth, requireInstance, (req, res) => {
  const rows = db.prepare(`
    SELECT *
    FROM (
      SELECT *
      FROM chat_messages
      WHERE instance_id = ?
      ORDER BY created_at DESC
      LIMIT 100
    )
    ORDER BY created_at ASC
  `).all(req.instance.id);
  res.json({
    messages: rows.map((row) => ({
      id: row.id,
      role: row.role,
      content: row.content,
      tokenEstimate: row.token_estimate,
      createdAt: row.created_at
    }))
  });
});

app.post("/api/instances/:id/chat", requireAuth, requireInstance, (req, res) => {
  if (req.instance.status !== "running") return sendError(res, 409, "实例未运行");
  const webChat = db.prepare("SELECT * FROM channel_configs WHERE instance_id = ? AND type = 'web_chat'").get(req.instance.id);
  if (!webChat || webChat.status !== "active") return sendError(res, 409, "Web Chat 通道未启用");

  const content = String(req.body.message || "").trim();
  if (!content) return sendError(res, 400, "消息不能为空");

  const model = db.prepare("SELECT * FROM model_configs WHERE instance_id = ? AND is_default = 1").get(req.instance.id);
  const enabledSkills = db.prepare(`
    SELECT s.name
    FROM skill_installs si
    JOIN skills s ON s.id = si.skill_id
    WHERE si.instance_id = ? AND si.status = 'enabled'
    ORDER BY s.name ASC
  `).all(req.instance.id);
  const userTokens = estimateTokens(content);
  const stamp = now();
  const userMessageId = createId("msg");

  db.prepare(`
    INSERT INTO chat_messages (id, instance_id, role, content, token_estimate, created_at)
    VALUES (?, ?, 'user', ?, ?, ?)
  `).run(userMessageId, req.instance.id, content, userTokens, stamp);

  if (req.instance.node_type === "provider") {
    const recentMessages = db.prepare(`
      SELECT id, role, content, token_estimate, created_at
      FROM chat_messages
      WHERE instance_id = ?
      ORDER BY created_at DESC
      LIMIT 20
    `).all(req.instance.id).reverse().map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      tokenEstimate: message.token_estimate,
      createdAt: message.created_at
    }));
    const taskId = enqueueNodeTask(req.instance.node_id, "chat", {
      instanceId: req.instance.id,
      messageId: userMessageId,
      message: content,
      messages: recentMessages,
      userTokens,
      model: model ? { provider: model.provider, model: model.model } : null,
      enabledSkills: enabledSkills.map((skill) => skill.name),
      channel: "web_chat"
    }, req.instance.id);
    writeAudit(req.user.id, req.instance.id, "chat.message.queued", { taskId, tokens: userTokens });
    writeInstanceLog(req.instance.id, "info", "runtime", "Web Chat 消息已派发到 Provider 节点", { taskId });
    return res.status(202).json({
      status: "queued",
      taskId,
      message: {
        role: "system",
        content: "消息已发送到 Provider 节点执行，稍后刷新聊天记录查看回复。",
        tokenEstimate: 0,
        createdAt: now()
      }
    });
  }

  const request = {
    instanceId: req.instance.id,
    instance: {
      id: req.instance.id,
      name: req.instance.name,
      template: req.instance.template_name,
      framework: req.instance.template_framework
    },
    message: content,
    userTokens,
    model: model ? { provider: model.provider, model: model.model } : null,
    enabledSkills: enabledSkills.map((skill) => skill.name),
    channel: "web_chat"
  };
  const chatEntrypoint = path.join(req.instance.workspace_path, "openasst-chat.mjs");
  if (!fs.existsSync(chatEntrypoint)) {
    return sendError(res, 503, "本地 Agent 聊天入口不存在，请重新创建或重启实例");
  }

  const execution = spawnSync(process.execPath, [chatEntrypoint], {
    cwd: req.instance.workspace_path,
    input: JSON.stringify(request),
    encoding: "utf8",
    timeout: 15_000,
    maxBuffer: 256 * 1024
  });
  if (execution.error || execution.status !== 0) {
    const detail = execution.error?.message || execution.stderr || `exit ${execution.status}`;
    writeInstanceLog(req.instance.id, "error", "runtime", "本地 Agent 聊天入口执行失败", { error: detail });
    return sendError(res, 502, "本地 Agent 执行失败", detail);
  }

  const answer = String(execution.stdout || "").trim();
  if (!answer) {
    writeInstanceLog(req.instance.id, "error", "runtime", "本地 Agent 聊天入口没有返回内容");
    return sendError(res, 502, "本地 Agent 没有返回内容");
  }
  const assistantTokens = estimateTokens(answer);
  db.prepare(`
    INSERT INTO chat_messages (id, instance_id, role, content, token_estimate, created_at)
    VALUES (?, ?, 'assistant', ?, ?, ?)
  `).run(createId("msg"), req.instance.id, answer, assistantTokens, now());

  recordTokenUsage(req.instance, userTokens + assistantTokens, {
    provider: model?.provider,
    model: model?.model,
    channel: "web_chat",
    runtime: "local-sandbox"
  });
  writeAudit(req.user.id, req.instance.id, "chat.message", { tokens: userTokens + assistantTokens, runtime: "local-sandbox" });

  res.status(201).json({
    message: {
      role: "assistant",
      content: answer,
      tokenEstimate: assistantTokens,
      createdAt: now()
    }
  });
});

app.get("/api/skills", requireAuth, (req, res) => {
  const rows = db.prepare("SELECT * FROM skills ORDER BY name ASC").all();
  res.json({
    skills: rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      version: row.version,
      description: row.description,
      permissions: fromJson(row.permissions_json, []),
      runtimeFlags: fromJson(row.runtime_flags_json, {})
    }))
  });
});

app.get("/api/instances/:id/skills", requireAuth, requireInstance, (req, res) => {
  const rows = db.prepare(`
    SELECT
      s.*,
      si.id AS install_id,
      si.status AS install_status,
      si.updated_at AS install_updated_at
    FROM skills s
    LEFT JOIN skill_installs si ON si.skill_id = s.id AND si.instance_id = ?
    ORDER BY s.name ASC
  `).all(req.instance.id);
  res.json({
    skills: rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
      version: row.version,
      description: row.description,
      permissions: fromJson(row.permissions_json, []),
      runtimeFlags: fromJson(row.runtime_flags_json, {}),
      installed: Boolean(row.install_id),
      status: row.install_status || "not_installed",
      updatedAt: row.install_updated_at
    }))
  });
});

app.post("/api/instances/:id/skills/:skillId/install", requireAuth, requireInstance, (req, res) => {
  const skill = db.prepare("SELECT * FROM skills WHERE id = ? OR slug = ?").get(req.params.skillId, req.params.skillId);
  if (!skill) return sendError(res, 404, "技能不存在");
  db.prepare(`
    INSERT INTO skill_installs (
      id, instance_id, skill_id, version, status, permissions_json, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, 'enabled', ?, ?, ?)
    ON CONFLICT(instance_id, skill_id)
    DO UPDATE SET status = 'enabled', updated_at = excluded.updated_at
  `).run(createId("ski"), req.instance.id, skill.id, skill.version, skill.permissions_json, now(), now());
  writeAudit(req.user.id, req.instance.id, "skill.install", { skillId: skill.id });
  writeInstanceLog(req.instance.id, "info", "skill", `${skill.name} 已安装并启用`);
  res.json({ ok: true });
});

app.patch("/api/instances/:id/skills/:skillId", requireAuth, requireInstance, (req, res) => {
  const status = String(req.body.status || "");
  if (!["enabled", "disabled"].includes(status)) return sendError(res, 400, "技能状态不合法");
  const skill = db.prepare("SELECT * FROM skills WHERE id = ? OR slug = ?").get(req.params.skillId, req.params.skillId);
  if (!skill) return sendError(res, 404, "技能不存在");
  const installed = db.prepare("SELECT * FROM skill_installs WHERE instance_id = ? AND skill_id = ?")
    .get(req.instance.id, skill.id);
  if (!installed) return sendError(res, 409, "技能尚未安装");
  db.prepare("UPDATE skill_installs SET status = ?, updated_at = ? WHERE id = ?").run(status, now(), installed.id);
  writeAudit(req.user.id, req.instance.id, "skill.toggle", { skillId: skill.id, status });
  writeInstanceLog(req.instance.id, "info", "skill", `${skill.name} 已${status === "enabled" ? "启用" : "禁用"}`);
  res.json({ ok: true });
});

app.delete("/api/instances/:id/skills/:skillId", requireAuth, requireInstance, (req, res) => {
  const skill = db.prepare("SELECT * FROM skills WHERE id = ? OR slug = ?").get(req.params.skillId, req.params.skillId);
  if (!skill) return sendError(res, 404, "技能不存在");
  db.prepare("DELETE FROM skill_installs WHERE instance_id = ? AND skill_id = ?").run(req.instance.id, skill.id);
  writeAudit(req.user.id, req.instance.id, "skill.uninstall", { skillId: skill.id });
  writeInstanceLog(req.instance.id, "warn", "skill", `${skill.name} 已卸载`);
  res.json({ ok: true });
});

app.get("/api/instances/:id/logs", requireAuth, requireInstance, (req, res) => {
  const logs = db.prepare(`
    SELECT * FROM instance_logs
    WHERE instance_id = ?
    ORDER BY created_at DESC
    LIMIT 200
  `).all(req.instance.id);
  const audits = db.prepare(`
    SELECT a.*, u.email AS actor_email
    FROM audit_logs a
    LEFT JOIN users u ON u.id = a.actor_id
    WHERE a.instance_id = ?
    ORDER BY a.created_at DESC
    LIMIT 200
  `).all(req.instance.id);
  res.json({
    logs: logs.map((row) => ({
      id: row.id,
      level: row.level,
      source: row.source,
      message: row.message,
      metadata: fromJson(row.metadata_json, {}),
      createdAt: row.created_at
    })),
    audits: audits.map((row) => ({
      id: row.id,
      actorEmail: row.actor_email,
      action: row.action,
      metadata: fromJson(row.metadata_json, {}),
      createdAt: row.created_at
    }))
  });
});

app.get("/api/instances/:id/usage", requireAuth, requireInstance, (req, res) => {
  const records = db.prepare(`
    SELECT * FROM usage_records
    WHERE instance_id = ?
    ORDER BY created_at DESC
    LIMIT 200
  `).all(req.instance.id);
  res.json({
    summary: estimateInstanceUsage(req.instance),
    records: records.map((row) => ({
      id: row.id,
      type: row.type,
      quantity: row.quantity,
      unit: row.unit,
      priceEstimateCents: row.price_estimate_cents,
      metadata: fromJson(row.metadata_json, {}),
      createdAt: row.created_at
    }))
  });
});

app.get("/api/admin/overview", requireAuth, requireAdmin, (req, res) => {
  const counts = {
    users: db.prepare("SELECT COUNT(*) AS n FROM users").get().n,
    providers: db.prepare("SELECT COUNT(*) AS n FROM provider_profiles").get().n,
    approvedProviders: db.prepare("SELECT COUNT(*) AS n FROM provider_profiles WHERE status = 'approved'").get().n,
    templates: db.prepare("SELECT COUNT(*) AS n FROM agent_templates").get().n,
    instances: db.prepare("SELECT COUNT(*) AS n FROM instances").get().n,
    runningInstances: db.prepare("SELECT COUNT(*) AS n FROM instances WHERE status = 'running'").get().n,
    providerNodes: db.prepare("SELECT COUNT(*) AS n FROM nodes WHERE type = 'provider'").get().n
  };
  const nodes = db.prepare(`
    SELECT n.*, p.display_name AS provider_display_name, p.status AS provider_status
    FROM nodes n
    LEFT JOIN provider_profiles p ON p.id = n.provider_profile_id
    ORDER BY n.region ASC, n.created_at ASC
  `).all();
  const recentErrors = db.prepare(`
    SELECT l.*, i.name AS instance_name
    FROM instance_logs l
    LEFT JOIN instances i ON i.id = l.instance_id
    WHERE l.level = 'error'
    ORDER BY l.created_at DESC
    LIMIT 20
  `).all();
  const usage = db.prepare(`
    SELECT type, SUM(quantity) AS quantity, SUM(price_estimate_cents) AS price
    FROM usage_records
    GROUP BY type
  `).all();
  res.json({
    counts,
    nodes,
    usage,
    recentErrors: recentErrors.map((row) => ({
      id: row.id,
      instanceId: row.instance_id,
      instanceName: row.instance_name,
      level: row.level,
      source: row.source,
      message: row.message,
      createdAt: row.created_at
    }))
  });
});

app.get("/api/admin/instances", requireAuth, requireAdmin, (req, res) => {
  const rows = db.prepare(`
    SELECT
      i.*,
      t.name AS template_name,
      t.framework AS template_framework,
      t.description AS template_description,
      t.default_skills_json AS template_default_skills_json,
      p.name AS plan_name,
      p.price_per_hour_cents,
      n.name AS node_name,
      n.type AS node_type,
      n.status AS node_status,
      n.provider_profile_id AS node_provider_profile_id,
      n.price_per_hour_cents AS node_price_per_hour_cents,
      n.platform_fee_percent AS node_platform_fee_percent
    FROM instances i
    JOIN agent_templates t ON t.id = i.template_id
    JOIN price_plans p ON p.id = i.plan_id
    JOIN nodes n ON n.id = i.node_id
    ORDER BY i.created_at DESC
  `).all();
  res.json({ instances: rows.map(serializeInstance) });
});

app.get("/api/admin/nodes", requireAuth, requireAdmin, (req, res) => {
  const rows = db.prepare(`
    SELECT n.*, p.display_name AS provider_display_name, p.status AS provider_status
    FROM nodes n
    LEFT JOIN provider_profiles p ON p.id = n.provider_profile_id
    ORDER BY n.region ASC, n.created_at ASC
  `).all();
  res.json({ nodes: rows.map(serializeNode) });
});

app.get("/api/admin/providers", requireAuth, requireAdmin, (req, res) => {
  const rows = db.prepare(`
    SELECT
      p.*,
      u.email AS user_email
    FROM provider_profiles p
    JOIN users u ON u.id = p.user_id
    ORDER BY CASE p.status WHEN 'pending' THEN 0 WHEN 'approved' THEN 1 ELSE 2 END, p.created_at DESC
  `).all();
  res.json({
    providers: rows.map((row) => {
      const nodeCounts = db.prepare(`
        SELECT
          COUNT(*) AS node_count,
          SUM(CASE WHEN status = 'healthy' THEN 1 ELSE 0 END) AS healthy_node_count
        FROM nodes
        WHERE provider_profile_id = ?
      `).get(row.id);
      const earnings = db.prepare(`
        SELECT COALESCE(SUM(provider_cents), 0) AS provider_cents
        FROM provider_ledger_entries
        WHERE provider_profile_id = ?
      `).get(row.id);
      return {
        ...serializeProviderProfile(row),
        nodeCount: Number(nodeCounts?.node_count || 0),
        healthyNodeCount: Number(nodeCounts?.healthy_node_count || 0),
        providerCents: Number(earnings?.provider_cents || 0)
      };
    })
  });
});

app.patch("/api/admin/providers/:id", requireAuth, requireAdmin, (req, res) => {
  const provider = getProviderProfileById(req.params.id);
  if (!provider) return sendError(res, 404, "Provider 不存在");
  const status = String(req.body.status || provider.status);
  if (!["pending", "approved", "rejected", "suspended"].includes(status)) return sendError(res, 400, "Provider 状态不合法");
  const platformFeePercent = req.body.platformFeePercent === undefined
    ? provider.platform_fee_percent
    : Math.max(0, Math.min(80, Number(req.body.platformFeePercent)));
  const rejectionReason = status === "rejected"
    ? String(req.body.rejectionReason || "未通过审核").trim().slice(0, 500)
    : null;
  db.prepare(`
    UPDATE provider_profiles
    SET status = ?,
        platform_fee_percent = ?,
        rejection_reason = ?,
        reviewed_at = ?,
        reviewed_by = ?,
        updated_at = ?
    WHERE id = ?
  `).run(status, platformFeePercent, rejectionReason, now(), req.user.id, now(), provider.id);
  db.prepare("UPDATE nodes SET platform_fee_percent = ?, updated_at = ? WHERE provider_profile_id = ?")
    .run(platformFeePercent, now(), provider.id);
  writeAudit(req.user.id, null, "admin.provider.review", { providerProfileId: provider.id, status, platformFeePercent });
  res.json({ provider: serializeProviderProfile(getProviderProfileById(provider.id)) });
});

app.post("/api/admin/templates", requireAuth, requireAdmin, (req, res) => {
  const name = String(req.body.name || "").trim();
  const framework = String(req.body.framework || "custom");
  const description = String(req.body.description || "").trim();
  if (!name || !description) return sendError(res, 400, "模板名称和描述不能为空");
  if (!["hermes", "openclaw", "custom"].includes(framework)) return sendError(res, 400, "框架不合法");

  const id = createId("tpl");
  db.prepare(`
    INSERT INTO agent_templates (
      id, name, framework, description, official, status, base_price_cents,
      default_model_provider, default_model, capabilities_json,
      default_channels_json, default_skills_json, created_at, updated_at
    )
    VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    name,
    framework,
    description,
    String(req.body.status || "draft"),
    Number(req.body.basePriceCents || 0),
    String(req.body.defaultModelProvider || "openai"),
    String(req.body.defaultModel || "gpt-4.1-mini"),
    toJson(req.body.capabilities || {}),
    toJson(req.body.defaultChannels || ["web_chat"]),
    toJson(req.body.defaultSkills || []),
    now(),
    now()
  );
  writeAudit(req.user.id, null, "admin.template.create", { templateId: id });
  res.status(201).json({ template: getTemplateWithPlans(id) });
});

app.patch("/api/admin/templates/:id", requireAuth, requireAdmin, (req, res) => {
  const template = db.prepare("SELECT * FROM agent_templates WHERE id = ?").get(req.params.id);
  if (!template) return sendError(res, 404, "模板不存在");
  const next = {
    name: req.body.name === undefined ? template.name : String(req.body.name).trim(),
    description: req.body.description === undefined ? template.description : String(req.body.description).trim(),
    status: req.body.status === undefined ? template.status : String(req.body.status),
    basePriceCents: req.body.basePriceCents === undefined ? template.base_price_cents : Number(req.body.basePriceCents)
  };
  if (!["active", "draft", "archived"].includes(next.status)) return sendError(res, 400, "模板状态不合法");
  db.prepare(`
    UPDATE agent_templates
    SET name = ?, description = ?, status = ?, base_price_cents = ?, updated_at = ?
    WHERE id = ?
  `).run(next.name, next.description, next.status, next.basePriceCents, now(), template.id);
  writeAudit(req.user.id, null, "admin.template.update", { templateId: template.id, status: next.status });
  res.json({ template: getTemplateWithPlans(template.id) });
});

if (process.env.NODE_ENV === "production") {
  const distDir = path.join(rootDir, "dist");
  app.use(express.static(distDir));
  app.get(/.*/, (req, res) => {
    res.sendFile(path.join(distDir, "index.html"));
  });
}

app.use((err, req, res, next) => {
  console.error(err);
  sendError(res, 500, "服务内部错误", err.message);
});

server.on("upgrade", (request, socket, head) => {
  const url = new URL(request.url, "http://127.0.0.1");
  if (url.pathname !== "/ws/terminal") {
    socket.destroy();
    return;
  }

  try {
    const token = url.searchParams.get("token");
    const instanceId = url.searchParams.get("instanceId");
    if (!token || !instanceId) throw new Error("missing token or instanceId");
    const payload = verifyToken(token);
    const user = db.prepare("SELECT id, email, role, created_at FROM users WHERE id = ?").get(payload.sub);
    if (!user) throw new Error("invalid user");
    const instance = getInstance(instanceId, user);
    if (!instance || instance.status !== "running") throw new Error("instance is not running");

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request, { user, instance });
    });
  } catch {
    socket.write("HTTP/1.1 401 Unauthorized\r\n\r\n");
    socket.destroy();
  }
});

wss.on("connection", (ws, request, { user, instance }) => {
  const shell = process.env.SHELL || "/bin/sh";
  let commandBuffer = "";
  const startedAt = now();
  writeAudit(user.id, instance.id, "terminal.start", { shell });
  writeInstanceLog(instance.id, "info", "terminal", "终端会话已开始", { userId: user.id });

  const sendOutput = (data) => {
    if (ws.readyState === ws.OPEN) ws.send(JSON.stringify({ type: "output", data: String(data) }));
  };

  let child = null;
  let ptyProcess = null;
  try {
    ptyProcess = pty.spawn(shell, ["-i"], {
      name: "xterm-256color",
      cols: 100,
      rows: 28,
      cwd: instance.workspace_path,
      env: {
        ...process.env,
        TERM: "xterm-256color",
        OPENASST_INSTANCE_ID: instance.id,
        OPENASST_WORKSPACE: instance.workspace_path
      }
    });
    ptyProcess.onData(sendOutput);
    ptyProcess.onExit(({ exitCode }) => {
      sendOutput(`\r\n[terminal exited: ${exitCode ?? 0}]\r\n`);
      ws.close();
    });
    sendOutput(`OpenAsstAI terminal connected to ${instance.name}\r\nWorkspace: ${instance.workspace_path}\r\n`);
  } catch (error) {
    child = spawn(shell, ["-i"], {
      cwd: instance.workspace_path,
      env: {
        ...process.env,
        TERM: "xterm-256color",
        OPENASST_INSTANCE_ID: instance.id,
        OPENASST_WORKSPACE: instance.workspace_path
      },
      stdio: ["pipe", "pipe", "pipe"]
    });
    child.stdout.on("data", (chunk) => sendOutput(chunk.toString()));
    child.stderr.on("data", (chunk) => sendOutput(chunk.toString()));
    child.on("close", (code) => {
      sendOutput(`\r\n[terminal exited: ${code ?? 0}]\r\n`);
      ws.close();
    });
    sendOutput(`OpenAsstAI terminal fallback connected to ${instance.name}\r\nWorkspace: ${instance.workspace_path}\r\n$ `);
    writeInstanceLog(instance.id, "warn", "terminal", "PTY 启动失败，已降级为普通 shell 管道", {
      error: error.message
    });
  }

  ws.on("message", (raw) => {
    let message;
    try {
      message = JSON.parse(raw.toString());
    } catch {
      message = { type: "input", data: raw.toString() };
    }
    if (message.type === "resize") {
      if (ptyProcess) {
        const cols = Math.max(20, Math.min(240, Number(message.cols) || 100));
        const rows = Math.max(8, Math.min(80, Number(message.rows) || 28));
        ptyProcess.resize(cols, rows);
      }
      return;
    }
    if (message.type !== "input") return;
    const data = String(message.data || "");
    if (ptyProcess) ptyProcess.write(data);
    else child?.stdin.write(data);

    for (const char of data) {
      if (char === "\r" || char === "\n") {
        const command = commandBuffer.trim();
        commandBuffer = "";
        if (command) {
          writeAudit(user.id, instance.id, "terminal.command", {
            command: command.slice(0, 240)
          });
        }
      } else if (char === "\u007f") {
        commandBuffer = commandBuffer.slice(0, -1);
      } else {
        commandBuffer += char;
      }
    }
  });

  ws.on("close", () => {
    if (ptyProcess) ptyProcess.kill();
    else child?.kill("SIGHUP");
    writeAudit(user.id, instance.id, "terminal.end", { startedAt, endedAt: now() });
    writeInstanceLog(instance.id, "info", "terminal", "终端会话已结束", { userId: user.id });
  });
});

export function startServer() {
  return server.listen(config.port, config.host, () => {
    console.log(`OpenAsstAI API listening on http://${config.host}:${config.port}`);
  });
}

export { app, server };

if (isMainModule) {
  startServer();
}
