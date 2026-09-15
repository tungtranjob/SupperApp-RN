import React, { useCallback, useEffect, useState } from 'react';
import { api } from '../lib/api';

/**
 * QUẢN LÝ MINI-APP (hướng B).
 *
 * Khác căn bản với trang Màn hình (hướng A): ở đó bạn SOẠN nội dung; ở đây bạn
 * chỉ DUYỆT và CÔNG BỐ. Bundle do đội phát hành build và ký trên máy của họ, rồi
 * đẩy lên qua `npm run mini:publish`. Dashboard không sửa được bundle — nó chỉ
 * đổi con trỏ "version nào đang ra production".
 *
 * Đó là ranh giới đúng. Nếu dashboard sửa được nội dung mini-app thì chữ ký trở
 * nên vô nghĩa: ai chiếm được dashboard là chạy được mã tuỳ ý trên máy người dùng.
 */
export function MiniAppsPage() {
  const [apps, setApps] = useState([]);
  const [detail, setDetail] = useState({});
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    try {
      const data = await api.listMiniApps();
      setApps(data.apps);
      const details = await Promise.all(data.apps.map((a) => api.getMiniApp(a.id)));
      setDetail(Object.fromEntries(details.map((d) => [d.id, d])));
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  useEffect(() => { void reload(); }, [reload]);

  const act = async (fn) => {
    setBusy(true);
    try { await fn(); await reload(); }
    catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };

  if (error) return <div className="page"><p className="error">{error}</p></div>;

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1>Mini-app</h1>
          <p className="muted">
            Bundle React Native thật, tải lúc chạy. Đội phát hành build và ký trên máy họ;
            ở đây bạn chỉ chọn version nào ra production.
          </p>
        </div>
      </header>

      {apps.length === 0 ? (
        <div className="empty">
          <p>Chưa có mini-app nào được đẩy lên.</p>
          <p className="muted">
            Chạy <code>npm run mini:release</code> ở thư mục gốc để build, ký và phát hành cả hai.
          </p>
        </div>
      ) : null}

      {apps.map((app) => {
        const d = detail[app.id];
        return (
          <section key={app.id} className="card mini-card">
            <div className="mini-head">
              <span className="mini-icon">{app.icon}</span>
              <div style={{ flex: 1 }}>
                <h2>{app.title}</h2>
                <p className="muted">
                  container <code>{app.container}</code> · {app.team} · ký bằng{' '}
                  <code>{app.keyId}</code>
                </p>
              </div>
              <div className="mini-state">
                {app.publishedVersion ? (
                  <span className="badge badge-live">production v{app.publishedVersion}</span>
                ) : (
                  <span className="badge">chưa publish</span>
                )}
                {app.hasUnpublishedChanges && app.draftVersion ? (
                  <span className="badge badge-draft">nháp v{app.draftVersion}</span>
                ) : null}
              </div>
            </div>

            <p className="muted small">
              Quyền nền tảng đã cấp: {app.grantedPermissions.map((p) => (
                <code key={p} style={{ marginRight: 6 }}>{p}</code>
              ))}
            </p>

            <table className="versions">
              <thead>
                <tr>
                  <th>Version</th>
                  <th>Host tối thiểu</th>
                  <th>Quyền có hiệu lực</th>
                  <th>Nền tảng</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {(d?.versions ?? []).map((v) => {
                  const live = v.version === app.publishedVersion;
                  return (
                    <tr key={v.version} className={live ? 'live' : ''}>
                      <td>
                        <strong>v{v.version}</strong>
                        {live ? <span className="dot" title="đang ra production" /> : null}
                      </td>
                      <td>v{v.minHostVersion}</td>
                      <td>
                        {v.effectivePermissions.map((p) => (
                          <code key={p} className="perm">{p}</code>
                        ))}
                        {/* Quyền bị từ chối hiện ngay cạnh quyền được cấp. Nếu giấu
                            đi, đội phát hành sẽ ngồi gỡ lỗi một lời gọi bị chặn mà
                            không hiểu vì sao. */}
                        {v.deniedPermissions.map((p) => (
                          <code key={p} className="perm perm-denied" title="nền tảng chưa cấp">
                            {p}
                          </code>
                        ))}
                      </td>
                      <td>{v.platforms.join(', ')}</td>
                      <td className="row-actions">
                        {live ? (
                          <span className="muted small">đang chạy</span>
                        ) : (
                          <button
                            disabled={busy}
                            onClick={() =>
                              act(() =>
                                app.publishedVersion
                                  ? api.rollbackMiniApp(app.id, v.version)
                                  : api.publishMiniApp(app.id, v.version),
                              )
                            }
                          >
                            {app.publishedVersion ? '↩ Chuyển về bản này' : '🚀 Publish'}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {app.publishedVersion ? (
              <button
                className="ghost danger"
                disabled={busy}
                onClick={() => act(() => api.unpublishMiniApp(app.id))}
              >
                Gỡ khỏi production
              </button>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}
