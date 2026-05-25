import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
export const rootDir = path.resolve(__dirname, "..");

const railwayVolumeDir = process.env.RAILWAY_VOLUME_MOUNT_PATH || "";
const defaultPublicBaseUrl = process.env.RAILWAY_PUBLIC_DOMAIN
  ? `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`
  : `http://127.0.0.1:${process.env.PORT || 4000}`;
const defaultDatabasePath = railwayVolumeDir
  ? path.join(railwayVolumeDir, "openasstai.sqlite")
  : "data/openasstai.sqlite";
const defaultRuntimeWorkspaceDir = railwayVolumeDir
  ? path.join(railwayVolumeDir, "workspaces")
  : "runtime/workspaces";

export const config = {
  port: Number(process.env.PORT || 4000),
  host: process.env.HOST || (process.env.NODE_ENV === "production" ? "0.0.0.0" : "127.0.0.1"),
  publicBaseUrl: process.env.PUBLIC_BASE_URL || defaultPublicBaseUrl,
  databaseUrl: process.env.DATABASE_URL || "",
  databaseSsl: process.env.DATABASE_SSL === "true",
  jwtSecret: process.env.JWT_SECRET || "dev-openasstai-jwt-secret-change-me",
  secretKey: process.env.SECRET_KEY || "dev-openasstai-secret-key-change-me",
  bootstrapAdminEmail: process.env.BOOTSTRAP_ADMIN_EMAIL || "admin@openasst.ai",
  bootstrapAdminPassword:
    process.env.BOOTSTRAP_ADMIN_PASSWORD || (process.env.NODE_ENV === "production" ? "" : "admin123"),
  seedDemoUser: process.env.SEED_DEMO_USER
    ? process.env.SEED_DEMO_USER === "true"
    : process.env.NODE_ENV !== "production",
  demoEmail: process.env.DEMO_EMAIL || "demo@openasst.ai",
  demoPassword: process.env.DEMO_PASSWORD || "demo123",
  databasePath: path.resolve(rootDir, process.env.DATABASE_PATH || defaultDatabasePath),
  runtimeWorkspaceDir: path.resolve(
    rootDir,
    process.env.RUNTIME_WORKSPACE_DIR || defaultRuntimeWorkspaceDir
  )
};
