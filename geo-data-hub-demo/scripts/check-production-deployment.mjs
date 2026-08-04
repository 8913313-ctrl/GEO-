import crypto from "node:crypto";
import { constants as fsConstants } from "node:fs";
import { access, lstat, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { assertRelayRuntimeConfig, loadRelayRuntimeConfig } from "../relay-config.mjs";

const args = process.argv.slice(2);

function valueAfter(name, fallback = "") {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? String(args[index + 1]).trim() : fallback;
}

function boolean(value) {
  return /^(1|true|yes|on)$/i.test(String(value || "").trim());
}

function fingerprint(value) {
  return `sha256:${crypto.createHash("sha256").update(String(value)).digest("hex").slice(0, 16)}`;
}

function isPlaceholder(value) {
  return /(^|[^a-z])(changeme|replace[-_ ]?me|example|placeholder|your[-_ ]?token|todo)([^a-z]|$)/i.test(String(value || ""));
}

async function assertPrivateSecretFile(filePath, label) {
  const resolved = path.resolve(filePath);
  const info = await lstat(resolved).catch(() => null);
  if (!info?.isFile() || info.isSymbolicLink()) throw new Error(`${label}必须是非符号链接的常规文件：${resolved}`);
  if (process.platform !== "win32" && (Number(info.mode) & 0o077) !== 0) throw new Error(`${label}权限过宽，生产密钥文件必须为 0600：${resolved}`);
  return resolved;
}

async function assertWritableDirectory(directory, label) {
  const resolved = path.resolve(directory);
  const info = await stat(resolved).catch(() => null);
  if (!info?.isDirectory()) throw new Error(`${label}不存在或不是目录：${resolved}`);
  await access(resolved, fsConstants.R_OK | fsConstants.W_OK);
  return resolved;
}

async function inspectSecret(valueName, fileName, resolvedValue, label) {
  const direct = String(process.env[valueName] || "").trim();
  const configuredFile = String(process.env[fileName] || "").trim();
  if (direct && configuredFile) throw new Error(`${valueName} 与 ${fileName} 不能同时设置。`);
  if (configuredFile) await assertPrivateSecretFile(configuredFile, label);
  const value = String(resolvedValue || "").trim();
  if (!value || isPlaceholder(value)) throw new Error(`${label}为空或仍为占位值。`);
  return { source: configuredFile ? "secret_file" : "environment", fingerprint: fingerprint(value), value };
}

const config = assertRelayRuntimeConfig(loadRelayRuntimeConfig());
if (!config.production) throw new Error("生产部署预检要求 NODE_ENV=production。");
if (String(process.env.TZ_RELAY_SEED_DEMO || "").trim() !== "0") throw new Error("必须显式设置 TZ_RELAY_SEED_DEMO=0。");
if (String(process.env.TZ_RELAY_AIDSO_MODE || "").trim().toLowerCase() !== "real") throw new Error("必须显式设置 TZ_RELAY_AIDSO_MODE=real。");

const master = await inspectSecret("TZ_RELAY_MASTER_KEY", "TZ_RELAY_MASTER_KEY_FILE", config.masterKey, "中转主密钥");
const admin = await inspectSecret("TZ_RELAY_ADMIN_TOKEN", "TZ_RELAY_ADMIN_TOKEN_FILE", config.adminToken, "管理员根 Token");
if (admin.value.length < 32) throw new Error("生产管理员根 Token 至少需要 32 个字符。");

let aidso = null;
if (config.aidsoToken) {
  aidso = await inspectSecret("AIDSO_TOKEN", "AIDSO_TOKEN_FILE", config.aidsoToken, "AIDSO Token");
} else if (!args.includes("--allow-stored-aidso-token")) {
  throw new Error("首次生产部署预检必须注入 AIDSO_TOKEN 或 AIDSO_TOKEN_FILE；已加密入库的后续重启可显式使用 --allow-stored-aidso-token。");
}
if (new Set([master.value, admin.value, ...(aidso ? [aidso.value] : [])]).size !== (aidso ? 3 : 2)) throw new Error("主密钥、管理员 Token 和 AIDSO Token 必须彼此不同。");

const dataDir = await assertWritableDirectory(config.dataDir, "中转数据目录");
const backupDir = await assertWritableDirectory(process.env.TZ_RELAY_BACKUP_DIR || path.join(config.dataDir, "backups"), "中转备份目录");
const retentionDays = Number(process.env.TZ_RELAY_BACKUP_RETENTION_DAYS || 0);
if (!Number.isInteger(retentionDays) || retentionDays < 30) throw new Error("TZ_RELAY_BACKUP_RETENTION_DAYS 必须至少为 30 天。");

const alertWebhook = String(process.env.TZ_RELAY_ALERT_WEBHOOK_URL || "").trim();
const exitMonitored = boolean(process.env.TZ_RELAY_ALERT_EXIT_MONITORED);
if (alertWebhook) {
  const parsed = new URL(alertWebhook);
  if (parsed.protocol !== "https:" || parsed.username || parsed.password) throw new Error("TZ_RELAY_ALERT_WEBHOOK_URL 必须使用 HTTPS 且不能嵌入凭证。");
} else if (!exitMonitored) {
  throw new Error("必须配置 HTTPS 告警 Webhook，或显式设置 TZ_RELAY_ALERT_EXIT_MONITORED=1 并由 systemd/监控平台接收非零退出状态。");
}

const logSink = String(process.env.TZ_RELAY_LOG_SINK || "").trim().toLowerCase();
if (!["journal", "container", "stdout-collector"].includes(logSink)) throw new Error("TZ_RELAY_LOG_SINK 必须声明为 journal、container 或 stdout-collector。");

const nginxSetting = valueAfter("--nginx", process.env.TZ_RELAY_NGINX_CONFIG || "").trim();
if (!nginxSetting) throw new Error("必须通过 --nginx 或 TZ_RELAY_NGINX_CONFIG 指定已渲染的 Nginx 配置。");
const nginxPath = path.resolve(nginxSetting);
const nginx = await readFile(nginxPath, "utf8");
const publicHost = new URL(config.publicOrigin).hostname;
if (!new RegExp(`server_name\\s+${publicHost.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*;`).test(nginx)) throw new Error("Nginx server_name 与 TZ_RELAY_PUBLIC_ORIGIN 不一致。");
if (/relay\.example\.com|203\.0\.113\.|replace with the real/i.test(nginx)) throw new Error("Nginx 配置仍包含示例占位值。");
for (const required of ["ssl_protocols TLSv1.2 TLSv1.3", "Strict-Transport-Security", "location ^~ /api/v1/admin/", "location ^~ /client/v1/", "deny all;", "proxy_set_header X-Forwarded-Proto https"]) {
  if (!nginx.includes(required)) throw new Error(`Nginx 配置缺少生产控制：${required}`);
}
if (/allow\s+(?:all|0\.0\.0\.0\/0|::\/0)\s*;/i.test(nginx)) throw new Error("Nginx 管理访问控制包含全网放行规则。");
if (!/location\s+\^~\s+\/api\/v1\/admin\/\s*\{[\s\S]*?allow\s+[^;]+;[\s\S]*?deny\s+all;[\s\S]*?proxy_pass/.test(nginx)) throw new Error("Nginx 管理 API 未配置 allowlist + deny all。");
if (!/location\s+\/\s*\{[\s\S]*?allow\s+[^;]+;[\s\S]*?deny\s+all;[\s\S]*?proxy_pass/.test(nginx)) throw new Error("Nginx 运营控制台未配置 allowlist + deny all。");
if (!/upstream\s+tongzhuo_relay[\s\S]*server\s+(?:127\.0\.0\.1|\[::1\]|localhost):\d+\s*;/.test(nginx)) throw new Error("Nginx 必须通过回环地址连接 Node 中转服务。");

console.log(JSON.stringify({
  status: "production-deployment-ready",
  publicOrigin: config.publicOrigin,
  trustedProxyAddresses: config.trustedProxyAddresses,
  secretSources: { master: master.source, admin: admin.source, aidso: aidso?.source || "encrypted_database" },
  secretFingerprints: { master: master.fingerprint, admin: admin.fingerprint, aidso: aidso?.fingerprint || null },
  dataDir,
  backupDir,
  backupRetentionDays: retentionDays,
  nginxPath,
  logSink,
  alertChannel: alertWebhook ? "https_webhook" : "monitored_exit",
  demoSeed: false,
  aidsoMode: "real"
}, null, 2));
