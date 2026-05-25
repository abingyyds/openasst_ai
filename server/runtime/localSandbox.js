import fs from "node:fs";
import path from "node:path";
import { config } from "../config.js";

export function workspacePathFor(instanceId) {
  return path.join(config.runtimeWorkspaceDir, instanceId);
}

export function provisionWorkspace(instance, template, plan) {
  fs.mkdirSync(instance.workspace_path, { recursive: true });

  const readme = `# ${instance.name}

OpenAsstAI local sandbox workspace

- Instance: ${instance.id}
- Template: ${template.name}
- Framework: ${template.framework}
- Plan: ${plan.name}
- Region: ${instance.region}

This directory simulates the isolated Linux workspace for Phase 1 local testing.
`;

  const chatEntrypoint = `#!/usr/bin/env node
let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => { input += chunk; });
process.stdin.on("end", () => {
  const request = JSON.parse(input || "{}");
  const skills = Array.isArray(request.enabledSkills) && request.enabledSkills.length
    ? request.enabledSkills.join(", ")
    : "none";
  const model = request.model
    ? (request.model.provider || "unknown") + "/" + (request.model.model || "unknown")
    : "unknown/unknown";
  process.stdout.write([
    "Local sandbox Agent " + ((request.instance && request.instance.name) || request.instanceId || "instance") + " processed your Web Chat turn.",
    "",
    request.message || "",
    "",
    "Model: " + model + ". Enabled skills: " + skills + "."
  ].join("\\n"));
});
process.stdin.resume();
`;

  fs.writeFileSync(path.join(instance.workspace_path, "README.md"), readme, "utf8");
  fs.writeFileSync(path.join(instance.workspace_path, "openasst-chat.mjs"), chatEntrypoint, { encoding: "utf8", mode: 0o755 });
  fs.writeFileSync(
    path.join(instance.workspace_path, "agent.config.json"),
    JSON.stringify(
      {
        instanceId: instance.id,
        templateId: template.id,
        framework: template.framework,
        plan: {
          cpu: instance.cpu,
          memoryMb: instance.memory_mb,
          diskGb: instance.disk_gb
        },
        runtime: "local-sandbox"
      },
      null,
      2
    ),
    "utf8"
  );

  fs.mkdirSync(path.join(instance.workspace_path, "logs"), { recursive: true });
  fs.mkdirSync(path.join(instance.workspace_path, "data"), { recursive: true });
}
