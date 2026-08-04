<?php

namespace App\Services\GeoFlow;

use App\Models\TongzhuoContentBusinessLine;
use App\Models\TongzhuoContentGenerationRun;
use App\Models\TongzhuoContentManagedKeyword;
use App\Models\TongzhuoContentQuestionLibraryItem;
use App\Models\TongzhuoContentTopicCandidate;
use App\Services\TongzhuoAi\AiGatewayException;
use App\Services\TongzhuoAi\AiModelGateway;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Throwable;

/**
 * AI-assisted GEO discovery pipeline.
 *
 * The service deliberately treats a customer question as the primary unit of
 * work. A keyword is only a seed; it is never copied into a topic or padded
 * with a mechanical "是什么/怎么做" suffix. Every generated item keeps its
 * source, decision context and evidence requirements so the later RAG writer
 * can answer the question with company facts.
 */
class ContentDiscoveryService
{
    /** @var array<string,array{name:string,brief:string}> */
    public const DIMENSIONS = [
        'semantic' => ['name' => '语义拓展', 'brief' => '客户如何理解概念、边界、关系和差异'],
        'scenario' => ['name' => '场景覆盖', 'brief' => '客户在具体业务场景、阶段或约束下如何决策'],
        'commercial' => ['name' => '商业意图', 'brief' => '客户在选型、采购、预算、服务范围和交付上如何判断'],
        'ranking' => ['name' => '推荐榜单', 'brief' => '客户要求比较、推荐或筛选方案时需要哪些标准'],
        'review' => ['name' => '产品评测', 'brief' => '客户如何评价产品、服务或实施方案是否适用'],
        'brand' => ['name' => '品牌关联', 'brief' => '客户把企业、产品能力与问题联系起来时会怎样提问'],
        'question' => ['name' => '问答长尾', 'brief' => '客户直接向 AI 提出的完整长尾问题和追问'],
        'technical' => ['name' => '技术方案', 'brief' => '客户询问实现、集成、流程、风险和验收方式'],
    ];

    /**
     * Business profiles distilled from GEORank. Customer deployments can
     * override `business_profile`, `target_users` and `blocked_terms` in the
     * business-line settings instead of relying on inference.
     *
     * @var array<string,array{label:string,signals:list<string>,target_users:list<string>,blocked_terms:list<string>}>
     */
    private const BUSINESS_PROFILES = [
        'enterprise_service' => [
            'label' => '企业服务',
            'signals' => ['企业', 'B2B', 'SaaS', '工业', '制造', '系统', '软件', '咨询', 'GEO'],
            'target_users' => ['企业负责人', '市场负责人', '采购负责人', '业务负责人', 'IT 负责人'],
            'blocked_terms' => [],
        ],
        'education' => [
            'label' => '教育培训',
            'signals' => ['教育', '培训', '课程', '辅导', '学校', '招生', '学习'],
            'target_users' => ['学员', '家长', '教师', '教务负责人'],
            'blocked_terms' => ['SaaS 采购', 'B2B 获客', '企业级部署'],
        ],
        'local_service' => [
            'label' => '本地服务',
            'signals' => ['本地', '上门', '到店', '维修', '装修', '家政', '门店', '医院'],
            'target_users' => ['本地消费者', '家庭决策者', '门店客户'],
            'blocked_terms' => ['SaaS 续费', 'API 集成', '企业级部署'],
        ],
        'ecommerce_brand' => [
            'label' => '电商品牌',
            'signals' => ['电商', '网购', '商品', '旗舰店', '品牌', '消费品'],
            'target_users' => ['购买者', '使用者', '送礼决策者'],
            'blocked_terms' => ['SaaS 续费', '企业级部署'],
        ],
        'content_media' => [
            'label' => '内容媒体',
            'signals' => ['媒体', '内容', '资讯', '公众号', '短视频', '读者'],
            'target_users' => ['读者', '订阅者', '内容创作者', '品牌传播负责人'],
            'blocked_terms' => ['SaaS 采购', '企业级部署'],
        ],
    ];

    public function __construct(private readonly AiModelGateway $gateway) {}

