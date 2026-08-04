# 官网与 GEO 后台服务器切换手册

本手册把当前官网保留在 `18080`，并在不占用该端口的情况下验证新版服务。新版由两个独立 Node 进程组成：

```text
staging  : 18182 -> geo-site (官网)    18183 -> geo-admin (后台)
production: 18080 -> geo-site (官网)  18183 -> geo-admin (仅本机)
```

两个服务在同一环境内共享一个持久化 Docker volume，其中保存 SQLite、附件元数据、模型配置、发布器状态和日志。**同一个 volume 同一时刻只能由一组（staging 或 production）服务写入**；不要让 staging 与 production 共同指向同一个 data volume。

本文件只给出操作顺序和命令，不会自动连接服务器、停止服务或删除旧数据。

## 0. 不可跳过的保护规则

1. 不在尚未完成健康检查前停止旧官网。
2. 不在没有独立离机备份的情况下删除旧容器、旧目录或旧数据库。
3. 不复用 staging 与 production 的 data volume。
4. `TZ_MASTER_KEY` 必须在备份、恢复和后续运行中保持不变；不要把它、SSH 密码或模型 API Key 写入本手册、镜像或 Git。

建议先在服务器上以非 root 的部署账号执行 Docker；若使用 root，请把 `deploy/cutover.env` 和 `../.env` 权限设为 `600`。

## 1. 服务器上的准备

将整个交付目录上传到例如 `/opt/tongzhuo-geo`，且官网静态文件目录与 compose 配置保持可读：

```bash
cd /opt/tongzhuo-geo/tongzhuo-geo-platform-demo
cp .env.example .env
cp deploy/cutover.env.example deploy/cutover.env
chmod 600 .env deploy/cutover.env
```

在 `.env` 中至少填写随机 `TZ_MASTER_KEY`，并设置生产环境必需项：

```dotenv
NODE_ENV=production
TZ_MASTER_KEY=<一个长期保存的32字节Base64密钥>
TZ_COOKIE_SECURE=1
TZ_TRUST_PROXY=1
```

在 `deploy/cutover.env` 中设置真实的公开站点 URL 和静态官网目录：

```dotenv
TZ_SITE_STATIC_HOST_PATH=/opt/tongzhuo-geo/demo-company-homepage
TZ_PRODUCTION_SITE_BASE_URL=https://你的官网域名
TZ_PRODUCTION_TRUST_PROXY=1
TZ_PRODUCTION_COOKIE_SECURE=1
```

上例适用于本机 Nginx 终止 HTTPS 且它是唯一公开入口；若继续通过公网 IP 和 `18080` 端口直接提供官网，保持 `TZ_PRODUCTION_TRUST_PROXY=0`，避免客户端伪造 `X-Forwarded-For`。后台正式入口应使用 HTTPS；仅在维护期间通过 localhost SSH 隧道使用 HTTP 时，才临时将 `TZ_PRODUCTION_COOKIE_SECURE` 设为 `0`，维护结束后立即恢复。

先记录旧系统正在使用什么；这一步是为了形成可回滚清单，**不要在此处停止任何进程**：

```bash
sudo ss -ltnp | grep ':18080' || true
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Ports}}'
sudo systemctl list-units --type=service --all | grep -Ei 'nginx|node|php|geo|tongzhuo' || true
```

## 2. 旧系统备份与验证

先分别备份旧网站目录和其数据库。实际路径、服务名和数据库类型以第 1 步的检查结果为准；下列变量必须换成真实值：

```bash
export LEGACY_SITE_DIR=/实际/旧官网目录
export BACKUP_DIR=/opt/tongzhuo-backups/$(date +%Y%m%d-%H%M%S)
sudo mkdir -p "$BACKUP_DIR"
sudo tar -C "$(dirname "$LEGACY_SITE_DIR")" -czf "$BACKUP_DIR/legacy-site.tar.gz" "$(basename "$LEGACY_SITE_DIR")"
sudo sha256sum "$BACKUP_DIR/legacy-site.tar.gz" | sudo tee "$BACKUP_DIR/legacy-site.tar.gz.sha256"
```

若旧系统使用 MySQL/MariaDB，额外导出：

```bash
mysqldump --single-transaction --routines --events -u <db_user> -p <db_name> | gzip > "$BACKUP_DIR/legacy-db.sql.gz"
gzip -t "$BACKUP_DIR/legacy-db.sql.gz"
```

若旧系统是容器，请同时保存其 inspect、镜像和 compose 配置；若是 systemd 服务，保存 unit 文件和环境文件。把备份复制到服务器外部后，才可进入切换步骤。

## 3. 启动 staging（不影响 18080）

从 `deploy` 目录执行：

```bash
cd /opt/tongzhuo-geo/tongzhuo-geo-platform-demo/deploy
docker compose --env-file cutover.env -f docker-compose.staging.yml up --build -d
docker compose --env-file cutover.env -f docker-compose.staging.yml ps
curl -fsS http://127.0.0.1:18183/health/ready
curl -fsS http://127.0.0.1:18182/health/ready
```

通过 SSH 隧道或临时受限防火墙规则访问 staging，完成以下验收：

