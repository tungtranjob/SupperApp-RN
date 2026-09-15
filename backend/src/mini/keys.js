/**
 * Đọc khoá công khai của các đội phát hành.
 *
 * MỘT NGUỒN DUY NHẤT: thư mục `keys/` ở gốc repo.
 *   keys/<keyId>.pem      khoá RIÊNG  — đội dùng để ký, KHÔNG commit (.gitignore)
 *   keys/<keyId>.pem.pub  khoá CÔNG   — commit được, không bí mật
 *
 * Ba nơi dùng chung thư mục này:
 *   1. `npm run mini:build`  ký bundle bằng khoá riêng
 *   2. backend              xác minh lúc publish (file này)
 *   3. `npm run keys:sync`   sinh mobile/src/mini/trustStore.ts từ các khoá công
 *
 * Ba nơi, một nguồn. Nếu mỗi nơi giữ một bản sao thì sớm muộn chúng lệch nhau,
 * và triệu chứng sẽ là "mini-app tự dưng không mở được" — rất khó lần ra.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** keys/ nằm ở gốc repo, tức là lên ba cấp từ backend/src/mini/. */
export const KEYS_DIR = path.join(__dirname, '..', '..', '..', 'keys');

export function publicKeyPath(keyId) {
  return path.join(KEYS_DIR, `${keyId}.pem.pub`);
}

export function readPublicKey(keyId) {
  // Chặn ../ trong keyId — nó đến từ dữ liệu, dù hiện tại là dữ liệu của mình.
  if (!/^[a-z0-9-]+$/i.test(keyId)) {
    throw new Error(`keyId không hợp lệ: ${keyId}`);
  }
  const file = publicKeyPath(keyId);
  if (!fs.existsSync(file)) {
    throw new Error(`Chưa có khoá công khai tại ${file}. Chạy: npm run keys:gen`);
  }
  return fs.readFileSync(file, 'utf8');
}

export function listKeyIds() {
  if (!fs.existsSync(KEYS_DIR)) return [];
  return fs
    .readdirSync(KEYS_DIR)
    .filter((f) => f.endsWith('.pem.pub'))
    .map((f) => f.replace(/\.pem\.pub$/, ''))
    .sort();
}
