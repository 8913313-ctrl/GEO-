# GEOFlow 服务器部署说明

本文档用于把 `geoflow-integration/server-overrides` 安装到客户的 GEOFlow Laravel 项目中。

## 部署边界

服务器端只部署 GEOFlow 后台、官网路由、线索管理、发布设备管理、分发任务队列和本地发布助手接口。

第三方平台账号、Cookie、验证码、浏览器 Profile 不进入服务器部署包；这些内容只保存在客户电脑上的 Windows 本地发布助手中。

## 生成服务器部署包

在客户实例根目录运行：

```powershell
.\scripts\Test-ServerOverrides.ps1

.\scripts\Package-GeoFlowServer.ps1 `
  -OutputPath 'D:\Deliveries\customer-a-geoflow-overrides.zip'
```

部署包包含：

- `server-overrides/`：覆盖到 Laravel 项目的文件。
- `deployment/install-geoflow-overrides.sh`：Linux 服务器安装脚本。
- `deployment/verify-geoflow-overrides.sh`：安装后服务器验收脚本。
- `deployment/smoke-geoflow-workbench.sh`：上线烟测脚本和人工操作清单。
- `package-manifest.json`：包信息和安装命令。

部署包不应包含 `.env`、`storage`、`vendor`、`node_modules`、`.data` 或任何客户 Token。

## 上传到服务器

示例：

```powershell
scp D:\Deliveries\customer-a-geoflow-overrides.zip root@SERVER_IP:/tmp/
```

也可以使用本地部署助手完成“打包 -> 上传 -> 远程 dry-run”：

```powershell
.\scripts\Deploy-GeoFlowServer.ps1 `
  -ServerHost SERVER_IP `
  -SshUser root `
  -LaravelRoot /www/wwwroot/geoflow `
  -BaseUrl https://www.example.com `
  -AdminPath geo_admin
```

这个命令不会安装覆盖文件，只会生成并验证部署包、上传服务器、解压并执行远程 dry-run。确认 dry-run 通过后再执行正式安装：

```powershell
.\scripts\Deploy-GeoFlowServer.ps1 `
  -ServerHost SERVER_IP `
  -SshUser root `
  -LaravelRoot /www/wwwroot/geoflow `
  -BaseUrl https://www.example.com `
  -AdminPath geo_admin `
  -Install
```

部署助手使用系统 `scp` / `ssh`，不会保存服务器密码；可以交互输入密码，也可以使用 SSH key。

服务器上解压：

```bash
cd /tmp
unzip customer-a-geoflow-overrides.zip
cd tongzhuo-geoflow-server-overrides
```

## Dry-run 预检

正式安装前先执行 dry-run。它会检查 Laravel 路径、`artisan`、`storage/app` 写入权限、覆盖文件数量、PHP 语法检查、将要覆盖和新增的文件数量。dry-run 不会复制文件，不会执行迁移，也不会清理缓存。

```bash
bash deployment/install-geoflow-overrides.sh \
  --laravel-root /www/wwwroot/geoflow \
  --package-root . \
  --dry-run
```

## 安装到 GEOFlow

把 `/www/wwwroot/geoflow` 替换成真实 Laravel 项目目录：

```bash
bash deployment/install-geoflow-overrides.sh \
  --laravel-root /www/wwwroot/geoflow \
  --package-root .
```

安装脚本会执行：

- 检查 `server-overrides` 和 Laravel `artisan` 是否存在。
- 对覆盖层 PHP 文件执行 `php -l`。
- 把即将覆盖的原文件备份到 `storage/app/tongzhuo-backups/`。
- 复制覆盖层文件。
- 执行 `php artisan migrate --force`。
- 执行 `php artisan optimize:clear`、`route:clear`、`view:clear`。

如果暂时不想执行迁移：

```bash
bash deployment/install-geoflow-overrides.sh \
  --laravel-root /www/wwwroot/geoflow \
  --package-root . \
  --skip-migrate
```

## 部署后验收

先在服务器上执行安装后验收脚本：

```bash
bash deployment/verify-geoflow-overrides.sh \
  --laravel-root /www/wwwroot/geoflow \
  --base-url https://www.example.com \
  --admin-path geo_admin
```

这个脚本会检查关键覆盖文件、CMS/GEO/客户项目/发布设备迁移文件、Laravel `route:list` 中的后台和 API 路由，以及可选的官网/后台 URL 访问状态。

再执行上线烟测脚本：

```bash
bash deployment/smoke-geoflow-workbench.sh \
  --base-url https://www.example.com \
  --admin-path geo_admin
```

烟测脚本会检查官网、AI 抓取入口和后台核心入口的 HTTP 状态，并输出登录后的人工验收清单。它不会登录后台、不会创建渠道、不会发布内容，也不会修改数据。

部署完成后检查：

- 后台可打开：`/geo_admin`
- 官网 CMS 可打开：`/geo_admin/tongzhuo-cms`
- GEO 工作台可打开：`/geo_admin/geo-growth`
- 问题机会可打开：`/geo_admin/geo-opportunities`
- 行动方案可打开：`/geo_admin/geo-plans`
- AI 问答测试可打开：`/geo_admin/geo-answer-tests`
- 发布助手页可打开：`/geo_admin/publisher-assistant`
- 发布设备页可打开：`/geo_admin/publisher-devices`
- 分发管理可打开：`/geo_admin/distribution`
- 客户线索可打开：`/geo_admin/contact-leads`
- 客户项目可打开：`/geo_admin/customer-projects`
- 客户项目详情里“交付报告”可打开，并能使用浏览器打印/保存 PDF。
- 官网 AI 入口可打开：`/llms.txt`、`/llms-full.txt`、`/sitemap.xml`、`/feed.xml`
- 点击发布助手页的“初始化默认渠道”后，能创建 `desktop_publisher` 渠道。
- 点击“同步已发布文章”后，已发布文章进入本地发布助手队列。
- 登录后台后，按烟测脚本输出的人工清单完成：编辑官网页面、保存 FAQ、跑一次 GEO 诊断、创建客户项目、保存交付清单、打开交付报告并打印/保存 PDF。

## 回滚

安装脚本会输出备份目录，例如：

```text
storage/app/tongzhuo-backups/geoflow-overrides-20260717-120000
```

如需回滚，把备份目录中的文件复制回 Laravel 项目对应路径，然后执行：

```bash
php artisan optimize:clear
php artisan route:clear
php artisan view:clear
```
