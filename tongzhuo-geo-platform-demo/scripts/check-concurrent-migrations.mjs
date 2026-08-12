import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = await mkdtemp(path.join(os.tmpdir(), "tongzhuo-concurrent-migrations-"));
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const databasePath = path.join(root, "shared.sqlite");

function run() {
  const source = `import { ProductionDatabase } from ${JSON.stringify(new URL("../production-database.mjs", import.meta.url).href)}; const db = new ProductionDatabase({ databasePath: process.env.CHECK_DATABASE }); console.log(db.connection.prepare("SELECT MAX(version) AS version FROM migrations").get().version); db.close();`;
  const child = spawn(process.execPath, ["--input-type=module", "--eval", source], { cwd: projectRoot, env: { ...process.env, CHECK_DATABASE: databasePath }, stdio: ["ignore", "pipe", "pipe"] });
  return new Promise((resolve) => {
    let stdout = ""; let stderr = "";
    child.stdout.on("data", (chunk) => { stdout += chunk; }); child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.once("exit", (code) => resolve({ code, stdout, stderr }));
  });
}

try {
  const results = await Promise.all([run(), run(), run(), run()]);
  for (const result of results) {
    assert.equal(result.code, 0, result.stderr);
    assert.match(result.stdout, /30/);
  }
  console.log("Concurrent first-boot database migration check passed.");
} finally {
  await rm(root, { recursive: true, force: true, maxRetries: 2, retryDelay: 50 });
}
