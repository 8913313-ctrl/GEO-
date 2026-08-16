<?php

namespace App\Console\Commands;

use App\Services\Publishing\PublisherPlatformJobLifecycleService;
use Carbon\Carbon;
use Illuminate\Console\Command;
use Throwable;

class ReconcilePublisherPlatformJobsCommand extends Command
{
    protected $signature = 'publisher:reconcile
        {--at= : Optional ISO-8601 timestamp used for deterministic diagnostics}
        {--force : Run even when the platform-jobs API feature flag is disabled}
        {--json : Emit the reconciliation counters as JSON}';

    protected $description = 'Promote scheduled publisher jobs, release expired leases, and rebind waiting jobs.';

    public function handle(PublisherPlatformJobLifecycleService $lifecycle): int
    {
        if (! $this->option('force') && ! (bool) config('publishing.platform_jobs_enabled', false)) {
            $this->components->info('Publisher platform jobs are disabled; reconciliation was skipped.');

            return self::SUCCESS;
        }

        $at = null;
        $atOption = trim((string) $this->option('at'));
        if ($atOption !== '') {
            try {
                $at = Carbon::parse($atOption);
            } catch (Throwable $exception) {
                $this->components->error('Invalid --at timestamp: '.$exception->getMessage());

                return self::INVALID;
            }
        }

        $counts = $lifecycle->reconcile($at);
        if ($this->option('json')) {
            $encoded = json_encode($counts, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            $this->line($encoded !== false ? $encoded : '{}');

            return self::SUCCESS;
        }

        $this->table(['Action', 'Count'], [
            ['scheduled_promoted', (int) ($counts['scheduled'] ?? 0)],
            ['leases_released', (int) ($counts['leases_released'] ?? 0)],
            ['jobs_bound', (int) ($counts['bound'] ?? 0)],
            ['login_recovered', (int) ($counts['login_recovered'] ?? 0)],
        ]);

        return self::SUCCESS;
    }
}
