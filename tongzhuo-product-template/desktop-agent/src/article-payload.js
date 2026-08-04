export function normalizeArticle(raw = {}) {
  const article = raw?.article ? raw.article : raw;
  const title = String(article?.title || '').trim();
  const excerpt = String(article?.excerpt || article?.meta_description || '').trim();
  const html = String(article?.content_html || article?.content || '').trim();
  const text = htmlToPlainText(html);

  return {
    title,
    excerpt,
    html,
    text,
    slug: String(article?.slug || '').trim(),
    keywords: Array.isArray(article?.keywords)
      ? article.keywords.filter(Boolean).map((keyword) => String(keyword).trim()).filter(Boolean)
      : [],
  };
}

export function htmlToPlainText(html = '') {
  return String(html)
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<\/(p|div|h[1-6]|li|blockquote|section|article)>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<li[^>]*>/gi, '- ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

