#!/usr/bin/env node
/**
 * Build một mini-app thành remote container đã ký.
 *
 *   npm run mini:build insurance [ios|android]
 *
 * Kết quả nằm ở mini-apps/<id>/build/generated/<platform>/.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { readMiniApp, MINI_APPS_DIR } from './mini-common.mjs';

const [, , id, platformArg] = process.argv;
const platform = platformArg ?? 'ios';

if (!id) {
  console.error('Cách dùng: npm run mini:build <id> [ios|android]');
  process.exit(1);
}
if (!['ios', 'android'].includes(platform)) {
  console.error(`platform phải là ios hoặc android, nhận được: ${platform}`);
  process.exit(1);
}

const app = readMiniApp(id);
const cwd = path.join(MINI_APPS_DIR, id);

console.log(`\n▸ Build ${app.meta.container} v${app.version} cho ${platform}`);
console.log(`  ký bằng khoá: ${app.meta.keyId}\n`);

execFileSync(
  'npx',
  [
    'react-native', 'bundle',
    '--platform', platform,
    '--entry-file', 'src/index.ts',
    '--dev', 'false',
  ],
  { cwd, stdio: 'inherit' },
);

const outDir = path.join(cwd, 'build', 'generated', platform);
if (!fs.existsSync(path.join(outDir, 'mf-manifest.json'))) {
  console.error(`\nKhông thấy mf-manifest.json trong ${outDir}. Build hỏng?`);
  process.exit(1);
}

console.log(`\n✔ Xong: ${path.relative(process.cwd(), outDir)}`);
console.log(`  Tiếp theo: npm run mini:publish ${id} ${platform}\n`);
