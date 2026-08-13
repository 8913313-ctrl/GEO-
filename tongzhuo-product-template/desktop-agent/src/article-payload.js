export function normalizeArticle(raw = {}) {
  const envelope = raw && typeof raw === 'object' ? raw : {};
  const article = envelope?.article ? envelope.article : envelope;
  const title = String(article?.title || '').trim();
  const excerpt = String(article?.excerpt || article?.meta_description || '').trim();
  const html = String(article?.content_html || article?.content || '').trim();
  const text = htmlToPlainText(html);
  const images = normalizeImageAssets(envelope?.assets?.images || article?.assets?.images || article?.images || []);

  return {
    title,
    excerpt,
    html,
    text,
    images,
    assets: { images },
    slug: String(article?.slug || '').trim(),
    keywords: Array.isArray(article?.keywords)
      ? article.keywords.filter(Boolean).map((keyword) => String(keyword).trim()).filter(Boolean)
      : [],
  };
}

export function normalizeImageAssets(raw = []) {
  const items = Array.isArray(raw) ? raw : [];
  const seen = new Set();
  return items.slice(0, 20).map((item, index) => {
    const source = typeof item === 'string' ? { source_url: item } : (item && typeof item === 'object' ? item : {});
    const sourceUrl = String(source.source_url || source.url || source.src || '').trim();
    const contentBase64 = String(source.content_base64 || source.base64 || '').replace(/^data:[^;]+;base64,/i, '').trim();
    const mimeType = String(source.mime_type || source.mimeType || '').trim();
    const filename = String(source.filename || `image-${index + 1}`).trim();
    const key = sourceUrl || `${mimeType}:${contentBase64.slice(0, 80)}`;
    if ((!sourceUrl && !contentBase64) || seen.has(key)) return null;
    if (/^(?:javascript|data):/i.test(sourceUrl)) return null;
    seen.add(key);
    return {
      source_url: sourceUrl,
      url: sourceUrl,
      content_base64: contentBase64,
      mime_type: mimeType,
      filename,
      alt: String(source.alt || '').trim(),
      caption: String(source.caption || '').trim(),
    };
  }).filter(Boolean);
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

