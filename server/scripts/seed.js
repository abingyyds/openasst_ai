import { db, initDatabase } from "../db.js";

await initDatabase();
console.log("Database seeded.");
await db.close();
