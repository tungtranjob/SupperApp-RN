#!/usr/bin/env node
/**
 * Sinh mobile/src/mini/trustStore.ts từ các khoá công trong keys/.
 *
 * Chạy sau keys:gen, và mỗi khi thêm/xoay khoá của một đội.
 *
 * VÌ SAO TRUST STORE PHẢI NẰM TRONG APP, KHÔNG PHẢI TRONG REGISTRY
 *
 * Cách làm ngây thơ là để registry trả kèm khoá công cho từng mini-app. Cách đó
 * THỦNG hoàn toàn: kẻ chiếm được registry đổi cả bundle lẫn khoá, chữ ký khớp
 * với khoá của chính hắn, app xác minh thành công và chạy mã của hắn.
 *
 * Registry chỉ được phép nói `keyId` — một cái TÊN. Khoá thật nằm trong bản app
 * đã ký và phát hành qua store, nơi kẻ tấn công không với tới được.
 *
 * Hệ quả: kết nạp một ĐỘI PHÁT HÀNH MỚI cần một bản app mới. Đó không phải hạn
 * chế, đó là mục đích — cho một bên lạ quyền chạy mã trong app của bạn là việc
 * phải qua thẩm định, không phải một lệnh POST.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const KEYS_DIR = path.join(ROOT, 'keys');
const OUT = path.join(ROOT, 'mobile', 'src', 'mini', 'trustStore.ts');

if (!fs.existsSync(KEYS_DIR)) {
  console.error('Chưa có thư mục keys/. Chạy trước: npm run keys:gen');
  process.exit(1);
}

const keyIds = fs
  .readdirSync(KEYS_DIR)
  .filter((f) => f.endsWith('.pem.pub'))
  .map((f) => f.replace(/\.pem\.pub$/, ''))
  .sort();

if (keyIds.length === 0) {
  console.error('Không tìm thấy khoá công nào trong keys/. Chạy trước: npm run keys:gen');
  process.exit(1);
}

const entries = keyIds
  .map((keyId) => {
    const pem = fs.readFileSync(path.join(KEYS_DIR, `${keyId}.pem.pub`), 'utf8').trim();
    // Chuỗi nhiều dòng: dùng template literal để PEM giữ nguyên xuống dòng.
    return `  '${keyId}': \`${pem}\`,`;
  })
  .join('\n\n');

const content = `/**
 * TRUST STORE — khoá công khai của các đội được phép phát hành mini-app.
 *
 * FILE NÀY ĐƯỢC SINH TỰ ĐỘNG bởi \`npm run keys:sync\`. Đừng sửa tay.
 * Nguồn: keys/*.pem.pub
 *
 * Đây là gốc tin cậy của toàn bộ hướng B. Registry chỉ nói mini-app được ký bằng
 * \`keyId\` nào; khoá thật thì lấy ở đây — bên trong bản app đã phát hành. Nếu
 * khoá đến từ registry thì kẻ chiếm được registry sẽ đổi cả bundle lẫn khoá và
 * chữ ký luôn hợp lệ. Xem tools/keys-sync.mjs để biết đầy đủ lý do.
 *
 * Thêm một đội mới ở đây = phải phát hành bản app mới. Đó là chủ ý.
 */

export const TRUST_STORE: Record<string, string> = {
${entries}
};

/** Lấy khoá công cho một keyId, hoặc null nếu app này không tin đội đó. */
export function publicKeyFor(keyId: string): string | null {
  return TRUST_STORE[keyId] ?? null;
}
`;

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, content);
console.log(`Đã ghi ${path.relative(ROOT, OUT)} với ${keyIds.length} khoá: ${keyIds.join(', ')}`);
