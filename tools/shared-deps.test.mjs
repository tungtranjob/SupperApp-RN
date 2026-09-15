/**
 * CANH LỆCH VERSION GIỮA HOST VÀ MINI-APP.
 *
 * Đây là lỗi tốn thời gian nhất trong Module Federation, vì triệu chứng không
 * chỉ về nguyên nhân: nếu host chạy react 19.2.3 còn mini-app biên dịch với
 * 19.2.4, cả hai bản React cùng được nạp. Component của mini-app gọi hook trên
 * bản thứ hai trong khi cây component thuộc bản thứ nhất, và bạn nhận
 * "Invalid hook call" — hoặc tệ hơn, state mất sạch giữa chừng mà không có lỗi
 * nào cả.
 *
 * Con số duy nhất đúng nằm ở shared-deps.mjs. Test này bắt mọi nơi khác phải khớp.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { VERSIONS, SHARED_HOST, SHARED_MINI } from '../shared-deps.mjs';
import { createRunner } from './test-util.mjs';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const t = createRunner('Đồng bộ version giữa host và mini-app');

const readPkg = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'));
const hostPkg = readPkg('mobile/package.json');

/* ---------- host cài đúng version đã khai ---------- */

for (const [name, version] of Object.entries(VERSIONS)) {
  const declared = hostPkg.dependencies?.[name] ?? hostPkg.devDependencies?.[name];
  t.ok(
    `mobile/package.json có ${name}`,
    declared !== undefined,
  );
  // Chấp nhận cả dạng có tiền tố ^ hoặc ~ — npm vẫn cài đúng dòng version đó.
  t.eq(
    `${name} khớp shared-deps.mjs`,
    String(declared ?? '').replace(/^[\^~]/, ''),
    version,
  );
}

/* ---------- mini-app build với đúng version đó ---------- */

const miniDirs = fs
  .readdirSync(path.join(ROOT, 'mini-apps'))
  .filter((d) => fs.existsSync(path.join(ROOT, 'mini-apps', d, 'package.json')));

t.ok('có ít nhất hai mini-app', miniDirs.length >= 2);

for (const dir of miniDirs) {
  const pkg = readPkg(`mini-apps/${dir}/package.json`);
  for (const name of ['react', 'react-native']) {
    const declared = pkg.devDependencies?.[name] ?? pkg.dependencies?.[name];
    t.eq(
      `mini-app '${dir}' build với ${name} đúng version của host`,
      String(declared ?? '').replace(/^[\^~]/, ''),
      VERSIONS[name],
    );
  }

  /* Metadata phát hành phải đầy đủ, nếu không script publish sẽ đổ giữa chừng. */
  const meta = pkg.supperMiniApp;
  t.ok(`mini-app '${dir}' có khối supperMiniApp`, !!meta);
  t.ok(`mini-app '${dir}' khai keyId`, typeof meta?.keyId === 'string');
  t.ok(`mini-app '${dir}' khai minHostVersion`, Number.isInteger(meta?.minHostVersion));
  t.ok(`mini-app '${dir}' khai permissions`, Array.isArray(meta?.permissions));

  /* Khoá công khai phải có sẵn, nếu không server từ chối lúc publish. */
  t.ok(
    `có khoá công khai cho '${meta?.keyId}'`,
    fs.existsSync(path.join(ROOT, 'keys', `${meta?.keyId}.pem.pub`)),
  );
}

/* ---------- tên container phải là định danh JavaScript hợp lệ ---------- */

for (const dir of miniDirs) {
  const { supperMiniApp } = readPkg(`mini-apps/${dir}/package.json`);
  t.ok(
    `container '${supperMiniApp.container}' là định danh JS hợp lệ`,
    /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(supperMiniApp.container),
  );
}

/* ---------- eager: host CÓ, mini-app KHÔNG ---------- */

/**
 * Không phải chi tiết vụn vặt — đảo ngược là hỏng ngay:
 *
 *   host thiếu eager    → chết lúc khởi động, "[ Federation Runtime ]:
 *                         Invalid loadShareSync function call #RUNTIME-006"
 *   mini-app có eager   → mini-app nhét cả React + React Native vào bundle,
 *                         từ vài chục KB phình lên vài MB, mất luôn ý nghĩa
 *                         của việc chia sẻ
 */
t.ok('host: react eager', SHARED_HOST.react.eager === true);
t.ok('host: react-native eager', SHARED_HOST['react-native'].eager === true);
t.ok('mini-app: react KHÔNG eager', SHARED_MINI.react.eager === false);
t.ok('mini-app: react-native KHÔNG eager', SHARED_MINI['react-native'].eager === false);

/* ---------- mọi package chia sẻ đều là singleton và khai version tường minh ---------- */

for (const [name, cfg] of Object.entries(SHARED_HOST)) {
  t.ok(`${name} là singleton`, cfg.singleton === true);
  // Thiếu `version` thì Module Federation cảnh báo rồi ÂM THẦM bỏ qua ràng buộc
  // singleton với các package có exports trỏ vào thư mục con.
  t.ok(`${name} khai version tường minh`, typeof cfg.version === 'string');
  t.ok(`${name} khai requiredVersion`, typeof cfg.requiredVersion === 'string');
}

t.done();
