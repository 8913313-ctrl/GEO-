import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../server.mjs", import.meta.url), "utf8");
assert.match(source, /const runtimeBuild = Object\.freeze\(\{/);
assert.match(source, /TZ_BUILD_ID/);
assert.match(source, /SOURCE_VERSION/);
assert.match(source, /runtime: runtimeBuild/);
assert.match(source, /startedAt: new Date\(\)\.toISOString\(\)/);
console.log("Runtime liveness/readiness build identity contract check passed.");
