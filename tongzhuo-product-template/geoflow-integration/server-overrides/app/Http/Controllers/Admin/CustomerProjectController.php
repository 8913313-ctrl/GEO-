<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\TongzhuoCustomerProject;
use App\Models\TongzhuoCmsSite;
use App\Services\GeoGrowth\CustomerDeliveryReadinessService;
use App\Services\TongzhuoCms\SiteTemplateService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\View\View;
use Symfony\Component\HttpFoundation\StreamedResponse;

class CustomerProjectController extends Controller
{
    public function __construct(
        private readonly SiteTemplateService $templates,
        private readonly CustomerDeliveryReadinessService $deliveryReadiness,
    ) {}

    public function index(Request $request): View
    {
        $filters = [
            'stage' => (string) $request->query('stage', ''),
            'health_status' => (string) $request->query('health_status', ''),
        ];
        $query = TongzhuoCustomerProject::query()->latest();
        foreach ($filters as $key => $value) {
            if ($value !== '') {
                $query->where($key, $value);
            }
        }

        return view('admin.customer-projects.index', [
            'pageTitle' => '客户项目',
            'activeMenu' => 'customer_projects',
            'projects' => $query->paginate(20)->withQueryString(),
            'filters' => $filters,
            'stats' => [
                'total' => TongzhuoCustomerProject::query()->count(),
                'delivery' => TongzhuoCustomerProject::query()->whereIn('stage', ['config_review', 'handoff', 'launch'])->count(),
                'operations' => TongzhuoCustomerProject::query()->where('stage', 'operations')->count(),
                'risk' => TongzhuoCustomerProject::query()->where('health_status', 'risk')->count(),
            ],
            'stageLabels' => $this->stageLabels(),
            'healthLabels' => $this->healthLabels(),
            'acceptanceLabels' => $this->acceptanceLabels(),
            'renewalLabels' => $this->renewalLabels(),
            'serviceLines' => $this->serviceLines(),
            'deliveryChecklist' => $this->deliveryChecklist(),
        ]);
    }

    public function show(int $projectId): View
    {
        $project = TongzhuoCustomerProject::query()->findOrFail($projectId);
        $deliveryReadiness = $this->deliveryReadiness->evaluate($project);

        return view('admin.customer-projects.show', [
            'pageTitle' => '客户项目详情',
            'activeMenu' => 'customer_projects',
            'project' => $project,
            'stageLabels' => $this->stageLabels(),
            'healthLabels' => $this->healthLabels(),
            'acceptanceLabels' => $this->acceptanceLabels(),
            'renewalLabels' => $this->renewalLabels(),
            'serviceLines' => $this->serviceLines(),
            'deliveryChecklist' => $this->deliveryChecklist(),
            'deliveryReadiness' => $deliveryReadiness,
            'backendSnapshotPreview' => $this->backendSnapshotPreview($project, $deliveryReadiness),
        ]);
    }

    public function handoffReport(int $projectId): View
    {
        $project = TongzhuoCustomerProject::query()->findOrFail($projectId);
        $deliveryReadiness = $this->deliveryReadiness->evaluate($project);

        return view('admin.customer-projects.handoff-report', [
            'pageTitle' => '客户交付报告',
            'activeMenu' => 'customer_projects',
            'project' => $project,
            'stageLabels' => $this->stageLabels(),
            'healthLabels' => $this->healthLabels(),
            'acceptanceLabels' => $this->acceptanceLabels(),
            'renewalLabels' => $this->renewalLabels(),
            'serviceLines' => $this->serviceLines(),
            'deliveryChecklist' => $this->deliveryChecklist(),
            'deliveryReadiness' => $deliveryReadiness,
            'backendSnapshotPreview' => $this->backendSnapshotPreview($project, $deliveryReadiness),
        ]);
    }

