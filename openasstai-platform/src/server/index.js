import { createServer } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  agents,
  findAgent,
  findInstance,
  instances,
  logs
} from "./data/mockData.js";
import { OpenNebulaAdapter } from "./adapters/opennebula/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.resolve(__dirname, "..", "client");
const adapter = new OpenNebulaAdapter();
const port = Number(process.env.PORT || 3000);
const host = "0.0.0.0";

const mimeTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml; charset=utf-8"],
  [".ico", "image/x-icon"]
]);

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
      return;
    }

    await serveClient(res, url.pathname);
  } catch (error) {
    sendJson(res, 500, {
      error: "internal_server_error",
      message: error instanceof Error ? error.message : "Unknown server error"
    });
  }
});

server.listen(port, host, () => {
  console.log(`OpenAsstAI platform listening on http://${host}:${port}`);
});

async function handleApi(req, res, url) {
  const method = req.method || "GET";
  const parts = url.pathname.split("/").filter(Boolean);

  if (method === "GET" && url.pathname === "/api/health") {
    const opennebula = await adapter.validateConnection();
    sendJson(res, 200, {
      ok: true,
      app: "openasstai-platform",
      time: new Date().toISOString(),
      opennebula
    });
    return;
  }

  if (method === "GET" && url.pathname === "/api/agents/search") {
    const q = (url.searchParams.get("q") || "").trim().toLowerCase();
    const results = instances
      .filter((instance) => {
        const haystack = [instance.id, instance.name, instance.ipv4, instance.privateIpv4, instance.statusText]
          .join(" ")
          .toLowerCase();
        return !q || haystack.includes(q);
      })
      .map((instance) => ({
        id: instance.id,
        type: "Hermes Agent",
        name: instance.name,
        statusText: instance.statusText,
        ipv4: instance.ipv4,
        href: `/console/hermes/instances/${instance.id}`
      }));
    sendJson(res, 200, { q, results });
    return;
  }

  if (method === "GET" && url.pathname === "/api/instances") {
    sendJson(res, 200, { instances });
    return;
  }

  if (parts[0] === "api" && parts[1] === "instances" && parts[2]) {
    await handleInstanceApi(req, res, parts[2], parts.slice(3));
    return;
  }

  sendJson(res, 404, { error: "not_found", message: "API route not found" });
}

async function handleInstanceApi(req, res, instanceId, tail) {
  const method = req.method || "GET";
  const instance = findInstance(instanceId);

  if (!instance) {
    sendJson(res, 404, { error: "instance_not_found", message: `Instance ${instanceId} was not found` });
    return;
  }

  if (method === "GET" && tail.length === 0) {
    sendJson(res, 200, { instance });
    return;
  }

  if (tail[0] !== "agent") {
    sendJson(res, 404, { error: "not_found", message: "Instance API route not found" });
    return;
  }

  const agent = findAgent(instanceId);
  if (!agent) {
    sendJson(res, 404, { error: "agent_not_found", message: `Agent for ${instanceId} was not found` });
    return;
  }

  if (method === "GET" && tail.length === 1) {
    sendJson(res, 200, { agent });
    return;
  }

  if (method === "PATCH" && tail.join("/") === "agent/models/default") {
    const body = await readJsonBody(req);
    agent.defaultModel = {
      ...agent.defaultModel,
      provider: body.provider || agent.defaultModel.provider,
      model: body.model || agent.defaultModel.model,
      planId: body.planId || agent.defaultModel.planId
    };
    sendJson(res, 200, { agent, updated: "defaultModel" });
    return;
  }

  if (method === "POST" && tail.join("/") === "agent/channels") {
    const body = await readJsonBody(req);
    const channel = {
      id: body.id || `channel-${Date.now()}`,
      name: body.name || "自定义渠道",
      status: "connected",
      statusText: "已连接",
      account: body.account || "待命名账号"
    };
    agent.channels.push(channel);
    sendJson(res, 201, { channel, channels: agent.channels });
    return;
  }

  if (method === "POST" && tail.join("/") === "agent/skills") {
    const body = await readJsonBody(req);
    const skill = {
      id: body.id || body.name || `skill-${Date.now()}`,
      name: body.name || "custom-skill",
      version: body.version || "0.1.0",
      source: body.source || "SkillHub"
    };
    agent.skills.installed.push(skill);
    sendJson(res, 201, { skill, skills: agent.skills.installed });
    return;
  }

  if (method === "POST" && tail.join("/") === "agent/actions/restart") {
    agent.lastRestartedAt = new Date().toISOString();
    logs[instanceId].unshift({
      id: `log-${Date.now()}`,
      level: "info",
      timestamp: agent.lastRestartedAt,
      message: "Hermes Agent restart requested from console"
    });
    sendJson(res, 202, { action: "restart", status: "queued", agent });
    return;
  }

  if (method === "GET" && tail.join("/") === "agent/logs") {
    sendJson(res, 200, { logs: logs[instanceId] || [] });
    return;
  }

  sendJson(res, 404, { error: "not_found", message: "Agent API route not found" });
}

async function serveClient(res, requestedPath) {
  const normalized = path.normalize(decodeURIComponent(requestedPath)).replace(/^(\.\.(\/|\\|$))+/, "");
  const relativePath = normalized === "/" || normalized === "." ? "index.html" : normalized.replace(/^\/+/, "");
  const filePath = path.join(clientRoot, relativePath);
  const resolved = path.resolve(filePath);

  if (!resolved.startsWith(clientRoot)) {
    sendText(res, 403, "Forbidden");
    return;
  }

  try {
    const fileStat = await stat(resolved);
    if (fileStat.isFile()) {
      const ext = path.extname(resolved);
      const body = await readFile(resolved);
      sendBuffer(res, 200, body, mimeTypes.get(ext) || "application/octet-stream");
      return;
    }
  } catch {
    const index = await readFile(path.join(clientRoot, "index.html"));
    sendBuffer(res, 200, index, "text/html; charset=utf-8");
  }
}

async function readJsonBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }

  if (!chunks.length) {
    return {};
  }

  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function sendJson(res, statusCode, payload) {
  sendBuffer(res, statusCode, Buffer.from(JSON.stringify(payload, null, 2)), "application/json; charset=utf-8");
}

function sendText(res, statusCode, body) {
  sendBuffer(res, statusCode, Buffer.from(body), "text/plain; charset=utf-8");
}

function sendBuffer(res, statusCode, body, contentType) {
  res.writeHead(statusCode, {
    "content-type": contentType,
    "cache-control": contentType.includes("text/html") ? "no-store" : "public, max-age=60"
  });
  res.end(body);
}
