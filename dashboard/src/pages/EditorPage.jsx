import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';
import { useJsonField } from '../lib/useJsonField';
import { WebPreview } from '../preview/WebPreview';

const MOCK_USER = { id: 'u1', name: 'Trần Tùng', email: 'demo@supper.app', avatar: '🦊', phone: '0909 123 456', tier: 'Kim cương' };

/** Dữ liệu mẫu để preview những binding lấy từ API (state.home.*). */
const MOCK_REMOTE_STATE = {
  home: {
    balance: 12450000,
    services: [
      { id: 'transfer', emoji: '💸', label: 'Chuyển tiền', color: '#a50064' },
      { id: 'topup', emoji: '📱', label: 'Nạp điện thoại', color: '#0d7ee0' },
      { id: 'bill', emoji: '🧾', label: 'Hoá đơn', color: '#f0870a' },
      { id: 'movie', emoji: '🎬', label: 'Vé xem phim', color: '#e5484d' },
    ],
    transactions: [
      { id: 't1', emoji: '☕', title: 'The Coffee House', time: 'Hôm nay, 08:24', amount: -65000, color: '#1c2024' },
      { id: 't2', emoji: '💰', title: 'Nhận từ Minh Anh', time: 'Hôm qua, 19:02', amount: 500000, color: '#30a46c' },
    ],
  },
};

export function EditorPage({ id, onBack }) {
  const [screen, setScreen] = useState(null);
  const [status, setStatus] = useState(null);
  const [error, setError] = useState(null);

  const load = () => api.getScreen(id).then(setScreen).catch((e) => setError(e.message));
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id]);

  const layout = useJsonField(screen?.draft?.layout);
  const onLoad = useJsonField(screen?.draft?.onLoad ?? []);
  const initialState = useJsonField(screen?.draft?.initialState ?? {});

  /** context để preview: initialState + dữ liệu API giả lập */
  const previewCtx = useMemo(
    () => ({ user: MOCK_USER, params: {}, state: { ...MOCK_REMOTE_STATE, ...(initialState.value || {}) } }),
    [initialState.value],
  );

  if (error) return <div className="empty">❌ {error}</div>;
  if (!screen) return <div className="empty">Đang tải…</div>;

  const dirty =
    JSON.stringify(layout.value) !== JSON.stringify(screen.draft?.layout) ||
    JSON.stringify(onLoad.value) !== JSON.stringify(screen.draft?.onLoad ?? []) ||
    JSON.stringify(initialState.value) !== JSON.stringify(screen.draft?.initialState ?? {});

  const allValid = layout.valid && onLoad.valid && initialState.valid;

  const save = async () => {
    setStatus('Đang lưu…');
    try {
      await api.updateScreen(id, { layout: layout.value, onLoad: onLoad.value, initialState: initialState.value, note: 'sửa trên dashboard' });
      await load();
      setStatus('Đã lưu bản nháp — bấm Publish để đẩy cho app.');
    } catch (e) { setStatus(`Lỗi: ${e.message}`); }
  };

  const publish = async () => {
    setStatus('Đang publish…');
    try {
      if (dirty) await api.updateScreen(id, { layout: layout.value, onLoad: onLoad.value, initialState: initialState.value, note: 'publish' });
      await api.publish(id);
      await load();
      setStatus('🚀 Đã publish. App mobile sẽ tự cập nhật trong vài giây.');
    } catch (e) { setStatus(`Lỗi: ${e.message}`); }
  };

  const rollback = async (version) => {
    if (!confirm(`Đưa app về version ${version}?`)) return;
    await api.rollback(id, version);
    await load();
    setStatus(`↩️ Đã rollback về v${version}.`);
  };

  return (
    <div className="editor">
      <header className="editor-head">
        <button className="btn ghost" onClick={onBack}>← Danh sách</button>
        <div className="editor-title">
          <span className="tile-icon">{screen.icon}</span>
          <div>
            <strong>{screen.title}</strong>
            <code className="muted"> /{screen.route}</code>
          </div>
          <span className={`pill ${screen.hasUnpublishedChanges ? 'warn' : 'ok'}`}>
            nháp v{screen.draftVersion} · publish v{screen.publishedVersion}
          </span>
        </div>
        <div className="actions">
          <button className="btn ghost" disabled={!dirty || !allValid} onClick={save}>Lưu nháp</button>
          <button className="btn" disabled={!allValid} onClick={publish}>🚀 Publish</button>
        </div>
      </header>

      {status && <div className="status">{status}</div>}

      <div className="editor-body">
        <div className="editor-col">
          <JsonBox title="Layout (cây UI)" field={layout} rows={26} />
          <JsonBox title="onLoad (chạy khi mở màn hình)" field={onLoad} rows={6} />
          <JsonBox title="initialState (state ban đầu)" field={initialState} rows={6} />

          <section className="panel">
            <h3>Lịch sử version</h3>
            <div className="versions">
              {screen.versions.map((v) => (
                <div key={v.version} className="version">
                  <div>
                    <strong>v{v.version}</strong>
                    {v.version === screen.publishedVersion && <span className="pill ok">đang live</span>}
                    <div className="muted">{new Date(v.createdAt).toLocaleString('vi-VN')} · {v.note}</div>
                  </div>
                  {v.version !== screen.publishedVersion && (
                    <button className="btn ghost sm" onClick={() => rollback(v.version)}>Rollback</button>
                  )}
                </div>
              ))}
            </div>
          </section>
        </div>

        <div className="editor-col preview-col">
          <h3>Xem trước</h3>
          <p className="muted">Dựng bằng cùng một DSL với app. Binding được resolve bằng dữ liệu mẫu.</p>
          {layout.valid ? <WebPreview layout={layout.value} ctx={previewCtx} /> : <div className="error">JSON chưa hợp lệ</div>}
        </div>
      </div>
    </div>
  );
}

function JsonBox({ title, field, rows }) {
  return (
    <section className="panel">
      <div className="panel-head">
        <h3>{title}</h3>
        <button className="btn ghost sm" onClick={field.format}>Format</button>
      </div>
      <textarea
        className={`code ${field.error ? 'invalid' : ''}`}
        rows={rows}
        value={field.text}
        spellCheck={false}
        onChange={(e) => field.onChange(e.target.value)}
      />
      {field.error && <div className="error">{field.error}</div>}
    </section>
  );
}
