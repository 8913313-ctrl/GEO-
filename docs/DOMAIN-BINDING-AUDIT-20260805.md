# tongzhuo.ink 域名绑定前审计（2026-08-05）

本审计通过主机指纹校验的 SSH 只读执行完成，没有修改服务器配置、容器、数据、证书或防火墙。

## 当前事实

- `80/tcp` 和 `443/tcp` 从公网可达。
- `80` 由 `productshot` 容器占用；`443` 由 `tongzhuo-geo-production-geo-admin-tls-1` 占用；GEO 官网在公开 `18080`。
- 当前 443 TLS 证书仅包含 IP SAN `124.221.70.55`，不包含 `tongzhuo.ink`，有效期至 2026-08-09。
- 主机没有 `nginx`、`certbot`、`acme.sh`、`lego` 或 `dehydrated` 工具；UFW 未启用，iptables INPUT policy 为 ACCEPT，公网隔离主要依赖 Docker 和云安全组。
- 生产 `TZ_PRODUCTION_SITE_BASE_URL` 仍为 `http://124.221.70.55:18080`，`TZ_PRODUCTION_TRUST_PROXY=0`。
- 审计时主机 DNS 尚未解析 `tongzhuo.ink` 或 `www.tongzhuo.ink`。

## 变更前必须确认

如果域名用于 GEO 后台，可保留 443 的后台容器，申请包含域名的证书并挂载到该容器；若域名还要承载官网，则需要一个统一的 80/443 edge proxy，并确认 `productshot` 的现有业务路由后再迁移。

