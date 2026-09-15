import React, { useState } from 'react';
import { ScreensPage } from './pages/ScreensPage';
import { EditorPage } from './pages/EditorPage';
import { MiniAppsPage } from './pages/MiniAppsPage';
import { api } from './lib/api';

export default function App() {
  const [editingId, setEditingId] = useState(null);
  // 'screens' = hướng A (layout JSON), 'mini' = hướng B (remote bundle thật).
  const [tab, setTab] = useState('screens');

  return (
    <div className="app">
      <nav className="nav">
        <div className="brand">💜 SupperApp Studio</div>
        {!editingId ? (
          <div className="tabs">
            <button
              className={tab === 'screens' ? 'tab active' : 'tab'}
              onClick={() => setTab('screens')}
            >
              Màn hình
            </button>
            <button
              className={tab === 'mini' ? 'tab active' : 'tab'}
              onClick={() => setTab('mini')}
            >
              Mini-app
            </button>
          </div>
        ) : null}
        <div className="muted">Backend: <code>{api.base}</code></div>
      </nav>

      {editingId ? (
        <EditorPage id={editingId} onBack={() => setEditingId(null)} />
      ) : tab === 'mini' ? (
        <MiniAppsPage />
      ) : (
        <ScreensPage onOpen={setEditingId} />
      )}
    </div>
  );
}
