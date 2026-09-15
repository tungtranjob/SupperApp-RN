/**
 * TEST REGISTRY MINI-APP.
 *
 * Ba tính chất được chốt ở đây, mỗi cái ứng với một yêu cầu bắt buộc ở README
 * mục 9:
 *
 *   - Cổng `minHostVersion`  (yêu cầu #2: khoá phiên bản native)
 *   - Quyền = GIAO(được cấp, được xin)  (yêu cầu #3: ranh giới quyền)
 *   - Registry KHÔNG BAO GIỜ trả khoá   (sửa lỗ hổng trong chính mô tả của #1)
 *
 * Chỉ gọi các hàm THUẦN trên object tự dựng, nên test không đụng tới
 * backend/data/mini-apps.json của bản demo đang chạy.
 */
import { miniApps } from '../backend/src/mini/store.js';
import { createRunner } from './test-util.mjs';

const t = createRunner('Registry mini-app');

/** Một bản ghi mini-app như store lưu. */
function makeApp(overrides = {}) {
  return {
    id: 'insurance',
    container: 'miniInsurance',
    title: 'Bảo hiểm',
    icon: '🛡️',
    team: 'Đội Bảo hiểm',
    keyId: 'team-insurance',
    grantedPermissions: ['home.summary', 'insurance.quote'],
    draftVersion: '1.4.0',
    publishedVersion: '1.4.0',
    versions: [
      {
        version: '1.0.0',
        minHostVersion: 1,
        requestedPermissions: ['home.summary'],
        createdAt: '2026-09-01T00:00:00.000Z',
        platforms: { ios: { entryFile: 'mf-manifest.json', files: [] } },
      },
      {
        version: '1.4.0',
        minHostVersion: 1,
        requestedPermissions: ['home.summary', 'insurance.quote'],
        createdAt: '2026-09-12T00:00:00.000Z',
        platforms: { ios: { entryFile: 'mf-manifest.json', files: [] } },
      },
    ],
    ...overrides,
  };
}

const base = { platform: 'ios', baseUrl: 'http://h:4000', hostVersion: 1 };

/* ---------- publish / rollback chỉ là đổi con trỏ ---------- */

t.eq('bản publish là bản con trỏ đang trỏ tới', miniApps.resolve(makeApp(), base).version, '1.4.0');
t.eq(
  'rollback = trỏ con trỏ về bản cũ, bản cũ vẫn nguyên',
  miniApps.resolve(makeApp({ publishedVersion: '1.0.0' }), base).version,
  '1.0.0',
);
t.eq('chưa publish → không xuất hiện', miniApps.resolve(makeApp({ publishedVersion: null }), base), null);
t.eq(
  'kênh nháp thấy bản nháp, kênh production không',
  miniApps.resolve(makeApp({ publishedVersion: '1.0.0', draftVersion: '1.4.0' }), {
    ...base, channel: 'draft',
  }).version,
  '1.4.0',
);

/* ---------- cổng minHostVersion ---------- */

const needsHost2 = makeApp({
  versions: [
    {
      version: '2.0.0',
      minHostVersion: 2,
      requestedPermissions: [],
      createdAt: 'x',
      platforms: { ios: { entryFile: 'mf-manifest.json', files: [] } },
    },
  ],
  publishedVersion: '2.0.0',
  draftVersion: '2.0.0',
});

t.eq(
  'app vỏ v1 KHÔNG thấy mini-app cần host v2',
  miniApps.resolve(needsHost2, { ...base, hostVersion: 1 }),
  null,
);
t.eq(
  'app vỏ v2 thì thấy',
  miniApps.resolve(needsHost2, { ...base, hostVersion: 2 }).version,
  '2.0.0',
);
t.eq(
  'app vỏ mới hơn yêu cầu cũng thấy',
  miniApps.resolve(needsHost2, { ...base, hostVersion: 9 }).version,
  '2.0.0',
);

/* ---------- lọc theo platform ---------- */

t.eq(
  'chưa build cho android → android không thấy',
  miniApps.resolve(makeApp(), { ...base, platform: 'android' }),
  null,
);

/* ---------- quyền = GIAO(được cấp, được xin) ---------- */

