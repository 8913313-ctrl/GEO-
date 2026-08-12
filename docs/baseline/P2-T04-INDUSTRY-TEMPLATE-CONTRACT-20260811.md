# P2-T04 行业适配模板接口（2026-08-11）

## 结论

行业适配已经成为独立、可校验的配置层，不复制后台代码，也不保存客户数据。当前注册三个模板：

- `professional-services`
- `building-materials`
- `machinery`

建材与机械通过同一个 `resolveIndustryTemplate()` / `requireIndustryTemplate()` 接口读取；新增第三类行业只需增加模板并注册，不需要复制 GEOFlow 后台。

## 固定接口

每个行业模板必须提供：

- `templateKey`
- `displayName`
- `requiredFields`
- `defaultQuestionGroups`
- `contentTypes`
- `terminologyPack`
- `promptPreset`
- `navigationPreset`

`promptPreset` 当前只保存资产键与待分配版本，不含提示词正文。提示词正文与冻结版本将在 P2-T05/P2-T07 进入底层知识资产库。

## 安全边界

模板校验器拒绝 `tenant_id`、企业名称、品牌、联系人、域名、备案等客户字段。模板可以声明 `company_profile.legal_name` 是交付必填路径，但不能给这个路径填入某个客户的值。

注册表向调用者返回深拷贝，调用方修改返回对象不会污染系统注册值。未知模板必须显式失败，不自动猜测最接近行业。

## 验收

运行：

```text
npm run check:industry-templates
```

检查覆盖：必填字段、键名规范、列表唯一性、建材/机械差异、客户字段拒绝、未知模板拒绝、返回值隔离，以及项目配置示例能解析到已注册模板。

## 下一步

P2-T05 建立系统底层知识资产库。行业模板只能引用方法与提示词资产，不能在后续任务中把完整提示词重新写回模板。