    /** @param array<string,mixed> $input @return array<string,mixed> */
    public function generateQuestions(array $input, ?int $adminId = null): array
    {
        $line = TongzhuoContentBusinessLine::query()->where('status', 'active')->findOrFail((int) $input['business_line_id']);
        $dimensions = $this->dimensions($input['dimensions'] ?? array_keys(self::DIMENSIONS));
        $seeds = $this->resolveSeeds($line, $input);
        if ($seeds === []) {
            throw new AiGatewayException('至少提供一个关键词或已管理的关键词 ID。', 'invalid_request', 422, false);
        }
        $profile = $this->businessProfile($line, $seeds);

        $run = $this->startRun('questions', $input, $adminId);
        $all = [];
        $usage = ['prompt_tokens' => 0, 'completion_tokens' => 0, 'total_tokens' => 0];
        $provider = null;
        $model = null;
        try {
            // Four dimensions per request keeps prompts bounded while still
            // requiring exactly five questions for every requested dimension.
            foreach (array_chunk($dimensions, 4, true) as $batch) {
                $result = $this->chatQuestions($line, $seeds, $batch, $input, false, $profile);
                $all = array_merge($all, $result['items']);
                $usage = $this->addUsage($usage, $result['usage']);
                $provider = $result['provider'] ?? $provider;
                $model = $result['model'] ?? $model;
            }

            $all = $this->qualityGateQuestions($all, $dimensions, (int) $line->id, $profile['blocked_terms'], array_map(fn (array $seed): string => mb_strtolower(trim((string) $seed['keyword'])), $seeds));
            $counts = $this->dimensionCounts($all);
            $missing = array_values(array_filter(array_keys($dimensions), fn (string $key): bool => ($counts[$key] ?? 0) < 5));
            if ($missing !== []) {
                $result = $this->chatQuestions($line, $seeds, $this->dimensionMap($missing), $input, true, $profile);
                $all = $this->qualityGateQuestions(array_merge($all, $result['items']), $dimensions, (int) $line->id, $profile['blocked_terms'], array_map(fn (array $seed): string => mb_strtolower(trim((string) $seed['keyword'])), $seeds));
                $usage = $this->addUsage($usage, $result['usage']);
                $provider = $result['provider'] ?? $provider;
                $model = $result['model'] ?? $model;
                $counts = $this->dimensionCounts($all);
            }
            $missing = array_values(array_filter(array_keys($dimensions), fn (string $key): bool => ($counts[$key] ?? 0) < 5));
            if ($missing !== []) {
                throw new AiGatewayException(
                    '模型没有按要求返回每个栏目 5 个完整客户问题，未自动填充伪问题。',
                    'invalid_contract',
                    502,
                    true,
                    ['missing_dimensions' => $missing, 'counts' => $counts]
                );
            }

            // Keep the first five high-quality, non-duplicate items per
            // dimension. The generated records remain candidates until a
            // human confirms them in the question library.
            $all = $this->takeFivePerDimension($all, $dimensions);
            $persisted = $this->persistQuestionCandidates($line, $all, $seeds, $run, $adminId);
            $run->forceFill([
                'status' => 'succeeded',
                'provider' => $provider === null ? null : (string) $provider,
                'model' => $model === null ? null : Str::limit((string) $model, 120, ''),
                'usage' => $usage,
                'citation_snapshot' => ['kind' => 'question_candidates', 'items' => $persisted['items']],
                'completed_at' => now(),
            ])->save();

            return [
                'generation_run_id' => (int) $run->id,
                'items' => $persisted['items'],
                'counts' => $this->dimensionCounts($persisted['items']),
                'usage' => $usage,
            ];
        } catch (Throwable $exception) {
            $run->forceFill([
                'status' => 'failed',
                'error_message' => Str::limit($exception->getMessage(), 2000, ''),
                'usage' => $usage,
                'completed_at' => now(),
            ])->save();
            throw $exception;
        }
    }

    /** @param array<string,mixed> $input @return array<string,mixed> */
    public function confirmQuestions(array $input, ?int $adminId = null): array
    {
        $ids = array_values(array_unique(array_map('intval', (array) ($input['question_ids'] ?? []))));
        if ($ids === []) {
            throw new AiGatewayException('至少选择一个问题进入问题词库。', 'invalid_request', 422, false);
        }
        $lineId = (int) $input['business_line_id'];
        $items = TongzhuoContentQuestionLibraryItem::query()
            ->where('business_line_id', $lineId)
            ->whereIn('id', $ids)
            ->where('status', 'candidate')
            ->get();
        if ($items->count() !== count($ids)) {
            throw new AiGatewayException('只能确认当前业务线中仍处于候选状态的问题。', 'invalid_request', 422, false);
        }
        DB::transaction(function () use ($items, $adminId): void {
            foreach ($items as $item) {
                $item->forceFill([
                    'status' => 'active',
                    'created_by_admin_id' => $item->created_by_admin_id ?: $adminId,
                ])->save();
                if ($item->managed_keyword_id) {
                    TongzhuoContentManagedKeyword::query()
                        ->whereKey($item->managed_keyword_id)
                        ->where('status', 'active')
                        ->update(['status' => 'promoted', 'archived_at' => now()]);
                }
            }
        });

        return ['items' => $items->fresh()->values()->all(), 'count' => $items->count()];
    }

