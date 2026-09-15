#!/usr/bin/env node
/**
 * Sinh cặp khoá ký cho từng ĐỘI PHÁT HÀNH mini-app.
 *
 * Chạy một lần cho mỗi máy dev:  npm run keys:gen
 *
 * Ghi ra:
 *   keys/<keyId>.pem      khoá RIÊNG — đội dùng để ký. KHÔNG commit (.gitignore).
 *   keys/<keyId>.pem.pub  khoá CÔNG  — commit được, nhúng vào app vỏ.
 *
 * Không ghi đè khoá đã có. Muốn xoay khoá thì xoá tay rồi chạy lại — và nhớ rằng
 * xoay khoá nghĩa là mọi bundle đã ký bằng khoá cũ lập tức bị TỪ CHỐI trên máy
 * đang chạy bản app có khoá mới. Đó là hành vi đúng, nhưng phải cố ý.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const KEYS_DIR = path.join(ROOT, 'keys');

/** Phải khớp `keyId` trong backend/src/mini/store.js. */
const TEAMS = ['team-insurance', 'team-invest'];

fs.mkdirSync(KEYS_DIR, { recursive: true });

let created = 0;
for (const keyId of TEAMS) {
  const privatePath = path.join(KEYS_DIR, `${keyId}.pem`);
  const publicPath = path.join(KEYS_DIR, `${keyId}.pem.pub`);

  if (fs.existsSync(privatePath) && fs.existsSync(publicPath)) {
    console.log(`  ✓ ${keyId} — đã có, bỏ qua`);
    continue;
  }

  // RS256 như Re.Pack CodeSigningPlugin dùng. 2048 bit là mức tối thiểu còn an toàn.
  const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });

  fs.writeFileSync(privatePath, privateKey, { mode: 0o600 });
  fs.writeFileSync(publicPath, publicKey);
  console.log(`  + ${keyId} — đã sinh cặp khoá mới`);
  created += 1;
}

console.log(
  created > 0
    ? `\nXong. Chạy tiếp: npm run keys:sync (nhúng khoá công vào app vỏ)\n`
    : `\nKhông có gì để sinh.\n`,
);
