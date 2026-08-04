<?php

namespace App\Services\GeoGrowth;

use App\Models\Article;
use Illuminate\Support\Str;

class ArticleGeoQualityScorer
{
    /**
     * @return array{
     *     score:int,
     *     level:string,
     *     passed:int,
     *     total:int,
     *     checks:array<string,array<string,mixed>>,
     *     next_action:string
     * }
     */
    public function score(Article $article): array
    {
        $text = $this->plainText($article);
        $checks = [
            'direct_answer' => $this->check(
                $this->hasDirectAnswer($text),
                '首段直接回答',
                '开头直接回答客户问题，方便AI抽取结论。'
            ),
            'evidence_points' => $this->check(
                $this->evidencePointCount($text) >= 3,
                '事实与证据',
                '至少写入3条事实、数字、案例或可验证依据。'
            ),
            'comparison' => $this->check(
                $this->containsAny($text, ['对比', '区别', '相比', '不同', '优劣', '适合']),
                '对比模块',
                '补充方案对比、适用对象或选择标准。'
            ),
            'steps' => $this->check(
                $this->containsAny($text, ['步骤', '流程', '第一步', '第二步', '1.', '2.', '先', '再']),
                '操作步骤',
                '把建议拆成可执行步骤，减少空泛表述。'
            ),
            'faq' => $this->check(
                $this->containsAny($text, ['常见问题', 'FAQ', '问：', '答：', 'Q:', 'A:']),
                'FAQ结构',
                '增加2-3个追问，承接AI搜索的长尾问题。'
            ),
            'source_update' => $this->check(
                $this->containsAny($text, ['来源', '参考', '数据', '更新时间', '更新于', '截至']),
                '来源与更新时间',
                '注明来源、更新日期或证据口径。'
            ),
            'boundary' => $this->check(
                $this->containsAny($text, ['适用', '不适合', '限制', '边界', '前提', '需要结合']),
                '适用边界',
                '说明适用条件和限制，避免AI误引用。'
            ),
            'verified_language' => $this->check(
                ! $this->containsAny($text, ['绝对', '百分百', '一定排名第一', '保证上热门', '包效果']),
                '可信表达',
                '避免把未核实内容写成确定事实或夸大承诺。'
            ),
        ];

        $passed = collect($checks)->where('passed', true)->count();
        $total = count($checks);
        $score = (int) round(($passed / max(1, $total)) * 100);

        return [
            'score' => $score,
            'level' => $score >= 85 ? 'ready' : ($score >= 65 ? 'needs_review' : 'weak'),
            'passed' => $passed,
            'total' => $total,
            'checks' => $checks,
            'next_action' => $this->nextAction($checks),
        ];
    }

    /**
     * @return array{passed:bool,label:string,hint:string}
     */
    private function check(bool $passed, string $label, string $hint): array
    {
        return compact('passed', 'label', 'hint');
    }

    private function plainText(Article $article): string
    {
        return trim(preg_replace('/\s+/u', ' ', strip_tags(
            (string) $article->title.' '.(string) $article->excerpt.' '.(string) $article->content
        )) ?: '');
    }

    private function hasDirectAnswer(string $text): bool
    {
        $first = Str::limit($text, 220, '');

        return $this->containsAny($first, ['是', '可以', '需要', '核心', '关键', '建议', '首先', '答案']);
    }

    private function evidencePointCount(string $text): int
    {
        preg_match_all('/(\d+[%％]?)|([一二三四五六七八九十]+个)|案例|客户|数据|报告|来源|实践/u', $text, $matches);

        return count($matches[0] ?? []);
    }

    /** @param array<int,string> $needles */
    private function containsAny(string $text, array $needles): bool
    {
        foreach ($needles as $needle) {
            if ($needle !== '' && str_contains($text, $needle)) {
                return true;
            }
        }

        return false;
    }

    /** @param array<string,array<string,mixed>> $checks */
    private function nextAction(array $checks): string
    {
        foreach ($checks as $check) {
            if (($check['passed'] ?? false) === false) {
                return (string) ($check['hint'] ?? '补齐证据型内容结构。');
            }
        }

        return '质量门已通过，可进入官网发布、分发和AI采样复测。';
    }
}
