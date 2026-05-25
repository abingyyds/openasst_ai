import { db, runMigrations } from "../db.js";

await runMigrations();
console.log("Database migrations applied.");
await db.close();