    /** @param array<string,mixed> $input @return array<string,mixed> */
    public function generateTopics(array $input, ?int $adminId = null): array
    {
        $line = TongzhuoContentBusinessLine::query()->where('status', 'active')->findOrFail((int) $input['business_line_id']);
        $questions = $this->resolveQuestions($line, $input);
        if ($questions === []) {
            throw new AiGatewayException('至少提供一个已确认的问题。', 'invalid_request', 422, false);
        }
        $run = $this->startRun('topics', $input, $adminId);
        $all = [];
        $usage = ['prompt_tokens' => 0, 'completion_tokens' => 0, 'total_tokens' => 0];
        $provider = null;
        $model = null;
        try {
            // Keep each prompt bounded. A large question library is a queue,
            // not one giant model context.
            foreach (array_chunk($questions, 20) as $batch) {
                $profile = $this->businessProfile($line, array_map(fn (array $question): string => (string) ($question['question'] ?? ''), $batch));
                $result = $this->chatTopics($line, $batch, $input, $profile);
                $existingTopics = TongzhuoContentTopicCandidate::query()
                    ->where('business_line_id', $line->id)
                    ->whereIn('status', ['candidate', 'active', 'planned'])
                    ->latest('id')
                    ->limit(100)
                    ->pluck('title')
                    ->map(fn (mixed $value): string => Str::limit(trim((string) $value), 240, ''))
                    ->values()
                    ->all();
                $items = $this->qualityGateTopics($result['items'], $batch, $profile['blocked_terms'], $existingTopics);
                $all = array_merge($all, $items);
                $usage = $this->addUsage($usage, $result['usage']);
                $provider = $result['provider'] ?? $provider;
                $model = $result['model'] ?? $model;
            }
            if (count($all) !== count($questions)) {
                throw new AiGatewayException('模型返回的选题数量与问题数量不一致，未自动补齐。', 'invalid_contract', 502, true, [
                    'expected' => count($questions),
                    'actual' => count($all),
                ]);
            }
            $persisted = DB::transaction(function () use ($line, $all, $questions, $adminId, $provider, $model, $usage): array {
                $byId = [];
                foreach ($questions as $question) {
                    $byId[(string) ($question['id'] ?? $question['question'])] = $question;
                }
                $saved = [];
                foreach ($all as $item) {
                    $source = $byId[(string) ($item['question_id'] ?? $item['question'])] ?? null;
                    if (! $source) {
                        continue;
                    }
                    $title = Str::limit(trim((string) ($item['title'] ?? '')), 240, '');
                    $sourceQuestionId = is_numeric($source['id'] ?? null) ? (int) $source['id'] : null;
                    $topicHash = $this->contentHash(
                        ($sourceQuestionId ? 'question:'.$sourceQuestionId : 'question:'.(string) $source['question'])
                        .'|title:'.$title
                    );
                    $attributes = ['business_line_id' => $line->id, 'topic_hash' => $topicHash];
                    $values = [
                            'question_library_item_id' => $sourceQuestionId,
                            'title' => $title,
                            'primary_question' => $source['question'],
                            'intent' => $this->enum((string) ($source['intent'] ?? 'question'), ['question', 'comparison', 'selection', 'evaluation', 'implementation', 'risk'], 'question', 40),
                            'decision_stage' => $this->enum((string) ($source['decision_stage'] ?? 'discovery'), ['discovery', 'shortlist', 'evaluation', 'purchase', 'implementation', 'renewal'], 'discovery', 32),
                            'cluster_name' => $source['cluster_name'] ?? null,
                            'follow_up_questions' => $this->stringList($source['follow_up_questions'] ?? [], 10, 1000),
                            'query_rewrites' => $this->stringList($source['query_rewrites'] ?? [], 10, 1000),
                            'proof_points' => $this->stringList($item['proof_points'] ?? [], 20, 1000),
                            'evidence_types' => $this->stringList($item['evidence_requirements'] ?? [], 20, 1000),
                            'target_content_types' => $this->stringList($item['target_content_types'] ?? ['article'], 10, 60),
                            'audience_boundary' => Str::limit(trim((string) ($item['audience_boundary'] ?? '')), 5000, ''),
                            'output_type' => 'article',
                            'status' => 'candidate',
                            'priority' => in_array($source['priority'] ?? 'medium', ['low', 'medium', 'high', 'critical'], true) ? $source['priority'] : 'medium',
                            'brief' => [
                                'content_direction' => Str::limit(trim((string) ($item['content_direction'] ?? '')), 5000, ''),
                                'user_intent' => Str::limit(trim((string) ($item['user_intent'] ?? '')), 500, ''),
                                'answer_outline' => $this->stringList($item['answer_outline'] ?? [], 20, 1000),
                                'source_question_id' => $sourceQuestionId,
                            ],
                            'metadata' => [
                                'quality' => $item['quality'] ?? [],
                                'source' => 'ai',
                                'generation_run_id' => $run->id,
                                'source_question_snapshot' => $source,
                            ],
                            'created_by_admin_id' => $adminId,
                        ];
                    $record = TongzhuoContentTopicCandidate::query()->where($attributes)->first();
                    if ($record && $record->status === 'archived') {
                        $record->forceFill(array_merge($values, ['status' => 'candidate', 'archived_at' => null]))->save();
                    } elseif (! $record) {
                        $record = new TongzhuoContentTopicCandidate();
                        $record->forceFill(array_merge($attributes, $values));
                        try {
                            $record->save();
                        } catch (Throwable $exception) {
                            $record = TongzhuoContentTopicCandidate::query()->where($attributes)->first();
                            if (! $record) {
                                throw $exception;
                            }
                        }
                    }
                    $saved[] = $record->toArray();
                }
                return ['items' => $saved, 'provider' => $provider, 'model' => $model, 'usage' => $usage];
            });
            if (count($persisted['items']) !== count($all)) {
                throw new AiGatewayException('选题持久化数量与质量校验通过数量不一致，已停止本次生成。', 'invalid_contract', 502, true, [
                    'expected' => count($all),
                    'actual' => count($persisted['items']),
                ]);
            }
            $run->forceFill([
                'status' => 'succeeded',
                'provider' => $persisted['provider'] === null ? null : Str::limit((string) $persisted['provider'], 80, ''),
                'model' => $persisted['model'] === null ? null : Str::limit((string) $persisted['model'], 120, ''),
                'usage' => $persisted['usage'],
                'citation_snapshot' => ['kind' => 'topic_candidates', 'items' => $persisted['items']],
                'completed_at' => now(),
            ])->save();
            return ['generation_run_id' => (int) $run->id, 'items' => $persisted['items'], 'usage' => $persisted['usage']];
        } catch (Throwable $exception) {
            $run->forceFill(['status' => 'failed', 'error_message' => Str::limit($exception->getMessage(), 2000, ''), 'completed_at' => now()])->save();
            throw $exception;
        }
    }

    /** @param array<string,mixed> $input @return array<string,mixed> */
    public function confirmTopics(array $input, ?int $adminId = null): array
    {
        $ids = array_values(array_unique(array_map('intval', (array) ($input['topic_ids'] ?? []))));
        if ($ids === []) {
            throw new AiGatewayException('至少选择一个选题进入选题库。', 'invalid_request', 422, false);
        }
        $items = TongzhuoContentTopicCandidate::query()
            ->where('business_line_id', (int) $input['business_line_id'])
            ->whereIn('id', $ids)
            ->where('status', 'candidate')
            ->get();
        if ($items->count() !== count($ids)) {
            throw new AiGatewayException('只能确认当前业务线中仍处于候选状态的选题。', 'invalid_request', 422, false);
        }
        DB::transaction(function () use ($items, $adminId): void {
            foreach ($items as $item) {
                $item->forceFill(['status' => 'active', 'created_by_admin_id' => $item->created_by_admin_id ?: $adminId])->save();
                if ($item->question_library_item_id) {
                    TongzhuoContentQuestionLibraryItem::query()->whereKey($item->question_library_item_id)->where('status', 'active')->update([
                        'status' => 'promoted', 'coverage_status' => 'in_progress', 'archived_at' => now(),
                    ]);
                }
            }
        });
        return ['items' => $items->fresh()->values()->all(), 'count' => $items->count()];
    }

