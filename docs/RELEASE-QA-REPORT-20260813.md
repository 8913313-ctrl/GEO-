# GEO 私有交付系统发布 QA 报告

日期：2026-08-13  
分支：`codex/qa-fixes-20260812`

## 结论

当前版本达到“可交付候选版”标准：核心业务闭环、客户/项目隔离、六套官网模板、研究数据包、备份恢复、生产安全基础、Windows 交付包、10,000 篇官网容量和 30 分钟长稳均有通过证据。真实浏览器已完成空白客户初始化、企业身份配置、工业模板选择、首次发布、公开站回读、咨询提交、后台认领和跟进状态更新。正式上线仍必须在客户 Linux/Docker 环境完成 TLS、域名、反向代理、模型/OCR 和真实发布渠道验收。因此建议为：**完成部署环境验收后上线**。

## 已验证范围

- 新客户建档：企业资料、业务线、关键词和 GEO 问题基线幂等创建，不继承桐灼或其他客户数据。
- 内容闭环：计划、生成、风险扫描、送审、冻结批准、官网发布；草稿和待审内容不能公开。
- 行业项目：建材、机械、UPS、电源、美妆共用 GEO 底层，未发现跨租户品牌污染。
- 官网：`professional`、`industrial`、`energy`、`beauty`、`engineering-case`、`product-matrix` 六套模板；草稿预览与正式快照隔离。普通客户官网默认推广客户自身产品与能力，不继承桐灼 GEO 销售话术。
- 研究底层：Citation Lab 2.0.1 数据库和固定 commit 文档快照完成来源、许可、Git blob、SHA-256 和只读加载校验。
- 安全：认证、CSRF、角色权限、活动文件、文章 HTML、资产 SSRF、备份路径/压缩包、发布器设备绑定、Secure Cookie、HSTS。
- 浏览器：既有模板页面已完成桌面与 390×844 移动端终审；本轮又以全新工业客户“清源工业装备”真实走通后台建站、首次发布和线索闭环。首次发布前公开站返回 404 + noindex，发布后返回 200，且无桐灼业务数据污染。

## 已修复的发布级问题

1. 更正上游 DuckDB 固定来源并重建派生 SQLite；新哈希为 `90c9bfe87c96ff250eb92a5d06e9b18a5aacdc6013b4b4bb7e45be46df886070`。
2. 完成研究文档固定 commit 快照的逐文件校验和原子激活，使空白交付包包含合法活动指针。
3. 修复 Windows GNU tar 对绝对盘符路径的误判，交付包可正常生成。
4. 将含研究文档索引的冷启动测试等待提升为有上限的 30 秒。
5. 去除后台粗侧边强调、圆角粗顶边和 width 布局动画，统一字体栈；Impeccable 扫描结果为 `[]`。
6. 生产公网监听强制 Secure Cookie；HTTPS/可信代理 HTTPS 增加 HSTS。
7. 修复后台与官网同时连接全新 SQLite 时竞争执行非幂等迁移的问题；迁移获得写锁后再次确认版本，四进程并发首启连续三轮通过。
8. 新增从解压交付包运行的自动门禁，覆盖管理员初始化、客户建档、CMS 审核发布、官网回读、备份、破坏、恢复和恢复后回读。
9. 修复普通行业客户官网默认宣传 GEO 服务的问题；GEO 保留为后台底层能力，客户可见层改为企业产品、能力和采购咨询。
10. 发布官网时增加咨询入口门禁：在线表单启用时，“联系我们”页未公开则阻止发布，避免首页 CTA 跳转 404。
11. 正式交付构建默认拒绝脏 Git 工作区；Docker Engine 最低 24、Compose 最低 2.20 由预检脚本实际解析验证。
12. 私有交付环境模板已同步 AI 上游重试总预算、周期草稿和内容资产巡检参数，并删除重复调度配置。

## 关键证据

- `npm run precheck`：通过。
- `npm run check`：通过。
- `npm run check:private-industry-projects`：UPS、美妆完整项目闭环通过。
- `npm run check:backup`：通过。
- `npm run delivery:check`：通过。
- `npm run check:clean-delivery-runtime`：解压包独立运行、发布和恢复闭环通过。
- `npm run check:concurrent-migrations`：四进程首次启动迁移竞争回归通过。
- `npm run check:site-capacity`：10,000 篇已审核发布文章下，首页、资讯、文章、sitemap、RSS 和 llms-full 全部成功；热态核心页面 p95 不高于 56.69ms，冷缓存 sitemap p95 约 479.20ms（本机 Windows/Node 26 数据，不等同生产 SLA）。
- `npm run check:runtime-endurance`：1,000 篇文章、30 分钟、1,074 次请求、错误 0；p50 65.13ms、p95 71.67ms、p99 76.07ms；后半程 RSS -0.60%，WAL 稳定在约 4.02MB。
- 最新空白交付包源码提交：`7bc19431c462f7e0479a463acff4eee9e526f318`；manifest 与 `SOURCE_VERSION` 一致，`sourceDirty=false`。
- 交付包目录共 323 个文件（manifest 记录 321 个 payload 文件，另含 manifest 与总校验文件）；归档大小 `161410151` bytes。
- 最新空白交付包 SHA-256：`bc40bbb3bb086189e79845b7320f30a6f3d291296c1675eca782497bac8fbf93`；不含客户数据和恢复密钥。
- `npm audit --omit=dev --audit-level=high`：High/Critical 为 0。

## 上线前必须验收

- 客户实际 Linux、Docker Compose、DNS、TLS 证书和反向代理。
- 真实模型、Embedding、OCR 的费用、配额、超时和供应商安全。
- 真实第三方平台发布；发布器多实例需共享状态或网关级控制。
- 客户生产规格服务器的公网容量基线、告警阈值和高峰流量复测；本机 30 分钟长稳已通过，但没有替代目标 Linux 主机的观测。
- 完成一次真实模型生成、真实文章审核发布和第三方渠道回读；解压包的 CMS 发布、官网回读和隔离备份恢复已通过。

只有当部署环境检查通过、Critical/High 为 0，并且上述外部项有验收记录时，才建议正式公网 Go。
