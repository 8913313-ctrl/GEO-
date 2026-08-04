<?php

namespace App\Services\GeoGrowth;

class GeoEngineManager
{
    public function __construct(
        private readonly LocalGeoEngineClient $local,
        private readonly RemoteGeoRankEngineClient $georank,
    ) {}

    /** @return array<string,mixed> */
    public function auditWebsite(string $url): array
    {
        return $this->callWithFallback(
            fn (GeoEngineClient $client): array => $client->auditWebsite($url),
            'summary'
        );
    }

    /** @param array<string,mixed> $context */
    public function runAnswerTest(string $question, array $context = []): array
    {
        return $this->callWithFallback(
            fn (GeoEngineClient $client): array => $client->runAnswerTest($question, $context),
            'metadata'
        );
    }

    /** @param array<string,mixed> $context */
    public function expandOpportunities(array $context = []): array
    {
        return $this->callWithFallback(
            fn (GeoEngineClient $client): array => $client->expandOpportunities($context),
            'metadata'
        );
    }

    /** @param array<string,mixed> $context */
    public function generateActionPlan(array $context = []): array
    {
        return $this->callWithFallback(
            fn (GeoEngineClient $client): array => $client->generateActionPlan($context),
            'metadata'
        );
    }

    /** @param callable(GeoEngineClient):array<string,mixed> $callback */
    private function callWithFallback(callable $callback, string $metaKey): array
    {
        if ((string) config('geoflow.geo_engine.driver', 'local') !== 'georank') {
            return $callback($this->local);
        }

        try {
            return $callback($this->georank);
        } catch (\Throwable $exception) {
            $result = $callback($this->local);
            $meta = is_array($result[$metaKey] ?? null) ? $result[$metaKey] : [];
            $result[$metaKey] = array_merge($meta, [
                'engine_fallback' => true,
                'engine_error' => $exception->getMessage(),
            ]);

            return $result;
        }
    }
}
