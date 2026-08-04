import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const actions = [...new Set([...source.matchAll(/data-action=["']([^"']+)["']/g)].map((match) => match[1]).filter((value) => !value.includes("${")))];
const directHandlers = [...source.matchAll(/action\s*===\s*["']([^"']+)["']/g)].map((match) => match[1]);
const groupedHandlers = [...source.matchAll(/\[([^\]]+)\]\.includes\(action\)/g)].flatMap((match) => [...match[1].matchAll(/["']([^"']+)["']/g)].map((entry) => entry[1]));
const handlers = new Set([...directHandlers, ...groupedHandlers]);

assert.deepEqual(actions.filter((action) => !handlers.has(action)), [], "every visible central-console action must have an implementation");
assert.match(source, /let customers = \[\];[\s\S]*let instances = \[\];[\s\S]*let jobs = \[\];/, "central console must start without fixture tenants, instances or jobs");
assert.doesNotMatch(source, /localStorage\.setItem|sessionStorage\.setItem/, "the browser must not persist the root administrator token or central facts");
assert.match(source, /POST[\s\S]*\/api\/v1\/admin\/session|method:\s*"POST"[\s\S]*Authorization:\s*`Bearer/, "administrator login must exchange the root token for a server session");
assert.match(source, /analytics\?days=\$\{encodeURIComponent\(ui\.chartPeriod\)\}/, "analytics period controls must query the real API");
assert.match(source, /\/api\/v1\/admin\/items\/\$\{encodeURIComponent\(itemId\)\}\/reconcile/, "manual reconciliation must call the central API");
assert.match(source, /\/api\/v1\/admin\/deliveries\/\$\{encodeURIComponent\(deliveryId\)\}\/requeue/, "dead-letter redelivery must call the central API");
assert.match(source, /\/api\/v1\/admin\/instances\/\$\{encodeURIComponent\(id\)\}\/revoke/, "instance revocation must be available in the operator UI");
assert.match(source, /payment-orders[\s\S]*invoice-requests/, "payment and invoice operations must use formal central records");

console.log("Relay production administrator UI checks passed.");

