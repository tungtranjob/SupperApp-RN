/**
 * Tiện ích dùng chung cho các script mini-app.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
export const MINI_APPS_DIR = path.join(ROOT, 'mini-apps');

export const API_BASE = process.env.SUPPER_API ?? 'http://localhost:4000';

/**
 * Đọc metadata của một mini-app từ package.json của chính nó.
 *
 * Nguồn sự thật là package.json, không phải một file cấu hình riêng: version
 * của mini-app CHÍNH LÀ version npm của nó, nên `npm version patch` là đủ để
 * phát hành bản mới. Một con số, một chỗ.
 */
export function readMiniApp(id) {
  const pkgPath = path.join(MINI_APPS_DIR, id, 'package.json');
  if (!fs.existsSync(pkgPath)) {
    throw new Error(`Không thấy mini-app '${id}' (thiếu ${pkgPath})`);
  }
  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
  const meta = pkg.supperMiniApp;
  if (!meta) {
    throw new Error(`${pkgPath} thiếu khối "supperMiniApp"`);
  }
  return { pkg, version: pkg.version, meta };
}

/**
 * Chọn những file CẦN PHÁT HÀNH từ thư mục build.
 *
 * Ba loại bị loại bỏ, mỗi loại một lý do:
 *
 *   - `*.map`         source map. Có ích lúc gỡ lỗi, nhưng phát hành ra công
 *                     khai là tặng kẻ tấn công toàn bộ mã nguồn mini-app.
 *   - `mf-stats.json` báo cáo thống kê của bundler, app không dùng.
 *   - `<container>.bundle`  entry bundle. React Native CLI bắt buộc sinh ra nó,
 *                     nhưng app vỏ không bao giờ tải — thứ nó tải là container.
 *                     Đây cũng là file DUY NHẤT không được ký (Re.Pack bỏ qua
 *                     entry chính), nên phát hành nó là tạo một lỗ hổng.
 */
export function collectPublishableFiles(outDir, container) {
  const skipEntry = `${container}.bundle`;
  return fs
    .readdirSync(outDir)
    .filter((name) => {
      if (name.endsWith('.map')) return false;
      if (name === 'mf-stats.json') return false;
      if (name === skipEntry) return false;
      return name.endsWith('.bundle') || name === 'mf-manifest.json';
    })
    .sort();
}

export async function api(pathname, { method = 'GET', body } = {}) {
  const res = await fetch(`${API_BASE}${pathname}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = { message: text }; }
  if (!res.ok) {
    throw new Error(`${method} ${pathname} → ${res.status}: ${data?.message ?? text}`);
  }
  return data;
}
