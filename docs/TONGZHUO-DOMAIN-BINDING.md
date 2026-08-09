# tongzhuo.ink 域名绑定执行说明

## DNS 记录

在阿里云云解析为 `tongzhuo.ink` 添加或更新，TTL 可保持默认 `600`：

| 主机记录 | 类型 | 记录值 |
| --- | --- | --- |
| `@` | `A` | `124.221.70.55` |
| `www` | `A` 或 `CNAME` | `124.221.70.55` 或 `tongzhuo.ink` |
| `admin` | `A` | `124.221.70.55` |

官网主入口为 `https://tongzhuo.ink/`，`www.tongzhuo.ink` 跳转到主入口；灼见 GEO 后台为 `https://admin.tongzhuo.ink/`。

DNS 生效前，`Resolve-DnsName tongzhuo.ink -Type A` 应返回 SOA 或无结果；生效后应返回 `124.221.70.55`。

## 服务器执行

DNS 生效后，在生产服务器的项目目录执行：

```bash
cd /opt/tongzhuo-geo/tongzhuo-geo-platform-demo
sudo EXPECTED_IP=124.221.70.55 ALLOW_REPLACE_PRODUCTSHOT=1 bash deploy/bind-tongzhuo-domains.sh
```

脚本会把 `geo-site` 和 `geo-admin-tls` 改为本机监听，替换旧的 `productshot` 公网 80 入口，启动 `tongzhuo-domain-edge` Caddy 容器占用公网 `80/443`，并自动为官网和后台签发 HTTPS 证书。脚本执行前会确认三个域名已经解析到目标 IP；如未生效会直接退出。
