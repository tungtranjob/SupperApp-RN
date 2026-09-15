import React, { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { templates } from '../lib/templates';

export function ScreensPage({ onOpen }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [creating, setCreating] = useState(false);

  const reload = () => api.listScreens().then(setData).catch((e) => setError(e.message));
  useEffect(() => { reload(); }, []);

  if (error) return <div className="empty">❌ {error}<br /><small>Backend đã chạy chưa? <code>cd backend && npm run dev</code></small></div>;
  if (!data) return <div className="empty">Đang tải…</div>;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Màn hình</h1>
          <p className="muted">
            Revision đang publish: <code>{data.revision}</code> — app mobile so chuỗi này để biết có gì mới.
          </p>
        </div>
        <div className="actions">
          <button className="btn ghost" onClick={reload}>Làm mới</button>
          <button className="btn" onClick={() => setCreating(true)}>+ Màn hình mới</button>
        </div>
      </div>

      <div className="grid">
        {data.screens.map((s) => (
          <div key={s.id} className="tile" onClick={() => onOpen(s.id)}>
            <div className="tile-top">
              <span className="tile-icon">{s.icon}</span>
              <div>
                <div className="tile-title">{s.title}</div>
                <code className="muted">/{s.route}</code>
              </div>
            </div>
            <div className="tile-meta">
              <span className={`pill ${s.hasUnpublishedChanges ? 'warn' : 'ok'}`}>
                {s.hasUnpublishedChanges ? `nháp v${s.draftVersion} chưa publish` : `đã publish v${s.publishedVersion}`}
              </span>
              {s.requiresAuth && <span className="pill">cần đăng nhập</span>}
              <span className="pill">{s.versionCount} version</span>
            </div>
          </div>
        ))}
      </div>

      {creating && <CreateDialog onClose={() => setCreating(false)} onCreated={(id) => { setCreating(false); reload(); onOpen(id); }} />}
    </div>
  );
}

function CreateDialog({ onClose, onCreated }) {
  const [form, setForm] = useState({ id: '', route: '', title: '', icon: '✨', requiresAuth: true, showInMenu: true, template: 'blank' });
  const [error, setError] = useState(null);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const submit = async (e) => {
    e.preventDefault();
    try {
      const t = templates[form.template];
      const created = await api.createScreen({
        id: form.id.trim(), route: form.route.trim() || form.id.trim(), title: form.title.trim(),
        icon: form.icon, requiresAuth: form.requiresAuth, showInMenu: form.showInMenu,
        layout: t.layout, onLoad: t.onLoad, initialState: t.initialState,
      });
      onCreated(created.id);
    } catch (err) { setError(err.message); }
  };

  return (
    <div className="backdrop" onClick={onClose}>
      <form className="dialog" onClick={(e) => e.stopPropagation()} onSubmit={submit}>
        <h2>Tạo màn hình mới</h2>
        <p className="muted">Sau khi publish, app mobile sẽ tự thấy route này mà không cần build lại.</p>

        <label>ID <input value={form.id} onChange={(e) => set('id', e.target.value.replace(/\s/g, ''))} placeholder="promo" required /></label>
        <label>Route <input value={form.route} onChange={(e) => set('route', e.target.value.replace(/\s/g, ''))} placeholder="promo (mặc định = ID)" /></label>
        <label>Tiêu đề <input value={form.title} onChange={(e) => set('title', e.target.value)} placeholder="Khuyến mãi" required /></label>
        <label>Icon <input value={form.icon} onChange={(e) => set('icon', e.target.value)} maxLength={2} /></label>
        <label>Mẫu
          <select value={form.template} onChange={(e) => set('template', e.target.value)}>
            {Object.entries(templates).map(([k, t]) => <option key={k} value={k}>{t.name}</option>)}
          </select>
        </label>
        <label className="row"><input type="checkbox" checked={form.requiresAuth} onChange={(e) => set('requiresAuth', e.target.checked)} /> Yêu cầu đăng nhập</label>

        {error && <div className="error">{error}</div>}
        <div className="dialog-actions">
          <button type="button" className="btn ghost" onClick={onClose}>Huỷ</button>
          <button type="submit" className="btn">Tạo</button>
        </div>
      </form>
    </div>
  );
}
