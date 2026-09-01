import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

const script = fileURLToPath(new URL("../scripts/verify-cutover-data.mjs", import.meta.url));
const apiPackage = fileURLToPath(new URL("../package.json", import.meta.url));

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

test("cutover removes legacy runtime and dependencies", () => {
  for (const file of ["db.ts", "logic.ts", "schema.sql", "server.ts", "types.ts"]) {
    assert.equal(existsSync(fileURLToPath(new URL(`../${file}`, import.meta.url))), false, file);
  }

  const packageJson = JSON.parse(readFileSync(apiPackage, "utf8"));
  assert.equal(packageJson.scripts["legacy:start:read-only"], undefined);
  assert.equal(packageJson.dependencies["better-sqlite3"], undefined);
  assert.equal(packageJson.dependencies.express, undefined);
});