const greedy = makeApp({
  grantedPermissions: ['home.summary'],
  versions: [
    {
      version: '9.9.9',
      minHostVersion: 1,
      // Mini-app tự xin thêm quyền nó không được cấp — đây đúng là cách một
      // version độc hại sẽ cố leo thang.
      requestedPermissions: ['home.summary', 'insurance.quote', 'admin.publish'],
      createdAt: 'x',
      platforms: { ios: { entryFile: 'mf-manifest.json', files: [] } },
    },
  ],
  publishedVersion: '9.9.9',
  draftVersion: '9.9.9',
});

t.eq(
  'xin thêm quyền ngoài phần được cấp → phần thừa bị loại',
  miniApps.resolve(greedy, base).permissions,
  ['home.summary'],
);
t.eq(
  'phần bị từ chối hiện ra cho dashboard, không giấu',
  miniApps.deniedPermissions(greedy, greedy.versions[0]),
  ['insurance.quote', 'admin.publish'],
);
t.eq(
  'xin ít hơn phần được cấp thì chỉ nhận phần xin',
  miniApps.effectivePermissions(makeApp(), makeApp().versions[0]),
  ['home.summary'],
);

/* ---------- KHÔNG BAO GIỜ trả khoá ---------- */

/**
 * Chốt chặn hồi quy quan trọng nhất của cả file này.
 *
 * Cách làm ngây thơ — và chính là cách README mục 9 mô tả trước khi sửa — là để
 * registry trả kèm public key cho từng mini-app. Cách đó THỦNG hoàn toàn: kẻ
 * chiếm được registry đổi cả bundle lẫn khoá, chữ ký khớp với khoá của chính
 * hắn, app xác minh thành công và chạy mã của hắn.
 *
 * Registry chỉ được nói `keyId` — một cái TÊN. Khoá thật nằm trong trust store
 * nhúng sẵn ở app vỏ (mobile/src/mini/trustStore.ts).
 */
const resolved = miniApps.resolve(makeApp(), base);
const asText = JSON.stringify(resolved);

t.eq('có keyId', resolved.keyId, 'team-insurance');
t.ok('KHÔNG có trường publicKey', !('publicKey' in resolved));
t.ok('KHÔNG có trường privateKey', !('privateKey' in resolved));
t.ok('không lọt chuỗi PEM nào', !/BEGIN (PUBLIC|PRIVATE|RSA) KEY/.test(asText));
t.ok('không có khoá nào kết thúc bằng .pem', !/\.pem/.test(asText));

/* ---------- URL entry dựng đúng ---------- */

t.eq(
  'entry trỏ tới manifest của đúng version và platform',
  resolved.entry,
  'http://h:4000/mini/insurance/1.4.0/ios/mf-manifest.json',
);

/* ---------- addVersion giữ lịch sử bất biến ---------- */

const app = makeApp();
const before = app.versions.length;
miniApps.addVersion(app, {
  version: '1.5.0',
  minHostVersion: 1,
  requestedPermissions: ['home.summary'],
  platform: 'ios',
  entryFile: 'mf-manifest.json',
  files: ['mf-manifest.json'],
});
t.eq('thêm version mới', app.versions.length, before + 1);
t.eq('bản mới vào kênh nháp, KHÔNG tự ra production', app.draftVersion, '1.5.0');
t.eq('production vẫn ở bản cũ cho tới khi người ta bấm Publish', app.publishedVersion, '1.4.0');
t.eq('version cũ không bị đụng tới', app.versions[0].version, '1.0.0');

/* Publish cùng version cho platform thứ hai thì không tạo bản ghi trùng. */
miniApps.addVersion(app, {
  version: '1.5.0',
  minHostVersion: 1,
  requestedPermissions: ['home.summary'],
  platform: 'android',
  entryFile: 'mf-manifest.json',
  files: ['mf-manifest.json'],
});
t.eq('cùng version, platform khác → không nhân đôi bản ghi', app.versions.length, before + 1);
t.eq(
  'bản ghi giờ có cả hai platform',
  Object.keys(miniApps.versionOf(app, '1.5.0').platforms).sort(),
  ['android', 'ios'],
);

t.done();