    public function dossier(int $projectId): View
    {
        $project = TongzhuoCustomerProject::query()->findOrFail($projectId);
        $deliveryReadiness = $this->deliveryReadiness->evaluate($project);

        return view('admin.customer-projects.dossier', [
            'pageTitle' => '客户项目档案',
            'activeMenu' => 'customer_projects',
            'project' => $project,
            'stageLabels' => $this->stageLabels(),
            'healthLabels' => $this->healthLabels(),
            'acceptanceLabels' => $this->acceptanceLabels(),
            'renewalLabels' => $this->renewalLabels(),
            'serviceLines' => $this->serviceLines(),
            'deliveryChecklist' => $this->deliveryChecklist(),
            'deliveryReadiness' => $deliveryReadiness,
            'backendSnapshotPreview' => $this->backendSnapshotPreview($project, $deliveryReadiness),
        ]);
    }

    public function exportDossier(int $projectId): StreamedResponse
    {
        $project = TongzhuoCustomerProject::query()->findOrFail($projectId);
        $payload = $this->buildDossierPayload($project, $this->deliveryReadiness->evaluate($project));
        $filename = 'customer-project-'.$project->id.'-dossier.json';

        return response()->streamDownload(function () use ($payload): void {
            echo json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        }, $filename, [
            'Content-Type' => 'application/json; charset=UTF-8',
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $data = $this->validateProject($request);
        $project = TongzhuoCustomerProject::query()->create($this->payload($data) + [
            'created_by_admin_id' => auth('admin')->id(),
        ]);

        return redirect()->route('admin.customer-projects.show', ['projectId' => $project->id])->with('message', '客户项目已创建。');
    }

    public function update(Request $request, int $projectId): RedirectResponse
    {
        $project = TongzhuoCustomerProject::query()->findOrFail($projectId);
        $project->update($this->payload($this->validateProject($request)) + ['last_reviewed_at' => now()]);

        return back()->with('message', '客户项目已更新。');
    }

    public function createCurrentSiteProject(): RedirectResponse
    {
        $site = $this->templates->ensureSite();
        $settings = is_array($site->settings) ? $site->settings : [];
        $project = TongzhuoCustomerProject::query()->firstOrCreate(
            ['site_id' => $site->id, 'company_name' => (string) ($settings['company_name'] ?? $site->brand_name ?? $site->name)],
            [
                'name' => (string) ($site->brand_name ?? $site->name ?? '当前官网项目'),
                'status' => 'active',
                'stage' => 'operations',
                'health_status' => 'normal',
                'website_url' => $site->domain,
                'geoflow_url' => config('app.url'),
                'service_lines' => ['geo', 'short_video', 'enterprise_ai'],
                'endpoints' => [
                    'website' => $site->domain,
                    'admin' => url(config('geoflow.admin_base_path', '/geo_admin')),
                    'llms' => rtrim((string) $site->domain, '/').'/llms.txt',
                ],
                'next_action' => '完成GEO工作台、官网CMS、发布执行器和客户线索闭环验收。',
                'notes' => '由当前站点自动创建的客户项目档案。',
                'delivery_profile' => [
                    'readiness' => [],
                    'acceptance_status' => 'pending',
                    'accepted_by' => null,
                    'evidence_url' => null,
                    'training_at' => null,
                    'last_release_version' => null,
                    'upgrade_history' => null,
                    'success_review_at' => null,
                    'success_review_summary' => null,
                    'renewal_signal' => 'none',
                    'renewal_next_action' => null,
                    'review_notes' => null,
                ],
                'created_by_admin_id' => auth('admin')->id(),
            ],
        );

        return redirect()->route('admin.customer-projects.show', ['projectId' => $project->id])->with('message', '已生成当前站点客户项目档案。');
    }

    private function validateProject(Request $request): array
    {
        return $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'company_name' => ['required', 'string', 'max:180'],
            'status' => ['required', Rule::in(['active', 'paused', 'closed'])],
            'stage' => ['required', Rule::in(array_keys($this->stageLabels()))],
            'health_status' => ['required', Rule::in(array_keys($this->healthLabels()))],
            'contact_name' => ['nullable', 'string', 'max:80'],
            'contact_phone' => ['nullable', 'string', 'max:80'],
            'website_url' => ['nullable', 'string', 'max:500'],
            'geoflow_url' => ['nullable', 'string', 'max:500'],
            'service_lines' => ['nullable', 'array'],
            'service_lines.*' => [Rule::in(array_keys($this->serviceLines()))],
            'delivery_profile' => ['nullable', 'array'],
            'delivery_profile.readiness' => ['nullable', 'array'],
            'delivery_profile.readiness.*' => [Rule::in(array_keys($this->deliveryChecklist()))],
            'delivery_profile.acceptance_status' => ['nullable', Rule::in(array_keys($this->acceptanceLabels()))],
            'delivery_profile.accepted_by' => ['nullable', 'string', 'max:80'],
            'delivery_profile.evidence_url' => ['nullable', 'string', 'max:500'],
            'delivery_profile.training_at' => ['nullable', 'date'],
            'delivery_profile.last_release_version' => ['nullable', 'string', 'max:80'],
            'delivery_profile.upgrade_history' => ['nullable', 'string', 'max:5000'],
            'delivery_profile.success_review_at' => ['nullable', 'date'],
            'delivery_profile.success_review_summary' => ['nullable', 'string', 'max:3000'],
            'delivery_profile.renewal_signal' => ['nullable', Rule::in(array_keys($this->renewalLabels()))],
            'delivery_profile.renewal_next_action' => ['nullable', 'string', 'max:1500'],
            'delivery_profile.review_notes' => ['nullable', 'string', 'max:3000'],
            'next_action' => ['nullable', 'string', 'max:2000'],
            'notes' => ['nullable', 'string', 'max:5000'],
            'contract_started_at' => ['nullable', 'date'],
            'go_live_at' => ['nullable', 'date'],
        ]);
    }

