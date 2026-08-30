export interface SiteContentItem {
  id: string;
  kind: string;
  title: string;
  subtitle?: string;
  label?: string;
  summary?: string;
  description?: string;
  image?: string;
  gallery?: string[];
  tags?: string[];
  facts?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  status?: string;
  order?: number;
}

export interface SiteBootstrap {
  site?: { siteName?: string; companyName?: string; description?: string; cta?: string; settings?: Record<string, unknown>; assets?: Record<string, unknown>; footer?: Record<string, unknown>; };
  templateKey?: string;
  theme?: Record<string, unknown>;
  pages?: Array<Record<string, unknown>>;
  blocks?: Array<Record<string, unknown>>;
  contentItems?: SiteContentItem[];
  assets?: Record<string, unknown>;
  articles?: Array<Record<string, unknown>>;
  problemGroups?: Array<Record<string, unknown>>;
}

const apiBase = String(import.meta.env.VITE_SITE_API_BASE || '').replace(/\/$/, '');

export async function fetchSiteBootstrap(signal?: AbortSignal): Promise<SiteBootstrap> {
  const response = await fetch(`${apiBase}/api/v1/site-public/bootstrap`, { headers: { Accept: 'application/json' }, signal });
  if (!response.ok) throw new Error(`SITE_BOOTSTRAP_${response.status}`);
  const payload = await response.json();
  return payload?.data || payload;
}
