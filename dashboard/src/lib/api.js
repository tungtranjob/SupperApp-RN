const BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000';

async function req(path, opts = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method: opts.method || 'GET',
    headers: opts.body ? { 'Content-Type': 'application/json' } : undefined,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) throw new Error(data?.message || `Lỗi ${res.status}`);
  return data;
}

export const api = {
  base: BASE,
  listScreens: () => req('/api/admin/screens'),
  getScreen: (id) => req(`/api/admin/screens/${id}`),
  createScreen: (payload) => req('/api/admin/screens', { method: 'POST', body: payload }),
  updateScreen: (id, payload) => req(`/api/admin/screens/${id}`, { method: 'PUT', body: payload }),
  publish: (id) => req(`/api/admin/screens/${id}/publish`, { method: 'POST' }),
  rollback: (id, version) => req(`/api/admin/screens/${id}/rollback/${version}`, { method: 'POST' }),
  remove: (id) => req(`/api/admin/screens/${id}`, { method: 'DELETE' }),
  resetAll: () => req('/api/admin/reset', { method: 'POST' }),
  manifest: () => req('/api/manifest'),

  /* ---------- Mini-app (hướng B) ---------- */
  listMiniApps: () => req('/api/admin/mini-apps'),
  getMiniApp: (id) => req(`/api/admin/mini-apps/${id}`),
  publishMiniApp: (id, version) =>
    req(`/api/admin/mini-apps/${id}/publish`, { method: 'POST', body: { version } }),
  rollbackMiniApp: (id, version) =>
    req(`/api/admin/mini-apps/${id}/rollback`, { method: 'POST', body: { version } }),
  unpublishMiniApp: (id) =>
    req(`/api/admin/mini-apps/${id}/unpublish`, { method: 'POST' }),
};
