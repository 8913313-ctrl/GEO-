<?php

namespace App\Services\Rag;

class KnowledgeChunker
{
    /**
     * @return list<array{heading:?string,content:string,locator:string,character_count:int,token_count:int}>
     */
    public function chunk(string $content, string $format = 'text', ?int $maxChars = null, ?int $overlapChars = null): array
    {
        $maxChars ??= max(300, (int) config('geoflow.rag.chunk_size', 1200));
        $overlapChars ??= max(0, min($maxChars - 100, (int) config('geoflow.rag.chunk_overlap', 160)));
        $text = $this->normalise($content, $format);
        if ($text === '') {
            return [];
        }

        $sections = $this->sections($text);
        $chunks = [];
        $ordinal = 0;

        foreach ($sections as $section) {
            $body = trim($section['content']);
            if ($body === '') {
                continue;
            }

            $offset = 0;
            $length = mb_strlen($body);
            while ($offset < $length) {
                $piece = $this->cutAtBoundary($body, $offset, $maxChars);
                if ($piece === '') {
                    break;
                }

                $ordinal++;
                $chunks[] = [
                    'heading' => $section['heading'],
                    'content' => $piece,
                    'locator' => ($section['heading'] ? '章节：'.$section['heading'].'；' : '').'片段：'.$ordinal,
                    'character_count' => mb_strlen($piece),
                    'token_count' => $this->estimateTokens($piece),
                ];

                $advance = max(1, mb_strlen($piece) - $overlapChars);
                $offset += $advance;
            }
        }

        return $chunks;
    }

    public function normalise(string $content, string $format = 'text'): string
    {
        $format = strtolower(trim($format));
        if (in_array($format, ['html', 'htm'], true)) {
            $content = preg_replace('/<(br|\/p|\/div|\/li|\/h[1-6])\b[^>]*>/iu', "\n", $content) ?? $content;
            $content = html_entity_decode(strip_tags($content), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        } elseif (in_array($format, ['markdown', 'md'], true)) {
            $content = preg_replace('/!\[([^\]]*)\]\([^)]*\)/u', '$1', $content) ?? $content;
            $content = preg_replace('/\[([^\]]+)\]\([^)]*\)/u', '$1', $content) ?? $content;
            $content = preg_replace('/^\s*[-*+]\s+/mu', '', $content) ?? $content;
            $content = preg_replace('/[`*_~]{1,3}/u', '', $content) ?? $content;
        }

        $content = str_replace(["\r\n", "\r", "\u{00A0}"], ["\n", "\n", ' '], $content);
        $content = preg_replace('/[\t ]+/u', ' ', $content) ?? $content;
        $content = preg_replace('/\n{3,}/u', "\n\n", $content) ?? $content;

        return trim($content);
    }

    /** @return list<array{heading:?string,content:string}> */
    private function sections(string $text): array
    {
        $lines = preg_split('/\n/u', $text) ?: [];
        $sections = [];
        $heading = null;
        $buffer = [];

        foreach ($lines as $line) {
            $trimmed = trim($line);
            if (preg_match('/^#{1,6}\s+(.+)$/u', $trimmed, $matches)) {
                if ($buffer !== []) {
                    $sections[] = ['heading' => $heading, 'content' => implode("\n", $buffer)];
                    $buffer = [];
                }
                $heading = trim($matches[1]);
                continue;
            }
            $buffer[] = $line;
        }

        if ($buffer !== []) {
            $sections[] = ['heading' => $heading, 'content' => implode("\n", $buffer)];
        }

        return $sections !== [] ? $sections : [['heading' => null, 'content' => $text]];
    }

    private function cutAtBoundary(string $text, int $offset, int $maxChars): string
    {
        $remaining = mb_substr($text, $offset);
        if (mb_strlen($remaining) <= $maxChars) {
            return trim($remaining);
        }

        $window = mb_substr($remaining, 0, $maxChars);
        $minimum = (int) floor($maxChars * 0.6);
        $cut = 0;
        foreach (["\n\n", "\n", '。', '！', '？', '；', ';', '. '] as $boundary) {
            $position = mb_strrpos($window, $boundary);
            if ($position !== false && $position >= $minimum) {
                $cut = max($cut, $position + mb_strlen($boundary));
            }
        }

        return trim(mb_substr($window, 0, $cut > 0 ? $cut : $maxChars));
    }

    private function estimateTokens(string $text): int
    {
        $han = preg_match_all('/[\x{3400}-\x{9FFF}]/u', $text) ?: 0;
        $other = max(0, mb_strlen($text) - $han);

        return max(1, (int) ceil($han * 1.25 + $other / 4));
    }
}
