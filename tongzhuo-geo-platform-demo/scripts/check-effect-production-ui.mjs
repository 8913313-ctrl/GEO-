import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const styles = await readFile(new URL("../public/styles.css", import.meta.url), "utf8");

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
assert.match(styles, /\.asset-citation-facts/);
assert.match(styles, /\.asset-alert-row/);

console.log("Customer effect monitoring production UI checks passed.");