    /** @param TongzhuoContentBusinessLine $line @param array<string,mixed> $input @return list<array<string,mixed>> */
    private function resolveSeeds(TongzhuoContentBusinessLine $line, array $input): array
    {
        $seeds = [];
        foreach ((array) ($input['keyword_ids'] ?? []) as $id) {
            $keyword = TongzhuoContentManagedKeyword::query()
                ->where('business_line_id', $line->id)
                ->where('status', 'active')
                ->find((int) $id);
            if ($keyword) {
                $seeds[] = ['id' => (int) $keyword->id, 'keyword' => (string) $keyword->keyword, 'intent' => $keyword->intent, 'cluster_name' => $keyword->cluster_name];
            }
        }
        foreach ((array) ($input['keywords'] ?? []) as $keyword) {
            $value = is_string($keyword) ? trim($keyword) : '';
            if ($value !== '') {
                $seeds[] = ['id' => null, 'keyword' => Str::limit($value, 240, ''), 'intent' => 'question', 'cluster_name' => null];
            }
        }
        $unique = [];
        foreach ($seeds as $seed) {
            $unique[mb_strtolower($seed['keyword'])] = $seed;
        }
        return array_values($unique);
    }

    /** @param TongzhuoContentBusinessLine $line @param array<string,mixed> $input @return list<array<string,mixed>> */
    private function resolveQuestions(TongzhuoContentBusinessLine $line, array $input): array
    {
        $questions = [];
        foreach ((array) ($input['question_ids'] ?? []) as $id) {
            $record = TongzhuoContentQuestionLibraryItem::query()->where('business_line_id', $line->id)->where('status', 'active')->find((int) $id);
            if ($record) {
                $questions[] = $record->toArray();
            }
        }
        foreach ((array) ($input['questions'] ?? []) as $question) {
            if (is_string($question) && trim($question) !== '') {
                throw new AiGatewayException('选题只能从已确认的问题词库生成，请先将问题加入问题词库。', 'invalid_request', 422, false);
            } elseif (is_array($question)) {
                if (is_numeric($question['id'] ?? null)) {
                    $record = TongzhuoContentQuestionLibraryItem::query()
                        ->where('business_line_id', $line->id)
                        ->where('status', 'active')
                        ->find((int) $question['id']);
                    if (! $record) {
                        throw new AiGatewayException('问题不属于当前业务线或尚未确认入库。', 'invalid_request', 422, false, ['question_id' => (int) $question['id']]);
                    }
                    $questions[] = $record->toArray();
                    continue;
                }
                $value = trim((string) ($question['question'] ?? ''));
                if ($value !== '') {
                    throw new AiGatewayException('选题只能从已确认的问题词库生成，请传入已入库问题 ID。', 'invalid_request', 422, false);
                }
            }
        }
        $unique = [];
        foreach ($questions as $question) {
            $unique[mb_strtolower(trim((string) $question['question']))] = $question;
        }
        return array_values($unique);
    }

    /** @param array<int|string,mixed> $requested @return array<string,array{name:string,brief:string}> */
    private function dimensions(array $requested): array
    {
        $keys = array_values(array_unique(array_map('strval', $requested)));
        $invalid = array_values(array_diff($keys, array_keys(self::DIMENSIONS)));
        if ($invalid !== []) {
            throw new AiGatewayException('存在不支持的选题维度。', 'invalid_request', 422, false, ['dimensions' => $invalid]);
        }
        if ($keys === []) {
            throw new AiGatewayException('至少选择一个选题维度。', 'invalid_request', 422, false);
        }
        return $this->dimensionMap($keys);
    }

    /** @param list<string> $keys @return array<string,array{name:string,brief:string}> */
    private function dimensionMap(array $keys): array
    {
        return array_intersect_key(self::DIMENSIONS, array_flip($keys));
    }

    /** @param TongzhuoContentBusinessLine $line @param list<array<string,mixed>> $seeds @param array<string,array{name:string,brief:string}> $dimensions @param array<string,mixed> $input */
    private function chatQuestions(TongzhuoContentBusinessLine $line, array $seeds, array $dimensions, array $input, bool $repair = false, array $profile = []): array
    {
        $contract = [
            'questions' => [[
                'question' => '客户可直接输入 AI 的完整自然语言问题',
                'source_keyword' => '来源关键词原文',
                'dimension' => 'semantic|scenario|commercial|ranking|review|brand|question|technical',
                'intent' => 'question|comparison|selection|evaluation|implementation|risk',
                'decision_stage' => 'discovery|shortlist|evaluation|purchase|implementation|renewal',
                'asker_role' => '提问者角色',
                'trigger_scenario' => '触发场景',
                'expected_answer' => '客户希望 AI 直接回答的判断',
                'follow_up_questions' => ['自然追问'],
                'query_rewrites' => ['同一问题的自然表达变体'],
                'evidence_requirements' => ['回答必须核验的企业事实'],
                'recommendation_score' => 0,
                'business_score' => 0,
                'reason' => '为什么值得运营',
            ]],
        ];
        $prompt = [
            'business_line' => $this->safeBusinessLine($line),
            'business_profile' => $profile,
            'seed_keywords' => $seeds,
            'existing_questions_do_not_repeat' => TongzhuoContentQuestionLibraryItem::query()
                ->where('business_line_id', $line->id)
                ->whereIn('status', ['candidate', 'active', 'promoted'])
                ->latest('id')
                ->limit(100)
                ->pluck('question')
                ->map(fn (mixed $value): string => Str::limit(trim((string) $value), 300, ''))
                ->values()
                ->all(),
            'dimensions' => array_map(fn (array $item, string $key): array => ['key' => $key, 'name' => $item['name'], 'brief' => $item['brief'], 'required_count' => 5], $dimensions, array_keys($dimensions)),
            'contract' => $contract,
            'quality_rules' => [
                '每个维度必须返回恰好 5 条；本次补全请求只返回缺失维度。',
                '问题必须像客户直接向 AI 提问，脱离上下文也能理解。',
                '必须体现角色、场景、阶段或决策任务中的至少两项。',
                '一条问题只解决一个主要判断，不要把多个问题用“以及/同时”拼接。',
                '不能伪造搜索量、真实用户数据、排名、价格、案例、效果或资质。',
                '不能只是关键词机械扩写，也不能用营销口号代替客户问题。',
                '只输出 JSON，不要 Markdown、解释或额外字段。',
            ],
            'repair' => $repair,
        ];
        $result = $this->gateway->chat(
            $input['provider_id'] ?? null,
            [
                ['role' => 'system', 'content' => '你是 GEO 选题研究员。你的工作是建模客户会向 AI 提出的真实问题，而不是写广告标题。严格遵守输出契约和质量规则。'],
                ['role' => 'user', 'content' => json_encode($prompt, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT)],
            ],
            ['temperature' => $input['temperature'] ?? 0.35, 'max_tokens' => $input['max_tokens'] ?? 10000, 'timeout' => $input['timeout'] ?? null]
        );
        $decoded = $this->decodeJson((string) $result['content']);
        $items = is_array($decoded['questions'] ?? null) ? $decoded['questions'] : (array_is_list($decoded) ? $decoded : []);
        if ($items === []) {
            throw new AiGatewayException('模型没有返回 questions JSON 数组。', 'invalid_contract', 502, true);
        }
        return ['items' => $items, 'usage' => $result['usage'] ?? [], 'provider' => $result['provider_id'] ?? null, 'model' => $result['model'] ?? null];
    }

