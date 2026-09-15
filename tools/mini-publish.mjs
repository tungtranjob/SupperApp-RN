#!/usr/bin/env node
/**
 * Đẩy một bản build đã ký lên registry.
 *
 *   npm run mini:publish insurance [ios|android]
 *
 * Server XÁC MINH CHỮ KÝ trước khi nhận. Bundle chưa ký hoặc ký sai khoá bị từ
 * chối ngay tại đây — thay vì publish trót lọt rồi chết trên máy người dùng.
 *
 * Sau bước này version nằm ở kênh NHÁP. Đưa ra production bằng nút Publish trên
 * dashboard, hoặc `npm run mini:release`.
 */
import fs from 'node:fs';
import path from 'node:path';
import {
  readMiniApp, collectPublishableFiles, api, MINI_APPS_DIR, API_BASE,
} from './mini-common.mjs';

const [, , id, platformArg] = process.argv;
const platform = platformArg ?? 'ios';

if (!id) {
  console.error('Cách dùng: npm run mini:publish <id> [ios|android]');
  process.exit(1);
}

const app = readMiniApp(id);
const outDir = path.join(MINI_APPS_DIR, id, 'build', 'generated', platform);

if (!fs.existsSync(outDir)) {
  console.error(`Chưa có bản build cho ${platform}. Chạy trước: npm run mini:build ${id} ${platform}`);
  process.exit(1);
}

const names = collectPublishableFiles(outDir, app.meta.container);
const files = {};
let totalBytes = 0;
for (const name of names) {
  const buf = fs.readFileSync(path.join(outDir, name));
  totalBytes += buf.length;
  files[name] = buf.toString('base64');
}

console.log(`\n▸ Publish ${id} v${app.version} (${platform}) → ${API_BASE}`);
console.log(`  ${names.length} file, ${(totalBytes / 1024).toFixed(0)} KB`);
console.log(`  xin quyền: ${app.meta.permissions.join(', ') || '(không)'}`);

try {
  const result = await api(`/api/admin/mini-apps/${id}/versions`, {
    method: 'POST',
    body: {
      version: app.version,
      minHostVersion: app.meta.minHostVersion,
      requestedPermissions: app.meta.permissions,
      platform,
      /**
       * ENTRY LÀ CONTAINER BUNDLE, KHÔNG PHẢI mf-manifest.json.
       *
       * Module Federation hỗ trợ cả hai. Chọn container vì hai lý do, cả hai
       * đều quan trọng:
       *
       *   1. BẢO MẬT. Manifest là JSON và Module Federation tải nó bằng `fetch`
       *      thường — KHÔNG đi qua ScriptManager, nên KHÔNG được xác minh chữ ký.
       *      Ai đổi được manifest thì đổi được đường dẫn mọi chunk. Dùng
       *      container bundle thì mọi thứ trên đường tin cậy đều đã ký.
       *
       *   2. OFFLINE. Vì lý do trên, manifest cũng không nằm trong cache của
       *      ScriptManager. Lấy nó làm entry nghĩa là mất mạng là không mở được
       *      mini-app, kể cả khi toàn bộ chunk đã nằm sẵn trên máy.
       *
       * Manifest vẫn được phát hành kèm — hữu ích khi cần soi bản build — nhưng
       * app vỏ không đọc nó.
       */
      entryFile: `${app.meta.container}.container.bundle`,
      files,
      note: app.pkg.description ?? '',
    },
  });

  console.log(`\n✔ Nhận: v${result.version} (${result.signedFiles} file đã xác minh chữ ký)`);
  console.log(`  quyền có hiệu lực: ${result.effectivePermissions.join(', ') || '(không)'}`);
  if (result.deniedPermissions.length) {
    // Không phải lỗi — là mô hình quyền đang làm đúng việc của nó. Nhưng người
    // publish cần biết, nếu không họ sẽ ngồi gỡ lỗi một lời gọi bị chặn.
    console.log(`  ⚠ bị từ chối : ${result.deniedPermissions.join(', ')}`);
    console.log('    (nền tảng chưa cấp những quyền này cho mini-app đó)');
  }
  console.log(`\n  Đang ở kênh NHÁP. Đưa ra production: dashboard → Mini Apps → Publish\n`);
} catch (err) {
  console.error(`\n✖ ${err.message}\n`);
  process.exit(1);
}
