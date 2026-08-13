<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('article_distributions') || ! Schema::hasColumn('article_distributions', 'id') || ! Schema::hasColumn('article_distributions', 'idempotency_key')) {
            return;
        }

        $this->backfillAndDisambiguateKeys();
        $this->ensureIdempotencyUniqueIndex();
        $this->dropLegacyBatchUniqueIndex();
    }

    public function down(): void
    {
        // Forward-only. Removing the idempotency index would make concurrent
        // retries unsafe, and restoring the legacy batch index would prevent
        // a later V2 retry after a partial platform failure.
    }

    private function backfillAndDisambiguateKeys(): void
    {
        DB::table('article_distributions')
            ->select(['id', 'idempotency_key'])
            ->chunkById(500, function ($rows): void {
                foreach ($rows as $row) {
                    $original = (string) ($row->idempotency_key ?? '');
                    $normalized = trim($original);
                    if ($normalized !== '' && mb_strlen($normalized) <= 120) {
                        if ($normalized !== $original) {
                            $conflicts = DB::table('article_distributions')
                                ->where('id', '!=', (int) $row->id)
                                ->where('idempotency_key', $normalized)
                                ->exists();
                            if ($conflicts) {
                                $normalized = $this->uniqueBackfillKey($normalized, (int) $row->id, 'normalize');
                            }
                            DB::table('article_distributions')
                                ->where('id', (int) $row->id)
                                ->update(['idempotency_key' => $normalized]);
                        }
                        continue;
                    }

                    DB::table('article_distributions')
                        ->where('id', (int) $row->id)
                        ->update([
                            'idempotency_key' => $this->uniqueBackfillKey(
                                $original,
                                (int) $row->id,
                                'normalize',
                            ),
                        ]);
                }
            }, 'id');

        // Resolve duplicates in a second pass using the database collation.
        // This covers duplicates that span chunk boundaries and preserves the
        // oldest record's key for backwards compatibility.
        while (true) {
            $duplicate = DB::table('article_distributions')
                ->select('idempotency_key')
                ->whereNotNull('idempotency_key')
                ->groupBy('idempotency_key')
                ->havingRaw('COUNT(*) > 1')
                ->orderBy('idempotency_key')
                ->first();

            if ($duplicate === null) {
                break;
            }

            $rows = DB::table('article_distributions')
                ->where('idempotency_key', (string) $duplicate->idempotency_key)
                ->orderBy('id')
                ->get(['id', 'idempotency_key']);

            foreach ($rows->slice(1) as $row) {
                DB::table('article_distributions')
                    ->where('id', (int) $row->id)
                    ->update([
                        'idempotency_key' => $this->uniqueBackfillKey(
                            (string) ($row->idempotency_key ?? ''),
                            (int) $row->id,
                            'duplicate',
                        ),
                    ]);
            }
        }
    }

    private function uniqueBackfillKey(string $source, int $id, string $reason): string
    {
        for ($attempt = 0; $attempt < 1000; $attempt++) {
            $candidate = 'distribution-'.$id.'-'.substr(
                hash('sha256', $reason.'|'.$id.'|'.$source.'|'.$attempt),
                0,
                64,
            );

            if (! DB::table('article_distributions')
                ->where('id', '!=', $id)
                ->where('idempotency_key', $candidate)
                ->exists()) {
                return $candidate;
            }
        }

        throw new \RuntimeException('Unable to generate a unique idempotency key for a legacy distribution.');
    }

    private function ensureIdempotencyUniqueIndex(): void
    {
        // The original migration already creates a unique index on this
        // column. Avoid adding an equivalent second index under another name.
        if ($this->hasUniqueIndexOn(['idempotency_key'])) {
            return;
        }

        try {
            Schema::table('article_distributions', function ($table): void {
                $table->unique('idempotency_key', 'article_distributions_idempotency_unique');
            });
        } catch (\Throwable $exception) {
            // A concurrent deployment may have created it between the check
            // and ALTER TABLE; re-read metadata before propagating the error.
            if (! $this->hasUniqueIndexOn(['idempotency_key'])) {
                throw $exception;
            }
        }
    }

    private function dropLegacyBatchUniqueIndex(): void
    {
        if (! $this->hasIndexNamed('article_distribution_unique')) {
            return;
        }

        try {
            Schema::table('article_distributions', function ($table): void {
                $table->dropUnique('article_distribution_unique');
            });
        } catch (\Throwable $exception) {
            // A concurrent drop is safe to treat as success; other errors are
            // surfaced so deployment does not falsely report success.
            if ($this->hasIndexNamed('article_distribution_unique')) {
                throw $exception;
            }
        }
    }

    /** @param list<string> $columns */
    private function hasUniqueIndexOn(array $columns): bool
    {
        $wanted = array_map(fn ($column): string => strtolower((string) $column), $columns);
        sort($wanted);

        foreach (Schema::getIndexes('article_distributions') as $index) {
            $indexColumns = array_map(
                fn ($column): string => strtolower((string) $column),
                (array) ($index['columns'] ?? []),
            );
            sort($indexColumns);
            $isUnique = (bool) ($index['unique'] ?? false)
                || strtolower((string) ($index['type'] ?? '')) === 'unique';
            if ($isUnique && $indexColumns === $wanted) {
                return true;
            }
        }

        return false;
    }

    private function hasIndexNamed(string $name): bool
    {
        foreach (Schema::getIndexes('article_distributions') as $index) {
            if (strcasecmp((string) ($index['name'] ?? ''), $name) === 0) {
                return true;
            }
        }

        return false;
    }
};