    /** @param TongzhuoContentBusinessLine $line @param list<array<string,mixed>> $questions @param array<string,mixed> $input */
    private function chatTopics(TongzhuoContentBusinessLine $line, array $questions, array $input, array $profile = []): array
    {
        $contract = ['topics' => [[
            'question_id' => '原问题 id；无 id 时回传原问题文本',
            'title' => '面向客户的文章选题标题，不改变核心问题',
            'content_direction' => '回答范围和结构',
            'user_intent' => '用户意图',
            'proof_points' => ['需要从知识库核实的事实点'],
            'evidence_requirements' => ['证据要求'],
            'target_content_types' => ['article'],
            'audience_boundary' => '适用对象和不适用对象',
            'answer_outline' => ['直接答案', '依据', '适用条件', '步骤', '边界', 'FAQ'],
            'quality' => [
                'askability' => 0,
                'specificity' => 0,
                'business_relevance' => 0,
                'evidence_readiness' => 0,
                'duplicate_risk' => 0,
            ],
        ]]];
        $prompt = [
            'business_line' => $this->safeBusinessLine($line),
            'business_profile' => $profile,
            'questions' => $questions,
            'existing_topics_do_not_repeat' => TongzhuoContentTopicCandidate::query()
                ->where('business_line_id', $line->id)
                ->whereIn('status', ['candidate', 'active', 'planned'])
                ->latest('id')
                ->limit(100)
                ->pluck('title')
                ->map(fn (mixed $value): string => Str::limit(trim((string) $value), 240, ''))
                ->values()
                ->all(),
            'contract' => $contract,
            'quality_rules' => [
                '每个问题只生成一个选题，必须保留 primary question 的判断意图。',
                'title 可以是编辑用标题，但不能把客户问题改成泛泛的营销标题。',
                'content_direction 要说明直接答案、证据、适用条件、步骤、边界和 FAQ 如何组织。',
                '不要编造企业事实；证据不足时明确列入 evidence_requirements。',
                '只输出 JSON，不要 Markdown 或额外解释。',
            ],
        ];
        $result = $this->gateway->chat(
            $input['provider_id'] ?? null,
            [
                ['role' => 'system', 'content' => '你是 GEO 内容架构师。把真实客户问题转成可被 AI 直接回答的内容选题，并为 RAG 写作保留证据边界。'],
                ['role' => 'user', 'content' => json_encode($prompt, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT)],
            ],
            ['temperature' => $input['temperature'] ?? 0.25, 'max_tokens' => $input['max_tokens'] ?? 12000, 'timeout' => $input['timeout'] ?? null]
        );
        $decoded = $this->decodeJson((string) $result['content']);
        $items = is_array($decoded['topics'] ?? null) ? $decoded['topics'] : (array_is_list($decoded) ? $decoded : []);
        if ($items === []) {
            throw new AiGatewayException('模型没有返回 topics JSON 数组。', 'invalid_contract', 502, true);
        }
        return ['items' => $items, 'usage' => $result['usage'] ?? [], 'provider' => $result['provider_id'] ?? null, 'model' => $result['model'] ?? null];
    }

