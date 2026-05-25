import assert from "node:assert/strict";
import { app } from "../index.js";
import { db, fromJson } from "../db.js";
import { config } from "../config.js";
import { verifyPassword } from "../security.js";

const stack = app.router?.stack || app._router?.stack || [];

function hasRoute(method, path) {
  return stack.some((layer) => layer.route?.path === path && layer.route?.methods?.[method]);
}

const requiredRoutes = [
  ["get", "/api/health"],
  ["get", "/install-node.sh"],
  ["post", "/api/auth/login"],
  ["get", "/api/templates"],
  ["post", "/api/instances"],
  ["get", "/api/instances/:id/setup"],
  ["get", "/api/provider/profile"],
  ["post", "/api/provider/apply"],
  ["post", "/api/provider/nodes"],
  ["get", "/api/provider/nodes/install.sh"],
  ["post", "/api/provider/nodes/:id/rotate-token"],
  ["get", "/api/provider/templates"],
  ["post", "/api/provider/templates"],
  ["patch", "/api/provider/templates/:id"],
  ["post", "/api/node/register"],
  ["post", "/api/node/heartbeat"],
  ["get", "/api/node/tasks/poll"],
  ["post", "/api/node/tasks/:taskId/complete"],
  ["get", "/api/instances/:id/chat"],
  ["post", "/api/instances/:id/chat"],
  ["get", "/api/admin/nodes"],
  ["get", "/api/admin/providers"],
  ["patch", "/api/admin/providers/:id"]
];

for (const [method, path] of requiredRoutes) {
  assert.equal(hasRoute(method, path), true, `missing route ${method.toUpperCase()} ${path}`);
}

const users = db.prepare("SELECT email, password_hash, role FROM users ORDER BY role, email").all();
const demoUser = users.find((user) => user.email === config.demoEmail.toLowerCase());
const adminUser = users.find((user) => user.email === config.bootstrapAdminEmail.toLowerCase());
assert.ok(demoUser && demoUser.role === "user", "missing demo user");
assert.ok(adminUser && adminUser.role === "admin", "missing admin user");
assert.equal(verifyPassword(config.demoPassword, demoUser.password_hash), true, "demo password does not match seed config");
assert.equal(verifyPassword(config.bootstrapAdminPassword, adminUser.password_hash), true, "admin password does not match seed config");

const templates = db.prepare(`
  SELECT id, install_method, runtime_kind, install_command, start_command, health_check, config_hints_json
  FROM agent_templates
  WHERE status = 'active'
  ORDER BY id
`).all();
assert.ok(templates.length >= 2, "expected at least two active templates");

for (const template of templates.filter((row) => row.id === "tpl_hermes_research" || row.id === "tpl_openclaw_ops")) {
  assert.ok(template.install_method, `${template.id} missing install method`);
  assert.ok(template.runtime_kind, `${template.id} missing runtime kind`);
  assert.ok(template.install_command, `${template.id} missing install command`);
  assert.ok(template.start_command, `${template.id} missing start command`);
  assert.ok(template.health_check, `${template.id} missing health check`);
  assert.ok(fromJson(template.config_hints_json, []).length > 0, `${template.id} missing config hints`);
}

const providerTables = ["provider_profiles", "node_tasks", "provider_ledger_entries"];
for (const table of providerTables) {
  const exists = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(table);
  assert.ok(exists, `missing table ${table}`);
}

const nodeColumns = new Set(db.prepare("PRAGMA table_info(nodes)").all().map((column) => column.name));
for (const column of ["provider_profile_id", "agent_token_hash", "docker_status", "price_per_hour_cents"]) {
  assert.ok(nodeColumns.has(column), `nodes missing column ${column}`);
}

console.log("Smoke checks passed.");
