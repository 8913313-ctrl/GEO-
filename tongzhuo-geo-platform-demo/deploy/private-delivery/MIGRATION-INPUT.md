# migrated 交付模式输入规范

`migrated` 用于把已经验收的客户数据随应用版本迁移到另一台客户服务器。构建器绝不自动读取当前运行目录，必须显式指定由生产备份脚本导出的 backup v2 目录。

## 输入目录

```text
customer-backup/
├─ manifest.json
├─ manifest.sha256
├─ metadata/
└─ payload/
   ├─ database/
   ├─ secrets/
   ├─ state/
   ├─ site-static/
   └─ deployment-config/
```

`manifest.json` 必须满足：

- `format` 为 `tongzhuo-private-backup-v2`；
- `formatVersion` 为 `2`；
- `components` 明确登记各组件是否存在、是否必需及其文件哈希；
- `manifest.sha256` 与 `manifest.json` 的实际 SHA-256 一致。
- `masterKey.activeSource` 不能为 `environment`；依赖外部 `TZ_MASTER_KEY` 的备份不是可独立恢复的迁移包，必须先按客户密钥管理流程处理后重新备份。

## 构建命令

```bash
npm run delivery:build -- \
  --mode migrated \
  --migration-input /secure/export/customer-backup \
  --customer-id customer-a \
  --acknowledge-sensitive-data
```

`--customer-id` 应使用内部不可猜测客户信息的短代号，不要放企业全称、联系人、手机号或合同号。

## 安全要求

- 在受控设备、受限账号和加密磁盘上执行构建；
- 仅通过 VPN、SFTP、企业加密文件交换或等效通道传输；
- 分离传递下载位置和访问凭据；
- 交付包到达目标服务器后核对外部 `.sha256`，解压后再执行 `sha256sum -c SHA256SUMS`；
- 恢复和验收完成后，安全删除服务器上的压缩包、解压后的 `migration` 目录及中转副本；
- 禁止上传到公开网盘、Git、聊天群、普通工单附件或不受控对象存储；
- `migrated` 的 tar.gz 只是压缩包，不是加密容器。

通用演示、首次安装或没有客户数据时必须使用 `blank`，不能为了省事把开发机 `data` 目录直接打包。