    private function payload(array $data): array
    {
        return [
            'name' => $data['name'],
            'company_name' => $data['company_name'],
            'status' => $data['status'],
            'stage' => $data['stage'],
            'health_status' => $data['health_status'],
            'contact_name' => $data['contact_name'] ?? null,
            'contact_phone' => $data['contact_phone'] ?? null,
            'website_url' => $data['website_url'] ?? null,
            'geoflow_url' => $data['geoflow_url'] ?? null,
            'service_lines' => array_values($data['service_lines'] ?? []),
            'endpoints' => [
                'website' => $data['website_url'] ?? null,
                'admin' => isset($data['geoflow_url']) && $data['geoflow_url'] !== '' ? rtrim((string) $data['geoflow_url'], '/').'/geo_admin' : null,
                'llms' => isset($data['website_url']) && $data['website_url'] !== '' ? rtrim((string) $data['website_url'], '/').'/llms.txt' : null,
            ],
            'delivery_profile' => [
                'readiness' => array_values($data['delivery_profile']['readiness'] ?? []),
                'acceptance_status' => $data['delivery_profile']['acceptance_status'] ?? 'pending',
                'accepted_by' => $data['delivery_profile']['accepted_by'] ?? null,
                'evidence_url' => $data['delivery_profile']['evidence_url'] ?? null,
                'training_at' => $data['delivery_profile']['training_at'] ?? null,
                'last_release_version' => $data['delivery_profile']['last_release_version'] ?? null,
                'upgrade_history' => $data['delivery_profile']['upgrade_history'] ?? null,
                'success_review_at' => $data['delivery_profile']['success_review_at'] ?? null,
                'success_review_summary' => $data['delivery_profile']['success_review_summary'] ?? null,
                'renewal_signal' => $data['delivery_profile']['renewal_signal'] ?? 'none',
                'renewal_next_action' => $data['delivery_profile']['renewal_next_action'] ?? null,
                'review_notes' => $data['delivery_profile']['review_notes'] ?? null,
            ],
            'next_action' => $data['next_action'] ?? null,
            'notes' => $data['notes'] ?? null,
            'contract_started_at' => $data['contract_started_at'] ?? null,
            'go_live_at' => $data['go_live_at'] ?? null,
        ];
    }

