import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const [source, styles, guide] = await Promise.all([
  readFile(new URL("../public/app.js", import.meta.url), "utf8"),
  readFile(new URL("../public/styles.css", import.meta.url), "utf8"),
  readFile(new URL("../public/usage-guide.html", import.meta.url), "utf8")
]);

for (const removedMemberUi of [
  "成员与权限",
  "成员权限",
  "invite-member",
  "manage-member",
  "save-member",
  "delete-member",
  "memberEditor"
]) {
  assert.equal(source.includes(removedMemberUi), false, `member management UI must stay removed: ${removedMemberUi}`);
}
assert.equal(guide.includes("配置成员权限"), false);
assert.equal(guide.includes("成员与权限"), false);

assert.match(source, /if \(ui\.topicGenerating\) return showToast\("选题正在生成"/);
assert.match(source, /topicGeneratingQuestionIds/);
assert.match(source, /aria-busy="\$\{isGenerating \? "true" : "false"\}"/);
assert.match(source, /正在为 <b>.*个问题生成选题，请勿重复点击/);

assert.match(source, /if \(ui\.studioSending \|\| ui\.studioGenerating\) return showToast\("文章正在生成"/);
assert.match(source, /data-action="send-studio-chat"/);
assert.match(source, /<span>发送<\/span>/);
assert.match(source, /aria-busy="\$\{composerBusy \? "true" : "false"\}"/);
assert.match(styles, /\.studio-composer-primary\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\) auto/s);
assert.match(styles, /\.studio-send-button\s*\{[^}]*min-width:\s*76px/s);

assert.equal((source.match(/class="card toolbar-card question-add-bar"/g) || []).length, 0, "question library must not render a second inline add form");
assert.match(source, /addQuestion: renderAddQuestionModal/);
assert.match(source, /ui\.modal = \{ type: "addQuestion" \}/);
assert.match(source, /studioGenerationPending = true/);
assert.match(source, /queueMicrotask\(\(\) => generateStudioArticle/);
assert.match(source, /不需要再次点击发送/);
assert.match(source, /window\.setTimeout\(remove, 4600\)/);
assert.match(styles, /\.toast-root\s*\{[^}]*top:\s*20px/s);
assert.doesNotMatch(styles, /\.toast-root\s*\{[^}]*bottom:\s*20px/s);
assert.match(source, /reason: `全部 \$\{existingCount\} 篇文章已有该平台任务`/);
assert.match(source, /reason: `可发布 \$\{availableCount\} 篇 · \$\{existingCount\} 篇已有任务将跳过`/);
assert.match(source, /function publishBatchTargetCoverage\(selectedArticles, selectedPlatforms, group\)/);
assert.match(source, /已有平台任务会按文章自动跳过，不会阻断整批发布/);
assert.match(source, /将创建 \$\{coverage\.availableCount\} 条平台任务；\$\{coverage\.existingCount\} 条已有任务会自动跳过/);
assert.match(source, /if \(!coverage\.availableCount\) return showToast\("没有新的发布目标"/);
assert.doesNotMatch(source, /const order = \(ui\.publishBatchSelection\.platformOrder \|\| \[\]\)\.filter\(\(platform\) => available\.has\(platform\)\)/);
assert.match(source, /当前界面直接完成核对与审核，无需再次提交/);
assert.match(source, /await submitArticleForManualReview\(article\.id, \{ fromArticleModal: true \}\)/);

console.log("Single-user settings and generation usability checks passed.");
