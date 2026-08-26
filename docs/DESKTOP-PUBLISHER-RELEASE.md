# 桐灼桌面发布助手：发布与在线更新记录

最后更新：2026-08-24

## 当前版本

- 版本：`1.0.4`
- Windows 安装包：[桐灼发布助手 Setup 1.0.4.exe](https://tongzhuo.ink/downloads/%E6%A1%90%E7%81%BC%E5%8F%91%E5%B8%83%E5%8A%A9%E6%89%8B%20Setup%201.0.4.exe)
- 更新清单：<https://tongzhuo.ink/downloads/latest.yml>
- 更新服务：Electron `electron-updater` + Generic provider

管理端“发布助手”页面必须使用上面的版本化地址，不能再引用旧的
`/downloads/tongzhuo-geo-publisher-setup.exe` 路径。

## 用户如何在线更新

安装包启动后会在 Windows 打包环境中自动检查 `latest.yml`。发现更高版本时，
软件会提示用户下载；下载完成后提示重启，重启时完成安装。账号登录状态和本地
任务数据保存在用户数据目录，不随更新包删除。

在线更新不会因为同版本文件被替换而触发。每次发布必须递增 `publisher-desktop/package.json`
中的版本号，例如 `1.0.1` 或 `1.1.0`，然后重新构建。

## 新版本发布流程

1. 修改 `publisher-desktop/package.json` 的 `version`，同步确认 `package-lock.json` 顶层版本。
2. 在 `publisher-desktop` 目录执行 `npm run build`（或 `npx electron-builder --win nsis`）。
3. 确认 `dist` 中同时存在安装包、`.blockmap` 和 `latest.yml`。
4. 将这三个文件上传到服务器下载目录：
   `/var/lib/docker/volumes/tongzhuo-domain-edge-data/_data/downloads/`
5. 检查 `https://tongzhuo.ink/downloads/latest.yml` 的 `version`、文件名、`sha512` 和 `size`。
6. 用安装了旧版本的测试客户端启动软件，确认出现更新提示、下载完成提示和重启安装流程。

服务器上的 Caddy 已经为 `/downloads/*` 提供静态文件服务，更新文件上传后无需重启
Caddy 或 GEO 服务。

## 当前构建注意事项

- 当前安装包未配置 Windows 代码签名证书，首次安装可能出现 SmartScreen 提示。
- 正式生产发布建议配置代码签名证书（`CSC_LINK`、`CSC_KEY_PASSWORD`）。
- 不要在文档、仓库或日志中记录服务器 SSH 密码。
