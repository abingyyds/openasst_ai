import { createId, db, now, toJson } from "./db.js";

export function writeAudit(actorId, instanceId, action, metadata = {}) {
  db.prepare(`
    INSERT INTO audit_logs (id, actor_id, instance_id, action, metadata_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(createId("aud"), actorId || null, instanceId || null, action, toJson(metadata), now());
}

export function writeInstanceLog(instanceId, level, source, message, metadata = {}) {
  db.prepare(`
    INSERT INTO instance_logs (id, instance_id, level, source, message, metadata_json, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(createId("log"), instanceId || null, level, source, message, toJson(metadata), now());
}
