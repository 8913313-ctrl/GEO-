<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\TongzhuoCmsSite;
use App\Models\TongzhuoFaqCategory;
use App\Models\TongzhuoFaqItem;
use App\Services\TongzhuoCms\SiteTemplateService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\View\View;

class TongzhuoFaqController extends Controller
{
    public function __construct(private readonly SiteTemplateService $templates) {}

    public function index(): View
    {
        $site = $this->site();

        return view('admin.tongzhuo-cms.faqs.index', [
            'pageTitle' => '问题地图',
            'activeMenu' => 'tongzhuo_cms_faqs',
            'site' => $site,
            'categories' => $site->faqCategories()->withCount('items')->orderBy('sort_order')->get(),
            'items' => TongzhuoFaqItem::query()->where('site_id', $site->id)->with('category')->orderByDesc('updated_at')->paginate(20),
        ]);
    }

    public function categoryStore(Request $request): RedirectResponse
    {
        $site = $this->site();
        $data = $request->validate([
            'name' => ['required', 'string', 'max:80'],
            'slug' => ['nullable', 'string', 'max:120', 'regex:/^[a-z0-9-]+$/', Rule::unique('tongzhuo_faq_categories', 'slug')->where('site_id', $site->id)],
            'description' => ['nullable', 'string', 'max:240'],
            'sort_order' => ['nullable', 'integer', 'min:0', 'max:9999'],
        ]);

        TongzhuoFaqCategory::query()->create([
            'site_id' => $site->id,
            'name' => $data['name'],
            'slug' => $data['slug'] ?: $this->nextSlug($site, 'category'),
            'description' => $data['description'] ?: null,
            'sort_order' => $data['sort_order'] ?? ((int) $site->faqCategories()->max('sort_order') + 10),
            'is_visible' => true,
        ]);

        return back()->with('message', '问题分类已新增。');
    }

    public function categoryUpdate(Request $request, int $categoryId): RedirectResponse
    {
        $category = $this->category($categoryId);
        $data = $request->validate([
            'name' => ['required', 'string', 'max:80'],
            'description' => ['nullable', 'string', 'max:240'],
            'sort_order' => ['nullable', 'integer', 'min:0', 'max:9999'],
            'is_visible' => ['nullable', 'boolean'],
        ]);
        $category->update($data + ['is_visible' => $request->boolean('is_visible')]);

        return back()->with('message', '分类设置已保存。');
    }

    public function itemStore(Request $request): RedirectResponse
    {
        $site = $this->site();
        $data = $this->validateItem($request, $site);
        $category = $this->category((int) $data['category_id']);
        $status = $data['status'] ?? 'draft';
        TongzhuoFaqItem::query()->create([
            'site_id' => $site->id,
            'category_id' => $category->id,
            'question' => $data['question'],
            'slug' => $data['slug'] ?: $this->nextItemSlug($category),
            'answer' => $data['answer'],
            'excerpt' => $data['excerpt'] ?: Str::limit(trim(strip_tags($data['answer'])), 260, ''),
            'seo' => ['title' => $data['seo']['title'] ?? $data['question'], 'description' => $data['seo']['description'] ?? ($data['excerpt'] ?: '')],
            'sort_order' => $data['sort_order'] ?? ((int) $category->items()->max('sort_order') + 10),
            'status' => $status,
            'published_at' => $status === 'published' ? now() : null,
        ]);

        return back()->with('message', $status === 'published' ? '问题已发布到官网。' : '问题已保存为草稿。');
    }

    public function itemUpdate(Request $request, int $itemId): RedirectResponse
    {
        $item = $this->item($itemId);
        $data = $this->validateItem($request, $this->site(), $item);
        $category = $this->category((int) $data['category_id']);
        $status = $data['status'] ?? $item->status;
        $item->update([
            'category_id' => $category->id,
            'question' => $data['question'],
            'slug' => $data['slug'] ?: $item->slug,
            'answer' => $data['answer'],
            'excerpt' => $data['excerpt'] ?: Str::limit(trim(strip_tags($data['answer'])), 260, ''),
            'seo' => ['title' => $data['seo']['title'] ?? $data['question'], 'description' => $data['seo']['description'] ?? ($data['excerpt'] ?: '')],
            'sort_order' => $data['sort_order'] ?? $item->sort_order,
            'status' => $status,
            'published_at' => $status === 'published' ? ($item->published_at ?? now()) : null,
        ]);

        return back()->with('message', '问题内容已保存。');
    }

    public function itemStatus(Request $request, int $itemId): RedirectResponse
    {
        $item = $this->item($itemId);
        $status = $request->validate(['status' => ['required', Rule::in(['draft', 'published'])]])['status'];
        $item->update(['status' => $status, 'published_at' => $status === 'published' ? ($item->published_at ?? now()) : null]);

        return back()->with('message', $status === 'published' ? '问题已发布到官网。' : '问题已转为草稿。');
    }

    public function itemDelete(int $itemId): RedirectResponse
    {
        $this->item($itemId)->delete();

        return back()->with('message', '问题已删除。');
    }

    private function site(): TongzhuoCmsSite
    {
        return $this->templates->ensureSite();
    }

    private function category(int $categoryId): TongzhuoFaqCategory
    {
        return $this->site()->faqCategories()->findOrFail($categoryId);
    }

    private function item(int $itemId): TongzhuoFaqItem
    {
        return TongzhuoFaqItem::query()->where('site_id', $this->site()->id)->findOrFail($itemId);
    }

    private function validateItem(Request $request, TongzhuoCmsSite $site, ?TongzhuoFaqItem $item = null): array
    {
        return $request->validate([
            'category_id' => ['required', 'integer', Rule::exists('tongzhuo_faq_categories', 'id')->where('site_id', $site->id)],
            'question' => ['required', 'string', 'max:220'],
            'slug' => ['nullable', 'string', 'max:140', 'regex:/^[a-z0-9-]+$/'],
            'answer' => ['required', 'string', 'max:8000'],
            'excerpt' => ['nullable', 'string', 'max:300'],
            'sort_order' => ['nullable', 'integer', 'min:0', 'max:9999'],
            'status' => ['nullable', Rule::in(['draft', 'published'])],
            'seo' => ['nullable', 'array'],
            'seo.title' => ['nullable', 'string', 'max:180'],
            'seo.description' => ['nullable', 'string', 'max:300'],
        ]);
    }

    private function nextSlug(TongzhuoCmsSite $site, string $prefix): string
    {
        return $prefix.'-'.((int) $site->faqCategories()->count() + 1);
    }

    private function nextItemSlug(TongzhuoFaqCategory $category): string
    {
        return 'question-'.((int) $category->items()->count() + 1);
    }
}
