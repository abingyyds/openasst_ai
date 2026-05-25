import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const rootDir = path.resolve(__dirname, "..");

export const config = {
  port: Number(process.env.PORT || 4000),
  host: process.env.HOST || (process.env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1"),
  publicBaseUrl: process.env.PUBLIC_BASE_URL || `http://127.0.0.1:${process.env.PORT || 4000}`,
  jwtSecret: process.env.JWT_SECRET || "dev-openasstai-jwt-secret-change-me",
  secretKey: process.env.SECRET_KEY || "dev-openasstai-secret-key-change-me",
  databasePath: path.resolve(rootDir, process.env.DATABASE_PATH || "data/openasstai.sqlite"),
  runtimeWorkspaceDir: path.resolve(
    rootDir,
    process.env.RUNTIME_WORKSPACE_DIR || "runtime/workspaces"
  )
};
