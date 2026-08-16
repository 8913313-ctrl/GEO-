# 发布器后台自动化运维契约

本文说明后台覆盖层中发布任务的队列互斥、平台范围、能力字段和自恢复调度约定。

## V1 / V2 队列互斥

- V2 分发会创建 `publisher_platform_jobs`，并在 `remote_meta.publisher_assistant.protocol_version` 中写入 `v2`。
- 旧版 `/api/v1/publisher/jobs` 同时按子任务关系和 `protocol_version` 排除 V2 分发。
- 即使客户端处于 `dual` 模式，同一 V2 分发也只能从平台子任务队列领取，不能再从 V1 队列领取。

## 设备平台范围

| platform_filter_mode | enabled_platform_ids_present | enabled_platform_ids | 语义 |
| --- | --- | --- | --- |
| `all` | `false` | `[]` | 不限制平台 |
| `allowlist` | `true` | 非空数组 | 只允许数组中的平台 |
| `none` | `true` | `[]` | 禁用全部平台 |

兼容规则：历史状态没有 `enabled_platform_ids_present` 时，非空数组按旧白名单处理，空数组按未限制处理。后台一旦显式提交平台范围，就同时保存 presence 和 mode。V2 任务列表及领取接口会在服务端再次执行该规则，避免旧客户端把空数组误解为全部允许。

## V2 任务能力字段

平台子任务响应顶层包含 `support_level` 和 `manual_confirmation`，并在 `platform` 对象中包含草稿、直接发布、定时发布能力。任务创建时的预检结果也会写入 `result.preflight`，因此平台目录后续变更不会改写已有任务的人工确认策略。

## 后台自恢复

手工执行：

```bash
php artisan publisher:reconcile --json
```

诊断指定时间点：

```bash
php artisan publisher:reconcile --at=2026-08-14T10:00:00+08:00 --json
```

命令会提升到期的定时任务、释放过期租约、绑定等待设备的任务，并恢复登录状态已经就绪的任务。默认仅在 `PUBLISHER_PLATFORM_JOBS_ENABLED=true` 时执行；诊断时可加 `--force`。

Laravel Scheduler 已每分钟注册该命令并使用 5 分钟重叠锁。服务器仍需配置一个系统级调度入口：

```cron
* * * * * cd /path/to/laravel && php artisan schedule:run >> /dev/null 2>&1
```

可通过 `PUBLISHER_JOB_RECONCILE_SCHEDULE_ENABLED=false` 关闭自动调度。部署后应执行：

```bash
php artisan list | grep publisher:reconcile
php artisan schedule:list
php artisan publisher:reconcile --json
```

本文件只描述源码契约；未配置服务器 Cron 时，Scheduler 不会自行运行。
## Device event stream (SSE)

Set `PUBLISHER_DEVICE_EVENTS_ENABLED=true` to enable a short-lived SSE wake-up stream for publisher devices. It is disabled by default. The stream emits only wake-up hints (`jobs_available`, `desired_state_changed`, and `commands_available`); article content, credentials, leases, and configuration values continue to use the normal authenticated API calls.

Devices reconnect automatically and retain the existing heartbeat and polling timers as the reliability fallback. Configure the reverse proxy to keep `text/event-stream` responses unbuffered and uncached. The included endpoint also sends `X-Accel-Buffering: no`; verify that any proxy/CDN in front of Laravel does not override it.

## Selector health

The device administration page aggregates selector telemetry over the configured recent-day window. A platform step remains `insufficient_data` until it reaches `PUBLISHER_SELECTOR_HEALTH_MIN_SAMPLES`. Once enough samples exist, a hit rate below `PUBLISHER_SELECTOR_HEALTH_ALERT_RATE` is marked `attention`, with average attempted selectors and fallback count to help triage a changed platform page.

This is an in-console operational alert only. It does not send an external notification unless a separate notification channel is configured. V2 telemetry is read from `publisher_platform_jobs`; V1 telemetry is read from legacy distribution metadata, and V2 mirrors are excluded from the V1 pass to prevent double counting.
## Device credential storage

New or re-paired devices store their bearer credential as a tagged SHA-256 digest in the publisher_devices.public_key field; the raw value is not retained by the server. Existing installations are rolling-compatible: the first successful authenticated device request verifies the legacy raw value and upgrades that record in place. A node does not need to re-pair solely for this migration. If its local credential has been lost, issue a new pairing code and register it again.

## Release and deployment acceptance

### Local package gate

Run the following commands before creating a server override package:

~~~powershell
.\geoflow-integration\deployment\check-publisher-automation-contract.ps1
.\scripts\Test-ServerOverrides.ps1
.\scripts\Test-VersionConsistency.ps1
.\scripts\Package-GeoFlowServer.ps1 -OutputPath .\dist\tongzhuo-geoflow-server-overrides.zip
.\scripts\Test-GeoFlowServerPackage.ps1 -PackagePath .\dist\tongzhuo-geoflow-server-overrides.zip -ExpectedVersion ((Get-Content .\product.json -Raw | ConvertFrom-Json).version)
~~~

The contract check is the publisher-specific source gate. The package checks then verify that every required controller, service, route, migration, command, and configuration file is present in the generated archive.

### Server enablement

Enable these feature flags only after the package and migrations have passed:

- PUBLISHING_CENTER_V2_ENABLED=true
- PUBLISHER_PLATFORM_JOBS_ENABLED=true
- PUBLISHER_DEVICE_COMMANDS_ENABLED=true
- PUBLISHER_DEVICE_EVENTS_ENABLED=true
- PUBLISHER_JOB_PROTOCOL=dual during a rolling V1-to-V2 upgrade

Run the deployed verification and Laravel checks:

~~~bash
bash deployment/verify-geoflow-overrides.sh \
  --laravel-root /path/to/geoflow \
  --base-url https://flow.example.com

cd /path/to/geoflow
php artisan migrate:status
php artisan route:list --path=api/v1/publisher
php artisan list --raw | grep -F 'publisher:reconcile'
php artisan schedule:list | grep -F 'publisher:reconcile'
php artisan publisher:reconcile --json
~~~

The verifier checks publisher routes, the reconcile command, and the Laravel schedule registration. The server must still run the system-level Scheduler entry:

~~~cron
* * * * * cd /path/to/geoflow && php artisan schedule:run >> /dev/null 2>&1
~~~

For the SSE endpoint, disable proxy buffering and keep the upstream read timeout longer than the configured event-stream lifetime:

~~~nginx
proxy_buffering off;
proxy_cache off;
proxy_read_timeout 90s;
~~~

After deployment, retain the package SHA-256, package-manifest.json, migration output, route/command/schedule evidence, and the reconcile JSON result with the release record.

### Real-account E2E boundary

Source and contract tests do not replace real third-party account validation. A production acceptance pass must cover each of the 28 catalog platforms with authorized test accounts and operator-assisted OTP or QR verification. Record, per platform:

- login and verification completion;
- session status visible in both the desktop agent and GEOFlow backend;
- editor opening without an extra about:blank tab;
- title, body, image, and draft/manual-confirmation behavior;
- result, selector telemetry, and remote URL synchronization;
- idempotent retry with no duplicate publication.

Do not mark a platform as direct-publish capable solely because its adapter contract passes. Keep unverified platforms in manual-confirmation mode until this real-account evidence is complete.
