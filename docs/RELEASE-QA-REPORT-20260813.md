# GEO 私有交付系统发布 QA 报告

日期：2026-08-13  
分支：`codex/qa-fixes-20260812`

## 结论

当前版本达到“可交付候选版”标准：核心业务闭环、客户/项目隔离、四套官网模板、研究数据包、备份恢复、生产安全基础和 Windows 交付包均有通过证据。正式上线仍必须在客户 Linux/Docker 环境完成 TLS、域名、反向代理、模型/OCR 和真实发布渠道验收。因此建议为：**完成部署环境验收后上线**。

## 已验证范围

- 新客户建档：企业资料、业务线、关键词和 GEO 问题基线幂等创建，不继承桐灼或其他客户数据。
- 内容闭环：计划、生成、风险扫描、送审、冻结批准、官网发布；草稿和待审内容不能公开。
- 行业项目：建材、机械、UPS、电源、美妆共用 GEO 底层，未发现跨租户品牌污染。
- 官网：`professional`、`industrial`、`energy`、`beauty` 四套模板；草稿预览与正式快照隔离。
- 研究底层：Citation Lab 2.0.1 数据库和固定 commit 文档快照完成来源、许可、Git blob、SHA-256 和只读加载校验。
- 安全：认证、CSRF、角色权限、活动文件、文章 HTML、资产 SSRF、备份路径/压缩包、发布器设备绑定、Secure Cookie、HSTS。
- 浏览器：四套模板首页、服务、资讯、文章页完成桌面与 390×844 移动端终审，无页面级横向滚动、未命名控件或捕获到的脚本错误。

## 已修复的发布级问题

1. 更正上游 DuckDB 固定来源并重建派生 SQLite；新哈希为 `90c9bfe87c96ff250eb92a5d06e9b18a5aacdc6013b4b4bb7e45be46df886070`。
2. 完成研究文档固定 commit 快照的逐文件校验和原子激活，使空白交付包包含合法活动指针。
3. 修复 Windows GNU tar 对绝对盘符路径的误判，交付包可正常生成。
4. 将含研究文档索引的冷启动测试等待提升为有上限的 30 秒。
5. 去除后台粗侧边强调、圆角粗顶边和 width 布局动画，统一字体栈；Impeccable 扫描结果为 `[]`。
6. 生产公网监听强制 Secure Cookie；HTTPS/可信代理 HTTPS 增加 HSTS。

## 关键证据

- `npm run precheck`：通过。
- `npm run check`：通过。
- `npm run check:private-industry-projects`：UPS、美妆完整项目闭环通过。
- `npm run check:backup`：通过。
- `npm run delivery:check`：通过。
- 空白交付包：307 文件；tar.gz 161,348,410 字节；SHA-256 `611f143560ef674129c9909445a8e8bdddab51f303b676f5fcc19519c10f7f29`。
- `npm audit --omit=dev --audit-level=high`：High/Critical 为 0。

## 上线前必须验收

- 客户实际 Linux、Docker Compose、DNS、TLS 证书和反向代理。
- 真实模型、Embedding、OCR 的费用、配额、超时和供应商安全。
- 真实第三方平台发布；发布器多实例需共享状态或网关级控制。
- 生产公网负载与 30–60 分钟 RSS/CPU/WAL 长稳。
- 完成一次真实文章审核发布、官网回读和隔离备份恢复。

只有当部署环境检查通过、Critical/High 为 0，并且上述外部项有验收记录时，才建议正式公网 Go。
