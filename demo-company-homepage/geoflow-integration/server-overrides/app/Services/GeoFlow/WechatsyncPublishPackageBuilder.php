<?php

namespace App\Services\GeoFlow;

use App\Models\ArticleDistribution;
use App\Models\DistributionChannel;
use RuntimeException;
use ZipArchive;

class WechatsyncPublishPackageBuilder
{
    public function __construct(private readonly DistributionPayloadBuilder $payloadBuilder) {}

    /**
     * @return array{path:string,filename:string}
     */
    public function build(ArticleDistribution $distribution): array
    {
        if (! class_exists(ZipArchive::class)) {
            throw new RuntimeException('服务器缺少 ZipArchive 扩展，无法生成 Wechatsync 发布包。');
        }

        $distribution->loadMissing(['article.category', 'article.author', 'article.task', 'channel']);
        if (! $distribution->article || ! ($distribution->channel instanceof DistributionChannel)) {
            throw new RuntimeException('分发任务缺少文章或渠道，无法生成发布包。');
        }
        if (! $distribution->channel->isLocalPublisher()) {
            throw new RuntimeException('当前分发任务不是本地发布助手渠道。');
        }

        $payload = $this->payloadBuilder->build($distribution->article);
        $config = $distribution->channel->resolvedWechatSyncConfig();
        $article = is_array($payload['article'] ?? null) ? $payload['article'] : [];
        $assets = is_array($payload['assets'] ?? null) ? $payload['assets'] : [];
        $images = is_array($assets['images'] ?? null) ? $assets['images'] : [];
        $platforms = $config['wechatsync_platforms'];

        $tmpPath = tempnam(storage_path('app'), 'wechatsync-package-');
        if (! is_string($tmpPath) || $tmpPath === '') {
            throw new RuntimeException('无法创建临时发布包文件。');
        }

        $zip = new ZipArchive;
        if ($zip->open($tmpPath, ZipArchive::OVERWRITE) !== true) {
            @unlink($tmpPath);
            throw new RuntimeException('无法写入 Wechatsync 发布包。');
        }

        $normalizedImages = $this->addImages($zip, $images);
        $metadata = $this->metadata($distribution, $payload, $platforms, $normalizedImages);

        $zip->addFromString('article.md', $this->markdownArticle($article));
        $zip->addFromString('article.html', $this->htmlArticle($article));
        $zip->addFromString('article-sync-payload.json', json_encode($this->syncPayload($article, $platforms), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: '{}');
        $zip->addFromString('browser-sync.html', $this->browserSyncHtml($article, $platforms));
        $zip->addFromString('metadata.json', json_encode($metadata, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: '{}');
        $zip->addFromString('images.json', json_encode($normalizedImages, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: '[]');
        $zip->addFromString('wechatsync-commands.txt', $this->commands($platforms));
        $zip->addFromString('README.txt', $this->readme($platforms));
        $zip->close();

        return [
            'path' => $tmpPath,
            'filename' => $this->filename($article, (int) $distribution->id),
        ];
    }

    /**
     * @param  list<array<string,string>>  $images
     * @return list<array<string,mixed>>
     */
    private function addImages(ZipArchive $zip, array $images): array
    {
        $normalized = [];
        foreach ($images as $index => $image) {
            if (! is_array($image)) {
                continue;
            }
            $filename = $this->safeFilename((string) ($image['filename'] ?? 'image-'.$index.'.img'));
            $entry = [
                'source_url' => (string) ($image['source_url'] ?? ''),
                'filename' => $filename,
                'mime_type' => (string) ($image['mime_type'] ?? ''),
                'local_path' => null,
                'skip_reason' => (string) ($image['skip_reason'] ?? ''),
            ];

            $contentBase64 = (string) ($image['content_base64'] ?? '');
            if ($contentBase64 !== '') {
                $content = base64_decode($contentBase64, true);
                if (is_string($content)) {
                    $entry['local_path'] = 'images/'.$filename;
                    $zip->addFromString('images/'.$filename, $content);
                }
            }

            $normalized[] = $entry;
        }

        return $normalized;
    }

    /**
     * @param  array<string,mixed>  $payload
     * @param  list<string>  $platforms
     * @param  list<array<string,mixed>>  $images
     * @return array<string,mixed>
     */
    private function metadata(ArticleDistribution $distribution, array $payload, array $platforms, array $images): array
    {
        $article = is_array($payload['article'] ?? null) ? $payload['article'] : [];

        return [
            'version' => '1.0',
            'source' => 'geoflow',
            'package_type' => 'wechatsync_manual_publish',
            'generated_at' => now()->toISOString(),
            'distribution' => [
                'id' => (int) $distribution->id,
                'action' => (string) $distribution->action,
                'channel_id' => (int) $distribution->distribution_channel_id,
                'channel_name' => (string) ($distribution->channel?->name ?? ''),
            ],
            'article' => $article,
            'platforms' => $platforms,
            'images' => $images,
            'workflow' => [
                'local_browser_required' => true,
                'default_mode' => 'draft',
                'manual_confirmation_required' => true,
            ],
        ];
    }

    /**
     * @param  array<string,mixed>  $article
     */
    private function markdownArticle(array $article): string
    {
        $title = trim((string) ($article['title'] ?? ''));
        $content = trim((string) ($article['content'] ?? ''));
        if ($title !== '' && preg_match('/^\s*#\s+'.preg_quote($title, '/').'\s*$/um', $content) !== 1) {
            $content = '# '.$title."\n\n".$content;
        }

        return $content."\n";
    }

    /**
     * @param  array<string,mixed>  $article
     */
    private function htmlArticle(array $article): string
    {
        $title = trim((string) ($article['title'] ?? ''));
        $description = trim((string) ($article['meta_description'] ?? $article['excerpt'] ?? ''));
        $keywords = trim((string) ($article['keywords'] ?? ''));
        $contentHtml = trim((string) ($article['content_html'] ?? ''));

        return '<!doctype html>'."\n"
            .'<html lang="zh-CN">'."\n"
            .'<head>'."\n"
            .'<meta charset="utf-8">'."\n"
            .'<meta name="viewport" content="width=device-width, initial-scale=1">'."\n"
            .'<title>'.e($title).'</title>'."\n"
            .'<meta name="description" content="'.e($description).'">'."\n"
            .'<meta name="keywords" content="'.e($keywords).'">'."\n"
            .'</head>'."\n"
            .'<body>'."\n"
            .'<article>'."\n"
            .'<h1>'.e($title).'</h1>'."\n"
            .$contentHtml."\n"
            .'</article>'."\n"
            .'</body>'."\n"
            .'</html>'."\n";
    }

    /**
     * @param  list<string>  $platforms
     */
    private function commands(array $platforms): string
    {
        return implode("\n", [
            'Wechatsync 官方主仓库当前以浏览器扩展和 window.syncPost(article) JS API 为核心。',
            '本发布包不要求服务器保存平台账号，也不依赖未确认的 CLI 命令。',
            '',
            '推荐操作：',
            '1. 在本地 Chrome/Edge 安装并启用 Wechatsync 浏览器扩展。',
            '2. 登录要同步的平台账号。',
            '3. 解压发布包，打开 browser-sync.html。',
            '4. 点击页面里的“调用 Wechatsync 同步窗口”。',
            '5. 在 Wechatsync 弹窗中选择平台并进入草稿/发布确认。',
            '',
            '选中平台参考：'.implode(', ', $platforms),
            '',
            '手工兜底：',
            '- article.html 可复制到支持 HTML 的平台编辑器。',
            '- article.md 可复制到支持 Markdown 的技术社区。',
            '- article-sync-payload.json 是给 window.syncPost(article) 使用的结构化载荷。',
            '',
        ]);
    }

    /**
     * @param  array<string,mixed>  $article
     * @param  list<string>  $platforms
     * @return array<string,mixed>
     */
    private function syncPayload(array $article, array $platforms): array
    {
        $keywords = array_values(array_filter(array_map(
            static fn (string $keyword): string => trim($keyword),
            preg_split('/[,，、\s]+/u', (string) ($article['keywords'] ?? '')) ?: []
        )));
        $contentHtml = trim((string) ($article['content_html'] ?? ''));

        return [
            'post_title' => trim((string) ($article['title'] ?? '')),
            'post_content' => $contentHtml,
            'post_excerpt' => trim((string) ($article['excerpt'] ?? '')),
            'post_tags' => $keywords,
            'post_status' => 'draft',
            'title' => trim((string) ($article['title'] ?? '')),
            'content' => $contentHtml,
            'excerpt' => trim((string) ($article['excerpt'] ?? '')),
            'tags' => $keywords,
            'platforms' => $platforms,
            'source' => 'GEOFlow',
        ];
    }

    /**
     * @param  array<string,mixed>  $article
     * @param  list<string>  $platforms
     */
    private function browserSyncHtml(array $article, array $platforms): string
    {
        $payload = json_encode($this->syncPayload($article, $platforms), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) ?: '{}';

        return '<!doctype html>'."\n"
            .'<html lang="zh-CN">'."\n"
            .'<head>'."\n"
            .'<meta charset="utf-8">'."\n"
            .'<meta name="viewport" content="width=device-width, initial-scale=1">'."\n"
            .'<title>Wechatsync 发布助手</title>'."\n"
            .'<style>body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;margin:0;background:#f6fbfc;color:#102a43}main{max-width:920px;margin:0 auto;padding:40px 20px}.panel{background:#fff;border:1px solid #d8eef2;border-radius:10px;padding:24px;box-shadow:0 16px 40px rgba(15,80,95,.08)}button{border:0;border-radius:8px;background:#0891b2;color:#fff;font-size:15px;font-weight:700;padding:12px 18px;cursor:pointer}button:hover{background:#0e7490}pre{white-space:pre-wrap;word-break:break-word;background:#0f172a;color:#e2e8f0;border-radius:8px;padding:16px;max-height:420px;overflow:auto}.muted{color:#64748b;line-height:1.7}.status{margin-top:14px;font-weight:700}</style>'."\n"
            .'</head>'."\n"
            .'<body>'."\n"
            .'<main>'."\n"
            .'<div class="panel">'."\n"
            .'<h1>Wechatsync 发布助手</h1>'."\n"
            .'<p class="muted">请在已安装并登录 Wechatsync 浏览器扩展的本地浏览器中打开本页。点击按钮会调用 <code>window.syncPost(article)</code> 拉起同步窗口；如未检测到该方法，请先安装/启用扩展或把下方 JSON 复制到你的集成页面中调用。</p>'."\n"
            .'<button id="sync-button" type="button">调用 Wechatsync 同步窗口</button>'."\n"
            .'<div id="status" class="status"></div>'."\n"
            .'<h2>文章载荷</h2>'."\n"
            .'<pre id="payload"></pre>'."\n"
            .'</div>'."\n"
            .'</main>'."\n"
            .'<script>'."\n"
            .'const article = '.$payload.';'."\n"
            .'document.getElementById("payload").textContent = JSON.stringify(article, null, 2);'."\n"
            .'document.getElementById("sync-button").addEventListener("click", function () {'."\n"
            .'  const status = document.getElementById("status");'."\n"
            .'  if (typeof window.syncPost !== "function") {'."\n"
            .'    status.textContent = "未检测到 window.syncPost。请确认 Wechatsync 扩展/JS SDK 已启用，或复制 JSON 到已有集成页面调用。";'."\n"
            .'    status.style.color = "#b45309";'."\n"
            .'    return;'."\n"
            .'  }'."\n"
            .'  window.syncPost(article);'."\n"
            .'  status.textContent = "已调用 Wechatsync 同步窗口，请在弹窗中选择平台并人工确认。";'."\n"
            .'  status.style.color = "#047857";'."\n"
            .'});'."\n"
            .'</script>'."\n"
            .'</body>'."\n"
            .'</html>'."\n";
    }

    /**
     * @param  list<string>  $platforms
     */
    private function readme(array $platforms): string
    {
        return implode("\n", [
            '桐灼 GEOFlow × Wechatsync 半自动多平台发布包',
            '',
            '包内容：',
            '- article.md：正文 Markdown，适合手工复制到支持 Markdown 的平台',
            '- article.html：保留基础排版的 HTML 版本',
            '- browser-sync.html：本地浏览器唤起 Wechatsync 同步窗口',
            '- article-sync-payload.json：window.syncPost(article) 结构化载荷',
            '- metadata.json：文章、渠道、平台和 GEOFlow 分发任务元数据',
            '- images/：可被 GEOFlow 读取到的本地图片资源',
            '- images.json：图片来源与本地文件映射',
            '- wechatsync-commands.txt：本地执行说明',
            '',
            '选中平台：'.implode(', ', $platforms),
            '',
            '使用方式：',
            '1. 在本地电脑安装 Wechatsync 浏览器扩展，并登录需要发布的平台账号。',
            '2. 解压本发布包，在同一个浏览器中打开 browser-sync.html。',
            '3. 点击“调用 Wechatsync 同步窗口”，或把 article-sync-payload.json 交给你自己的编辑器页面调用 window.syncPost(article)。',
            '4. 发布结果建议先进入各平台草稿箱，人工检查标题、封面、图片、排版和敏感词后再发布。',
            '',
            '安全说明：',
            'GEOFlow 不保存任何平台账号、Cookie 或验证码信息；平台登录态只保存在本地浏览器。',
            '',
        ]);
    }

    /**
     * @param  array<string,mixed>  $article
     */
    private function filename(array $article, int $distributionId): string
    {
        $slug = trim((string) ($article['slug'] ?? ''));
        $base = $slug !== '' ? $slug : 'article-'.$distributionId;
        $base = preg_replace('/[^A-Za-z0-9_\-]+/', '-', $base) ?: 'article-'.$distributionId;
        $base = trim($base, '-_');

        return 'tongzhuo-wechatsync-'.$base.'-'.$distributionId.'.zip';
    }

    private function safeFilename(string $filename): string
    {
        $filename = basename(str_replace('\\', '/', $filename));
        $filename = preg_replace('/[^A-Za-z0-9._\-]+/', '-', $filename) ?: 'image.img';

        return trim($filename, '.-') ?: 'image.img';
    }
}
