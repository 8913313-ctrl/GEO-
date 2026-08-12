# Industry adaptation templates

行业模板只保存行业默认值，不保存任何客户事实。运行时组合顺序固定为：

```text
GEO 核心方法包 + 行业模板 + 客户项目配置 = 客户 GEO 项目
```

每个模板必须提供 `templateKey`、`displayName`、`requiredFields`、`defaultQuestionGroups`、`contentTypes`、`terminologyPack`、`promptPreset` 和 `navigationPreset`。

`promptPreset` 只保存未来底层提示词资产的键和版本引用，不在行业模板中复制提示词正文。`requiredFields` 只声明客户交付前必须填写的配置路径，不在模板中填写企业名称、品牌、联系人、域名或备案号。

新增行业时：复制一个模板文件，替换行业默认值，在 `index.mjs` 注册，然后运行 `npm run check:industry-templates`。不得复制后台代码、数据库或桐灼项目种子。
