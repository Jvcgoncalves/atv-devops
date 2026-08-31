import fs from "node:fs";
import path from "node:path";

const configuredPath = process.env.DB_PATH?.trim();
const databasePath = configuredPath
  ? path.resolve(configuredPath)
  : path.resolve("apps/api/hvac.db");
const candidates = [databasePath, `${databasePath}-wal`, `${databasePath}-shm`];
const present = candidates.filter((candidate) => fs.existsSync(candidate));

if (present.length > 0) {
  console.error(`SQLite data found (${present.join(", ")}). Final data migration required before cutover.`);
  process.exitCode = 1;
} else {
  console.log("No SQLite database or journal files found. No final data migration required; use canonical Supabase migration and seed.");
}