    /** @param list<array<string,mixed>> $items @param array<string,array{name:string,brief:string}> $dimensions @param list<string> $blockedTerms @param list<string> $allowedSources @return list<array<string,mixed>> */
    private function qualityGateQuestions(array $items, array $dimensions, int $businessLineId, array $blockedTerms = [], array $allowedSources = []): array
    {
        $accepted = [];
        $known = TongzhuoContentQuestionLibraryItem::query()
            ->where('business_line_id', $businessLineId)
            ->whereIn('status', ['candidate', 'active', 'promoted'])
            ->pluck('question')
            ->map(fn (mixed $value): string => preg_replace('/\s+/u', '', mb_strtolower(trim((string) $value))) ?: trim((string) $value))
            ->flip()
            ->all();
        foreach ($items as $item) {
            if (! is_array($item)) {
                continue;
            }
            $question = Str::limit(trim((string) ($item['question'] ?? '')), 5000, '');
            $dimension = (string) ($item['dimension'] ?? '');
            $sourceKeyword = trim((string) ($item['source_keyword'] ?? ''));
            $sourceKey = mb_strtolower($sourceKeyword);
            $contextSignals = array_filter([
                trim((string) ($item['asker_role'] ?? '')),
                trim((string) ($item['trigger_scenario'] ?? '')),
                trim((string) ($item['decision_stage'] ?? '')),
                trim((string) ($item['expected_answer'] ?? '')),
            ], fn (string $value): bool => $value !== '');
            if ($question === '' || ! isset($dimensions[$dimension]) || mb_strlen($question) < 12 || ! preg_match('/[？?]/u', $question)) {
                continue;
            }
            $specificSignals = array_filter($contextSignals, fn (string $value): bool => ! preg_match('/^(相关人员|相关企业|客户|用户|相关场景|具体场景|给出建议|回答问题|视情况而定|按需判断)$/u', $value));
            if ($sourceKeyword === '' || ($allowedSources !== [] && ! in_array($sourceKey, $allowedSources, true)) || ! $this->questionTextOverlaps($question, $sourceKeyword) || count($specificSignals) < 2) {
                continue;
            }
            if (collect($blockedTerms)->contains(fn (mixed $term): bool => trim((string) $term) !== '' && mb_stripos($question, trim((string) $term)) !== false)) {
                continue;
            }
            $normalized = preg_replace('/\s+/u', '', mb_strtolower($question)) ?: $question;
            if (isset($accepted[$normalized]) || isset($known[$normalized])) {
                continue;
            }
            $item['question'] = $question;
            $item['source_keyword'] = Str::limit($sourceKeyword, 240, '');
            $item['dimension'] = $dimension;
            $item['intent'] = $this->enum((string) ($item['intent'] ?? 'question'), ['question', 'comparison', 'selection', 'evaluation', 'implementation', 'risk'], 'question', 40);
            $item['decision_stage'] = $this->enum((string) ($item['decision_stage'] ?? 'discovery'), ['discovery', 'shortlist', 'evaluation', 'purchase', 'implementation', 'renewal'], 'discovery', 32);
            $item['asker_role'] = Str::limit(trim((string) ($item['asker_role'] ?? '')), 500, '');
            $item['trigger_scenario'] = Str::limit(trim((string) ($item['trigger_scenario'] ?? '')), 1000, '');
            $item['expected_answer'] = Str::limit(trim((string) ($item['expected_answer'] ?? '')), 2000, '');
            $item['follow_up_questions'] = $this->stringList($item['follow_up_questions'] ?? [], 10, 1000);
            $item['query_rewrites'] = $this->stringList($item['query_rewrites'] ?? [], 10, 1000);
            $item['evidence_requirements'] = $this->stringList($item['evidence_requirements'] ?? [], 20, 1000);
            $item['recommendation_score'] = $this->score($item['recommendation_score'] ?? 0);
            $item['business_score'] = $this->score($item['business_score'] ?? 0);
            $item['reason'] = Str::limit(trim((string) ($item['reason'] ?? '')), 2000, '');
            $accepted[$normalized] = $item;
        }
        return array_values($accepted);
    }

    /** @param list<array<string,mixed>> $items @param list<array<string,mixed>> $questions @return list<array<string,mixed>> */
    private function qualityGateTopics(array $items, array $questions, array $blockedTerms = [], array $existingTopics = []): array
    {
        $questionKeys = [];
        $questionRecords = [];
        foreach ($questions as $question) {
            $key = (string) ($question['id'] ?? $question['question']);
            $questionKeys[$key] = true;
            $questionRecords[$key] = $question;
        }
        $accepted = [];
        $existingTopicKeys = [];
        foreach ($existingTopics as $existingTopic) {
            $existingTopicKeys[$this->normalizeText((string) $existingTopic)] = true;
        }
        foreach ($items as $item) {
            if (! is_array($item) || trim((string) ($item['title'] ?? '')) === '') {
                continue;
            }
            $key = (string) ($item['question_id'] ?? $item['question'] ?? '');
            if ($key === '' || ! isset($questionKeys[$key]) || isset($accepted[$key])) {
                continue;
            }
            $title = trim((string) ($item['title'] ?? ''));
            $sourceQuestion = $questionRecords[$key] ?? [];
            $quality = is_array($item['quality'] ?? null) ? $item['quality'] : [];
            $alignment = (int) ($quality['question_alignment'] ?? $quality['questionAlignment'] ?? 0);
            $titleKey = $this->normalizeText($title);
            if (! $this->looksLikeCustomerQuestion($title) || $this->containsBlockedTerm($title, $blockedTerms) || isset($existingTopicKeys[$titleKey]) || (! $this->questionTextOverlaps($title, (string) ($sourceQuestion['question'] ?? '')) && $alignment < 75)) {
                continue;
            }
            $item['title'] = Str::limit(trim((string) $item['title']), 240, '');
            $item['content_direction'] = Str::limit(trim((string) ($item['content_direction'] ?? '')), 5000, '');
            $item['user_intent'] = Str::limit(trim((string) ($item['user_intent'] ?? '')), 500, '');
            $item['proof_points'] = $this->stringList($item['proof_points'] ?? [], 20, 1000);
            $item['evidence_requirements'] = $this->stringList($item['evidence_requirements'] ?? [], 20, 1000);
            $item['target_content_types'] = $this->stringList($item['target_content_types'] ?? ['article'], 10, 60);
            $item['answer_outline'] = $this->stringList($item['answer_outline'] ?? [], 20, 1000);
            $item['audience_boundary'] = Str::limit(trim((string) ($item['audience_boundary'] ?? '')), 5000, '');
            if (mb_strlen($item['content_direction']) < 20 || $item['user_intent'] === '' || $item['evidence_requirements'] === [] || count($item['answer_outline']) < 3) {
                continue;
            }
            $accepted[$key] = $item;
        }
        return array_values($accepted);
    }

