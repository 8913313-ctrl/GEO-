import path from "node:path";
import { createProductionBackup } from "./production-backup-v2.mjs";

const positional = process.argv.slice(2).filter((argument) => !argument.startsWith("--"));
if (positional.length > 1) throw new Error("用法：node scripts/backup-production.mjs [备份目标目录]");

const result = await createProductionBackup({
  ...(positional[0] ? { targetDir: path.resolve(positional[0]) } : {})
});

console.log(`生产数据完整备份已完成：${result.targetDir}`);
console.log(`备份格式：${result.manifest.format}；已校验组件：${result.summary.components.join("、")}`);
console.log("请将整个备份目录保存到受控的加密介质；数据库、主密钥与加密配置必须作为一个整体保管。");

