/**
 * REGISTRY MINI-APP — "cửa hàng ứng dụng" thu nhỏ của super app.
 *
 * Tách khỏi store.js vì đây là một miền dữ liệu khác hẳn: screens là layout JSON
 * do chính đội mình soạn, còn mini-app là MÃ THỰC THI do đội khác gửi tới. Trộn
 * hai thứ vào một file là mời gọi việc dùng nhầm hàm helper giữa chúng.
 *
 * MÔ HÌNH QUYỀN — điểm quan trọng nhất của file này
 *
 * Quyền KHÔNG do mini-app tự khai. Mỗi bản ghi mini-app có `grantedPermissions`
 * (nền tảng cấp, sau thẩm định), mỗi version có `requestedPermissions` (mini-app
 * xin lúc publish). Quyền có hiệu lực là GIAO của hai tập.
 *
 * Vì sao phải vậy: nếu mini-app tự khai quyền thì danh sách quyền chỉ là chú
 * thích. Version mới chỉ cần xin thêm `admin.publish` là có. Với mô hình giao,
 * xin thêm quyền ngoài phần được cấp thì phần thừa lặng lẽ rơi ra, và dashboard
 * hiện rõ nó bị từ chối.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'mini-apps.json');

/** Nơi chứa bundle đã ký: <BUNDLE_DIR>/<id>/<version>/<platform>/<file> */
export const BUNDLE_DIR = path.join(__dirname, '..', '..', 'mini-bundles');

let db = null;

/**
 * Hai mini-app demo, HAI ĐỘI KHÁC NHAU với khoá ký khác nhau.
 *
 * `keyId` phải có trong trust store nhúng sẵn ở app vỏ
 * (mobile/src/mini/trustStore.ts). Thêm một đội mới ở đây mà không thêm khoá vào
 * app là mini-app của họ sẽ bị TỪ CHỐI trên máy thật — đó là hành vi đúng, xem
 * mục 6.2 của tài liệu thiết kế.
 */
function defaultDb() {
  return {
    miniApps: [
      {
        id: 'insurance',
        container: 'miniInsurance',
        title: 'Bảo hiểm',
        icon: '🛡️',
        team: 'Đội Bảo hiểm',
        keyId: 'team-insurance',
        grantedPermissions: ['home.summary', 'insurance.quote'],
        draftVersion: null,
        publishedVersion: null,
        versions: [],
      },
      {
        id: 'invest',
        container: 'miniInvest',
        title: 'Đầu tư',
        icon: '📈',
        team: 'Đội Đầu tư',
        keyId: 'team-invest',
        grantedPermissions: ['invest.portfolio'],
        draftVersion: null,
        publishedVersion: null,
        versions: [],
      },
    ],
  };
}

export function loadMini() {
  if (db) return db;
  if (fs.existsSync(DB_FILE)) {
    db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } else {
    db = defaultDb();
    saveMini();
  }
  return db;
}

export function saveMini() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

export function resetMini() {
  db = defaultDb();
  saveMini();
  return db;
}

export const miniApps = {
  all: () => loadMini().miniApps,
  byId: (id) => loadMini().miniApps.find((a) => a.id === id) || null,

  versionOf(app, version) {
    return app.versions.find((v) => v.version === version) || null;
  },

  /**
   * Quyền CÓ HIỆU LỰC của một version = giao(được cấp, được xin).
   * Xem ghi chú đầu file.
   */
  effectivePermissions(app, version) {
    return version.requestedPermissions.filter((p) => app.grantedPermissions.includes(p));
  },

  /** Phần bị từ chối — dashboard hiện ra để người publish biết vì sao thiếu. */
  deniedPermissions(app, version) {
    return version.requestedPermissions.filter((p) => !app.grantedPermissions.includes(p));
  },

  /**
   * Bản mà app mobile nhận được trên một kênh, hoặc null nếu chưa publish.
   *
   * `hostVersion` lọc theo `minHostVersion`: app vỏ cũ hơn yêu cầu thì KHÔNG
   * được nhìn thấy mini-app này. Đây là lớp chặn thứ nhất (lớp thứ hai nằm ở
   * host, xem mobile/src/mini/loadMiniApp.ts).
   */
  resolve(app, { channel = 'production', hostVersion = Number.POSITIVE_INFINITY, platform = 'ios', baseUrl = '' } = {}) {
    const versionId = channel === 'draft' ? app.draftVersion : app.publishedVersion;
    if (!versionId) return null;

    const version = this.versionOf(app, versionId);
    if (!version) return null;
    if (version.minHostVersion > hostVersion) return null;

    const build = version.platforms[platform];
    if (!build) return null;

    return {
      id: app.id,
      container: app.container,
      title: app.title,
      icon: app.icon,
      version: version.version,
      minHostVersion: version.minHostVersion,
      entry: `${baseUrl}/mini/${app.id}/${version.version}/${platform}/${build.entryFile}`,
      // CHỈ keyId, KHÔNG BAO GIỜ là khoá. Xem mục 6.2 của tài liệu thiết kế:
      // trả kèm khoá thì kẻ chiếm được registry đổi cả bundle lẫn khoá và chữ ký
      // luôn hợp lệ. Khoá thật nằm trong trust store nhúng sẵn ở app vỏ.
      keyId: app.keyId,
      permissions: this.effectivePermissions(app, version),
      publishedAt: version.createdAt,
    };
  },

  /**
   * Ghi một version mới. Bundle đã được ghi ra đĩa trước đó bởi route publish.
   * Mỗi version là bất biến — publish và rollback chỉ đổi con trỏ, y như screens.
   */
  addVersion(app, { version, minHostVersion, requestedPermissions, platform, entryFile, files, note }) {
    let entry = this.versionOf(app, version);
    if (!entry) {
      entry = {
        version,
        minHostVersion,
        requestedPermissions,
        note: note || '',
        createdAt: new Date().toISOString(),
        platforms: {},
      };
      app.versions.push(entry);
    } else {
      // Publish lại cùng version cho platform khác: cập nhật phần chung.
      entry.minHostVersion = minHostVersion;
      entry.requestedPermissions = requestedPermissions;
    }
    entry.platforms[platform] = { entryFile, files };
    app.draftVersion = version;
    return entry;
  },
};

/**
 * Chữ ký của toàn bộ registry đang publish, để app hỏi "có gì mới không" cho rẻ.
 * Cùng cơ chế với computeRevision() của screens.
 */
export function computeMiniRevision(channel = 'production') {
  const parts = loadMini()
    .miniApps.map((a) => ({
      id: a.id,
      v: channel === 'draft' ? a.draftVersion : a.publishedVersion,
    }))
    .filter((x) => x.v)
    .map((x) => `${x.id}:${x.v}`)
    .sort();
  return parts.join('|') || 'empty';
}
