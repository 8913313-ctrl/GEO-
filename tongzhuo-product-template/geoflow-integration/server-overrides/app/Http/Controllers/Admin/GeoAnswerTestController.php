<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Article;
use App\Models\TongzhuoCmsSite;
use App\Models\TongzhuoFaqItem;
use App\Models\TongzhuoGeoAnswerTest;
use App\Services\GeoGrowth\GeoEngineManager;
use App\Services\TongzhuoCms\SiteTemplateService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\View\View;

class GeoAnswerTestController extends Controller
{
    public function __construct(
        private readonly SiteTemplateService $templates,
        private readonly GeoEngineManager $engines,
    ) {}

    public function index(Request $request): View
    {
        $site = $this->site();
        $filters = [
            'service_line' => (string) $request->query('service_line', ''),
            'verdict' => (string) $request->query('verdict', ''),
            'platform' => (string) $request->query('platform', ''),
        ];
        $query = $site->geoAnswerTests()->with('opportunity')->latest();
        foreach ($filters as $key => $value) {
            if ($value !== '') {
                $query->where($key, $value);
            }
        }

        return view('admin.geo-answer-tests.index', [
            'pageTitle' => 'AI问答测试',
            'activeMenu' => 'geo_answer_tests',
            'tests' => $query->paginate(20)->withQueryString(),
            'stats' => [
                'total' => $site->geoAnswerTests()->count(),
                'covered' => $site->geoAnswerTests()->where('verdict', 'covered')->count(),
                'gap' => $site->geoAnswerTests()->where('verdict', 'gap')->count(),
                'unknown' => $site->geoAnswerTests()->where('verdict', 'unknown')->count(),
                'sampled' => $site->geoAnswerTests()->whereNotNull('sampled_at')->count(),
                'mention_rate' => $this->rate($site->geoAnswerTests()->whereNotNull('sampled_at')->count(), $site->geoAnswerTests()->where('mention', true)->count()),
                'recommendation_rate' => $this->rate($site->geoAnswerTests()->whereNotNull('sampled_at')->count(), $site->geoAnswerTests()->where('recommendation', true)->count()),
                'avg_accuracy' => (int) round((float) $site->geoAnswerTests()->whereNotNull('answer_accuracy')->avg('answer_accuracy')),
            ],
            'filters' => $filters,
            'serviceLines' => $this->serviceLines(),
            'verdictLabels' => $this->verdictLabels(),
            'platformLabels' => $this->platformLabels(),
            'surfaceLabels' => $this->surfaceLabels(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $site = $this->site();
        $data = $request->validate([
            'service_line' => ['required', Rule::in(array_keys($this->serviceLines()))],
            'question' => ['required', 'string', 'max:260'],
            'expected_answer' => ['nullable', 'string', 'max:3000'],
        ]);

        $test = $site->geoAnswerTests()->create($data + [
            'status' => 'draft',
            'verdict' => 'unknown',
            'source' => 'local',
            'platform' => 'local',
            'surface' => 'web',
            'created_by_admin_id' => auth('admin')->id(),
            'metadata' => ['source' => 'manual'],
        ]);

        return redirect()->route('admin.geo-answer-tests.index')->with('message', "问答测试 #{$test->id} 已创建。");
    }

    public function run(int $testId): RedirectResponse
    {
        $test = $this->test($testId);
        $evidence = $this->collectEvidence($test->question);
        $engineResult = $this->engines->runAnswerTest($test->question, [
            'service_line' => $test->service_line,
            'expected_answer' => $test->expected_answer,
            'site_url' => $test->site->domain,
            'evidence_sources' => $evidence,
        ]);
        $resultEvidence = array_values(array_filter($engineResult['evidence_sources'] ?? $evidence, 'is_array'));
        $verdict = in_array($engineResult['verdict'] ?? '', ['covered', 'gap', 'unknown'], true) ? $engineResult['verdict'] : 'unknown';
        $test->update([
            'status' => 'completed',
            'verdict' => $verdict,
            'observed_answer' => (string) ($engineResult['observed_answer'] ?? ''),
            'gap_summary' => (string) ($engineResult['gap_summary'] ?? ''),
            'evidence_sources' => $resultEvidence,
            'last_run_at' => now(),
            'source' => (string) ($engineResult['engine'] ?? 'local'),
            'platform' => (string) ($engineResult['engine'] ?? 'local'),
            'surface' => 'web',
            'metadata' => array_merge(is_array($test->metadata) ? $test->metadata : [], [
                'runner' => 'geo_engine',
                'engine' => (string) ($engineResult['engine'] ?? 'local'),
                'engine_metadata' => is_array($engineResult['metadata'] ?? null) ? $engineResult['metadata'] : [],
            ]),
        ]);

        return back()->with('message', $verdict === 'covered' ? '问答测试已完成：官网内容已有覆盖。' : '问答测试已完成：发现内容缺口或需要人工复核。');
    }

    public function sample(Request $request, int $testId): RedirectResponse
    {
        $test = $this->test($testId);
        $data = $request->validate([
            'platform' => ['required', Rule::in(array_keys($this->platformLabels()))],
            'surface' => ['required', Rule::in(array_keys($this->surfaceLabels()))],
            'prompt_id' => ['nullable', 'string', 'max:80'],
            'run_id' => ['nullable', 'string', 'max:80'],
            'model_version' => ['nullable', 'string', 'max:120'],
            'sampled_at' => ['nullable', 'date'],
            'mention' => ['nullable', 'boolean'],
            'recommendation' => ['nullable', 'boolean'],
            'rank' => ['nullable', 'integer', 'min:1', 'max:50'],
            'answer_accuracy' => ['nullable', 'integer', 'min:0', 'max:100'],
            'citations' => ['nullable', 'string', 'max:3000'],
            'competitor_mentions' => ['nullable', 'string', 'max:2000'],
            'observed_answer' => ['nullable', 'string', 'max:8000'],
            'sampling_notes' => ['nullable', 'string', 'max:3000'],
        ]);

        $test->update([
            'status' => 'completed',
            'source' => 'platform_sampling',
            'platform' => $data['platform'],
            'surface' => $data['surface'],
            'prompt_id' => $data['prompt_id'] ?? null,
            'run_id' => $data['run_id'] ?? null,
            'model_version' => $data['model_version'] ?? null,
            'sampled_at' => isset($data['sampled_at']) ? $data['sampled_at'] : now(),
            'mention' => (bool) ($data['mention'] ?? false),
            'recommendation' => (bool) ($data['recommendation'] ?? false),
            'rank' => $data['rank'] ?? null,
            'answer_accuracy' => $data['answer_accuracy'] ?? null,
            'citations' => $this->lines((string) ($data['citations'] ?? '')),
            'competitor_mentions' => $this->lines((string) ($data['competitor_mentions'] ?? '')),
            'observed_answer' => $data['observed_answer'] ?? $test->observed_answer,
            'sampling_notes' => $data['sampling_notes'] ?? null,
            'verdict' => ((bool) ($data['mention'] ?? false) && (int) ($data['answer_accuracy'] ?? 0) >= 70) ? 'covered' : 'gap',
            'last_run_at' => now(),
            'metadata' => array_merge(is_array($test->metadata) ? $test->metadata : [], [
                'runner' => 'manual_platform_sampling',
                'ai_performance_score' => $this->performanceScore((bool) ($data['mention'] ?? false), (bool) ($data['recommendation'] ?? false), $data['rank'] ?? null, $data['answer_accuracy'] ?? null),
            ]),
        ]);

        return back()->with('message', 'AI平台采样结果已记录，可用于推荐率、引用率和竞品差距复盘。');
    }

    public function promoteOpportunity(int $testId): RedirectResponse
    {
        $test = $this->test($testId);
        if ($test->opportunity_id) {
            return redirect()->route('admin.geo-opportunities.index')->with('message', '这个问答测试已经转过问题机会。');
        }

        $opportunity = $test->site->geoOpportunities()->create([
            'service_line' => $test->service_line,
            'intent' => 'question',
            'status' => 'new',
            'priority' => $test->verdict === 'gap' ? 'high' : 'medium',
            'question' => $test->question,
            'recommended_output' => 'faq',
            'answer_angle' => $test->gap_summary ?: $test->expected_answer,
            'evidence' => $test->evidence_sources ?: [],
            'metadata' => ['source' => 'geo_answer_test', 'answer_test_id' => $test->id],
            'coverage_status' => $test->verdict === 'gap' ? 'uncovered' : 'covered',
            'created_by_admin_id' => auth('admin')->id(),
        ]);
        $test->update(['opportunity_id' => $opportunity->id]);

        return redirect()->route('admin.geo-opportunities.index')->with('message', '问答测试缺口已转为问题机会。');
    }

    private function site(): TongzhuoCmsSite
    {
        return $this->templates->ensureSite();
    }

    private function test(int $testId): TongzhuoGeoAnswerTest
    {
        return $this->site()->geoAnswerTests()->with('site')->findOrFail($testId);
    }

    /** @return array<int,array<string,string>> */
    private function collectEvidence(string $question): array
    {
        $tokens = $this->tokens($question);
        $evidence = [];
        foreach ($tokens as $token) {
            $faq = TongzhuoFaqItem::query()
                ->where('status', 'published')
                ->where(function ($query) use ($token): void {
                    $query->where('question', 'like', '%'.$token.'%')
                        ->orWhere('answer', 'like', '%'.$token.'%');
                })
                ->latest('published_at')
                ->first();
            if ($faq) {
                $evidence[] = [
                    'type' => 'faq',
                    'title' => (string) $faq->question,
                    'excerpt' => Str::limit(strip_tags((string) $faq->answer), 140, ''),
                ];
            }

            $article = Article::query()
                ->where('status', 'published')
                ->where(function ($query) use ($token): void {
                    $query->where('title', 'like', '%'.$token.'%')
                        ->orWhere('content', 'like', '%'.$token.'%');
                })
                ->latest('published_at')
                ->first();
            if ($article) {
                $evidence[] = [
                    'type' => 'article',
                    'title' => (string) $article->title,
                    'excerpt' => Str::limit(strip_tags((string) ($article->excerpt ?: $article->content)), 140, ''),
                ];
            }

            if (count($evidence) >= 6) {
                break;
            }
        }

        return collect($evidence)->unique(fn (array $item): string => $item['type'].'|'.$item['title'])->values()->all();
    }

    /** @return array<int,string> */
    private function tokens(string $question): array
    {
        preg_match_all('/[\x{4e00}-\x{9fa5}A-Za-z0-9]{2,}/u', $question, $matches);
        $tokens = collect($matches[0] ?? [])
            ->map(fn (string $token): string => trim($token))
            ->filter(fn (string $token): bool => mb_strlen($token, 'UTF-8') >= 2)
            ->reject(fn (string $token): bool => in_array($token, ['什么', '怎么', '如何', '是否', '哪些', '为什么', '企业', '客户'], true))
            ->values()
            ->all();

        return array_slice($tokens ?: [$question], 0, 8);
    }

    private function rate(int $total, int $count): int
    {
        return $total > 0 ? (int) round(($count / $total) * 100) : 0;
    }

    private function performanceScore(bool $mention, bool $recommendation, mixed $rank, mixed $accuracy): int
    {
        $score = 0;
        $score += $mention ? 30 : 0;
        $score += $recommendation ? 30 : 0;
        $rankValue = is_numeric($rank) ? (int) $rank : null;
        if ($rankValue !== null) {
            $score += $rankValue <= 3 ? 20 : ($rankValue <= 10 ? 10 : 0);
        }
        $score += min(20, max(0, (int) round(((int) ($accuracy ?? 0)) * 0.2)));

        return min(100, $score);
    }

    /** @return array<int,string> */
    private function lines(string $text): array
    {
        return collect(preg_split('/\r\n|\r|\n/u', $text) ?: [])
            ->map(fn (string $line): string => trim($line))
            ->filter()
            ->values()
            ->all();
    }

    /** @return array<string,string> */
    private function serviceLines(): array
    {
        return [
            'geo' => 'GEO优化',
            'short_video' => '短视频运营',
            'enterprise_ai' => '企业AI落地',
        ];
    }

    /** @return array<string,string> */
    private function verdictLabels(): array
    {
        return [
            'unknown' => '未测试',
            'covered' => '已有覆盖',
            'gap' => '内容缺口',
        ];
    }

    /** @return array<string,string> */
    private function platformLabels(): array
    {
        return [
            'local' => '本地覆盖检测',
            'deepseek' => 'DeepSeek',
            'doubao' => '豆包',
            'qianwen' => '通义千问',
            'kimi' => 'Kimi',
            'chatgpt' => 'ChatGPT',
            'yuanbao' => '腾讯元宝',
            'baidu_ai' => '百度AI',
            'perplexity' => 'Perplexity',
            'other' => '其他平台',
        ];
    }

    /** @return array<string,string> */
    private function surfaceLabels(): array
    {
        return [
            'web' => '网页端',
            'app' => 'App端',
            'search' => '搜索入口',
            'agent' => '智能体/插件',
        ];
    }
}
