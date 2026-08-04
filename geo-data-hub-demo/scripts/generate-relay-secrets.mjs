import crypto from "node:crypto";
import { chmod, lstat, mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const args = process.argv.slice(2);

function valueAfter(name, fallback = "") {
  const index = args.indexOf(name);
  return index >= 0 && args[index + 1] ? String(args[index + 1]) : fallback;
}

function fingerprint(value) {
  return crypto.createHash("sha256").update(value).digest("hex").slice(0, 16);
}

async function assertPrivateRegularSource(filePath, label) {
  const info = await lstat(filePath).catch(() => null);
  if (!info?.isFile() || info.isSymbolicLink()) throw new Error(`${label}必须是已存在、非符号链接的常规文件：${filePath}`);
  if (process.platform !== "win32" && (Number(info.mode) & 0o077) !== 0) {
    throw new Error(`${label}权限过宽；请先执行 chmod 600 ${filePath}`);
  }
  const value = (await readFile(filePath, "utf8")).trim();
  if (value.length < 8) throw new Error(`${label}为空或长度异常。`);
  return value;
}

async function writeSecret(filePath, value, label) {
  if (await stat(filePath).catch(() => null)) throw new Error(`${label}已存在，拒绝覆盖：${filePath}`);
  const temporary = `${filePath}.next-${process.pid}-${Date.now()}`;
  await writeFile(temporary, `${value}\n`, { mode: 0o600, flag: "wx" });
  await chmod(temporary, 0o600).catch(() => {});
  await rename(temporary, filePath);
  return { file: filePath, fingerprint: `sha256:${fingerprint(value)}` };
}

const outputDir = path.resolve(valueAfter("--output-dir", process.env.TZ_RELAY_SECRET_OUTPUT_DIR || "./.secrets"));
const aidsoSourceSetting = valueAfter("--aidso-token-file", process.env.AIDSO_TOKEN_SOURCE_FILE || "").trim();
const production = args.includes("--production") || String(process.env.NODE_ENV || "").trim().toLowerCase() === "production";

if (production && !aidsoSourceSetting) {
  throw new Error("生产密钥初始化必须通过 --aidso-token-file 指定由密码管理器导出的临时受控文件；禁止把 AIDSO Token 放到命令行参数值或脚本输出中。");
}

await mkdir(outputDir, { recursive: true, mode: 0o700 });
await chmod(outputDir, 0o700).catch(() => {});

const masterTarget = path.join(outputDir, "relay-master.key");
const adminTarget = path.join(outputDir, "relay-admin.token");
const aidsoTarget = path.join(outputDir, "aidso.token");
const requestedTargets = [masterTarget, adminTarget, ...(aidsoSourceSetting ? [aidsoTarget] : [])];
const existingTargets = [];
for (const target of requestedTargets) {
  if (await stat(target).catch(() => null)) existingTargets.push(target);
}
if (existingTargets.length) throw new Error(`生产凭证已存在，拒绝部分覆盖或原地轮换：${existingTargets.join(", ")}`);

const masterKey = crypto.randomBytes(32).toString("base64url");
const adminToken = crypto.randomBytes(48).toString("base64url");
const aidsoToken = aidsoSourceSetting
  ? await assertPrivateRegularSource(path.resolve(aidsoSourceSetting), "AIDSO Token 来源文件")
  : "";
if (aidsoToken && new Set([masterKey, adminToken, aidsoToken]).size !== 3) throw new Error("三个生产凭证必须彼此不同。");
const results = [];
try {
  results.push(await writeSecret(masterTarget, masterKey, "中转主密钥文件"));
  results.push(await writeSecret(adminTarget, adminToken, "管理员根 Token 文件"));
  if (aidsoToken) results.push(await writeSecret(aidsoTarget, aidsoToken, "AIDSO Token 文件"));
} catch (error) {
  // Preflight established that none of these targets existed before this
  // invocation, so cleaning only successfully-created outputs is safe and
  // prevents operators from mistaking a partial secret set for a complete one.
  await Promise.all(results.map((entry) => rm(entry.file, { force: true }).catch(() => {})));
  throw error;
}

console.log(JSON.stringify({
  created: results,
  secretValuesPrinted: false,
  next: production
    ? "将三个文件交给 Docker/Kubernetes Secret 或受控 Secret Manager；首次启动成功后销毁临时 AIDSO 来源文件。"
    : "开发密钥已写入受控目录；不要提交、复制到日志或通过聊天工具传输。"
}, null, 2));
