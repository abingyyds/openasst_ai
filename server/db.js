import { DatabaseSync } from "node:sqlite";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import { config } from "./config.js";

fs.mkdirSync(path.dirname(config.databasePath), { recursive: true });

export const db = new DatabaseSync(config.databasePath);
db.exec("PRAGMA foreign_keys = ON");
db.exec("PRAGMA journal_mode = WAL");

export function now() {
  return new Date().toISOString();
}

export function createId(prefix) {
  return `${prefix}_${crypto.randomUUID().replaceAll("-", "").slice(0, 14)}`;
}

export function toJson(value) {
  return JSON.stringify(value ?? {});
}

export function fromJson(value, fallback = {}) {
  if (value === null || value === undefined || value === "") return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function tableSql(name) {
  return db.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = ?").get(name)?.sql || "";
}

function tableColumns(name) {
  return new Set(db.prepare(`PRAGMA table_info(${name})`).all().map((column) => column.name));
}

function rebuildNodesTableForProviders() {
  const sql = tableSql("nodes");
  if (!sql) return;

  const columns = tableColumns("nodes");
  const needsRebuild =
    !sql.includes("'provider'") ||
    !columns.has("provider_profile_id") ||
    !columns.has("agent_token_hash") ||
    !columns.has("created_at");

  if (!needsRebuild) return;

  const stamp = now();
  const expr = (column, fallback) => (columns.has(column) ? column : fallback);

  try {
    db.exec("PRAGMA foreign_keys = OFF");
    db.exec("BEGIN");
    db.exec(`
      CREATE TABLE nodes_next (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL CHECK (type IN ('official', 'provider')),
        provider_profile_id TEXT REFERENCES provider_profiles(id) ON DELETE SET NULL,
        region TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('healthy', 'degraded', 'offline')),
        total_cpu REAL NOT NULL,
        total_memory_mb INTEGER NOT NULL,
        total_disk_gb INTEGER NOT NULL,
        available_cpu REAL NOT NULL,
        available_memory_mb INTEGER NOT NULL,
        available_disk_gb INTEGER NOT NULL,
        price_per_hour_cents INTEGER,
        platform_fee_percent REAL,
        public_host TEXT,
        docker_status TEXT NOT NULL DEFAULT 'unknown',
        agent_version TEXT,
        agent_token_hash TEXT UNIQUE,
        metadata_json TEXT NOT NULL DEFAULT '{}',
        last_heartbeat_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `);
    db.exec(`
      INSERT INTO nodes_next (
        id, name, type, provider_profile_id, region, status,
        total_cpu, total_memory_mb, total_disk_gb,
        available_cpu, available_memory_mb, available_disk_gb,
        price_per_hour_cents, platform_fee_percent, public_host,
        docker_status, agent_version, agent_token_hash, metadata_json,
        last_heartbeat_at, created_at, updated_at
      )
      SELECT
        id,
        name,
        CASE WHEN type = 'provider' THEN 'provider' ELSE 'official' END,
        ${expr("provider_profile_id", "NULL")},
        region,
        status,
        total_cpu,
        total_memory_mb,
        total_disk_gb,
        available_cpu,
        available_memory_mb,
        available_disk_gb,
        ${expr("price_per_hour_cents", "NULL")},
        ${expr("platform_fee_percent", "NULL")},
        ${expr("public_host", "NULL")},
        ${expr("docker_status", "'unknown'")},
        ${expr("agent_version", "NULL")},
        ${expr("agent_token_hash", "NULL")},
        ${expr("metadata_json", "'{}'")},
        last_heartbeat_at,
        ${expr("created_at", `COALESCE(last_heartbeat_at, '${stamp}')`)},
        ${expr("updated_at", `COALESCE(last_heartbeat_at, '${stamp}')`)}
      FROM nodes;
    `);
    db.exec("DROP TABLE nodes");
    db.exec("ALTER TABLE nodes_next RENAME TO nodes");
    db.exec("COMMIT");
  } catch (error) {
    try {
      db.exec("ROLLBACK");
    } catch {
      // Ignore rollback failure and surface the original migration error.
    }
    throw error;
  } finally {
    db.exec("PRAGMA foreign_keys = ON");
  }
}

function migrateAgentTemplateInstallMetadata() {
  const columns = tableColumns("agent_templates");
  if (!columns.size) return;

  const additions = [
    ["install_method", "TEXT NOT NULL DEFAULT 'local-sandbox adapter'"],
    ["runtime_kind", "TEXT NOT NULL DEFAULT 'local-sandbox'"],
    ["install_command", "TEXT NOT NULL DEFAULT ''"],
    ["start_command", "TEXT NOT NULL DEFAULT ''"],
    ["health_check", "TEXT NOT NULL DEFAULT ''"],
    ["config_hints_json", "TEXT NOT NULL DEFAULT '[]'"]
  ];

  for (const [name, definition] of additions) {
    if (!columns.has(name)) {
      db.exec(`ALTER TABLE agent_templates ADD COLUMN ${name} ${definition}`);
    }
  }
}

function migrateAgentTemplateProviderOwnership() {
  const columns = tableColumns("agent_templates");
  if (!columns.size || columns.has("provider_profile_id")) return;
  db.exec("ALTER TABLE agent_templates ADD COLUMN provider_profile_id TEXT REFERENCES provider_profiles(id) ON DELETE SET NULL");
}

export function runMigrations() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('user', 'admin')),
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS provider_profiles (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      display_name TEXT NOT NULL,
      contact TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('pending', 'approved', 'rejected', 'suspended')),
      platform_fee_percent REAL NOT NULL DEFAULT 20,
      payout_note TEXT,
      rejection_reason TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      reviewed_at TEXT,
      reviewed_by TEXT REFERENCES users(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS agent_templates (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      framework TEXT NOT NULL CHECK (framework IN ('hermes', 'openclaw', 'custom')),
      description TEXT NOT NULL,
      official INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL CHECK (status IN ('active', 'draft', 'archived')),
      base_price_cents INTEGER NOT NULL DEFAULT 0,
      provider_profile_id TEXT REFERENCES provider_profiles(id) ON DELETE SET NULL,
      default_model_provider TEXT NOT NULL,
      default_model TEXT NOT NULL,
      capabilities_json TEXT NOT NULL,
      default_channels_json TEXT NOT NULL,
      default_skills_json TEXT NOT NULL,
      install_method TEXT NOT NULL DEFAULT 'local-sandbox adapter',
      runtime_kind TEXT NOT NULL DEFAULT 'local-sandbox',
      install_command TEXT NOT NULL DEFAULT '',
      start_command TEXT NOT NULL DEFAULT '',
      health_check TEXT NOT NULL DEFAULT '',
      config_hints_json TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS price_plans (
      id TEXT PRIMARY KEY,
      template_id TEXT NOT NULL REFERENCES agent_templates(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      cpu REAL NOT NULL,
      memory_mb INTEGER NOT NULL,
      disk_gb INTEGER NOT NULL,
      region TEXT NOT NULL,
      price_per_hour_cents INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS nodes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('official', 'provider')),
      provider_profile_id TEXT REFERENCES provider_profiles(id) ON DELETE SET NULL,
      region TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('healthy', 'degraded', 'offline')),
      total_cpu REAL NOT NULL,
      total_memory_mb INTEGER NOT NULL,
      total_disk_gb INTEGER NOT NULL,
      available_cpu REAL NOT NULL,
      available_memory_mb INTEGER NOT NULL,
      available_disk_gb INTEGER NOT NULL,
      price_per_hour_cents INTEGER,
      platform_fee_percent REAL,
      public_host TEXT,
      docker_status TEXT NOT NULL DEFAULT 'unknown',
      agent_version TEXT,
      agent_token_hash TEXT UNIQUE,
      metadata_json TEXT NOT NULL DEFAULT '{}',
      last_heartbeat_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS instances (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      template_id TEXT NOT NULL REFERENCES agent_templates(id),
      node_id TEXT NOT NULL REFERENCES nodes(id),
      plan_id TEXT NOT NULL REFERENCES price_plans(id),
      name TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('provisioning', 'running', 'stopped', 'error', 'destroyed')),
      cpu REAL NOT NULL,
      memory_mb INTEGER NOT NULL,
      disk_gb INTEGER NOT NULL,
      region TEXT NOT NULL,
      workspace_path TEXT NOT NULL,
      started_at TEXT,
      stopped_at TEXT,
      destroyed_at TEXT,
      error_reason TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS model_configs (
      id TEXT PRIMARY KEY,
      instance_id TEXT NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      credential_ref TEXT,
      is_default INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS channel_configs (
      id TEXT PRIMARY KEY,
      instance_id TEXT NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('active', 'disabled', 'waitlist')),
      config_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(instance_id, type)
    );

    CREATE TABLE IF NOT EXISTS skills (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      slug TEXT NOT NULL UNIQUE,
      version TEXT NOT NULL,
      description TEXT NOT NULL,
      permissions_json TEXT NOT NULL,
      runtime_flags_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS skill_installs (
      id TEXT PRIMARY KEY,
      instance_id TEXT NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
      skill_id TEXT NOT NULL REFERENCES skills(id),
      version TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('enabled', 'disabled')),
      permissions_json TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(instance_id, skill_id)
    );

    CREATE TABLE IF NOT EXISTS usage_records (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      instance_id TEXT REFERENCES instances(id) ON DELETE SET NULL,
      type TEXT NOT NULL CHECK (type IN ('runtime', 'token', 'storage', 'network')),
      quantity REAL NOT NULL,
      unit TEXT NOT NULL,
      price_estimate_cents REAL NOT NULL DEFAULT 0,
      metadata_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      actor_id TEXT REFERENCES users(id) ON DELETE SET NULL,
      instance_id TEXT REFERENCES instances(id) ON DELETE SET NULL,
      action TEXT NOT NULL,
      metadata_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS instance_logs (
      id TEXT PRIMARY KEY,
      instance_id TEXT REFERENCES instances(id) ON DELETE CASCADE,
      level TEXT NOT NULL CHECK (level IN ('info', 'warn', 'error')),
      source TEXT NOT NULL,
      message TEXT NOT NULL,
      metadata_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      instance_id TEXT NOT NULL REFERENCES instances(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
      content TEXT NOT NULL,
      token_estimate INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS node_tasks (
      id TEXT PRIMARY KEY,
      node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
      instance_id TEXT REFERENCES instances(id) ON DELETE CASCADE,
      action TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('queued', 'running', 'succeeded', 'failed')),
      payload_json TEXT NOT NULL,
      result_json TEXT NOT NULL DEFAULT '{}',
      error_message TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      picked_at TEXT,
      completed_at TEXT
    );

    CREATE TABLE IF NOT EXISTS provider_ledger_entries (
      id TEXT PRIMARY KEY,
      provider_profile_id TEXT NOT NULL REFERENCES provider_profiles(id) ON DELETE CASCADE,
      node_id TEXT REFERENCES nodes(id) ON DELETE SET NULL,
      instance_id TEXT REFERENCES instances(id) ON DELETE SET NULL,
      type TEXT NOT NULL CHECK (type IN ('runtime', 'adjustment')),
      status TEXT NOT NULL CHECK (status IN ('pending', 'available', 'paid', 'void')),
      runtime_hours REAL NOT NULL DEFAULT 0,
      gross_cents REAL NOT NULL DEFAULT 0,
      platform_fee_cents REAL NOT NULL DEFAULT 0,
      provider_cents REAL NOT NULL DEFAULT 0,
      metadata_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  rebuildNodesTableForProviders();
  migrateAgentTemplateInstallMetadata();
  migrateAgentTemplateProviderOwnership();
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_nodes_provider_profile ON nodes(provider_profile_id);
    CREATE INDEX IF NOT EXISTS idx_node_tasks_node_status ON node_tasks(node_id, status, created_at);
    CREATE INDEX IF NOT EXISTS idx_provider_ledger_profile ON provider_ledger_entries(provider_profile_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_agent_templates_provider_profile ON agent_templates(provider_profile_id, created_at);
  `);
}

export function seedDefaults() {
  const stamp = now();
  if (!config.bootstrapAdminPassword) {
    throw new Error("BOOTSTRAP_ADMIN_PASSWORD must be set when NODE_ENV=production");
  }

  const syncSeedUser = ({ id, email, password, role }) => {
    const normalizedEmail = String(email || "").trim().toLowerCase();
    const passwordHash = bcrypt.hashSync(password, 10);
    const existingByEmail = db.prepare("SELECT id FROM users WHERE email = ?").get(normalizedEmail);

    if (existingByEmail) {
      db.prepare("UPDATE users SET password_hash = ?, role = ? WHERE id = ?")
        .run(passwordHash, role, existingByEmail.id);
      return;
    }

    const existingById = db.prepare("SELECT id FROM users WHERE id = ?").get(id);
    if (existingById) {
      db.prepare("UPDATE users SET email = ?, password_hash = ?, role = ? WHERE id = ?")
        .run(normalizedEmail, passwordHash, role, id);
      return;
    }

    db.prepare(`
      INSERT INTO users (id, email, password_hash, role, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, normalizedEmail, passwordHash, role, stamp);
  };

  if (config.seedDemoUser) {
    syncSeedUser({
      id: "usr_demo",
      email: config.demoEmail,
      password: config.demoPassword,
      role: "user"
    });
  }

  syncSeedUser({
    id: "usr_admin",
    email: config.bootstrapAdminEmail,
    password: config.bootstrapAdminPassword,
    role: "admin"
  });

  const templates = [
    {
      id: "tpl_hermes_research",
      name: "Hermes Research Agent",
      framework: "hermes",
      description: "Built for always-on research, source gathering, document organization, and light automation.",
      basePrice: 18,
      provider: "openai",
      model: "gpt-4.1-mini",
      installMethod: "local-sandbox adapter",
      runtimeKind: "local-sandbox",
      installCommand: "npm run agent:hermes -- --workspace <instance-workspace>",
      startCommand: "npm run agent:start -- --template hermes",
      healthCheck: "workspace exists, model config present, web chat channel active",
      configHints: [
        "Start with Web Chat, then add external channels when adapters are ready",
        "Best for long-running document Q&A and research workflows",
        "Supports external model providers and user-provided API keys"
      ],
      capabilities: {
        models: ["OpenAI", "Anthropic", "OpenRouter"],
        channels: ["Web Chat", "WeChat", "QQ", "Feishu"],
        skills: ["web-search", "file-manager", "scheduler"]
      },
      channels: ["web_chat", "wechat", "qq", "feishu"],
      skills: ["file-manager", "scheduler"]
    },
    {
      id: "tpl_openclaw_ops",
      name: "OpenClaw Ops Agent",
      framework: "openclaw",
      description: "An operations-focused agent for troubleshooting, log review, and command-line workflows.",
      basePrice: 28,
      provider: "openai",
      model: "gpt-4.1",
      installMethod: "local-sandbox adapter",
      runtimeKind: "local-sandbox",
      installCommand: "npm run agent:ops -- --workspace <instance-workspace>",
      startCommand: "npm run agent:start -- --template openclaw",
      healthCheck: "workspace exists, terminal helper installed, log channel enabled",
      configHints: [
        "Best for command-line diagnosis, log summaries, and quick operational tasks",
        "Web Chat is available; Feishu is the first external-channel placeholder",
        "Terminal and Logs are the primary operating surfaces"
      ],
      capabilities: {
        models: ["OpenAI", "Azure OpenAI", "OpenRouter"],
        channels: ["Web Chat", "Feishu"],
        skills: ["terminal-helper", "log-reader", "file-manager"]
      },
      channels: ["web_chat", "feishu"],
      skills: ["terminal-helper", "log-reader"]
    }
  ];

  const insertTemplate = db.prepare(`
    INSERT OR IGNORE INTO agent_templates (
      id, name, framework, description, official, status, base_price_cents, provider_profile_id,
      default_model_provider, default_model, capabilities_json,
      default_channels_json, default_skills_json, install_method, runtime_kind,
      install_command, start_command, health_check, config_hints_json,
      created_at, updated_at
    )
    VALUES (?, ?, ?, ?, 1, 'active', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  const updateTemplateInstallMetadata = db.prepare(`
    UPDATE agent_templates
    SET description = ?,
        install_method = ?,
        runtime_kind = ?,
        install_command = ?,
        start_command = ?,
        health_check = ?,
        config_hints_json = ?,
        capabilities_json = ?,
        default_channels_json = ?,
        default_skills_json = ?,
        updated_at = ?
    WHERE id = ?
  `);

  for (const template of templates) {
    insertTemplate.run(
      template.id,
      template.name,
      template.framework,
      template.description,
      template.basePrice,
      null,
      template.provider,
      template.model,
      toJson(template.capabilities),
      toJson(template.channels),
      toJson(template.skills),
      template.installMethod,
      template.runtimeKind,
      template.installCommand,
      template.startCommand,
      template.healthCheck,
      toJson(template.configHints),
      stamp,
      stamp
    );
    updateTemplateInstallMetadata.run(
      template.description,
      template.installMethod,
      template.runtimeKind,
      template.installCommand,
      template.startCommand,
      template.healthCheck,
      toJson(template.configHints),
      toJson(template.capabilities),
      toJson(template.channels),
      toJson(template.skills),
      stamp,
      template.id
    );
  }

  const insertPlan = db.prepare(`
    INSERT OR IGNORE INTO price_plans (
      id, template_id, name, cpu, memory_mb, disk_gb, region, price_per_hour_cents, created_at
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertPlan.run("plan_hermes_starter", "tpl_hermes_research", "Starter", 1, 1024, 10, "cn-shanghai", 18, stamp);
  insertPlan.run("plan_hermes_plus", "tpl_hermes_research", "Plus", 2, 2048, 20, "cn-shanghai", 34, stamp);
  insertPlan.run("plan_ops_starter", "tpl_openclaw_ops", "Starter", 1, 1536, 15, "cn-shanghai", 28, stamp);
  insertPlan.run("plan_ops_plus", "tpl_openclaw_ops", "Plus", 2, 4096, 30, "sg-singapore", 52, stamp);

  db.prepare(`
    INSERT OR IGNORE INTO nodes (
      id, name, type, region, status, total_cpu, total_memory_mb, total_disk_gb,
      available_cpu, available_memory_mb, available_disk_gb, last_heartbeat_at, created_at, updated_at
    )
    VALUES (?, ?, 'official', ?, 'healthy', ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run("node_shanghai_1", "Official Shanghai 1", "cn-shanghai", 16, 32768, 500, 16, 32768, 500, stamp, stamp, stamp);

  db.prepare(`
    INSERT OR IGNORE INTO nodes (
      id, name, type, region, status, total_cpu, total_memory_mb, total_disk_gb,
      available_cpu, available_memory_mb, available_disk_gb, last_heartbeat_at, created_at, updated_at
    )
    VALUES (?, ?, 'official', ?, 'healthy', ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run("node_singapore_1", "Official Singapore 1", "sg-singapore", 12, 24576, 400, 12, 24576, 400, stamp, stamp, stamp);

  const insertSkill = db.prepare(`
    INSERT OR IGNORE INTO skills (
      id, name, slug, version, description, permissions_json, runtime_flags_json
    )
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const updateSkill = db.prepare(`
    UPDATE skills
    SET name = ?,
        version = ?,
        description = ?,
        permissions_json = ?,
        runtime_flags_json = ?
    WHERE id = ?
  `);

  const skills = [
    {
      id: "sk_file_manager",
      name: "File Manager",
      slug: "file-manager",
      version: "1.0.0",
      description: "Read, organize, and write files inside the instance workspace.",
      permissions: ["workspace:read", "workspace:write"],
      flags: { mountsWorkspace: true }
    },
    {
      id: "sk_scheduler",
      name: "Scheduler",
      slug: "scheduler",
      version: "1.0.0",
      description: "Store lightweight scheduled tasks and reminders inside the instance.",
      permissions: ["tasks:write"],
      flags: { backgroundTasks: true }
    },
    {
      id: "sk_terminal_helper",
      name: "Terminal Helper",
      slug: "terminal-helper",
      version: "1.0.0",
      description: "Provide explanations, summaries, and safety notes for command-line work.",
      permissions: ["terminal:read"],
      flags: { terminalContext: true }
    },
    {
      id: "sk_log_reader",
      name: "Log Reader",
      slug: "log-reader",
      version: "1.0.0",
      description: "Read instance logs and generate troubleshooting summaries.",
      permissions: ["logs:read"],
      flags: { logAccess: true }
    }
  ];

  for (const skill of skills) {
    insertSkill.run(
      skill.id,
      skill.name,
      skill.slug,
      skill.version,
      skill.description,
      toJson(skill.permissions),
      toJson(skill.flags)
    );
    updateSkill.run(
      skill.name,
      skill.version,
      skill.description,
      toJson(skill.permissions),
      toJson(skill.flags),
      skill.id
    );
  }
}

export function initDatabase() {
  runMigrations();
  seedDefaults();
}
