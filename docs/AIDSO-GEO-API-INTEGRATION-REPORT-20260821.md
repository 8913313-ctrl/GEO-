# 爱搜 GEO 开放 API 接入报告

- 报告日期：2026-08-21
- 文档来源：[爱搜 GEO API 文档（飞书）](https://s12is4u3s19.feishu.cn/wiki/PN67wIpAViOE2akuUSdcytnqnUg)（最近修改 7月14日）
- 关联代码：`geo-data-hub-demo/aidso-client.mjs`（中转站爱搜适配器）
- 结论摘要：**异步两段式（提交任务 → 轮询结果）接口，鉴权头 `aidso-token`，可直接接入现有中转站架构，无需浏览器自动化或未公开接口。**

---

## 1. 接口总览

| 项 | 值 |
| --- | --- |
| 鉴权方式 | 请求头 `aidso-token: <token>`（Bearer 风格自定义头） |
| 调用消耗 | 每次调用消耗积分，实时价格见 https://geo.aidso.com/question |
| 密钥管理 | https://geo.aidso.com/setting?type=apiKeyManage |
| 开发者服务 | https://geo.aidso.com/apiService |

| # | 用途 | 方法 | 地址 |
| --- | --- | --- | --- |
| 1 | 提交对话任务 | POST | `https://openapi.aidso.com/geo_api/task_commit` |
| 2 | 获取对话结果 | GET | `https://openapi.aidso.com/geo_api/get_result?reqId=<任务id>` |

> 关键特性：异步任务模型。提交后立即返回 `data`（任务 id），结果需按 `reqId` 轮询；`status=ING` 表示处理中，不得当作完成。

---

## 2. 接口一：提交对话任务

### 2.1 请求参数

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `prompt` | string | 是 | 用户问题 |
| `name` | string | 是 | 平台编码（见下表） |
| `thinking_enabled` | string | 否 | 是否开启深度思考：`0` 关闭（默认），`1` 开启 |

### 2.2 支持平台（`name` 取值）

| 平台编码 | 说明 |
| --- | --- |
| `DB` | 豆包 |
| `DP` | DeepSeek |
| `KIMI` | Kimi |
| `TXYB` | 腾讯元宝 |
| `TYQW` | 通义千问 |
| `WXYY` | 文心一言 |
| `BDAI` | 百度 AI |
| `DYAI` | 抖音 AI |
| `DOUBA` | 豆包 APP |
| `DPA` | DeepSeek APP |
| `TYQWA` | 通义千问 APP |
| `TXYBA` | 腾讯元宝 APP |
| `XHSA` | 小红书问一问 |

### 2.3 示例请求

```bash
curl --location --request POST 'https://openapi.aidso.com/geo_api/task_commit' \
--header 'aidso-token: 此处填入token' \
--header 'Content-Type: application/json' \
--data-raw '{
    "prompt": "面霜推荐",
    "name": "DB",
    "thinking_enabled": 0
}'
```

### 2.4 响应字段说明

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `code` | int | 业务状态码（见第 6 节） |
| `msg` | string | 结果描述 |
| `data` | string | **任务 id（reqId）**，后续轮询使用 |

### 2.5 示例返回

```json
{
    "code": 200,
    "msg": "成功",
    "data": "8abcb01d-fff6-4ba0-9d11-d60d693d582d"
}
```

---

## 3. 接口二：获取对话结果

### 3.1 Query 参数

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `reqId` | string | 是 | 提交任务接口返回的任务 id |

### 3.2 示例请求

```bash
curl --location --request GET 'https://openapi.aidso.com/geo_api/get_result?reqId=f716880f-3121-4359-b65b-xxx4792' \
--header 'aidso-token: 此处填入token'
```

### 3.3 示例返回

**处理中（`status: ING`）**：

```json
{
  "code": 200,
  "msg": "success",
  "data": {
    "prompt": "面霜推荐",
    "status": "ING",
    "result": [],
    "fetch_time": 1720000000
  }
}
```

**处理完成（`status: SUCCESS`）**：

```json
{
  "code": 200,
  "msg": "success",
  "data": {
    "prompt": "面霜推荐",
    "status": "SUCCESS",
    "result": [
      {
        "context": "...",
        "quote": "...",
        "rich_media_block": "..."
      }
    ]
  }
}
```

> 注：`data` 内字段（context / quote / rich_media_block 等）的完整表格在源文档中以画布渲染，文本无法直接提取；上表基于文档结构整理，正式开发前应以真实返回为准并做 schema 校验。

### 3.4 关键字段

- `data.prompt`：本次问题原文回显
- `data.status`：`ING`（处理中）/ `SUCCESS`（完成）
- `data.result`：结果数组，处理中为空
- `data.fetch_time`：观测时间（Unix 秒）

---

## 4. context 结构化卡片

`context` 为正文结果内容，类型 string。部分平台结果中，`context` 内嵌结构化卡片数据，以标记形式出现在字符串中，格式为：

```
render_ecom_card_widget_<类型>_start:
[...json...]
render_ecom_card_widget_<类型>_end:
```

目前已明确的卡片类型与字段：

### 4.1 DOUBA 商品卡片（`product`）

```json
[
  {
    "text": "商品标题",
    "seller_name": "店铺名称",
    "image_url": "商品图片",
    "pid": "商品ID",
    "jump_url": "商品跳转链接"
  }
]
```

### 4.2 TYQWA 淘宝商品卡片（`taobao`）

```json
[
  {
    "title": "商品标题",
    "shop_name": "店铺名称",
    "pic_path": "商品图片",
    "price": "商品价格",
    "jump_url": "商品跳转链接",
    "source_seq": "来源序号",
    "auctionURL": "商品原始链接",
    "item_id": "商品ID",
    "card_type": "single_product"
  }
]
```

### 4.3 TYQWA 大麦卡片（`damai`）

```json
[
  {
    "name": "演出名称",
    "venueName": "场馆名称",
    "showTime": "演出时间",
    "cityName": "城市",
    "verticalPic": "演出海报",
    "priceShowText": "价格展示文案",
    "webURL": "跳转链接",
    "priceLow": "最低价",
    "minPrice": "最小价格",
    "maxPrice": "最大价格",
    "priceStr": "价格字符串",
    "showVenueName": "城市和场馆组合",
    "source_seq_id": "来源序号",
    "id": "演出ID"
  }
]
```

### 4.4 TYQWA 高德卡片（`gaode`）

```json
[
  {
    "source_seq": "source_xxxxxx",
    "name": "杭州西湖风景名胜区",
    "poi_id": "B0FFG7V0XX",
    "poi_summary": "著名风景名胜区，可游览断桥、苏堤等景点",
    "distance_formatted": "距您1.2公里",
    "photos": "https://example.com/poi.jpg",
    "address": "浙江省杭州市西湖区龙井路1号"
  }
]
```

### 4.5 其他卡片

文档另有 DOUBA 本地生活、TXYBA 小程序、TXYBA 京东三类卡片章节，但代码块在飞书虚拟滚动中未能完整渲染，具体 JSON 结构未获取到。接入前应向爱搜方确认这三类的 `render_ecom_card_widget_<类型>` 标记名与字段。

---

## 5. 处理完成示例返回（面霜推荐场景）

以面霜推荐为例，返回结果按「油皮/混油、干皮/沙漠皮、敏感肌、抗老需求」四大类组织，覆盖平价、中端、大牌价位段（AI 速览摘要，具体示例 payload 以真实调用为准）。

---

## 6. 状态码

| 状态码 | 含义 | 处理建议 |
| --- | --- | --- |
| 200 | 请求成功 | 正常 |
| 400 | reqId 未提交 | 参数错误，检查请求 |
| 401 | 未授权（重新获取 token） | 轮换 aidso-token，自动重试需谨慎 |
| 405 | 参数错误 | 检查请求体/Query 参数 |
| 406 | 积分不足 | 停止任务，通知充值 |
| 429 | 请求频繁 | 退避重试 |
| 500 | 服务异常 | 可重试；**提交接口 5xx 时不得自动重提任务**（可能已受理） |

---

## 7. 与现有代码（aidso-client.mjs）对照

| 本报告要点 | 现有实现（geo-data-hub-demo） | 差距 |
| --- | --- | --- |
| POST `task_commit`，返回 `data` 为 reqId | `submit()` 调 `task_commit`，从响应提取 `reqId` | 一致 |
| GET `get_result?reqId=` | `poll()` 调 `get_result`，Query 带 `reqId` | 一致 |
| `ING` 为处理中 | `PENDING_STATUSES` 含 ING/PENDING/PROCESSING 等 | 一致 |
| `SUCCESS` 为完成 | `SUCCESS_STATUSES` 含 SUCCESS/DONE/COMPLETED 等 | 一致，且实现比文档更宽容（兼容多态状态） |
| 提交 5xx 不自动重提 | `submission_uncertain` 状态、禁止自动重提交 | 一致，实现已覆盖 |
| 429 退避 | `_request` 对 408/429 retryable | 一致 |
| 积分不足 406 | 未在代码中显式特判 | **建议补充**：406 应映射为额度类错误并告警 |
| 卡片标记解析 | 未实现 `render_ecom_card_widget_*` 解析 | **建议补充**：按 §4 实现标记提取与标准化 |
| 平台编码（DB/KIMI/DOUBA…） | `taskPayload(item)` 以本地 platform 映射 | 需核对映射表与 §2.2 一致 |

---

## 8. 接入建议与风险

1. **token 安全**：`aidso-token` 仅存服务端密钥存储（现状满足），不得进浏览器/日志/payload。
2. **幂等**：同一幂等键不可重复提交；同一 reqId 只绑定一个任务项（现状满足）。
3. **轮询策略**：受控退避 + 超时熔断；`ING` 不视为完成。
4. **406 积分不足**：接入额度告警与人工对账流程（现状有账本，建议加显式告警）。
5. **卡片解析**：按 §4 实现 `render_ecom_card_widget_*` 解析，解析失败必须保留原文（现状 quote 已如此处理）。
6. **待确认**：本地生活 / 小程序 / 京东三类卡片的字段结构、`fetch_time` 与 `data.result` 的元素 schema 应以真实账号返回为准补充验收用例。
7. **范围边界**：只调用上述两个已确认 OpenAPI；不得抓取爱搜页面 DOM、登录态或未公开接口（与 AIDSO-EFFECT-DETECTION-INTEGRATION.md §3 一致）。

---

## 9. 参考

- 飞书文档：[爱搜GEOAPI文档](https://s12is4u3s19.feishu.cn/wiki/PN67wIpAViOE2akuUSdcytnqnUg)
- 项目文档：[AIDSO-EFFECT-DETECTION-INTEGRATION.md](../tongzhuo-geo-platform-demo/docs/AIDSO-EFFECT-DETECTION-INTEGRATION.md)
- 代码：[aidso-client.mjs](../geo-data-hub-demo/aidso-client.mjs)、[RELAY-FOUNDATION.md](../geo-data-hub-demo/RELAY-FOUNDATION.md)
