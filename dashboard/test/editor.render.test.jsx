/**
 * Test render thật trong jsdom: mount toàn bộ dashboard với fetch giả lập.
 * Mục đích chính: bắt vòng lặp render vô hạn (useJsonField nhận object mới mỗi render).
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import App from '../src/App.jsx';
import { EditorPage } from '../src/pages/EditorPage.jsx';
import { MiniAppsPage } from '../src/pages/MiniAppsPage.jsx';

const SCREEN = {
  id: 'home', route: 'home', title: 'Trang chủ', icon: '🏠',
  requiresAuth: true, draftVersion: 2, publishedVersion: 1,
  hasUnpublishedChanges: true, versionCount: 2,
  draft: {
    version: 2,
    layout: {
      type: 'Screen', props: { padding: 16 }, children: [
        { type: 'Heading', props: { text: 'Xin chào {{user.name}}' } },
        { type: 'Text', props: { text: '{{state.home.balance | currency}}' } },
        { type: 'Grid', props: { columns: 4 }, children: [
          { type: 'ServiceIcon', repeat: { items: 'state.home.services', as: 'svc' }, props: { emoji: '{{svc.emoji}}', label: '{{svc.label}}' } },
        ] },
        { type: 'Banner', props: { text: 'không hiện', tone: 'info' }, if: 'state.khongCo' },
        { type: 'Phantom', props: {} },
      ],
    },
    onLoad: [{ type: 'http', method: 'GET', url: '/api/home/summary', saveAs: 'home' }],
    initialState: {},
  },
  published: { version: 1, layout: { type: 'Screen', children: [] } },
  versions: [
    { version: 2, note: 'edit', createdAt: '2026-09-12T03:00:00.000Z' },
    { version: 1, note: 'seed', createdAt: '2026-09-11T03:00:00.000Z' },
  ],
};

const LIST = { revision: 'home:1', screens: [{ ...SCREEN, versions: undefined }] };

/* ---- Dữ liệu giả lập cho trang Mini-app (hướng B) ---- */

const MINI_LIST = {
  revision: 'insurance:1.6.0',
  apps: [
    {
      id: 'insurance', container: 'miniInsurance', title: 'Bảo hiểm', icon: '🛡️',
      team: 'Đội Bảo hiểm', keyId: 'team-insurance',
      grantedPermissions: ['home.summary', 'insurance.quote'],
      draftVersion: '1.6.0', publishedVersion: '1.4.0',
      hasUnpublishedChanges: true, versionCount: 2,
    },
  ],
};

const MINI_DETAIL = {
  ...MINI_LIST.apps[0],
  versions: [
    {
      version: '1.6.0', minHostVersion: 1,
      requestedPermissions: ['home.summary', 'insurance.quote', 'admin.publish'],
      effectivePermissions: ['home.summary', 'insurance.quote'],
      // Mini-app xin quyền nền tảng KHÔNG cấp — dashboard phải hiện ra, không giấu.
      deniedPermissions: ['admin.publish'],
      platforms: ['ios'], note: '', createdAt: '2026-09-12T05:00:00.000Z',
    },
    {
      version: '1.4.0', minHostVersion: 1,
      requestedPermissions: ['home.summary'],
      effectivePermissions: ['home.summary'],
      deniedPermissions: [],
      platforms: ['ios'], note: '', createdAt: '2026-09-11T05:00:00.000Z',
    },
  ],
};

globalThis.fetch = async (url) => {
  const path = String(url).replace(/^https?:\/\/[^/]+/, '');
  const body = path === '/api/admin/screens' ? LIST
    : path.startsWith('/api/admin/screens/') ? SCREEN
    : path === '/api/admin/mini-apps' ? MINI_LIST
    : path.startsWith('/api/admin/mini-apps/') ? MINI_DETAIL
    : {};
  return { ok: true, status: 200, text: async () => JSON.stringify(body) };
};

let pass = 0, fail = 0;
const check = (name, cond, extra = '') => {
  cond ? pass++ : fail++;
  console.log(`${cond ? '✓' : '✗'} ${name}${cond ? '' : `  ${extra}`}`);
};

