import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { server } from "../index.js";
import { createId, db, now } from "../db.js";
import { signToken } from "../security.js";

const port = Number(process.env.PHASE1_SMOKE_PORT || 4300 + Math.floor(Math.random() * 1000));
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

async function api(path, { token, nodeToken, method = "GET", body } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (nodeToken) headers["X-Node-Token"] = nodeToken;

  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  let payload = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = {};
  }
  if (!response.ok) {
    throw new Error(`${method} ${path} failed with ${response.status}: ${text}`);
  }
  return { status: response.status, payload, payloadRaw: text };
}

const listener = await listen();

try {
  const suffix = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const user = {
    id: createId("usr"),
    email: `phase1_${suffix}@example.com`,
    role: "user",
    created_at: now()
  };
  await db.run("INSERT INTO users (id, email, password_hash, role, created_at) VALUES (?, ?, 'phase1-smoke', ?, ?)",
    user.id,
    user.email,
    user.role,
    user.created_at
  );

  const admin = await db.get("SELECT id, email, role, created_at FROM users WHERE id = 'usr_admin'");
  assert.ok(admin, "missing seeded admin user");

  const userToken = signToken(user);
  const adminToken = signToken(admin);

  const provider = (await api("/api/provider/apply", {
    token: userToken,
    method: "POST",
    body: { displayName: `Phase1 Provider ${suffix}`, contact: user.email, payoutNote: "automated phase1 smoke" }
  })).payload.profile;
  assert.equal(provider.status, "pending");

  const approvedProvider = (await api(`/api/admin/providers/${provider.id}`, {
    token: adminToken,
    method: "PATCH",
    body: { status: "approved", platformFeePercent: 20 }
  })).payload.provider;
  assert.equal(approvedProvider.status, "approved");

  const nodeResponse = (await api("/api/provider/nodes", {
    token: userToken,
    method: "POST",
    body: {
      name: `Phase1 Node ${suffix}`,
      region: "cn-shanghai",
      totalCpu: 8,
      totalMemoryMb: 16384,
      totalDiskGb: 200,
      pricePerHourCents: 18
    }
  })).payload;
  const nodeToken = nodeResponse.token;
  assert.ok(nodeToken, "provider node creation did not return an agent token");
  assert.match(nodeResponse.installCommand, /\/api\/provider\/nodes\/install\.sh\b/, "provider install command should fetch the real install.sh route");
  assert.match(nodeResponse.installCommand, new RegExp(`--token\\s+${nodeToken.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}`), "provider install command should pass the node token to the installer");
  assert.equal(nodeResponse.installScriptUrl.endsWith("/api/provider/nodes/install.sh"), true, "provider install script URL should match the served route");
  const installScript = (await api(`/api/provider/nodes/install.sh?token=${encodeURIComponent(nodeToken)}`)).payloadRaw;
  assert.match(installScript, /^#!\/bin\/sh\n/, "provider installer route should serve a shell script");
  assert.match(installScript, /post\('\/api\/node\/register'/, "installer should register the node, not just print setup instructions");
  assert.match(installScript, /get\('\/api\/node\/tasks\/poll'\)/, "installed node agent should poll for tasks");
  assert.match(installScript, /complete\(task\['id'\], True, result\)/, "installed node agent should complete tasks back to the orchestrator");
  assert.match(installScript, /OPENASST_CHAT_COMMAND/, "installed node agent should route chat to a provider-configured runtime command instead of a fake echo");
  assert.doesNotMatch(installScript, /Provider runtime completed a chat turn/, "installed node agent should not fabricate successful assistant replies");

  // Keep this smoke hermetic on long-running verification DBs that may contain
  // healthy provider nodes from prior cron ticks; the assertion below verifies
  // this newly published node is the one that receives the provision/chat tasks.
  await db.run("UPDATE nodes SET status = 'offline', updated_at = ? WHERE type = 'provider' AND id != ?",
    now(),
    nodeResponse.node.id
  );

  const registeredNode = (await api("/api/node/register", {
    nodeToken,
    method: "POST",
    body: {
      hostname: `phase1-${suffix}`,
      totalCpu: 8,
      totalMemoryMb: 16384,
      totalDiskGb: 200,
      dockerStatus: "ready",
      agentVersion: "phase1-smoke"
    }
  })).payload.node;
  assert.equal(registeredNode.status, "healthy");

  await api("/api/node/heartbeat", {
    nodeToken,
    method: "POST",
    body: { status: "healthy", dockerStatus: "ready", availableCpu: 8, availableMemoryMb: 16384, availableDiskGb: 200 }
  });

  const providerTemplate = (await api("/api/provider/templates", {
    token: userToken,
    method: "POST",
    body: {
      name: `Phase1 Published Agent ${suffix}`,
      framework: "custom",
      description: "Provider-published agent used by the phase1 smoke to verify marketplace purchase and runtime dispatch.",
      status: "active",
      basePriceCents: 0,
      defaultModelProvider: "openai",
      defaultModel: "gpt-4.1-mini",
      defaultChannels: ["web_chat"],
      defaultSkills: [],
      installMethod: "provider-managed",
      runtimeKind: "provider-node",
      planName: "Phase1 Starter",
      cpu: 1,
      memoryMb: 1024,
      diskGb: 10,
      region: "cn-shanghai",
      pricePerHourCents: 18
    }
  })).payload.template;
  assert.equal(providerTemplate.status, "active");
  assert.equal(providerTemplate.providerProfileId, provider.id);
  assert.ok(providerTemplate.plans?.[0], "provider-published template has no purchasable plan");

  const templates = (await api("/api/templates", { token: userToken })).payload.templates;
  const template = templates.find((row) => row.id === providerTemplate.id);
  assert.ok(template, "active provider-published template was not visible in marketplace");
  assert.equal(template.providerProfileId, provider.id);
  const plan = template.plans?.[0];
  assert.ok(plan, "selected provider-published template has no purchasable plan");

  const createdInstance = (await api("/api/instances", {
    token: userToken,
    method: "POST",
    body: { templateId: template.id, planId: plan.id, name: `Phase1 Agent ${suffix}` }
  })).payload.instance;
  assert.equal(createdInstance.templateId, providerTemplate.id, "purchase should instantiate the provider-published Agent");
  assert.equal(createdInstance.nodeType, "provider", "purchase should allocate the newly registered provider node first");
  assert.equal(createdInstance.status, "provisioning");

  const provisionTask = (await api("/api/node/tasks/poll", { nodeToken })).payload.task;
  assert.ok(provisionTask, "provider node did not receive a provision task");
  assert.equal(provisionTask.action, "provision");
  assert.equal(provisionTask.instanceId, createdInstance.id);

  await api(`/api/node/tasks/${provisionTask.id}/complete`, {
    nodeToken,
    method: "POST",
    body: { ok: true, result: { ready: true, runtimeUrl: `provider://${createdInstance.id}` } }
  });
  const runningInstance = (await api(`/api/instances/${createdInstance.id}`, { token: userToken })).payload.instance;
  assert.equal(runningInstance.status, "running");
  const setup = (await api(`/api/instances/${createdInstance.id}/setup`, { token: userToken })).payload.setup;
  const skillsStep = setup.steps.find((step) => step.key === "enable_skills");
  assert.ok(skillsStep?.done, "Agents with no default skills should not block setup on an impossible skill requirement");
  assert.equal(skillsStep.note, "no required skills");

  const queuedChat = await api(`/api/instances/${createdInstance.id}/chat`, {
    token: userToken,
    method: "POST",
    body: { message: "hello from phase1 smoke" }
  });
  assert.equal(queuedChat.status, 202);
  assert.equal(queuedChat.payload.status, "queued");

  const chatTask = (await api("/api/node/tasks/poll", { nodeToken })).payload.task;
  assert.ok(chatTask, "provider node did not receive a chat task");
  assert.equal(chatTask.action, "chat");
  assert.equal(chatTask.payload.message, "hello from phase1 smoke");

  const completedChat = (await api(`/api/node/tasks/${chatTask.id}/complete`, {
    nodeToken,
    method: "POST",
    body: { ok: true, result: { answer: "provider runtime answered phase1 smoke" } }
  })).payload;
  assert.equal(completedChat.task.status, "succeeded");

  const duplicateChatComplete = (await api(`/api/node/tasks/${chatTask.id}/complete`, {
    nodeToken,
    method: "POST",
    body: { ok: true, result: { answer: "duplicate provider answer should not be inserted" } }
  })).payload;
  assert.equal(duplicateChatComplete.duplicate, true, "duplicate task completion should be idempotent");

  const failedQueuedChat = await api(`/api/instances/${createdInstance.id}/chat`, {
    token: userToken,
    method: "POST",
    body: { message: "please fail this provider turn" }
  });
  assert.equal(failedQueuedChat.status, 202);
  const failedChatTask = (await api("/api/node/tasks/poll", { nodeToken })).payload.task;
  assert.ok(failedChatTask, "provider node did not receive the failing chat task");
  assert.equal(failedChatTask.action, "chat");
  await api(`/api/node/tasks/${failedChatTask.id}/complete`, {
    nodeToken,
    method: "POST",
    body: { ok: false, error: "simulated provider runtime failure" }
  });
  const stillRunningAfterChatFailure = (await api(`/api/instances/${createdInstance.id}`, { token: userToken })).payload.instance;
  assert.equal(stillRunningAfterChatFailure.status, "running", "a failed chat turn must not make the purchased Agent unusable");

  const chatMessages = (await api(`/api/instances/${createdInstance.id}/chat`, { token: userToken })).payload.messages;
  assert.ok(chatMessages.some((message) => message.role === "user" && message.content === "hello from phase1 smoke"));
  assert.ok(chatMessages.some((message) => message.role === "assistant" && message.content === "provider runtime answered phase1 smoke"));
  assert.ok(chatMessages.some((message) => message.role === "assistant" && message.content.includes("Provider runtime failed to answer this chat turn")));
  assert.equal(chatMessages.filter((message) => message.role === "assistant" && message.content.includes("provider runtime answered")).length, 1);

  const localTemplate = templates.find((row) => row.id === "tpl_hermes_research");
  assert.ok(localTemplate, "official local sandbox template should be visible in marketplace");
  const localPlan = localTemplate.plans?.[0];
  assert.ok(localPlan, "official local sandbox template has no purchasable plan");
  const localInstance = (await api("/api/instances", {
    token: userToken,
    method: "POST",
    body: { templateId: localTemplate.id, planId: localPlan.id, name: `Phase1 Local Agent ${suffix}` }
  })).payload.instance;
  assert.equal(localInstance.status, "running");
  assert.equal(localInstance.nodeType, "official");
  assert.equal(fs.existsSync(path.join(localInstance.workspacePath, "openasst-chat.mjs")), true, "local sandbox should provision a real chat entrypoint");
  const localChat = (await api(`/api/instances/${localInstance.id}/chat`, {
    token: userToken,
    method: "POST",
    body: { message: "hello local sandbox" }
  })).payload.message;
  assert.match(localChat.content, /Local sandbox Agent Phase1 Local Agent/);
  assert.match(localChat.content, /hello local sandbox/);
  assert.doesNotMatch(localChat.content, /^Local runtime response from/, "official local chat should execute the workspace entrypoint, not inline echo text");

  const localChatMessages = (await api(`/api/instances/${localInstance.id}/chat`, { token: userToken })).payload.messages;
  assert.ok(localChatMessages.some((message) => message.role === "assistant" && message.content.includes("processed your Web Chat turn")));

  const taskRows = await db.all("SELECT action, status FROM node_tasks WHERE instance_id = ? ORDER BY created_at ASC", createdInstance.id);
  console.log(JSON.stringify({
    ok: true,
    providerId: provider.id,
    nodeId: nodeResponse.node.id,
    instanceId: createdInstance.id,
    verifiedTasks: taskRows,
    chatMessages: chatMessages.length
  }, null, 2));
} finally {
  await close(listener);
  await db.close();
}
