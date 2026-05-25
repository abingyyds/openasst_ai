import { cp, mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const dist = path.join(root, "dist");

await rm(dist, { force: true, recursive: true });
await mkdir(dist, { recursive: true });
await cp(path.join(root, "src", "server"), path.join(dist, "server"), { recursive: true });
await cp(path.join(root, "src", "client"), path.join(dist, "client"), { recursive: true });
await mkdir(path.join(dist, "meta"), { recursive: true });
await writeFile(
  path.join(dist, "meta", "build.json"),
  JSON.stringify(
    {
      app: "openasstai-platform",
      builtAt: new Date().toISOString(),
      mode: "static-client-node-server"
    },
    null,
    2
  )
);

console.log("Built openasstai-platform into dist/");
