# 桐灼 GEO 发布器发布验收

本清单用于验证桌面发布器源码、Windows 安装包和便捷版来自同一 Git 提交，并且交付文件在构建后没有被替换或篡改。当前版本为 `1.8.19`。

## 1. 源码质量门禁

在 Windows、Node.js 22 环境执行：

```powershell
cd tongzhuo-product-template\desktop-agent
npm.cmd ci
npx.cmd playwright install chromium
npm.cmd run check
```

`npm run check` 会先验证 build manifest 的生成契约，再执行语法、调度、协议、登录同步和离线适配器检查。CI 使用相同命令，不在 CI 中构建大体积安装包。

## 2. 正式构建

构建前确认 Git 工作树没有已修改或未跟踪文件：

```powershell
git status --short
npm.cmd run build:desktop
```

`build:desktop` 会依次执行：

1. 生成 `.release-metadata/build-manifest.json`；
2. 准备内置 Chromium；
3. 生成 NSIS 安装版和便捷版；
4. 生成 release manifest；
5. 对安装包、ASAR 和嵌入 build manifest 做离线一致性校验。

工作树不干净时，第一步必须失败，不能继续生成正式交付包。

## 3. 预期产物

`release/` 下必须存在：

- `tongzhuo-geo-publisher-setup-1.8.19-x64.exe`
- `tongzhuo-geo-publisher-portable-1.8.19-x64.exe`
- `tongzhuo-geo-publisher-v1.8.19-release-manifest.json`
- `win-unpacked/resources/app.asar`
- `win-unpacked/resources/build-manifest.json`

release manifest 记录安装版、便捷版、ASAR 和嵌入 build manifest 的文件大小与 SHA-256。build manifest 记录完整 Git SHA、构建时间、Node 版本及打入 ASAR 的源码文件哈希。

## 4. 离线复验

在同一源码提交上执行：

```powershell
npm.cmd run verify:release -- --require-current-commit
```

验收必须确认：

- release manifest 中的两个 EXE、ASAR 和 build manifest 哈希均与磁盘文件一致；
- `win-unpacked/resources/build-manifest.json` 与构建时 manifest 一致；
- ASAR 内的 `electron-main.mjs`、`preload.cjs`、`src/**` 和 `public/**` 与 build manifest 哈希一致；
- ASAR 内 `package.json` 的版本为 `1.8.19`，入口为 `electron-main.mjs`；
- build manifest 的提交等于当前 Git HEAD，并且构建来源不是 dirty worktree。

修改任一已记录文件后，复验必须失败。

## 5. 功能验收边界

离线自动化测试验证的是本地 HTML fixture、适配器结果结构和失败可观测性，不代表真实平台 E2E 已通过。正式声称某个平台可以自动最终发布前，还必须使用隔离测试账号逐平台验证：

- 登录、短信/扫码/验证码流程；
- 登录态过期与后台同步；
- 标题、富文本、图片和草稿保存；
- 最终发布按钮及平台成功信号；
- 风控、验证码和失败后的暂停/告警；
- 重启后不会重复发布已经成功的平台。

测试账号、Cookie、验证码、浏览器 Profile 和后台 Token 不得写入源码、manifest 或交付包。

## 6. 本次流程不包含

本清单不执行 GitHub 推送、服务器部署、Laravel 数据库迁移或真实平台内容发布。这些操作必须使用独立的上线审批与回滚流程。
