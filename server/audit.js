import { createId, db, now, toJson } from "./db.js";

export async function writeAudit(actorId, instanceId, action, metadata = {}) {
  await db.run(`
    INSERT INTO audit_logs (id, actor_id, instance_id, action, metadata_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `, createId("aud"), actorId || null, instanceId || null, action, toJson(metadata), now());
}

export async function writeInstanceLog(instanceId, level, source, message, metadata = {}) {
  await db.run(`
    INSERT INTO instance_logs (id, instance_id, level, source, message, metadata_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, createId("log"), instanceId || null, level, source, message, toJson(metadata), now());
}
