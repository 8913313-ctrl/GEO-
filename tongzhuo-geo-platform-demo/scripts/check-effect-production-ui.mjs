import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const scriptFiles = [
  "core.js",
  "content-sync.js",
  "publisher.js",
  "shell.js",
  "planning-content.js",
  "monitoring-analysis.js",
  "effect.js",
  "site.js",
  "knowledge.js",
  "content-review.js",
  "bootstrap.js"
];
const source = (await Promise.all(scriptFiles.map((file) => readFile(new URL(`../public/js/modules/${file}`, import.meta.url), "utf8")))).join("\n");
const styles = [
  await readFile(new URL("../public/styles.css", import.meta.url), "utf8"),
  await readFile(new URL("../public/css/modules/effect.css", import.meta.url), "utf8")
].join("\n");

for (const forbidden of [
  "SAMPLE-001",
  "完成一轮演示采样",
  "本轮演示采样已完成",
  "function refreshMonitoring()",
  "function renderMonitoringOverview()",
  "function renderMonitoringTable()",
  "已有演示采样",
  "数据为本地演示结果"
]) {
  assert.equal(source.includes(forbidden), false, `legacy monitoring demo must not return: ${forbidden}`);
}

assert.match(source, /function renderMonitoring\(\)\s*{\s*return renderRealMonitoring\(\);\s*}/);
assert.match(source, /function renderEffectMonitor\(\)\s*{\s*return renderRealEffectMonitor\(\);\s*}/);
assert.match(source, /真实 AI 引用记录/);
assert.match(source, /只统计已验证的实时检测证据/);
assert.match(source, /发布地址已自动纳入追踪/);
assert.match(source, /function effectMonitorScopedData\(data, plan\)/);
assert.match(source, /hasRecordSource/);
assert.match(source, /effectMonitorFreshnessLabel/);
assert.match(styles, /\.asset-citation-facts/);
assert.match(styles, /\.asset-alert-row/);
assert.match(styles, /\.effect-monitor-data-meta/);
assert.equal(styles.includes("animation: effect-monitor-pulse"), false, "monitor status pulse must remain static");

console.log("Customer effect monitoring production UI checks passed.");