    private function buildDossierPayload(TongzhuoCustomerProject $project, array $deliveryReadiness): array
    {
        $profile = is_array($project->delivery_profile) ? $project->delivery_profile : [];
        $checkedDelivery = is_array($profile['readiness'] ?? null) ? $profile['readiness'] : [];
        $deliveryChecklist = $this->deliveryChecklist();
        $serviceLines = $this->serviceLines();

        return [
            'schema' => 'customer_project_dossier_export',
            'schema_version' => '1.0',
            'exported_at' => now()->toIso8601String(),
            'security_boundary' => [
                'contains_credentials' => false,
                'contains_cookies' => false,
                'contains_browser_profiles' => false,
                'note' => 'This dossier is for delivery, acceptance, and customer replication. Secrets stay in runtime configuration.',
            ],
            'project' => [
                'id' => $project->id,
                'name' => $project->name,
                'company_name' => $project->company_name,
                'status' => $project->status,
                'stage' => [
                    'value' => $project->stage,
                    'label' => $this->stageLabels()[$project->stage] ?? $project->stage,
                ],
                'health_status' => [
                    'value' => $project->health_status,
                    'label' => $this->healthLabels()[$project->health_status] ?? $project->health_status,
                ],
                'contact_name' => $project->contact_name,
                'contact_phone' => $project->contact_phone,
                'website_url' => $project->website_url,
                'geoflow_url' => $project->geoflow_url,
                'contract_started_at' => $project->contract_started_at?->toDateString(),
                'go_live_at' => $project->go_live_at?->toDateString(),
                'last_reviewed_at' => $project->last_reviewed_at?->toDateString(),
            ],
            'service_lines' => collect(is_array($project->service_lines) ? $project->service_lines : [])
                ->map(fn ($line) => [
                    'value' => $line,
                    'label' => $serviceLines[$line] ?? $line,
                ])
                ->values()
                ->all(),
            'endpoints' => is_array($project->endpoints) ? $project->endpoints : [],
            'delivery_readiness' => $deliveryReadiness,
            'geoflow_backend_snapshot' => $this->backendSnapshotPreview($project, $deliveryReadiness),
            'delivery_checklist' => collect($deliveryChecklist)
                ->map(fn ($item, $key) => [
                    'key' => $key,
                    'label' => $item['label'],
                    'description' => $item['description'],
                    'completed' => in_array($key, $checkedDelivery, true),
                ])
                ->values()
                ->all(),
            'acceptance' => [
                'status' => [
                    'value' => (string) ($profile['acceptance_status'] ?? 'pending'),
                    'label' => $this->acceptanceLabels()[(string) ($profile['acceptance_status'] ?? 'pending')] ?? (string) ($profile['acceptance_status'] ?? 'pending'),
                ],
                'accepted_by' => $profile['accepted_by'] ?? null,
                'evidence_url' => $profile['evidence_url'] ?? null,
                'training_at' => $profile['training_at'] ?? null,
                'last_release_version' => $profile['last_release_version'] ?? null,
                'upgrade_history' => $profile['upgrade_history'] ?? null,
            ],
            'success_review' => [
                'success_review_at' => $profile['success_review_at'] ?? null,
                'success_review_summary' => $profile['success_review_summary'] ?? null,
                'renewal_signal' => [
                    'value' => (string) ($profile['renewal_signal'] ?? 'none'),
                    'label' => $this->renewalLabels()[(string) ($profile['renewal_signal'] ?? 'none')] ?? (string) ($profile['renewal_signal'] ?? 'none'),
                ],
                'renewal_next_action' => $profile['renewal_next_action'] ?? null,
                'review_notes' => $profile['review_notes'] ?? null,
            ],
            'operator_notes' => [
                'next_action' => $project->next_action,
                'notes' => $project->notes,
            ],
        ];
    }

