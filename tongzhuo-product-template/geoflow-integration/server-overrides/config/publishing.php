<?php

return [
    'center_v2_enabled' => filter_var(env('PUBLISHING_CENTER_V2_ENABLED', false), FILTER_VALIDATE_BOOLEAN),
    'platform_jobs_enabled' => filter_var(env('PUBLISHER_PLATFORM_JOBS_ENABLED', false), FILTER_VALIDATE_BOOLEAN),
    'device_commands_enabled' => filter_var(env('PUBLISHER_DEVICE_COMMANDS_ENABLED', false), FILTER_VALIDATE_BOOLEAN),
    'device_online_minutes' => max(1, (int) env('PUBLISHER_DEVICE_ONLINE_MINUTES', 2)),
    'default_job_max_attempts' => max(1, (int) env('PUBLISHER_PLATFORM_JOB_MAX_ATTEMPTS', 2)),
    'job_lease_minutes' => max(1, (int) env('PUBLISHER_PLATFORM_JOB_LEASE_MINUTES', 15)),
];
