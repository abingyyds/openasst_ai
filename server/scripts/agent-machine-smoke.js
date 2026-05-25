import assert from "node:assert/strict";
import { server } from "../index.js";
import { createId, db, now } from "../db.js";
import { signToken } from "../security.js";

const port = Number(process.env.AM_SMOKE_PORT || 4400 + Math.floor(Math.random() * 1000));
const baseUrl = `http://127.0.0.1:${port}`;

function listen() {
  return new Promise((resolve, reject) => {
    const listener = server.listen(port, "127.0.0.1", () => resolve(listener));
    listener.on("error", reject);
  });
}

function close(listener) {
  return new Promise((resolve, reject) => {
    listener.close((error) => (error ? reject(error) : resolve()));
  });
}

async function api(path, { token, method = "GET", body } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  let payload = {};
  try { payload = text ? JSON.parse(text) : {}; } catch {}
  if (!response.ok) throw new Error(`${method} ${path} → ${response.status}: ${text}`);
  return payload;
}

const listener = await listen();

try {
  const suffix = `${Date.now()}_${Math.random().toString(16).slice(2)}`;

  // Create provider user
  const providerUser = { id: createId("usr"), email: `amprov_${suffix}@test.com`, role: "user", created_at: now() };
  await db.run("INSERT INTO users (id, email, password_hash, role, created_at) VALUES (?, ?, 'x', ?, ?)",
    providerUser.id, providerUser.email, providerUser.role, providerUser.created_at);
  const providerToken = signToken(providerUser);

  // Create renter user
  const renterUser = { id: createId("usr"), email: `amrent_${suffix}@test.com`, role: "user", created_at: now() };
  await db.run("INSERT INTO users (id, email, password_hash, role, created_at) VALUES (?, ?, 'x', ?, ?)",
    renterUser.id, renterUser.email, renterUser.role, renterUser.created_at);
  const renterToken = signToken(renterUser);

  const admin = await db.get("SELECT id, email, role, created_at FROM users WHERE id = 'usr_admin'");
  const adminToken = signToken(admin);

  // 1. Provider applies and gets approved
  const { profile } = await api("/api/provider/apply", {
    token: providerToken, method: "POST",
    body: { displayName: `AM Provider ${suffix}`, contact: providerUser.email, payoutNote: "smoke" }
  });
  assert.equal(profile.status, "pending");
  await api(`/api/admin/providers/${profile.id}`, {
    token: adminToken, method: "PATCH", body: { status: "approved", platformFeePercent: 15 }
  });

  // 2. Register machine
  const { machine } = await api("/api/machines", {
    token: providerToken, method: "POST",
    body: { name: `Smoke Machine ${suffix}`, os: "linux", cpu: 4, memoryMb: 8192, diskGb: 100, installedAgents: ["echo-agent"] }
  });
  assert.ok(machine.id);
  assert.equal(machine.connector_status, "pending");

  // 3. Run capability check
  const { check } = await api(`/api/machines/${machine.id}/capability-check`, { token: providerToken, method: "POST" });
  assert.equal(check.status, "passed");

  // 4. List machines
  const { machines } = await api("/api/machines", { token: providerToken });
  assert.ok(machines.find(m => m.id === machine.id && m.connector_status === "verified"));

  // 5. Create listing
  const { listing } = await api("/api/listings", {
    token: providerToken, method: "POST",
    body: { machineId: machine.id, title: `Echo Agent Session ${suffix}`, agentType: "echo-agent", accessMode: "chat" }
  });
  assert.ok(listing.id);
  assert.equal(listing.status, "active");

  // 6. Browse listings (public)
  const { listings } = await api("/api/listings");
  assert.ok(listings.find(l => l.id === listing.id));

  // 7. Rent access grant
  const { grant } = await api("/api/grants", {
    token: renterToken, method: "POST",
    body: { listingId: listing.id, apiKey: "sk-test-key-12345" }
  });
  assert.ok(grant.id);
  assert.equal(grant.status, "active");
  assert.ok(grant.expires_at);

  // 8. Start session
  const { session } = await api("/api/sessions", {
    token: renterToken, method: "POST",
    body: { grantId: grant.id }
  });
  assert.ok(session.id);
  assert.equal(session.status, "active");

  // 9. Chat with agent
  const { message } = await api(`/api/sessions/${session.id}/chat`, {
    token: renterToken, method: "POST",
    body: { message: "hello from smoke test" }
  });
  assert.ok(message.content.includes("hello from smoke test"), `Expected echo, got: ${message.content}`);

  // 10. Get messages
  const { messages } = await api(`/api/sessions/${session.id}/messages`, { token: renterToken });
  assert.ok(messages.length >= 2);

  // 11. Get logs
  const { logs } = await api(`/api/sessions/${session.id}/logs`, { token: renterToken });
  assert.ok(Array.isArray(logs));

  // 12. Stop session
  const { session: stopped } = await api(`/api/sessions/${session.id}/stop`, { token: renterToken, method: "POST" });
  assert.equal(stopped.status, "stopped");

  // 13. Verify grant still active (not auto-revoked yet)
  const { grants } = await api("/api/grants", { token: renterToken });
  assert.ok(grants.find(g => g.id === grant.id));

  // 14. Revoke grant
  const { grant: revoked } = await api(`/api/grants/${grant.id}/revoke`, { token: renterToken, method: "POST" });
  assert.equal(revoked.status, "revoked");

  console.log(JSON.stringify({ ok: true, machineId: machine.id, listingId: listing.id, grantId: grant.id, sessionId: session.id }, null, 2));
} finally {
  await close(listener);
  await db.close();
}
