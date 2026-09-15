/**
 * Persistence siêu đơn giản: 1 file JSON.
 * Thật ra ở production bạn thay bằng Postgres/Mongo, nhưng model dữ liệu giữ nguyên:
 *   - mỗi screen có NHIỀU version (immutable history)
 *   - draftVersion  = version đang soạn trên dashboard
 *   - publishedVersion = version mà app mobile đang nhận
 * => publish chỉ là đổi con trỏ, rollback cũng chỉ là đổi con trỏ. Không bao giờ mất dữ liệu.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { seedScreens } from './seed/screens.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');

let db = null;

function defaultDb() {
  return {
    users: [
      { id: 'u1', email: 'demo@supper.app', password: '123456', name: 'Trần Tùng', avatar: '🦊', phone: '0909 123 456', tier: 'Kim cương' },
    ],
    screens: seedScreens(),
  };
}

export function load() {
  if (db) return db;
  if (fs.existsSync(DB_FILE)) {
    db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  } else {
    db = defaultDb();
    save();
  }
  return db;
}

export function save() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
}

export function reset() {
  db = defaultDb();
  save();
  return db;
}

/* ---------- helpers cho screens ---------- */

export const screens = {
  all: () => load().screens,
  byId: (id) => load().screens.find((s) => s.id === id),
  byRoute: (route) => load().screens.find((s) => s.route === route),

  versionOf(screen, version) {
    return screen.versions.find((v) => v.version === version) || null;
  },

  /** Bản mà mobile nhận được, tuỳ channel */
  resolve(screen, channel = 'production') {
    const version = channel === 'draft' ? screen.draftVersion : screen.publishedVersion;
    if (!version) return null;
    const v = this.versionOf(screen, version);
    if (!v) return null;
    return {
      id: screen.id,
      route: screen.route,
      title: screen.title,
      icon: screen.icon,
      requiresAuth: screen.requiresAuth,
      showInMenu: screen.showInMenu,
      version: v.version,
      minSdui: v.minSdui ?? 1,
      onLoad: v.onLoad ?? [],
      initialState: v.initialState ?? {},
      layout: v.layout,
      updatedAt: v.createdAt,
    };
  },

  /** Mỗi lần lưu tạo 1 version mới -> lịch sử đầy đủ, rollback an toàn */
  addVersion(screen, { layout, onLoad, initialState, note, minSdui }) {
    const nextVersion = Math.max(0, ...screen.versions.map((v) => v.version)) + 1;
    const v = {
      version: nextVersion,
      layout,
      onLoad: onLoad ?? [],
      initialState: initialState ?? {},
      minSdui: minSdui ?? 1,
      note: note || '',
      createdAt: new Date().toISOString(),
    };
    screen.versions.push(v);
    screen.draftVersion = nextVersion;
    return v;
  },
};

/**
 * "revision" = chữ ký của toàn bộ UI đang publish.
 * Mobile chỉ cần so sánh chuỗi này để biết "có gì đổi không" mà không phải tải hết layout.
 * Đây chính là cơ chế ETag của super app.
 */
export function computeRevision(channel = 'production') {
  const parts = load()
    .screens
    // Màn hình chưa publish không tồn tại với app production → không được làm đổi revision,
    // nếu không mọi lần bấm "Lưu nháp" sẽ khiến toàn bộ thiết bị đi tải lại manifest vô ích.
    .map((s) => ({ id: s.id, v: channel === 'draft' ? s.draftVersion : s.publishedVersion }))
    .filter((x) => x.v > 0)
    .map((x) => `${x.id}:${x.v}`)
    .sort();
  return parts.join('|') || 'empty';
}