    private function backendSnapshotPreview(TongzhuoCustomerProject $project, array $deliveryReadiness): array
    {
        $profile = is_array($project->delivery_profile) ? $project->delivery_profile : [];
        $checkedDelivery = is_array($profile['readiness'] ?? null) ? $profile['readiness'] : [];
        $deliveryChecklist = $this->deliveryChecklist();
        $deliveryTasks = $deliveryReadiness['delivery_tasks'] ?? [];

        return [
            'attached' => true,
            'schema' => 'customer_project_dossier_export',
            'schema_version' => '1.0',
            'exported_at' => now()->toIso8601String(),
            'project_id' => $project->id,
            'project_name' => $project->name,
            'company_name' => $project->company_name,
            'delivery_status' => (string) ($deliveryReadiness['status'] ?? 'watch'),
            'delivery_score' => (int) ($deliveryReadiness['score'] ?? 0),
            'delivery_task_count' => count($deliveryTasks),
            'checklist_count' => count($deliveryChecklist),
            'service_line_count' => count(is_array($project->service_lines) ? $project->service_lines : []),
            'accepted_count' => count(array_intersect(array_keys($deliveryChecklist), $checkedDelivery)),
            'contains_credentials' => false,
            'contains_cookies' => false,
            'contains_browser_profiles' => false,
            'source_file' => 'GEOFlow live project state',
        ];
    }

    /** @return array<string,string> */
    private function stageLabels(): array
    {
        return [
            'intake' => '需求收集',
            'config_review' => '配置评审',
            'handoff' => '交付准备',
            'launch' => '上线验收',
            'operations' => '持续运营',
            'success_review' => '复盘续费',
        ];
    }

    /** @return array<string,string> */
    private function healthLabels(): array
    {
        return [
            'normal' => '正常',
            'watch' => '关注',
            'risk' => '风险',
        ];
    }

    /** @return array<string,string> */
    private function acceptanceLabels(): array
    {
        return [
            'pending' => '待验收',
            'passed' => '已验收',
            'blocked' => '有阻塞',
        ];
    }

    /** @return array<string,string> */
    private function renewalLabels(): array
    {
        return [
            'none' => '暂无信号',
            'watch' => '需要跟进',
            'high' => '高意向',
        ];
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

    /** @return array<string,array{label:string,description:string}> */
    private function deliveryChecklist(): array
    {
        return [
            'brand_profile' => [
                'label' => '品牌资料配置',
                'description' => '公司名称、主营服务、联系方式、SEO基础信息已完成。',
            ],
            'cms_pages' => [
                'label' => '官网页面可编辑',
                'description' => '首页、关于、产品、案例、行业资讯、问题地图等核心页面可在CMS维护。',
            ],
            'ai_crawl_files' => [
                'label' => 'AI抓取文件',
                'description' => 'robots、sitemap、llms.txt、结构化数据和FAQ内容已检查。',
            ],
            'geo_audit' => [
                'label' => 'GEO诊断报告',
                'description' => '已完成至少一次官网诊断，并生成可执行任务。',
            ],
            'content_loop' => [
                'label' => '内容生产闭环',
                'description' => '问题机会可以转文章或FAQ，行业资讯能发布到官网。',
            ],
            'faq_map' => [
                'label' => '问题地图',
                'description' => 'FAQ分类和问答可动态维护，适合AI引用和客户检索。',
            ],
            'publisher_flow' => [
                'label' => '发布助手流程',
                'description' => '分发渠道、发布设备、任务队列和结果回写已完成验证。',
            ],
            'lead_capture' => [
                'label' => '线索回收',
                'description' => '官网表单提交后能进入客户线索管理，并可跟进状态。',
            ],
            'operator_training' => [
                'label' => '运营培训',
                'description' => '客户已知道如何编辑官网、发文章、查看诊断和处理分发。',
            ],
            'go_live_acceptance' => [
                'label' => '上线验收',
                'description' => '官网、后台、发布助手、线索、AI抓取入口已完成最终验收。',
            ],
        ];
    }
}
