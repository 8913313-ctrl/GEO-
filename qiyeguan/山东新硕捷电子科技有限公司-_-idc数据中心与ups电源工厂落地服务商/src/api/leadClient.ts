const apiBase = String(import.meta.env.VITE_SITE_API_BASE || '').replace(/\/$/, '');

export async function submitPublicLead(payload: Record<string, unknown>) {
  const response = await fetch(`${apiBase}/api/v1/leads`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload)
  });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body?.message || `LEAD_SUBMIT_${response.status}`);
  return body?.data || body;
}
