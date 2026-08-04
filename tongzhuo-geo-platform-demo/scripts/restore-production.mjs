import path from "node:path";
import { restoreProductionBackup } from "./production-backup-v2.mjs";

const argumentsList = process.argv.slice(2);
const positional = argumentsList.filter((argument) => !argument.startsWith("--"));
const force = argumentsList.includes("--force");
const skipSafetySnapshot = argumentsList.includes("--skip-safety-snapshot");
if (positional.length !== 1 || !force) {
  throw new Error("用法：node scripts/restore-production.mjs <备份目录> --force [--skip-safety-snapshot]（默认会先创建恢复前安全快照；恢复前必须停止应用）");
}

const result = await restoreProductionBackup({
  sourceDir: path.resolve(positional[0]),
  force,
  skipSafetySnapshot
});

console.log(`生产数据已恢复到：${result.databasePath}`);
console.log(`源备份格式：${result.sourceFormat}；已恢复组件：${result.restoredComponents.join("、")}`);
if (result.safetySnapshot) console.log(`恢复前安全快照：${result.safetySnapshot}`);
else if (skipSafetySnapshot) console.warn("警告：本次使用了 --skip-safety-snapshot，没有创建恢复前安全快照。");
console.log("请启动应用并检查 /health/ready，然后执行登录、模型解密、官网页面与发布器连接验收。");

