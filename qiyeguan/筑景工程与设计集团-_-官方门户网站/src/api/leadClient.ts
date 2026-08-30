const apiBase = String(import.meta.env.VITE_SITE_API_BASE || '').replace(/\/$/, '');

export async function submitPublicLead(payload: Record<string, unknown>, fallbackPath = '/api/consultation') {
  const response = await fetch(`${apiBase}/api/v1/leads`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(payload) });
  if (response.status === 404 && fallbackPath) {
    const fallback = await fetch(fallbackPath, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify(payload) });
    const fallbackBody = await fallback.json().catch(() => ({}));
    if (!fallback.ok) throw new Error(fallbackBody?.message || `LEAD_SUBMIT_${fallback.status}`);
    return fallbackBody?.data || fallbackBody;
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.message || `LEAD_SUBMIT_${response.status}`);
  return body?.data || body;
}
