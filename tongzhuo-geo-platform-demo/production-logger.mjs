import { appendFile, mkdir, rename, stat } from "node:fs/promises";
import path from "node:path";
import { productionConfig } from "./production-config.mjs";

const SECRET_KEY = /(authorization|cookie|password|secret|token|api[-_]?key|csrf)/i;

function sanitize(value, depth = 0) {
  if (depth > 5) return "[TRUNCATED]";
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => sanitize(item, depth + 1));
  if (!value || typeof value !== "object") return typeof value === "string" && value.length > 2_000 ? `${value.slice(0, 2_000)}…` : value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, SECRET_KEY.test(key) ? "[REDACTED]" : sanitize(item, depth + 1)]));
}

export class ProductionLogger {
  constructor(options = {}) {
    this.logDir = path.resolve(options.logDir || productionConfig.logDir);
    this.maxBytes = Number(options.maxBytes || productionConfig.logMaxBytes);
    this.filePath = path.join(this.logDir, "application.jsonl");
    this.writeQueue = Promise.resolve();
  }

  async rotateIfNeeded() {
    try {
      const info = await stat(this.filePath);
      if (info.size < this.maxBytes) return;
      await rename(this.filePath, path.join(this.logDir, `application-${new Date().toISOString().replace(/[:.]/g, "-")}.jsonl`));
    } catch (error) {
      if (error?.code !== "ENOENT") throw error;
    }
  }

  log(level, message, fields = {}) {
    const entry = sanitize({ timestamp: new Date().toISOString(), level, message, ...fields });
    const line = `${JSON.stringify(entry)}\n`;
    const output = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
    output(JSON.stringify(entry));
    this.writeQueue = this.writeQueue.then(async () => {
      await mkdir(this.logDir, { recursive: true });
      await this.rotateIfNeeded();
      await appendFile(this.filePath, line, { encoding: "utf8", mode: 0o600 });
    }).catch((error) => console.error(JSON.stringify({ timestamp: new Date().toISOString(), level: "error", message: "日志落盘失败", error: error.message })));
    return entry;
  }

  info(message, fields) { return this.log("info", message, fields); }
  warn(message, fields) { return this.log("warn", message, fields); }
  error(message, fields) { return this.log("error", message, fields); }
}

export const productionLogger = new ProductionLogger();

