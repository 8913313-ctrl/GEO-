<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\TongzhuoCmsSite;
use App\Models\TongzhuoGeoOpportunity;
use App\Services\GeoGrowth\GeoEngineManager;
use App\Services\TongzhuoCms\SiteTemplateService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\View\View;

class GeoOpportunityController extends Controller
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
            'status' => (string) $request->query('status', ''),
            'recommended_output' => (string) $request->query('recommended_output', ''),
        ];

        $query = $site->geoOpportunities()->with('task')->latest();
        foreach ($filters as $key => $value) {
            if ($value !== '') {
                $query->where($key, $value);
            }
        }

        return view('admin.geo-opportunities.index', [
            'pageTitle' => '问题机会',
            'activeMenu' => 'geo_opportunities',
            'site' => $site,
            'filters' => $filters,
            'opportunities' => $query->paginate(20)->withQueryString(),
            'stats' => [
                'total' => $site->geoOpportunities()->count(),
                'new' => $site->geoOpportunities()->where('status', 'new')->count(),
                'planned' => $site->geoOpportunities()->where('status', 'planned')->count(),
                'promoted' => $site->geoOpportunities()->where('status', 'promoted')->count(),
            ],
            'serviceLines' => $this->serviceLines(),
            'intents' => $this->intents(),
            'outputs' => $this->outputs(),
            'coverageLabels' => $this->coverageLabels(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $site = $this->site();
        $data = $request->validate([
            'service_line' => ['required', Rule::in(array_keys($this->serviceLines()))],
            'intent' => ['required', Rule::in(array_keys($this->intents()))],
            'priority' => ['required', Rule::in(['high', 'medium', 'low'])],
            'keyword' => ['nullable', 'string', 'max:120'],
            'cluster_name' => ['nullable', 'string', 'max:120'],
            'question' => ['required', 'string', 'max:240'],
            'parent_question' => ['nullable', 'string', 'max:240'],
            'follow_up_questions' => ['nullable', 'string', 'max:2000'],
            'query_rewrites' => ['nullable', 'string', 'max:2000'],
            'evidence_query' => ['nullable', 'string', 'max:240'],
            'coverage_status' => ['nullable', Rule::in(array_keys($this->coverageLabels()))],
            'recommended_output' => ['required', Rule::in(array_keys($this->outputs()))],
            'answer_angle' => ['nullable', 'string', 'max:2000'],
        ]);

        $followUps = $this->lines((string) ($data['follow_up_questions'] ?? ''));
        $rewrites = $this->lines((string) ($data['query_rewrites'] ?? ''));
        unset($data['follow_up_questions'], $data['query_rewrites']);

        $site->geoOpportunities()->create($data + [
            'status' => 'new',
            'coverage_status' => $data['coverage_status'] ?? 'unknown',
            'follow_up_questions' => $followUps,
            'query_rewrites' => $rewrites,
            'mapped_assets' => [],
            'competitor_notes' => [],
            'created_by_admin_id' => auth('admin')->id(),
            'metadata' => ['source' => 'manual'],
        ]);

        return back()->with('message', '问题机会已新增。');
    }

    public function status(Request $request, int $opportunityId): RedirectResponse
    {
        $opportunity = $this->opportunity($opportunityId);
        $status = $request->validate(['status' => ['required', Rule::in(['new', 'planned', 'promoted', 'ignored'])]])['status'];
        $opportunity->update(['status' => $status]);

        return back()->with('message', '机会状态已更新。');
    }

    public function promote(int $opportunityId): RedirectResponse
    {
        $opportunity = $this->opportunity($opportunityId);
        if ($opportunity->task_id) {
            return redirect()->route('admin.geo-opportunities.index')->with('message', '这个机会已经生成过任务。');
        }

        $task = $opportunity->site->geoTasks()->create([
            'type' => $opportunity->recommended_output === 'faq' ? 'faq_opportunity' : 'content_opportunity',
            'priority' => $opportunity->priority,
            'status' => 'todo',
            'title' => $opportunity->question,
            'description' => $opportunity->answer_angle ?: '请结合企业真实案例、服务边界和客户问题，生成可被官网和AI抓取的内容资产。',
            'content_brief' => [
                'source' => 'geo_opportunity',
                'opportunity_id' => $opportunity->id,
                'service_line' => $opportunity->service_line,
                'intent' => $opportunity->intent,
                'keyword' => $opportunity->keyword,
                'recommended_output' => $opportunity->recommended_output,
            ],
        ]);

        $opportunity->update([
            'task_id' => $task->id,
            'status' => 'promoted',
            'promoted_at' => now(),
        ]);

        return redirect()->route('admin.geo-growth.index')->with('message', '问题机会已转为GEO任务，可继续生成文章或FAQ内容。');
    }

    public function seedPresets(): RedirectResponse
    {
        $site = $this->site();
        $engineResult = $this->engines->expandOpportunities([
            'company_name' => $site->brand_name ?: $site->name,
            'site_url' => $site->domain,
            'service_lines' => array_keys($this->serviceLines()),
            'existing_questions' => $site->geoOpportunities()->latest()->limit(30)->pluck('question')->all(),
        ]);
        $engineOpportunities = array_values(array_filter($engineResult['opportunities'] ?? [], 'is_array'));
        $created = 0;
        foreach (array_merge($engineOpportunities, $this->presetOpportunities()) as $preset) {
            $preset = [
                'service_line' => array_key_exists($preset['service_line'] ?? '', $this->serviceLines()) ? $preset['service_line'] : 'geo',
                'intent' => array_key_exists($preset['intent'] ?? '', $this->intents()) ? $preset['intent'] : 'question',
                'priority' => in_array($preset['priority'] ?? '', ['high', 'medium', 'low'], true) ? $preset['priority'] : 'medium',
                'keyword' => (string) ($preset['keyword'] ?? ''),
                'cluster_name' => (string) ($preset['cluster_name'] ?? $preset['keyword'] ?? ''),
                'question' => trim((string) ($preset['question'] ?? '')),
                'parent_question' => (string) ($preset['parent_question'] ?? ''),
                'follow_up_questions' => array_values(array_filter(is_array($preset['follow_up_questions'] ?? null) ? $preset['follow_up_questions'] : [])),
                'query_rewrites' => array_values(array_filter(is_array($preset['query_rewrites'] ?? null) ? $preset['query_rewrites'] : [])),
                'evidence_query' => (string) ($preset['evidence_query'] ?? $preset['keyword'] ?? ''),
                'coverage_status' => array_key_exists($preset['coverage_status'] ?? '', $this->coverageLabels()) ? $preset['coverage_status'] : 'unknown',
                'recommended_output' => array_key_exists($preset['recommended_output'] ?? '', $this->outputs()) ? $preset['recommended_output'] : 'article',
                'answer_angle' => (string) ($preset['answer_angle'] ?? ''),
            ];
            if ($preset['question'] === '') {
                continue;
            }
            $exists = $site->geoOpportunities()
                ->where('service_line', $preset['service_line'])
                ->where('question', $preset['question'])
                ->exists();
            if ($exists) {
                continue;
            }
            $site->geoOpportunities()->create($preset + [
                'status' => 'new',
                'created_by_admin_id' => auth('admin')->id(),
                'metadata' => [
                    'source' => 'opportunity_seed',
                    'engine' => (string) ($engineResult['engine'] ?? 'local'),
                    'engine_metadata' => is_array($engineResult['metadata'] ?? null) ? $engineResult['metadata'] : [],
                ],
            ]);
            $created++;
        }

        return back()->with('message', $created > 0 ? "已生成 {$created} 条基础问题机会。" : '基础问题机会已经存在，无需重复生成。');
    }

    private function site(): TongzhuoCmsSite
    {
        return $this->templates->ensureSite();
    }

    private function opportunity(int $opportunityId): TongzhuoGeoOpportunity
    {
        return $this->site()->geoOpportunities()->with('site')->findOrFail($opportunityId);
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
    private function intents(): array
    {
        return [
            'question' => '问题咨询',
            'comparison' => '方案对比',
            'vendor' => '服务商选择',
            'howto' => '操作方法',
            'case' => '案例证明',
        ];
    }

    /** @return array<string,string> */
    private function outputs(): array
    {
        return [
            'article' => '行业资讯文章',
            'faq' => 'FAQ问答',
            'service_page' => '服务页优化',
            'case' => '案例内容',
        ];
    }

    /** @return array<string,string> */
    private function coverageLabels(): array
    {
        return [
            'unknown' => '未评估',
            'uncovered' => '未覆盖',
            'partial' => '部分覆盖',
            'covered' => '已覆盖',
            'validated' => '采样验证',
        ];
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

    /** @return array<int,array<string,mixed>> */
    private function presetOpportunities(): array
    {
        return [
            [
                'service_line' => 'geo',
                'intent' => 'vendor',
                'priority' => 'high',
                'keyword' => 'GEO优化服务商',
                'cluster_name' => 'GEO服务商选择',
                'question' => '企业选择GEO优化服务商时应该看哪些能力？',
                'parent_question' => '企业如何选择AI搜索优化服务商？',
                'follow_up_questions' => ['GEO优化和SEO有什么区别？', '如何判断服务商是否真的懂AI抓取？'],
                'query_rewrites' => ['GEO优化服务商怎么选', 'AI搜索优化公司选择标准'],
                'evidence_query' => 'GEO优化 服务商 能力 标准',
                'coverage_status' => 'partial',
                'recommended_output' => 'article',
                'answer_angle' => '从官网AI可读性、行业资讯沉淀、FAQ问题地图、结构化数据、分发闭环和线索复盘六个维度说明选择标准。',
            ],
            [
                'service_line' => 'geo',
                'intent' => 'howto',
                'priority' => 'high',
                'keyword' => 'AI搜索可见性',
                'cluster_name' => 'AI搜索可见性基础',
                'question' => '企业官网如何提升被AI搜索理解和推荐的概率？',
                'parent_question' => '企业如何提升AI搜索可见性？',
                'follow_up_questions' => ['llms.txt对AI抓取有什么用？', 'FAQ和行业资讯如何配合GEO？'],
                'query_rewrites' => ['企业官网 AI搜索 推荐', '官网被AI引用怎么做'],
                'evidence_query' => 'AI搜索可见性 官网 llms sitemap schema',
                'coverage_status' => 'partial',
                'recommended_output' => 'faq',
                'answer_angle' => '回答要覆盖清晰实体信息、服务页结构、行业资讯、FAQ、Schema、sitemap、RSS和llms.txt。',
            ],
            [
                'service_line' => 'short_video',
                'intent' => 'question',
                'priority' => 'medium',
                'keyword' => '短视频获客',
                'cluster_name' => 'B端短视频获客',
                'question' => 'B端企业做短视频运营，如何从曝光走到获客？',
                'parent_question' => 'B端企业短视频怎么做获客？',
                'follow_up_questions' => ['短视频线索如何承接到官网？', 'B端短视频选题怎么设计？'],
                'query_rewrites' => ['B端短视频获客流程', '企业短视频运营怎么转化'],
                'evidence_query' => 'B端 短视频 获客 线索 承接',
                'coverage_status' => 'unknown',
                'recommended_output' => 'article',
                'answer_angle' => '强调账号定位、选题矩阵、口播脚本、直播/私域承接、线索表单和官网内容协同。',
            ],
            [
                'service_line' => 'enterprise_ai',
                'intent' => 'case',
                'priority' => 'medium',
                'keyword' => '企业AI落地',
                'cluster_name' => '企业AI落地场景',
                'question' => '中小企业适合先落地哪些AI应用场景？',
                'parent_question' => '企业AI落地应该从哪里开始？',
                'follow_up_questions' => ['企业知识库适合先做吗？', 'AI落地如何避免只买工具？'],
                'query_rewrites' => ['中小企业 AI应用场景', '企业AI落地 第一步'],
                'evidence_query' => '企业AI落地 知识库 自动化 场景',
                'coverage_status' => 'unknown',
                'recommended_output' => 'article',
                'answer_angle' => '从知识库问答、内容生产、销售话术、客服问答、流程自动化和数据复盘切入，避免空泛谈模型。',
            ],
            [
                'service_line' => 'enterprise_ai',
                'intent' => 'comparison',
                'priority' => 'medium',
                'keyword' => 'AI工具和AI系统',
                'cluster_name' => 'AI工具与系统选择',
                'question' => '企业买AI工具和建设AI落地系统有什么区别？',
                'parent_question' => '企业应该买AI工具还是做AI系统？',
                'follow_up_questions' => ['AI系统为什么需要企业资料和流程？', 'AI工具适合解决哪些单点问题？'],
                'query_rewrites' => ['AI工具 AI系统 区别', '企业AI落地系统建设'],
                'evidence_query' => 'AI工具 AI系统 企业落地 区别',
                'coverage_status' => 'unknown',
                'recommended_output' => 'faq',
                'answer_angle' => '说明工具解决单点问题，系统要结合企业资料、流程、权限、数据和持续运营。',
            ],
        ];
    }
}
