#!/usr/bin/env node
/**
 * Build → publish → đưa ra production, một lệnh.
 *
 *   npm run mini:release                 tất cả mini-app, ios
 *   npm run mini:release insurance ios   một mini-app
 *
 * Dùng để dựng nhanh bản demo. Quy trình thật thì tách ba bước, vì bước cuối
 * (đưa ra production) phải là một quyết định của con người.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readMiniApp, api, MINI_APPS_DIR } from './mini-common.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const [, , idArg, platformArg] = process.argv;
const platform = platformArg ?? 'ios';

const ids = idArg
  ? [idArg]
  : fs.readdirSync(MINI_APPS_DIR).filter((d) =>
      fs.existsSync(path.join(MINI_APPS_DIR, d, 'package.json')),
    );

for (const id of ids) {
  const app = readMiniApp(id);
  execFileSync('node', [path.join(HERE, 'mini-build.mjs'), id, platform], { stdio: 'inherit' });
  execFileSync('node', [path.join(HERE, 'mini-publish.mjs'), id, platform], { stdio: 'inherit' });

  const res = await api(`/api/admin/mini-apps/${id}/publish`, {
    method: 'POST',
    body: { version: app.version },
  });
  console.log(`✔ ${id} v${res.published} đã ra kênh production\n`);
}
