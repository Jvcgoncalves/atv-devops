import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const script = fileURLToPath(new URL("../scripts/verify-cutover-data.mjs", import.meta.url));
const databaseModule = fileURLToPath(new URL("../db.ts", import.meta.url));

function run(databasePath) {
  return spawnSync(process.execPath, [script], {
    env: { ...process.env, DB_PATH: databasePath },
    encoding: "utf8",
  });
}

test("cutover data check passes when no SQLite artifact exists", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "hvac-cutover-"));
  try {
    const result = run(path.join(directory, "hvac.db"));
    assert.equal(result.status, 0);
    assert.match(result.stdout, /No SQLite database/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("cutover data check blocks when SQLite artifact exists", () => {
  const directory = mkdtempSync(path.join(tmpdir(), "hvac-cutover-"));
  try {
    const databasePath = path.join(directory, "hvac.db");
    writeFileSync(databasePath, "legacy data");
    const result = run(databasePath);
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Final data migration required/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("legacy SQLite connection is configured read-only by default", () => {
  const legacyDb = readFileSync(databaseModule, "utf8");
  assert.match(legacyDb, /fileMustExist: !writesEnabled/);
  assert.match(legacyDb, /readonly: !writesEnabled/);
  assert.match(legacyDb, /query_only = ON/);
  assert.match(legacyDb, /process\.env\.SQLITE_WRITE_MODE === SQLITE_WRITE_MODE/);
});

test("legacy server has no mutating routes", () => {
  const legacyServer = readFileSync(fileURLToPath(new URL("../server.ts", import.meta.url)), "utf8");
  assert.doesNotMatch(legacyServer, /app\.(post|put|patch|delete)\(/);
});
