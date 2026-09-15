/**
 * API REGISTRY MINI-APP.
 *
 * Ba nhóm, ba đối tượng gọi khác nhau:
 *   - GET  /api/mini-apps            → APP MOBILE hỏi "tôi được mở những gì?"
 *   - GET  /mini/:id/:v/:plat/*      → APP MOBILE tải bundle (file tĩnh, đã ký)
 *   - /api/admin/mini-apps/*         → DASHBOARD & script publish
 *
 * Như admin.js, phần admin ở đây KHÔNG có xác thực vì đây là demo chạy cục bộ.
 * Thật thì nó phải có auth admin, quyền theo đội, và audit log — vì đây là nơi
 * quyết định mã nào được chạy trên máy người dùng.
 */
import fs from 'node:fs';
import path from 'node:path';
import { Router } from 'express';
import {
  loadMini, saveMini, miniApps, computeMiniRevision, BUNDLE_DIR,
} from '../mini/store.js';
import { verifySignedBundle, SignatureError } from '../mini/signature.js';
import { readPublicKey } from '../mini/keys.js';

export const router = Router();
export const adminRouter = Router();
export const bundleRouter = Router();

/* ------------------------------------------------------------------ */
/* APP MOBILE                                                          */
/* ------------------------------------------------------------------ */

/**
 * Danh sách mini-app mà THIẾT BỊ NÀY mở được.
 *
 * `hostVersion` không phải thông tin trang trí: server dùng nó để loại bỏ những
 * mini-app cần app vỏ mới hơn. App cũ không nhìn thấy thứ nó không chạy nổi.
 */
router.get('/mini-apps', (req, res) => {
  const channel = req.query.channel === 'draft' ? 'draft' : 'production';
  const platform = req.query.platform === 'android' ? 'android' : 'ios';
  const hostVersion = Number.parseInt(req.query.hostVersion, 10) || 0;
  const baseUrl = `${req.protocol}://${req.get('host')}`;

  const apps = miniApps
    .all()
    .map((a) => miniApps.resolve(a, { channel, hostVersion, platform, baseUrl }))
    .filter(Boolean);

  res.json({
    revision: computeMiniRevision(channel),
    channel,
    hostVersion,
    platform,
    apps,
    updatedAt: new Date().toISOString(),
  });
});

/* ------------------------------------------------------------------ */
/* PHỤC VỤ BUNDLE                                                      */
/* ------------------------------------------------------------------ */

/**
 * Trả file bundle. KHÔNG cần đăng nhập — và đó là chủ ý.
 *
 * Tính toàn vẹn của bundle do CHỮ KÝ bảo đảm, không phải do ai giữ được đường
 * truyền. Bắt token ở đây tạo cảm giác an toàn giả: kẻ tấn công chen được vào
 * giữa vẫn đổi được nội dung, chỉ có chữ ký mới phát hiện ra.
 */
bundleRouter.get('/:id/:version/:platform/*', (req, res) => {
  const { id, version, platform } = req.params;
  // Express 4: phần khớp với '*' nằm ở req.params[0], không phải một tên đặt được.
  const rest = req.params[0];

  const dir = path.join(BUNDLE_DIR, id, version, platform);
  const file = path.resolve(dir, rest);

  // Chặn path traversal: file phải nằm trong đúng thư mục của version này.
  if (!file.startsWith(path.resolve(dir) + path.sep) && file !== path.resolve(dir)) {
    return res.status(400).json({ message: 'Đường dẫn không hợp lệ' });
  }
  if (!fs.existsSync(file)) return res.status(404).json({ message: 'Không tìm thấy file bundle' });

  if (file.endsWith('.json')) res.type('application/json');
  else if (file.endsWith('.bundle') || file.endsWith('.js')) res.type('application/javascript');
  res.sendFile(file);
});

/* ------------------------------------------------------------------ */
/* DASHBOARD & SCRIPT PUBLISH                                          */
/* ------------------------------------------------------------------ */

const summary = (a) => ({
  id: a.id,
  container: a.container,
  title: a.title,
  icon: a.icon,
  team: a.team,
  keyId: a.keyId,
  grantedPermissions: a.grantedPermissions,
  draftVersion: a.draftVersion,
  publishedVersion: a.publishedVersion,
  hasUnpublishedChanges: a.draftVersion !== a.publishedVersion,
  versionCount: a.versions.length,
});

adminRouter.get('/mini-apps', (_req, res) => {
  res.json({ revision: computeMiniRevision(), apps: miniApps.all().map(summary) });
});

adminRouter.get('/mini-apps/:id', (req, res) => {
  const app = miniApps.byId(req.params.id);
  if (!app) return res.status(404).json({ message: 'Không tìm thấy mini-app' });

  res.json({
    ...summary(app),
    versions: app.versions
      .map((v) => ({
        version: v.version,
        minHostVersion: v.minHostVersion,
        requestedPermissions: v.requestedPermissions,
        effectivePermissions: miniApps.effectivePermissions(app, v),
        deniedPermissions: miniApps.deniedPermissions(app, v),
        platforms: Object.keys(v.platforms),
        note: v.note,
        createdAt: v.createdAt,
      }))
      .reverse(),
  });
});