/* ---- 1. Đếm số lần render của EditorPage: vòng lặp vô hạn sẽ làm số này bùng nổ ---- */
let renderCount = 0;
function Counting(props) {
  renderCount++;
  if (renderCount > 200) throw new Error('VÒNG LẶP RENDER VÔ HẠN');
  return <EditorPage {...props} />;
}

const run = async () => {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const root = createRoot(host);

  await act(async () => { root.render(<Counting id="home" onBack={() => {}} />); });
  await act(async () => { await new Promise((r) => setTimeout(r, 60)); });

  check(`EditorPage render ${renderCount} lần (không vòng lặp)`, renderCount < 30, `renderCount=${renderCount}`);

  const html = host.innerHTML;
  // Chỉ soi BÊN TRONG khung preview: phần còn lại của trang có textarea chứa JSON nguồn,
  // nên tìm chuỗi trên toàn trang sẽ cho kết quả dương tính giả.
  const preview = host.querySelector('.phone-screen').innerHTML;

  check('binding user.name được resolve', preview.includes('Xin chào Trần Tùng'), preview.slice(0, 200));
  check('filter currency chạy', /12\.450\.000/.test(preview), 'không thấy số tiền đã format');
  check('repeat sinh đủ 4 ServiceIcon', (preview.match(/Chuyển tiền|Nạp điện thoại|Hoá đơn|Vé xem phim/g) || []).length >= 4);
  check('Grid dùng CSS grid 4 cột', preview.includes('repeat(4, 1fr)'));
  check('if falsy thì KHÔNG render trong preview', !preview.includes('không hiện'), preview.slice(0, 300));
  check('binding thô không lọt ra preview', !preview.includes('{{'), preview.slice(0, 300));
  check('component lạ hiện cảnh báo, không crash', preview.includes('Phantom') && preview.includes('chưa có trong registry'));
  check('lịch sử version hiển thị', html.includes('v2') && html.includes('v1'));
  check('đánh dấu version đang live', html.includes('đang live'));

  /* ---- 2. Mount App gốc (danh sách màn hình) ---- */
  const host2 = document.createElement('div');
  document.body.appendChild(host2);
  const root2 = createRoot(host2);
  await act(async () => { root2.render(<App />); });
  await act(async () => { await new Promise((r) => setTimeout(r, 60)); });
  check('danh sách màn hình render', host2.innerHTML.includes('Trang chủ'));
  check('hiện trạng thái nháp chưa publish', host2.innerHTML.includes('chưa publish'));

  /* ---- 3. Trang Mini-app (hướng B) ---- */
  const host3 = document.createElement('div');
  document.body.appendChild(host3);
  const root3 = createRoot(host3);
  await act(async () => { root3.render(<MiniAppsPage />); });
  await act(async () => { await new Promise((r) => setTimeout(r, 60)); });
  const mini = host3.innerHTML;

  check('mini-app hiện tên và container', mini.includes('Bảo hiểm') && mini.includes('miniInsurance'));
  check('hiện đội phát hành và keyId', mini.includes('Đội Bảo hiểm') && mini.includes('team-insurance'));
  check('đánh dấu version đang ra production', mini.includes('production v1.4.0'));
  check('hiện cả bản nháp chưa publish', mini.includes('nháp v1.6.0'));
  check('liệt kê đủ cả hai version', mini.includes('v1.6.0') && mini.includes('v1.4.0'));
  check('hiện host tối thiểu', mini.includes('v1'));
  check('quyền có hiệu lực hiển thị', mini.includes('insurance.quote'));
  // Chốt chặn quan trọng: quyền bị từ chối phải HIỆN RA, gạch ngang — nếu giấu đi,
  // đội phát hành sẽ ngồi gỡ lỗi một lời gọi bị chặn mà không hiểu vì sao.
  check('quyền bị từ chối hiện ra, có class gạch ngang',
    mini.includes('admin.publish') && mini.includes('perm-denied'));
  check('có nút chuyển version', mini.includes('Chuyển về bản này'));
  check('KHÔNG lộ chuỗi khoá nào ra dashboard', !/BEGIN (PUBLIC|PRIVATE) KEY/.test(mini));

  console.log(`\n${pass} pass, ${fail} fail`);
  process.exit(fail ? 1 : 0);
};

run().catch((e) => { console.error('✗ LỖI:', e.message); process.exit(1); });
