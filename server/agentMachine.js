import { spawn } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { createId, db, now, toJson, fromJson } from "./db.js";
import { encryptSecret, secretPreview } from "./security.js";
import { config } from "./config.js";

const activeSessions = new Map();

export async function migrateAgentMachineTables() {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS provider_machines (
      id TEXT PRIMARY KEY,
      provider_profile_id TEXT NOT NULL REFERENCES provider_profiles(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      os TEXT NOT NULL DEFAULT 'linux',
      cpu REAL NOT NULL DEFAULT 0,
      memory_mb INTEGER NOT NULL DEFAULT 0,
      disk_gb INTEGER NOT NULL DEFAULT 0,
      gpu TEXT,
      installed_agents_json TEXT NOT NULL DEFAULT '[]',
      access_modes_json TEXT NOT NULL DEFAULT '["chat"]',
      connector_status TEXT NOT NULL DEFAULT 'pending' CHECK (connector_status IN ('pending','connected','verified','offline')),
      connector_token_hash TEXT,
      last_seen_at TEXT,
      metadata_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS capability_checks (
      id TEXT PRIMARY KEY,
      machine_id TEXT NOT NULL REFERENCES provider_machines(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','running','passed','failed')),
      result_json TEXT NOT NULL DEFAULT '{}',
      started_at TEXT,
      completed_at TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS machine_listings (
      id TEXT PRIMARY KEY,
      machine_id TEXT NOT NULL REFERENCES provider_machines(id) ON DELETE CASCADE,
      provider_profile_id TEXT NOT NULL REFERENCES provider_profiles(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      agent_type TEXT NOT NULL DEFAULT 'echo-agent',
      access_mode TEXT NOT NULL DEFAULT 'chat' CHECK (access_mode IN ('chat','terminal','full')),
      isolation_mode TEXT NOT NULL DEFAULT 'trusted' CHECK (isolation_mode IN ('trusted','container','vm')),
      concurrency_limit INTEGER NOT NULL DEFAULT 1,
      price_per_hour_cents INTEGER NOT NULL DEFAULT 0,
      billing_unit TEXT NOT NULL DEFAULT 'session',
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('draft','active','paused','archived')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS access_grants (
      id TEXT PRIMARY KEY,
      listing_id TEXT NOT NULL REFERENCES machine_listings(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','revoked')),
      api_key_encrypted TEXT,
      expires_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS agent_sessions (
      id TEXT PRIMARY KEY,
      grant_id TEXT NOT NULL REFERENCES access_grants(id) ON DELETE CASCADE,
      machine_id TEXT NOT NULL REFERENCES provider_machines(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'starting' CHECK (status IN ('starting','active','stopping','stopped','error')),
      agent_type TEXT NOT NULL,
      pid INTEGER,
      workspace_path TEXT,
      logs_json TEXT NOT NULL DEFAULT '[]',
      started_at TEXT,
      stopped_at TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS agent_session_messages (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL REFERENCES agent_sessions(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK (role IN ('user','assistant','system')),
      content TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
  `);

  await db.exec(`
    CREATE INDEX IF NOT EXISTS idx_provider_machines_provider ON provider_machines(provider_profile_id);
    CREATE INDEX IF NOT EXISTS idx_machine_listings_machine ON machine_listings(machine_id);
    CREATE INDEX IF NOT EXISTS idx_access_grants_user ON access_grants(user_id, status);
    CREATE INDEX IF NOT EXISTS idx_agent_sessions_grant ON agent_sessions(grant_id);
    CREATE INDEX IF NOT EXISTS idx_agent_session_messages_session ON agent_session_messages(session_id, created_at);
  `);
}

export function startAgentProcess(session, listing) {
  const workDir = path.join(config.runtimeWorkspaceDir, `session_${session.id}`);
  fs.mkdirSync(workDir, { recursive: true });
  fs.mkdirSync(path.join(workDir, "logs"), { recursive: true });

  const agentType = listing.agent_type || "echo-agent";
  let child;

  if (agentType === "echo-agent") {
    const script = path.join(workDir, "echo-agent.mjs");
    fs.writeFileSync(script, `
process.stdin.setEncoding("utf8");
let buf = "";
process.stdin.on("data", c => { buf += c; });
process.stdin.on("end", () => {
  const req = JSON.parse(buf || "{}");
  process.stdout.write("Echo agent reply: " + (req.message || "(empty)"));
});
process.stdin.resume();
`, "utf8");
    child = spawn("node", [script], { cwd: workDir, stdio: ["pipe", "pipe", "pipe"] });
  } else {
    child = spawn("echo", [`Agent ${agentType} not implemented`], { cwd: workDir, stdio: ["pipe", "pipe", "pipe"] });
  }

  const entry = { child, workDir, agentType, logs: [] };

  const captureLog = (stream, label) => {
    stream.on("data", (chunk) => {
      const line = chunk.toString();
      entry.logs.push({ t: Date.now(), src: label, msg: line });
      if (entry.logs.length > 500) entry.logs.shift();
    });
  };
  if (child.stdout) captureLog(child.stdout, "stdout");
  if (child.stderr) captureLog(child.stderr, "stderr");

  child.on("exit", (code) => {
    entry.exitCode = code;
  });

  activeSessions.set(session.id, entry);
  return { pid: child.pid, workDir };
}

export async function sendMessageToSession(sessionId, message) {
  const entry = activeSessions.get(sessionId);
  if (!entry) {
    return "Echo agent (offline): " + message;
  }

  const agentType = entry.agentType;
  if (agentType === "echo-agent") {
    const script = path.join(entry.workDir, "echo-agent.mjs");
    return new Promise((resolve) => {
      const child = spawn("node", [script], { cwd: entry.workDir, stdio: ["pipe", "pipe", "pipe"] });
      let out = "";
      child.stdout.on("data", (c) => { out += c.toString(); });
      child.on("close", () => resolve(out || "Echo agent: " + message));
      child.stdin.write(JSON.stringify({ message }));
      child.stdin.end();
      setTimeout(() => { try { child.kill(); } catch {} resolve("Echo agent timeout: " + message); }, 5000);
    });
  }

  return `Agent ${agentType} reply: ${message}`;
}

export function stopAgentSession(sessionId) {
  const entry = activeSessions.get(sessionId);
  if (entry?.child && !entry.child.killed) {
    entry.child.kill("SIGTERM");
  }
  activeSessions.delete(sessionId);
}

export function getSessionLogs(sessionId) {
  const entry = activeSessions.get(sessionId);
  return entry?.logs || [];
}

export function isSessionAlive(sessionId) {
  const entry = activeSessions.get(sessionId);
  return entry && !entry.child.killed && entry.exitCode === undefined;
}