    /** @param list<array<string,mixed>> $items @param array<string,array{name:string,brief:string}> $dimensions @return list<array<string,mixed>> */
    private function takeFivePerDimension(array $items, array $dimensions): array
    {
        $counts = [];
        $result = [];
        foreach ($items as $item) {
            $key = (string) ($item['dimension'] ?? '');
            if (! isset($dimensions[$key]) || ($counts[$key] ?? 0) >= 5) {
                continue;
            }
            $counts[$key] = ($counts[$key] ?? 0) + 1;
            $result[] = $item;
        }
        return $result;
    }

    /** @param list<array<string,mixed>> $items @return array<string,int> */
    private function dimensionCounts(array $items): array
    {
        $counts = [];
        foreach ($items as $item) {
            $key = (string) ($item['dimension'] ?? ($item['metadata']['dimension'] ?? ''));
            if ($key !== '') {
                $counts[$key] = ($counts[$key] ?? 0) + 1;
            }
        }
        return $counts;
    }

    /** @param TongzhuoContentBusinessLine $line @param list<array<string,mixed>> $items @param list<array<string,mixed>> $seeds @return array<string,mixed> */
    private function persistQuestionCandidates(TongzhuoContentBusinessLine $line, array $items, array $seeds, TongzhuoContentGenerationRun $run, ?int $adminId): array
    {
        $seedMap = [];
        foreach ($seeds as $seed) {
            $seedMap[mb_strtolower(trim((string) $seed['keyword']))] = $seed;
        }
        $saved = DB::transaction(function () use ($items, $seedMap, $line, $run, $adminId): array {
            $saved = [];
            foreach ($items as $item) {
                $source = $seedMap[mb_strtolower(trim((string) ($item['source_keyword'] ?? '')))] ?? null;
                $question = Str::limit(trim((string) $item['question']), 5000, '');
                $hash = $this->contentHash($question);
                $attributes = ['business_line_id' => $line->id, 'question_hash' => $hash];
                $values = [
                        'managed_keyword_id' => $source['id'] ?? null,
                        'question' => $question,
                        'intent' => $this->enum((string) ($item['intent'] ?? 'question'), ['question', 'comparison', 'selection', 'evaluation', 'implementation', 'risk'], 'question', 40),
                        'decision_stage' => $this->enum((string) ($item['decision_stage'] ?? 'discovery'), ['discovery', 'shortlist', 'evaluation', 'purchase', 'implementation', 'renewal'], 'discovery', 32),
                        'cluster_name' => $source['cluster_name'] ?? null,
                        'follow_up_questions' => $this->stringList($item['follow_up_questions'] ?? [], 10, 1000),
                        'query_rewrites' => $this->stringList($item['query_rewrites'] ?? [], 10, 1000),
                        'evidence_requirements' => $this->stringList($item['evidence_requirements'] ?? [], 20, 1000),
                        'target_content_types' => ['article'],
                        'status' => 'candidate',
                        'priority' => ((int) ($item['business_score'] ?? 0)) >= 80 ? 'high' : 'medium',
                        'coverage_status' => 'uncovered',
                        'source' => 'ai',
                        'metadata' => [
                            'dimension' => $item['dimension'],
                            'asker_role' => $item['asker_role'] ?? null,
                            'trigger_scenario' => $item['trigger_scenario'] ?? null,
                            'expected_answer' => $item['expected_answer'] ?? null,
                            'recommendation_score' => $this->score($item['recommendation_score'] ?? 0),
                            'business_score' => $this->score($item['business_score'] ?? 0),
                            'reason' => Str::limit(trim((string) ($item['reason'] ?? '')), 2000, ''),
                            'source_keyword' => $item['source_keyword'] ?? null,
                            'generation_run_id' => $run->id,
                        ],
                        'created_by_admin_id' => $adminId,
                    ];
                $record = TongzhuoContentQuestionLibraryItem::query()->where($attributes)->first();
                if ($record && $record->status === 'archived') {
                    $record->forceFill(array_merge($values, ['status' => 'candidate', 'archived_at' => null]))->save();
                } elseif (! $record) {
                    $record = new TongzhuoContentQuestionLibraryItem();
                    $record->forceFill(array_merge($attributes, $values));
                    try {
                        $record->save();
                    } catch (Throwable $exception) {
                        $record = TongzhuoContentQuestionLibraryItem::query()->where($attributes)->first();
                        if (! $record) {
                            throw $exception;
                        }
                    }
                }
                $saved[] = $record->toArray();
            }
            return $saved;
        });
        return ['items' => $saved];
    }

