import * as Repack from '@callstack/repack';
import { ExpoModulesPlugin } from '@callstack/repack-plugin-expo-modules';

import { SHARED_HOST } from '../shared-deps.mjs';

/**
 * Các package phơi mã nguồn viết bằng Flow (chưa biên dịch) và cần đi qua Babel
 * trước. React Native core nằm trong này.
 */
const FLOW_TYPED_MODULES = [
  'react-native',
  '@react-native',
  'react-native-safe-area-context',
  'react-native-screens',
];

/**
 * Cấu hình build cho APP VỎ (host).
 *
 * Khác biệt lớn nhất so với một cấu hình Re.Pack thông thường: ở đây KHÔNG khai
 * báo `remotes`. Mini-app được đăng ký lúc chạy bằng `registerRemotes()` (xem
 * src/mini/loadMiniApp.ts), lấy từ registry của backend.
 *
 * Vì sao: nếu khai `remotes` tĩnh ở đây thì thêm một mini-app mới sẽ phải build
 * lại và phát hành lại app vỏ — đúng cái mà cả dự án này tồn tại để tránh.
 */
export default Repack.defineRspackConfig((env) => {
  const { mode } = env;

  return {
    context: import.meta.dirname,
    /**
     * PHẢI khai dạng OBJECT, không được dùng chuỗi.
     *
     * `NativeEntryPlugin` của Re.Pack — thứ chèn polyfills và `InitializeCore`
     * của React Native vào trước entry của bạn — duyệt entry bằng
     * `Object.keys(entry)`. Đưa chuỗi vào thì `Object.keys('./index.ts')` trả về
     * `['0','1','2',…]`: mỗi KÝ TỰ thành một entrypoint rác, còn entrypoint thật
     * thì không nhận được gì.
     *
     * Bundle vẫn build thành công. App vẫn khởi động. Rồi chết ở dòng đầu tiên
     * đụng tới một API do InitializeCore cài đặt — thực tế là
     * "Property 'WebSocket' doesn't exist" từ HMR client, một thông báo không hề
     * nhắc tới entry hay plugin nào.
     */
    entry: { index: './index.ts' },

    output: {
      // Bắt buộc khi dùng Module Federation: uniqueName phân biệt runtime của
      // host với runtime của từng mini-app. Thiếu nó thì HMR và share scope
      // giẫm lên nhau vì cùng dùng một khoá global mặc định.
      uniqueName: 'host',
    },

    resolve: {
      // `enablePackageExports: true` là BẮT BUỘC, không phải tuỳ chọn. Mặc định
      // Re.Pack tắt package exports để bắt chước Metro đời cũ; nhưng RN 0.86
      // lẫn các package @module-federation/* đều chỉ phơi subpath qua trường
      // `exports`. Tắt nó đi thì gặp "Can't resolve
      // '@module-federation/runtime/helpers'" — lỗi không gợi ý gì về nguyên nhân.
      ...Repack.getResolveOptions({ enablePackageExports: true }),
    },

    module: {
      rules: [
        // 1) swc — hạ ES hiện đại. Khai đầu nên chạy CUỐI (webpack áp loader
        //    theo thứ tự ngược). Tắt flow và codegen mặc định: quy tắc (2) lo cả hai.
        ...Repack.getJsTransformRules({
          flow: { enabled: false },
          codegen: { enabled: false },
        }),

        /**
         * 2) Preset chính thức của React Native, cho các package phơi mã nguồn
         *    chưa biên dịch. Khai sau nên chạy TRƯỚC swc.
         *
         * Nó lo HAI việc mà Re.Pack mặc định không lo nổi ở đây:
         *
         *   a. CÚ PHÁP `component` CỦA FLOW. React Native 0.86 viết component
         *      core là `component View(ref, ...props) {…}`. Đây không phải chú
         *      thích kiểu để xoá đi là xong — nó phải được BIẾN ĐỔI thành
         *      `React.forwardRef(...)`. `flow-remove-types` mà Re.Pack dùng mặc
         *      định chỉ biết xoá kiểu, để nguyên `component View(`, và swc chết
         *      với "Expected ';', '}' or <eof>".
         *
         *   b. CODEGEN, ĐÚNG THỨ TỰ. `@react-native/babel-plugin-codegen` đọc
         *      KIỂU của các file *NativeComponent / Native* để sinh view config,
         *      nên phải chạy TRƯỚC bước xoá kiểu. Preset đã xếp sẵn đúng thứ tự
         *      này; tự ghép plugin tay thì xoá kiểu trước và nhận
         *      "Could not find component config for native component".
         *
         * `test` PHẢI phủ cả `tsx?`, không chỉ `jsx?`. React Native core viết
         * bằng Flow (.js), nhưng `react-native-safe-area-context` và
         * `react-native-screens` viết bằng TypeScript — file spec native của
         * chúng là `.ts`. Bỏ sót đuôi `.ts` thì codegen không chạy cho chúng,
         * build vẫn xanh, và app chết lúc render với
         * "View config not found for component `RNSSafeAreaView`" — một thông
         * báo không hề nhắc tới babel, codegen, hay đuôi file.
         *
         * `disableImportExportTransform: true`: giữ nguyên ESM. Mặc định preset
         * hạ import/export xuống CommonJS, mà Module Federation cần ESM để phân
         * tích đồ thị phụ thuộc và chia sẻ module.
         */
        {
          type: 'javascript/auto',
          test: /\.([cm]?jsx?|tsx?|flow)$/,
          include: Repack.getModulePaths(FLOW_TYPED_MODULES),
          use: {
            loader: '@callstack/repack/babel-loader',
            options: {
              babelrc: false,
              configFile: false,
              presets: [
                ['@react-native/babel-preset', { disableImportExportTransform: true }],
              ],
            },
          },
        },

        ...Repack.getAssetTransformRules(),
      ],
    },

    plugins: [
      new Repack.RepackPlugin(),

      // Giữ expo-constants / expo-status-bar / AsyncStorage chạy được sau khi bỏ
      // Metro. Plugin này định nghĩa các global mà Expo Modules cần lúc chạy.
      new ExpoModulesPlugin(),

      new Repack.plugins.ModuleFederationPluginV2({
        name: 'host',

        /**
         * KHÔNG khai `exposes`, kể cả `exposes: {}`.
         *
         * Chỉ cần có mặt khoá đó là Module Federation sinh thêm một entrypoint
         * "container". Entrypoint đó tranh cùng tên file tĩnh `index.bundle` với
         * entry của app và build hỏng ở bước cuối:
         * "Conflict: Multiple assets emit different content to the same filename".
         *
         * Về mặt thiết kế thì cũng không cần: host KHÔNG expose gì cho mini-app.
         * Mini-app nhận mọi thứ nó được phép dùng qua props `bridge` — xem
         * packages/mini-sdk. Đó chính là ranh giới quyền, và nó chỉ có ý nghĩa
         * khi không có cửa sau nào qua Module Federation.
         */
        shared: SHARED_HOST,

        /**
         * Hai thứ này PHẢI tắt trên React Native.
         *
         * `dts` sinh khai báo TypeScript cho remote, `dev` cắm một plugin gợi ý
         * kiểu lúc chạy. Cả hai được viết cho web: plugin `dev` mở WebSocket
         * ngay khi runtime khởi động, trước khi React Native kịp cài polyfill
         * WebSocket. Kết quả là app chết lúc khởi động với
         * "[runtime not ready]: TypeError: undefined cannot be used as a
         * constructor" — một thông báo không hề nhắc tới Module Federation.
         */
        dts: false,
        dev: false,

        /**
         * Thay resolver-plugin mặc định bằng bản của mình, để gắn khoá xác minh
         * chữ ký cho từng mini-app. Xem src/mini/signedResolverPlugin.ts.
         *
         * Giữ lại core-plugin (nạp entry qua ScriptManager) và prefetch-plugin.
         */
        defaultRuntimePlugins: [
          '@callstack/repack/mf/prefetch-plugin',
          '@callstack/repack/mf/core-plugin',
        ],
        runtimePlugins: [
          new URL('./src/mini/signedResolverPlugin.ts', import.meta.url).pathname,
        ],
      }),
    ],

    /**
     * `@react-navigation/elements` `require()` một package tuỳ chọn bên trong
     * try/catch và tự xử lý khi không có. Không cài nó là hợp lệ, nhưng bundler
     * vẫn cảnh báo ở mỗi lần build.
     *
     * Bỏ qua ĐÚNG một cảnh báo đó, không dùng mẫu rộng: cảnh báo "Module not
     * found" khác đều là lỗi thật, và chúng chỉ có ích khi không bị chìm trong
     * tiếng ồn đã biết.
     */
    ignoreWarnings: [
      (warning) =>
        /Can't resolve '@react-native-masked-view\/masked-view'/.test(warning.message ?? ''),
    ],

    mode,
  };
});
