# P2-T01 项目配置契约记录（2026-08-11）

## 已完成

模板配置现在有一组明确的 GEO 产品字段：

- `project`：项目 slug、名称和状态；
- `tenant_id`：项目数据隔离主键；
- `product_capability`：固定为 `geo`，表示共享 GEO 核心能力；
- `industry_template`：行业适配包标识，不存客户事实；
- `company_profile`、`brand`、`site`、`contact`：客户自己的身份、品牌、网站和联系信息；
- `integrations`：服务连接边界；
- `methodology`：版本化 GEO 方法包和提示词引用。

当前仍保留旧配置块作为迁移兼容层，因为交付脚本还读取 `company`、`website` 和 `geoflow` 等字段。兼容层不新增第二套身份主键；后续任务将把校验器和交付脚本切换为 canonical 字段，再删除重复字段。

## 验收

```powershell
$cfg = Get-Content .\tongzhuo-product-template\config\client-config.example.json -Raw -Encoding UTF8 | ConvertFrom-Json
.\tongzhuo-product-template\scripts\Test-CustomerConfig.ps1 -ConfigPath .\tongzhuo-product-template\config\client-config.example.json
```

已确认配置可以在不修改业务代码的情况下改写为另一家企业，并保留现有客户交付脚本兼容性。尚未创建建材实例，也尚未修改渲染器或后台业务逻辑。

## 下一项

`P2-T02`：逐对象族审计并补齐 `tenant_id` 的创建、查询、详情、更新、删除、导出和后台任务过滤；先提交迁移设计，再实现。