    /** @param array<string,mixed> $input */
    private function startRun(string $kind, array $input, ?int $adminId): TongzhuoContentGenerationRun
    {
        return TongzhuoContentGenerationRun::query()->create([
            'status' => 'running',
            'prompt_snapshot' => json_encode(['kind' => $kind, 'input' => $this->safeInput($input)], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            'brief_snapshot' => ['kind' => $kind, 'business_line_id' => $input['business_line_id'] ?? null],
            'started_at' => now(),
            'created_by_admin_id' => $adminId,
        ]);
    }

    /** @param list<array<string,mixed>> $seeds @return array<string,mixed> */
    private function businessProfile(TongzhuoContentBusinessLine $line, array $seeds): array
    {
        $settings = is_array($line->settings) ? $line->settings : [];
        $configured = (string) ($settings['business_profile'] ?? '');
        $key = isset(self::BUSINESS_PROFILES[$configured]) ? $configured : 'enterprise_service';
        if ($configured === '' || ! isset(self::BUSINESS_PROFILES[$configured])) {
            $haystack = implode(' ', array_filter([
                (string) $line->name,
                (string) $line->description,
                implode(' ', array_column($seeds, 'keyword')),
            ]));
            $best = -1;
            foreach (self::BUSINESS_PROFILES as $candidateKey => $candidate) {
                $score = collect($candidate['signals'])->sum(fn (string $signal): int => mb_stripos($haystack, $signal) === false ? 0 : 1);
                if ($score > $best) {
                    $key = $candidateKey;
                    $best = $score;
                }
            }
        }
        $profile = self::BUSINESS_PROFILES[$key];
        $configuredTargetUsers = array_values((array) ($settings['target_users'] ?? []));
        $configuredBlockedTerms = array_values((array) ($settings['blocked_terms'] ?? []));
        return [
            'key' => $key,
            'label' => $profile['label'],
            'target_users' => array_values(array_unique(array_filter(array_merge($profile['target_users'], $configuredTargetUsers), static fn (mixed $value): bool => trim((string) $value) !== ''))),
            'blocked_terms' => array_values(array_unique(array_filter(array_merge($profile['blocked_terms'], $configuredBlockedTerms), static fn (mixed $value): bool => trim((string) $value) !== ''))),
            'inference' => $configured === '' ? 'keyword_rule' : 'business_line_setting',
        ];
    }

    /** @return array<string,mixed> */
    private function safeBusinessLine(TongzhuoContentBusinessLine $line): array
    {
        $settings = is_array($line->settings) ? $line->settings : [];
        return [
            'name' => Str::limit(trim((string) $line->name), 120, ''),
            'description' => Str::limit(trim((string) $line->description), 1000, ''),
            'business_profile' => $settings['business_profile'] ?? null,
            'target_users' => $this->stringList($settings['target_users'] ?? [], 20, 200),
            'blocked_terms' => $this->stringList($settings['blocked_terms'] ?? [], 50, 200),
        ];
    }

    /** @param array<string,mixed> $value @return array<string,mixed> */
    private function safeInput(array $value): array
    {
        return array_diff_key($value, array_flip(['api_key', 'authorization', 'cookie']));
    }

    /** @return array<string,mixed> */
    private function decodeJson(string $content): array
    {
        $content = trim($content);
        $content = preg_replace('/^```(?:json)?\s*/iu', '', $content) ?? $content;
        $content = preg_replace('/\s*```$/u', '', $content) ?? $content;
        $decoded = json_decode($content, true);
        if (is_array($decoded)) {
            return $decoded;
        }
        $start = strpos($content, '{');
        $end = strrpos($content, '}');
        if ($start !== false && $end !== false && $end > $start) {
            $decoded = json_decode(substr($content, $start, $end - $start + 1), true);
        }
        if (! is_array($decoded)) {
            throw new AiGatewayException('模型返回的内容不是合法 JSON。', 'invalid_contract', 502, true);
        }
        return $decoded;
    }

    /** @param list<string> $allowed */
    private function enum(string $value, array $allowed, string $fallback, int $maxLength): string
    {
        $value = mb_strtolower(trim($value));
        return in_array($value, $allowed, true) ? Str::limit($value, $maxLength, '') : $fallback;
    }

    /** @return list<string> */
    private function stringList(mixed $value, int $maxItems, int $maxLength): array
    {
        if (! is_array($value)) {
            return [];
        }
        $items = [];
        foreach ($value as $item) {
            if (! is_scalar($item)) {
                continue;
            }
            $item = Str::limit(trim((string) $item), $maxLength, '');
            if ($item !== '') {
                $items[mb_strtolower($item)] = $item;
            }
            if (count($items) >= $maxItems) {
                break;
            }
        }
        return array_values($items);
    }

    private function score(mixed $value): int
    {
        return max(0, min(100, is_numeric($value) ? (int) round((float) $value) : 0));
    }

    private function looksLikeCustomerQuestion(string $value): bool
    {
        $value = trim($value);
        if (mb_strlen($value) < 6 || mb_strlen($value) > 240 || ! preg_match('/[？?]$/u', $value)) {
            return false;
        }
        if (! preg_match('/如何|怎么|怎样|哪些|哪个|哪家|什么|是否|能否|可以吗|有没有|为什么|为何|多少|多久|哪里|区别|适合|值得|要不要|应该|还是/u', $value)) {
            return false;
        }
        return ! preg_match('/^(关于|浅谈|一文读懂|全面解析|深度剖析|揭秘|盘点)/u', $value);
    }

    private function containsBlockedTerm(string $value, array $blockedTerms): bool
    {
        foreach ($blockedTerms as $term) {
            $term = trim((string) $term);
            if ($term !== '' && mb_stripos($value, $term) !== false) {
                return true;
            }
        }
        return false;
    }

    private function normalizeText(string $value): string
    {
        return preg_replace('/[\s，,。.!！?？、:：;；“”"\'‘’（）()【】\[\]]+/u', '', mb_strtolower(trim($value))) ?: trim($value);
    }

    private function questionTextOverlaps(string $title, string $source): bool
    {
        $title = $this->normalizeText($title);
        $source = $this->normalizeText($source);
        if ($title === '' || $source === '') {
            return false;
        }
        if (str_contains($title, $source) || str_contains($source, $title)) {
            return true;
        }
        $length = mb_strlen($source);
        for ($index = 0; $index < $length - 1; $index++) {
            $gram = mb_substr($source, $index, 2);
            if (mb_strlen($gram) === 2 && mb_stripos($title, $gram) !== false) {
                return true;
            }
        }
        return false;
    }

    private function contentHash(string $value): string
    {
        $normalized = preg_replace('/\s+/u', '', mb_strtolower(trim($value))) ?: trim($value);
        return hash('sha256', $normalized);
    }

    /** @param array<string,int> $left @param array<string,mixed> $right @return array<string,int> */
    private function addUsage(array $left, array $right): array
    {
        foreach (['prompt_tokens', 'completion_tokens', 'total_tokens'] as $key) {
            $left[$key] = (int) ($left[$key] ?? 0) + (int) ($right[$key] ?? 0);
        }
        return $left;
    }
}
