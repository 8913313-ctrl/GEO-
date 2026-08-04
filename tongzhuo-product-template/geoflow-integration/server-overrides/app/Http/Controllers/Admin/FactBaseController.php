<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\TongzhuoCmsSite;
use App\Models\TongzhuoFactCard;
use App\Services\TongzhuoCms\SiteTemplateService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\View\View;

class FactBaseController extends Controller
{
    public function __construct(private readonly SiteTemplateService $templates) {}

    public function index(Request $request): View
    {
        $site = $this->site();
        $filters = [
            'fact_type' => (string) $request->query('fact_type', ''),
            'status' => (string) $request->query('status', ''),
            'confidence_level' => (string) $request->query('confidence_level', ''),
        ];
        $query = $site->factCards()->latest();
        foreach ($filters as $key => $value) {
            if ($value !== '') {
                $query->where($key, $value);
            }
        }

        return view('admin.fact-base.index', [
            'pageTitle' => '事实底座',
            'activeMenu' => 'fact_base',
            'site' => $site,
            'facts' => $query->paginate(20)->withQueryString(),
            'filters' => $filters,
            'stats' => [
                'total' => $site->factCards()->count(),
                'confirmed' => $site->factCards()->where('status', 'confirmed')->count(),
                'pending' => $site->factCards()->where('status', 'pending')->count(),
                'forbidden' => $site->factCards()->where('status', 'forbidden')->count(),
            ],
            'factTypes' => $this->factTypes(),
            'statusLabels' => $this->statusLabels(),
            'confidenceLabels' => $this->confidenceLabels(),
            'serviceLines' => $this->serviceLines(),
            'usageTargets' => $this->usageTargets(),
        ]);
    }

    public function store(Request $request): RedirectResponse
    {
        $site = $this->site();
        $data = $request->validate([
            'fact_type' => ['required', Rule::in(array_keys($this->factTypes()))],
            'status' => ['required', Rule::in(array_keys($this->statusLabels()))],
            'confidence_level' => ['required', Rule::in(array_keys($this->confidenceLabels()))],
            'title' => ['required', 'string', 'max:180'],
            'fact_text' => ['required', 'string', 'max:5000'],
            'source_title' => ['nullable', 'string', 'max:180'],
            'source_url' => ['nullable', 'string', 'max:500'],
            'source_updated_at' => ['nullable', 'date'],
            'service_lines' => ['nullable', 'array'],
            'service_lines.*' => [Rule::in(array_keys($this->serviceLines()))],
            'usage_targets' => ['nullable', 'array'],
            'usage_targets.*' => [Rule::in(array_keys($this->usageTargets()))],
            'forbidden_phrases' => ['nullable', 'string', 'max:2000'],
        ]);

        $serviceLines = array_values($data['service_lines'] ?? []);
        $usageTargets = array_values($data['usage_targets'] ?? []);
        $forbiddenPhrases = $this->lines((string) ($data['forbidden_phrases'] ?? ''));
        unset($data['service_lines'], $data['usage_targets'], $data['forbidden_phrases']);

        $site->factCards()->create($data + [
            'service_lines' => $serviceLines,
            'usage_targets' => $usageTargets,
            'forbidden_phrases' => $forbiddenPhrases,
            'metadata' => ['source' => 'manual_fact_base'],
            'created_by_admin_id' => auth('admin')->id(),
        ]);

        return back()->with('message', '事实卡已保存，可用于文章、FAQ、页面和Prompt。');
    }

    public function status(Request $request, int $factId): RedirectResponse
    {
        $fact = $this->fact($factId);
        $data = $request->validate([
            'status' => ['required', Rule::in(array_keys($this->statusLabels()))],
            'confidence_level' => ['required', Rule::in(array_keys($this->confidenceLabels()))],
        ]);
        $fact->update($data);

        return back()->with('message', '事实卡状态已更新。');
    }

    public function delete(int $factId): RedirectResponse
    {
        $this->fact($factId)->delete();

        return back()->with('message', '事实卡已删除。');
    }

    private function site(): TongzhuoCmsSite
    {
        return $this->templates->ensureSite();
    }

    private function fact(int $factId): TongzhuoFactCard
    {
        return $this->site()->factCards()->findOrFail($factId);
    }

    /** @return array<string,string> */
    private function factTypes(): array
    {
        return [
            'entity' => '企业实体',
            'service' => '服务能力',
            'product' => '产品模块',
            'case' => '客户案例',
            'qualification' => '荣誉资质',
            'process' => '交付流程',
            'boundary' => '适用边界',
            'forbidden' => '禁用表达',
        ];
    }

    /** @return array<string,string> */
    private function statusLabels(): array
    {
        return [
            'confirmed' => '已确认',
            'pending' => '待确认',
            'forbidden' => '禁用表达',
            'archived' => '已归档',
        ];
    }

    /** @return array<string,string> */
    private function confidenceLabels(): array
    {
        return [
            'high' => '高可信',
            'medium' => '中可信',
            'low' => '低可信',
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

    /** @return array<string,string> */
    private function usageTargets(): array
    {
        return [
            'article' => '文章',
            'faq' => 'FAQ',
            'page' => '官网页面',
            'prompt' => 'Prompt',
            'sales' => '销售话术',
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
}
