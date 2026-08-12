# P2-T06：UPS_GEO 方法论候选规则审计

日期：2026-08-12  
状态：候选规则已提取，等待来源/授权复核；未发布 `geo-core` 正式版本。

## 本次完成

从 `D:\Backup\Documents\UPS_GEO` 的项目契约和研究笔记中，按六个主题提取了 16 条候选规则：

1. 企业数字身份
2. 官网事实与第一方信源
3. 问题地图
4. 内容与引用
5. 发布与复盘
6. 风险边界

机器可读清单：

`docs/baseline/P2-T06-UPS-GEO-RULE-CANDIDATES-20260812.json`

校验命令：

```powershell
npm run check:ups-geo-rules
```

## 复用边界

- 所有规则当前统一标记为 `candidate-global-after-approval`，不能直接作为已发布方法论或销售承诺。
- `projects/` 目录中的山东金沣昌事实、案例和证据不在本次提取范围，不能进入全局资产。
- `references/` 中的第三方仓库快照、论文全文、数据集和字体不复制到客户共用资产；如需使用，只记录来源、许可证和摘要。
- 规则只描述方法和治理约束；企业名称、品牌、域名、联系人、产品参数和效果数字必须从客户自己的项目空间读取。
- 根目录没有发现 `LICENSE`，因此 UPS_GEO 自有资料的再分发仍需负责人确认。

## 已加入的底层测试

`foundation-assets/geo-core-drafts.mjs` 已补充 6 类生成门禁测试，覆盖：

- 企业事实必须引用已审核知识；
- 研究基线不能冒充实时表现；
- 单平台采样不能推广成全平台结论；
- 引用、提及、吸收和业务结果必须分开；
- 缺少实验对照时不得生成效果承诺；
- 缺少企业证据时必须记录知识缺口且不得补写事实。

已验证：

```text
npm run check:ups-geo-rules       通过（6 个主题、16 条规则）
npm run check:foundation-assets   通过
node scripts/check-content-workflow.mjs 通过
node scripts/check-content-api.mjs      通过
```

## 尚未完成的发布门

在以下事项完成前，不得把 `MVER-GEO-CORE-DRAFT-1` 改为正式发布版本：

- 项目负责人确认 UPS_GEO 自有资料是否允许进入产品私有交付；
- 每条规则完成来源文件、章节和定位复核；
- 研究结论、行业观点、内部经验和待验证假设完成分类；
- 对涉及第三方项目的数据和结论完成许可证与署名检查；
- 由 GEO 负责人确认规则适用于所有行业，而不是只适用于 UPS 行业；
- 将候选规则映射到方法论、提示词和质量规则的具体字段，并补充失败样例。

## 下一步

继续完成 P2-T06 第 4 步：负责人逐条确认 `approved / rejected`。系统已经实现审批与发布门；只有 16 条必需规则全部通过、明确允许全局复用且来源 SHA-256 匹配时，才允许发布不可变的 `geo-core-methodology-v1`。发布成功后才进入 P2-T07。
