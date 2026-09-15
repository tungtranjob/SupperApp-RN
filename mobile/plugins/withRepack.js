const { withDangerousMod } = require('@expo/config-plugins');
const fs = require('node:fs');
const path = require('node:path');

/**
 * Expo config plugin: bắt bản build native dùng Re.Pack thay vì Metro.
 *
 * VÌ SAO PHẢI LÀ PLUGIN, KHÔNG PHẢI SỬA TAY
 *
 * `npx expo prebuild --clean` xoá sạch ios/ và android/ rồi sinh lại. Mọi sửa
 * tay trong đó biến mất. Nếu cấu hình Re.Pack chỉ là một lần sửa tay thì sau
 * một lần prebuild --clean, app sẽ ÂM THẦM quay về đóng gói bằng Metro: build
 * vẫn thành công, app vẫn chạy, chỉ có Module Federation là chết và mini-app
 * không mở được — với lỗi lúc chạy chẳng liên quan gì tới nguyên nhân.
 * Plugin chạy lại ở mỗi lần prebuild nên không có cửa sổ đó.
 *
 * CƠ CHẾ (iOS)
 *
 * Build phase "Bundle React Native code and images" do Expo sinh ra có dạng:
 *
 *     source "$PODS_ROOT/../.xcode.env"            # ← chúng ta chen vào đây
 *     if [[ -z "$CLI_PATH" ]];       then export CLI_PATH=...@expo/cli...;  fi
 *     if [[ -z "$BUNDLE_COMMAND" ]]; then export BUNDLE_COMMAND="export:embed"; fi
 *
 * Vì hai nhánh kia chỉ chạy KHI BIẾN CÒN TRỐNG, chỉ cần đặt sẵn giá trị trong
 * `.xcode.env` là Expo tự nhường. Không phải vá project.pbxproj — vá file text
 * sinh tự động là thứ sẽ vỡ ở bản Expo kế tiếp.
 */

const IOS_MARKER = '# --- Re.Pack ---';

/**
 * Entry point mà phía NATIVE hỏi dev server lúc chạy.
 *
 * Expo prebuild sinh AppDelegate trỏ vào `.expo/.virtual-metro-entry` — một
 * entry ẢO chỉ Metro mới dựng được. Re.Pack không biết nó là gì và trả 404, app
 * chết ngay lúc khởi động với "File .expo/.virtual-metro-entry.bundle for ios
 * not found in compilation assets".
 *
 * Đổi sang `index`, khớp với `entry: './index.ts'` trong rspack.config.mjs.
 */
const EXPO_VIRTUAL_ENTRY = '.expo/.virtual-metro-entry';
const REPACK_ENTRY = 'index';

const IOS_ENV_BLOCK = `
${IOS_MARKER}
# Dùng React Native CLI (đã trỏ sang Re.Pack trong react-native.config.js)
# thay cho Expo CLI, để bản build release đóng gói bằng Rspack + Module Federation.
export CLI_PATH="$("$NODE_BINARY" --print "require('path').dirname(require.resolve('@react-native-community/cli/package.json')) + '/build/bin.js'")"
export BUNDLE_COMMAND="bundle"
`;

function withRepackIos(config) {
  return withDangerousMod(config, [
    'ios',
    (cfg) => {
      const envPath = path.join(cfg.modRequest.platformProjectRoot, '.xcode.env');
      const current = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';
      if (!current.includes(IOS_MARKER)) {
        fs.writeFileSync(envPath, current + IOS_ENV_BLOCK);
      }

      // Đổi bundle root trong AppDelegate — xem ghi chú ở EXPO_VIRTUAL_ENTRY.
      const appDelegate = path.join(
        cfg.modRequest.platformProjectRoot,
        cfg.modRequest.projectName,
        'AppDelegate.swift',
      );
      if (fs.existsSync(appDelegate)) {
        const src = fs.readFileSync(appDelegate, 'utf8');
        if (src.includes(EXPO_VIRTUAL_ENTRY)) {
          fs.writeFileSync(appDelegate, src.replaceAll(EXPO_VIRTUAL_ENTRY, REPACK_ENTRY));
        }
      }

      return cfg;
    },
  ]);
}

const ANDROID_MARKER = '// --- Re.Pack ---';

function withRepackAndroid(config) {
  return withDangerousMod(config, [
    'android',
    (cfg) => {
      const gradlePath = path.join(cfg.modRequest.platformProjectRoot, 'app', 'build.gradle');
      let src = fs.readFileSync(gradlePath, 'utf8');
      if (src.includes(ANDROID_MARKER)) return cfg;

      /**
       * Expo sinh khối `react { ... }` trỏ cliFile về @expo/cli. Đổi sang RN CLI
       * để Gradle gọi Re.Pack lúc đóng gói release. Cùng lý do như iOS.
       */
      src = src.replace(
        /react\s*\{/,
        `react {
    ${ANDROID_MARKER}
    cliFile = new File(["node", "--print", "require('path').dirname(require.resolve('@react-native-community/cli/package.json')) + '/build/bin.js'"].execute(null, rootDir).text.trim())
    bundleCommand = "bundle"
    // --- hết Re.Pack ---`,
      );
      fs.writeFileSync(gradlePath, src);
      return cfg;
    },
  ]);
}

module.exports = function withRepack(config) {
  return withRepackAndroid(withRepackIos(config));
};