/**
 * Nhận một bản build đã ký.
 *
 * Server XÁC MINH CHỮ KÝ trước khi ghi. Bundle chưa ký, hoặc ký bằng khoá không
 * phải của đội này, bị từ chối ngay tại đây — thay vì publish trót lọt rồi chết
 * trên máy của toàn bộ người dùng. Xem backend/src/mini/signature.js.
 */
adminRouter.post('/mini-apps/:id/versions', (req, res) => {
  const app = miniApps.byId(req.params.id);
  if (!app) return res.status(404).json({ message: 'Không tìm thấy mini-app' });

  const {
    version, minHostVersion, requestedPermissions, platform, entryFile, files, note,
  } = req.body || {};

  if (!version || !platform || !entryFile || !files) {
    return res.status(400).json({ message: 'Thiếu version / platform / entryFile / files' });
  }
  if (!['ios', 'android'].includes(platform)) {
    return res.status(400).json({ message: 'platform phải là ios hoặc android' });
  }

  let publicKey;
  try {
    publicKey = readPublicKey(app.keyId);
  } catch (err) {
    return res.status(500).json({ message: `Không đọc được khoá công khai '${app.keyId}': ${err.message}` });
  }

  const decoded = Object.entries(files).map(([name, b64]) => ({
    name,
    buffer: Buffer.from(b64, 'base64'),
  }));

  const entry = decoded.find((f) => f.name === entryFile);
  if (!entry) {
    return res.status(400).json({ message: `entryFile '${entryFile}' không có trong danh sách files` });
  }

  // Chỉ các file .bundle mới được ký (Re.Pack ký từng chunk, bỏ qua manifest JSON).
  const signedFiles = decoded.filter((f) => f.name.endsWith('.bundle'));
  if (signedFiles.length === 0) {
    return res.status(400).json({ message: 'Không có file .bundle nào để xác minh' });
  }

  try {
    for (const f of signedFiles) verifySignedBundle(f.buffer, publicKey);
  } catch (err) {
    if (err instanceof SignatureError) {
      return res.status(400).json({ message: `Từ chối bản build: ${err.message}` });
    }
    throw err;
  }

  const dir = path.join(BUNDLE_DIR, app.id, version, platform);
  fs.rmSync(dir, { recursive: true, force: true });
  for (const f of decoded) {
    const target = path.join(dir, f.name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, f.buffer);
  }

  const saved = miniApps.addVersion(app, {
    version,
    minHostVersion: Number(minHostVersion) || 1,
    requestedPermissions: Array.isArray(requestedPermissions) ? requestedPermissions : [],
    platform,
    entryFile,
    files: decoded.map((f) => f.name),
    note,
  });
  saveMini();

  res.status(201).json({
    version: saved.version,
    platform,
    signedFiles: signedFiles.length,
    effectivePermissions: miniApps.effectivePermissions(app, saved),
    deniedPermissions: miniApps.deniedPermissions(app, saved),
  });
});

/** Publish: chỉ đổi con trỏ. Không bao giờ mất version cũ. */
adminRouter.post('/mini-apps/:id/publish', (req, res) => {
  const app = miniApps.byId(req.params.id);
  if (!app) return res.status(404).json({ message: 'Không tìm thấy mini-app' });

  const version = req.body?.version ?? app.draftVersion;
  if (!version || !miniApps.versionOf(app, version)) {
    return res.status(400).json({ message: 'Version không tồn tại' });
  }
  app.publishedVersion = version;
  app.draftVersion = version;
  saveMini();
  res.json({ published: version, revision: computeMiniRevision() });
});

/** Rollback: cũng chỉ đổi con trỏ, theo hướng ngược lại. */
adminRouter.post('/mini-apps/:id/rollback', (req, res) => {
  const app = miniApps.byId(req.params.id);
  if (!app) return res.status(404).json({ message: 'Không tìm thấy mini-app' });

  const { version } = req.body || {};
  if (!version || !miniApps.versionOf(app, version)) {
    return res.status(400).json({ message: 'Version không tồn tại' });
  }
  app.publishedVersion = version;
  saveMini();
  res.json({ published: version, revision: computeMiniRevision() });
});

/** Gỡ khỏi kênh production. Version vẫn còn, chỉ là không ai nhận nữa. */
adminRouter.post('/mini-apps/:id/unpublish', (req, res) => {
  const app = miniApps.byId(req.params.id);
  if (!app) return res.status(404).json({ message: 'Không tìm thấy mini-app' });
  app.publishedVersion = null;
  saveMini();
  res.json({ published: null, revision: computeMiniRevision() });
});

loadMini();
