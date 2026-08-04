# 旧 GEOFlow 官网数据导入

这个工具只用于一次或少数几次、经过人工导出的历史官网数据迁移。它不会连接旧系统，不会删除旧程序，不会导入账号、密码、草稿、模型配置、访问日志或发布器数据。

迁移范围严格限定为：

- 官网 CMS 栏目：写入工作区 `site.cms.categories`；
- 已发布文章：写入 `content_articles` 和不可变的 `content_article_versions`；
- 文章标题、正文、摘要、栏目、关键词、slug、原发布时间、源网址和导入来源说明。

## 导出文件契约

文件必须是 UTF-8 JSON，顶层 `format` 必须是 `tongzhuo-legacy-geoflow-export-v1`。`source.id` 是不可变的迁移批次标识：相同 `source.id` 只能重跑完全相同的数据；导出有变化时，请创建新的导出批次 ID，而不是覆盖已发布历史记录。

```json
{
  "format": "tongzhuo-legacy-geoflow-export-v1",
  "exportedAt": "2026-07-26T08:00:00.000Z",
  "source": {
    "id": "geoflow-site-2026-07-26",
    "system": "GEOFlow",
    "baseUrl": "https://www.example.com"
  },
  "categories": [
    {
      "id": "industry",
      "name": "行业资讯",
      "slug": "insights",
      "parentId": null,
      "description": "企业公开资讯",
      "seoDescription": "企业行业资讯",
      "navVisible": true,
      "status": "active",
      "sortOrder": 0
    }
  ],
  "articles": [
    {
      "id": "legacy-post-1",
      "title": "制造业企业如何建立 GEO 内容体系",
      "slug": "manufacturing-geo-content",
      "categoryId": "industry",
      "contentHtml": "<p>正文 HTML</p>",
      "contentText": "可选；没有时由 HTML 提取",
      "excerpt": "文章摘要",
      "keywords": ["制造业 GEO", "内容体系"],
      "publishedAt": "2025-12-01T08:30:00+08:00",
      "sourceUrl": "https://www.example.com/insights/manufacturing-geo-content",
      "author": "企业名称"
    }
  ]
}
```

每一篇文章必须引用本文件内存在的 `categoryId`，并且必须有 `id`、`title`、`slug`、`publishedAt` 和至少一种正文 (`contentHtml` 或 `contentText`)。栏目和文章 ID、slug 都不能重复。

## 安全与状态处理

- 先拒绝含脚本、表单、iframe、内联事件、`javascript:` / `data:` URL 等活动 HTML 的正文；不会静默修改原文。
- 每篇历史文章以 `source=import` 保存，`status=published`，当前版本为 `approved + frozen`。
- 保留原发布时间（统一为 UTC ISO 时间）和原始时间字符串；没有伪造知识库引文。
- 风险扫描状态标为 `warning`，带有 `LEGACY_IMPORT_REVIEW` 记录，表示仅完成了结构安全检查。历史文章如要重新生成、改写或再次发布，仍应走当前的风险和人工审核流程。
- 导入使用稳定生成的 ID，完全相同的导出重跑是幂等的；发现同 ID 但内容不同会立即中止，绝不覆盖已发布历史文章。
- 所有创建动作都会写入审计日志和工作区导入台账 `site.cms.legacyImports`。

## 运行方式

先备份生产数据库，再预演：

```powershell
node scripts/import-legacy-geoflow.mjs --input .\legacy-geoflow-export.json --database .\data\tongzhuo-production.sqlite --dry-run
```

确认输出的栏目数和文章数后执行正式导入：

```powershell
node scripts/import-legacy-geoflow.mjs --input .\legacy-geoflow-export.json --database .\data\tongzhuo-production.sqlite
```

仅在全新、尚未初始化的数据库中才可增加 `--initialize-workspace`。它会创建一个最小工作区骨架；已有生产工作区不要使用该参数。

自检：

```powershell
node scripts/check-legacy-geoflow-import.mjs
```
