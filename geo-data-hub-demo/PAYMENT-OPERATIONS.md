# 收款订单、开票与支付接入边界

中央中转站现在提供的是“可审计的收款订单闭环”，而不是伪造的在线支付页。

在尚未签约支付商户、未取得回调验签规则和财税系统接口前，生产环境应按下面的流程工作：

```text
创建待核验收款订单
  -> 财务在真实银行/微信/支付宝/合同系统核验到账
  -> 中央后台确认到账（追加 top_up 账本）
  -> 创建开票申请（开票资料加密保存）
  -> 在真实财税系统开票
  -> 中央后台登记外部发票号码 / 作废或红冲记录
```

创建订单不会改变客户积分。只有 `confirm` 成功时，系统才会在同一数据库事务中写入不可变 `relay_billing_ledger`，并将订单标为 `paid`。同一收款参考不能用于两笔订单；确认请求和创建请求都支持幂等处理。

## 管理 API

以下接口全部要求中央管理员 HTTPS 会话或 CLI 根凭证。浏览器会话的状态变更仍受同源 CSRF 防护。

| 操作 | API |
| --- | --- |
| 创建待核验订单 | `POST /api/v1/admin/payment-orders` |
| 查询订单 | `GET /api/v1/admin/payment-orders` |
| 核验到账并入账 | `POST /api/v1/admin/payment-orders/:paymentOrderId/confirm` |
| 作废未到账订单 | `POST /api/v1/admin/payment-orders/:paymentOrderId/cancel` |
| 创建开票申请 | `POST /api/v1/admin/invoice-requests` |
| 查询开票申请 | `GET /api/v1/admin/invoice-requests` |
| 在外部开票后登记号码 | `POST /api/v1/admin/invoice-requests/:invoiceRequestId/issue` |
| 登记撤销 / 红冲 | `POST /api/v1/admin/invoice-requests/:invoiceRequestId/void` |

创建收款订单的关键字段：

```json
{
  "tenantId": "tenant_...",
  "idempotencyKey": "payment-order:...",
  "paymentChannel": "offline_bank",
  "amountCents": 250000,
  "currency": "CNY",
  "credits": 5000,
  "externalOrderReference": "contract-or-sales-order"
}
```

`amountCents` 使用分，避免浮点金额误差。允许的收款渠道是 `offline_bank`、`wechat_transfer`、`alipay_transfer` 和 `contract_grant`；后者可为零金额赠送，其他渠道必须有正金额。

确认到账时必须给出唯一的 `paymentReference`（银行流水、商户单号或合同编号）及人工核验说明。订单确认后不可在中转站直接退款或作废，以免中央积分账本和真实资金渠道出现不一致。

## 发票资料与隐私

开票申请只能关联已确认到账且金额大于零的订单。发票抬头用于列表展示；纳税人识别号、联系人和邮箱使用中央 `TZ_RELAY_MASTER_KEY` 加密保存。列表、创建和状态变更响应默认不返回这些资料；仅经过管理员认证且显式传入 `?includeBilling=true` 的单笔查询才会返回。

“登记已开票”只记录已由真实财税系统开出的外部发票号码，不产生发票文件，不代表税务合规凭证。已开票申请的作废同样只记录审计结果；应先在真实财税系统完成作废或红冲。

## 尚需外部签约后接入的能力

在线支付、自动退款、电子发票文件和支付/税务回调都依赖外部商户资料，不能用 Mock 代替生产验收。接入时至少需要：

- 支付商户号、签名密钥轮换机制、回调 IP / mTLS 或验签规范；
- 支付状态查询和退款 API 的幂等规则；
- 财税服务商合同、开票授权、发票号码与红冲回调规则；
- 对账单下载权限、财务审批和异常人工处理责任人。

届时应新增独立的支付适配器和回调验签端点。适配器只能将“已验签且可追溯”的支付成功事件转换为上述 `confirm` 操作，绝不能让浏览器回调或客户输入直接增加积分。
