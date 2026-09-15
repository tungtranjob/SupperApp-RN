/**
 * Đóng gói snapshot UI hiện tại vào app mobile làm bản dự phòng offline.
 * Chạy như một bước build:  npm run export:bundled
 *
 * Ở production bạn cũng làm đúng vậy: mỗi lần release app, nhúng snapshot mới nhất
 * để lần mở app ĐẦU TIÊN (chưa có cache, có thể chưa có mạng) vẫn hiện được UI.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { seedScreens } from '../src/seed/screens.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(__dirname, '../../mobile/src/fallback/bundled.json');

const screensRaw = seedScreens();

const resolved = screensRaw.map((s) => {
  const v = s.versions.find((x) => x.version === s.publishedVersion);
  return {
    id: s.id, route: s.route, title: s.title, icon: s.icon,
    requiresAuth: s.requiresAuth, showInMenu: s.showInMenu,
    version: v.version, minSdui: v.minSdui ?? 1,
    onLoad: v.onLoad ?? [], initialState: v.initialState ?? {},
    layout: v.layout, updatedAt: v.createdAt,
  };
});

const bundle = {
  manifest: {
    revision: 'bundled',
    channel: 'production',
    entry: 'login',
    home: 'home',
    sduiVersion: 1,
    screens: resolved.map(({ id, route, title, icon, requiresAuth, showInMenu, version, minSdui }) => ({
      id, route, title, icon, requiresAuth, showInMenu, version, minSdui,
    })),
  },
  screens: Object.fromEntries(resolved.map((s) => [s.route, s])),
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(bundle, null, 2));
console.log(`✔ Đã ghi snapshot dự phòng → ${OUT}`);
