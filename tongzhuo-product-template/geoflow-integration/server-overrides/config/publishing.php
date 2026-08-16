<?php

return [
    'center_v2_enabled' => filter_var(env('PUBLISHING_CENTER_V2_ENABLED', false), FILTER_VALIDATE_BOOLEAN),
    'platform_jobs_enabled' => filter_var(env('PUBLISHER_PLATFORM_JOBS_ENABLED', false), FILTER_VALIDATE_BOOLEAN),
    'job_protocol' => env('PUBLISHER_JOB_PROTOCOL'),
    'device_commands_enabled' => filter_var(env('PUBLISHER_DEVICE_COMMANDS_ENABLED', false), FILTER_VALIDATE_BOOLEAN),
    'device_events_enabled' => filter_var(env('PUBLISHER_DEVICE_EVENTS_ENABLED', false), FILTER_VALIDATE_BOOLEAN),
    'device_events_max_seconds' => max(5, min(60, (int) env('PUBLISHER_DEVICE_EVENTS_MAX_SECONDS', 25))),
    'device_events_poll_ms' => max(250, min(5000, (int) env('PUBLISHER_DEVICE_EVENTS_POLL_MS', 1000))),
    'device_online_minutes' => max(1, (int) env('PUBLISHER_DEVICE_ONLINE_MINUTES', 2)),
    'default_job_max_attempts' => max(1, (int) env('PUBLISHER_PLATFORM_JOB_MAX_ATTEMPTS', 2)),
    'job_lease_minutes' => max(1, (int) env('PUBLISHER_PLATFORM_JOB_LEASE_MINUTES', 15)),
    'legacy_job_lease_minutes' => max(1, (int) env('PUBLISHER_LEGACY_JOB_LEASE_MINUTES', 15)),
    'job_reconcile_limit' => max(10, min(500, (int) env('PUBLISHER_JOB_RECONCILE_LIMIT', 200))),
    'job_reconcile_schedule_enabled' => filter_var(env('PUBLISHER_JOB_RECONCILE_SCHEDULE_ENABLED', true), FILTER_VALIDATE_BOOLEAN),
    'job_retry_backoff_seconds' => max(1, min(3600, (int) env('PUBLISHER_JOB_RETRY_BACKOFF_SECONDS', 30))),
    'selector_health_min_samples' => max(1, (int) env('PUBLISHER_SELECTOR_HEALTH_MIN_SAMPLES', 5)),
    'selector_health_alert_rate' => max(0.01, min(1, (float) env('PUBLISHER_SELECTOR_HEALTH_ALERT_RATE', 0.8))),
    'selector_health_lookback_days' => max(1, min(90, (int) env('PUBLISHER_SELECTOR_HEALTH_LOOKBACK_DAYS', 7))),
];
