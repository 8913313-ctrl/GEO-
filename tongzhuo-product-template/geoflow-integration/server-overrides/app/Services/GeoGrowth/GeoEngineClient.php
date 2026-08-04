<?php

namespace App\Services\GeoGrowth;

interface GeoEngineClient
{
    /**
     * @return array{
     *     engine:string,
     *     findings:array<int,array<string,mixed>>,
     *     summary?:array<string,mixed>,
     *     score?:int|null,
     *     raw?:array<string,mixed>
     * }
     */
    public function auditWebsite(string $url): array;

    /**
     * @param array<string,mixed> $context
     * @return array{
     *     engine:string,
     *     verdict:string,
     *     observed_answer:string,
     *     gap_summary:string,
     *     evidence_sources:array<int,array<string,mixed>>,
     *     raw?:array<string,mixed>
     * }
     */
    public function runAnswerTest(string $question, array $context = []): array;

    /**
     * @param array<string,mixed> $context
     * @return array{
     *     engine:string,
     *     opportunities:array<int,array<string,mixed>>,
     *     raw?:array<string,mixed>
     * }
     */
    public function expandOpportunities(array $context = []): array;

    /**
     * @param array<string,mixed> $context
     * @return array{
     *     engine:string,
     *     title?:string,
     *     summary?:string,
     *     metrics?:array<string,mixed>,
     *     items:array<int,array<string,mixed>>,
     *     raw?:array<string,mixed>
     * }
     */
    public function generateActionPlan(array $context = []): array;
}
