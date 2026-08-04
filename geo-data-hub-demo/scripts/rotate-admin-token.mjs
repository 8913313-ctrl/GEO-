import crypto from "node:crypto";
import { mkdir, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const args = process.argv.slice(2);
const index = args.indexOf("--file");
const target = index >= 0 && args[index + 1]
  ? path.resolve(args[index + 1])
  : path.resolve(process.env.TZ_RELAY_ADMIN_TOKEN_FILE || "./.secrets/relay-admin.token");
const force = args.includes("--force");
if (!force && await stat(target).catch(() => null)) {
  throw new Error(`管理员 Token 文件已存在：${target}。如确认轮换，请加 --force。`);
}
const token = crypto.randomBytes(32).toString("base64url");
await mkdir(path.dirname(target), { recursive: true });
const temporary = `${target}.next-${process.pid}-${Date.now()}`;
await writeFile(temporary, `${token}\n`, { mode: 0o600, flag: "wx" });
await rename(temporary, target);
const fingerprint = crypto.createHash("sha256").update(token).digest("hex").slice(0, 16);
console.log(JSON.stringify({
  file: target,
  fingerprint: `sha256:${fingerprint}`,
  tokenPrinted: false,
  next: "将新文件同步到受控 Secret，再重启中转服务；旧 Token 会立即失效，所有浏览器会话也会在重启时撤销。"
}, null, 2));
