import { isIP } from "node:net";
import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);

function valueAfter(name, fallback = "") {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? String(args[index + 1]).trim() : fallback;
}

function requireValue(name) {
  const value = valueAfter(name);
  if (!value) throw new Error(`缺少 ${name}。`);
  return value;
}

function validateServerName(value) {
  const name = String(value || "").trim().toLowerCase();
  if (name.length > 253 || !/^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/.test(name)) {
    throw new Error("--server-name 必须是正式 HTTPS 域名，不能使用通配符、URL 或示例占位值。");
  }
  if (name.endsWith(".example.com") || name.endsWith(".example.test")) throw new Error("--server-name 仍是示例域名，拒绝生成生产配置。");
  return name;
}

function validateCertificatePath(value, label) {
  const candidate = String(value || "").trim();
  if (!candidate.startsWith("/") || candidate.includes("\n") || candidate.includes("\r") || /[;'"`$]/.test(candidate)) {
    throw new Error(`${label}必须是无 shell 元字符的 Linux 绝对路径。`);
  }
  return candidate;
}

function validateUpstream(value) {
  const candidate = String(value || "127.0.0.1:43280").trim();
  const match = candidate.match(/^([^:\s]+|\[[0-9a-fA-F:]+\]):([0-9]{1,5})$/);
  if (!match || Number(match[2]) < 1 || Number(match[2]) > 65_535) throw new Error("--upstream 必须是 host:port 或 [IPv6]:port。");
  const host = match[1].replace(/^\[|\]$/g, "");
  if (host !== "localhost" && !isIP(host)) throw new Error("--upstream 仅允许 localhost 或精确 IP，禁止 DNS 漂移到非预期服务。");
  if (!["localhost", "127.0.0.1", "::1"].includes(host)) throw new Error("生产模板要求 Node 只通过本机回环地址接入 Nginx。");
  return candidate;
}

function allowlist(value, label) {
  const entries = String(value || "").split(",").map((entry) => entry.trim()).filter(Boolean);
  if (!entries.length) throw new Error(`${label}至少需要一个精确管理来源 IP 或窄 CIDR。`);
  const normalized = [];
  for (const entry of entries) {
    if (/[^0-9a-fA-F:./]/.test(entry)) throw new Error(`${label}包含非法地址：${entry}`);
    const [address, prefixText, extra] = entry.split("/");
    if (extra !== undefined) throw new Error(`${label}包含非法 CIDR：${entry}`);
    const version = isIP(address);
    if (!version || ["0.0.0.0", "::"].includes(address)) throw new Error(`${label}包含通配或无效地址：${entry}`);
    if (prefixText !== undefined) {
      const prefix = Number(prefixText);
      const minimum = version === 4 ? 24 : 64;
      const maximum = version === 4 ? 32 : 128;
      if (!Number.isInteger(prefix) || prefix < minimum || prefix > maximum) {
        throw new Error(`${label}只允许 IPv4 /24-/32 或 IPv6 /64-/128 的窄网段：${entry}`);
      }
    }
    normalized.push(entry);
  }
  return [...new Set(normalized)];
}

function directives(entries, indentation = "        ") {
  return entries.map((entry) => `${indentation}allow ${entry};`).join("\n");
}

const templatePath = path.resolve(valueAfter("--template", path.join(projectRoot, "deploy", "nginx.conf")));
const outputPath = path.resolve(requireValue("--output"));
const serverName = validateServerName(requireValue("--server-name"));
const certificate = validateCertificatePath(requireValue("--certificate"), "--certificate");
const certificateKey = validateCertificatePath(requireValue("--certificate-key"), "--certificate-key");
const upstream = validateUpstream(valueAfter("--upstream", "127.0.0.1:43280"));
const adminAllow = allowlist(requireValue("--admin-allow"), "--admin-allow");
const healthAllow = allowlist(valueAfter("--health-allow", adminAllow.join(",")), "--health-allow");

if (templatePath === outputPath) throw new Error("输出文件不能覆盖受版本控制的 Nginx 模板。");
if (!args.includes("--force") && await stat(outputPath).catch(() => null)) throw new Error(`输出文件已存在：${outputPath}；确认替换时请加 --force。`);

let source = await readFile(templatePath, "utf8");
source = source.replaceAll("relay.example.com", serverName);
source = source.replace(/^\s*ssl_certificate\s+.*;$/m, `    ssl_certificate     ${certificate};`);
source = source.replace(/^\s*ssl_certificate_key\s+.*;$/m, `    ssl_certificate_key ${certificateKey};`);
source = source.replace(/^\s*server\s+127\.0\.0\.1:43280;$/m, `    server ${upstream};`);
source = source.replaceAll("        # allow 203.0.113.10; # replace with the real load-balancer address", directives(healthAllow));
source = source.replaceAll("        # allow 203.0.113.0/24; # replace with the real VPN egress CIDR", directives(adminAllow));

if (/relay\.example\.com|203\.0\.113\.|replace with the real/i.test(source)) throw new Error("生成后的 Nginx 配置仍包含示例占位值。");
if (!source.includes("deny all;") || !source.includes("ssl_protocols TLSv1.2 TLSv1.3") || !source.includes("location ^~ /api/v1/admin/")) {
  throw new Error("Nginx 模板缺少生产访问控制或 TLS 基线。");
}

await mkdir(path.dirname(outputPath), { recursive: true, mode: 0o700 });
const temporary = `${outputPath}.next-${process.pid}-${Date.now()}`;
await writeFile(temporary, source, { mode: 0o640, flag: "wx" });
await rename(temporary, outputPath);
console.log(JSON.stringify({ output: outputPath, serverName, upstream, adminAllow, healthAllow, containsExampleValues: false }, null, 2));