```bash
ssh -L 18182:127.0.0.1:18182 -L 18183:127.0.0.1:18183 <deploy-user>@<server>
```

浏览器验证：官网静态页、动态文章页、`/sitemap.xml`、`/feed.xml`、`/llms.txt`；后台验证：管理员登录、文章审核、官网栏目发布、文章在官网读到、访问日志回传。使用 staging 生成的测试内容必须明确标识，避免被误认为正式内容。

若旧官网由 GEOFlow 数据导出，先把导出 JSON 放进 staging data volume，执行一次只读预演；预演不会改写新库：

```bash
docker compose --env-file cutover.env -f docker-compose.staging.yml exec geo-admin mkdir -p /app/data/import
docker compose --env-file cutover.env -f docker-compose.staging.yml cp \
  /安全目录/legacy-geoflow-export.json geo-admin:/app/data/import/legacy-geoflow-export.json
docker compose --env-file cutover.env -f docker-compose.staging.yml exec geo-admin \
  node scripts/import-legacy-geoflow.mjs \
  --input /app/data/import/legacy-geoflow-export.json \
  --database /app/data/tongzhuo-production.sqlite \
  --dry-run
```

确认预演中的栏目、已发布文章数量和冲突报告正确后，去掉 `--dry-run` 执行导入。导入器是幂等的，不会覆盖存在冲突的历史文章；空库首次导入才可追加 `--initialize-workspace`。完整导出格式和限制见 [legacy-geoflow-import.md](legacy-geoflow-import.md)。

为 staging 数据创建应用一致性备份：

```bash
docker compose --env-file cutover.env -f docker-compose.staging.yml exec geo-admin node scripts/backup-production.mjs
```

## 4. 将验收数据复制到 production volume

先停止 staging，确保 SQLite WAL 已关闭，再复制 volume。此操作不触及旧系统：

```bash
cd /opt/tongzhuo-geo/tongzhuo-geo-platform-demo/deploy
docker compose --env-file cutover.env -f docker-compose.staging.yml down
docker volume create tongzhuo-geo-production-data
docker run --rm \
  -v tongzhuo-geo-staging-data:/from:ro \
  -v tongzhuo-geo-production-data:/to \
  alpine:3.20 sh -ceu 'test -z "$(find /to -mindepth 1 -maxdepth 1 -print -quit)"; cp -a /from/. /to/'
```

若在 `cutover.env` 中改过 volume 名称，请将上面两个名称替换成对应的 `TZ_STAGING_DATA_VOLUME` 和 `TZ_PRODUCTION_DATA_VOLUME` 值。不要把旧系统的数据库文件直接覆盖到新系统 SQLite 文件；旧数据迁移应使用对应的导入工具并在 staging 验收后再做。

## 5. 正式切换至 18080

先再次确认 staging 已停止且旧服务仍在：

```bash
docker compose --env-file cutover.env -f docker-compose.staging.yml ps
curl -fsS http://127.0.0.1:18080/ || true
```

在同一个维护窗口内，停止记录在第 1 步中的**具体旧服务**，然后立即启动新版。不要使用不带对象的 `pkill`、`docker prune` 或递归删除命令。

```bash
# 仅替换为第 1 步确认过的一个真实名称：
sudo systemctl stop <legacy-service-name>
# 或：docker stop <legacy-container-name>

docker compose --env-file cutover.env -f docker-compose.production.yml up --build -d
docker compose --env-file cutover.env -f docker-compose.production.yml ps
curl -fsS http://127.0.0.1:18183/health/ready
curl -fsS http://127.0.0.1:18080/health/ready
```

从服务器外部验证生产官网 URL、HTTPS、后台受限入口、文章发布和最新文章页。稳定运行并完成备份核验后，再禁用旧服务以防开机重新抢占 18080：

```bash
sudo systemctl disable <legacy-service-name>
# 或：docker rm <legacy-container-name>
```

删除旧系统目录或数据库只能在约定观察期结束、备份经恢复演练确认后执行。建议至少保留一个完整的回滚周期。

## 6. 回滚

如果上线后健康检查、文章读取或发布失败：

```bash
cd /opt/tongzhuo-geo/tongzhuo-geo-platform-demo/deploy
docker compose --env-file cutover.env -f docker-compose.production.yml down
# 重新启动第 1 步记录的旧服务或旧容器
sudo systemctl start <legacy-service-name>
# 或：docker start <legacy-container-name>
```

核验 `18080` 已恢复到旧官网，再分析新系统日志：

```bash
docker compose --env-file cutover.env -f docker-compose.production.yml logs --tail=200 geo-admin geo-site
```

不要在回滚期间更换 `TZ_MASTER_KEY` 或覆盖 production volume；保留它可以继续调查并从第 3 步备份恢复。

## 7. Compose 预检

在任何 `up` 前运行：

```bash
cd /opt/tongzhuo-geo/tongzhuo-geo-platform-demo/deploy
docker compose --env-file cutover.env -f docker-compose.staging.yml config >/dev/null
docker compose --env-file cutover.env -f docker-compose.production.yml config >/dev/null
```

这会解析变量、检查 compose 结构和挂载路径。服务器需要 Docker Engine 与 Docker Compose v2；应用容器使用 Node 24。
