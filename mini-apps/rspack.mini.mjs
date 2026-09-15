import * as Repack from '@callstack/repack';

import { SHARED_MINI } from '../shared-deps.mjs';

/**
 * Cấu hình build DÙNG CHUNG cho mọi mini-app.
 *
 * Mỗi mini-app chỉ khai id, tên container và khoá ký; mọi thứ còn lại giống hệt
 * nhau. Để mỗi mini-app tự chép một bản config là đảm bảo chúng sẽ lệch nhau —
 * và kiểu lệch nguy hiểm nhất là lệch `shared`, thứ chỉ lộ ra lúc chạy trên máy
 * thật dưới dạng "Invalid hook call".
 */

const FLOW_TYPED_MODULES = [
  'react-native',
  '@react-native',
  'react-native-safe-area-context',
  'react-native-screens',
];

/**
 * @param {object} options
 * @param {string} options.container  tên container Module Federation, vd 'miniInsurance'
 * @param {string} options.keyId      tên khoá ký, vd 'team-insurance'
 * @param {string} options.dirname    thư mục gốc của mini-app
 */
export function defineMiniAppConfig({ container, keyId, dirname }) {
  return Repack.defineRspackConfig((env) => {
    const { mode } = env;

    return {
      context: dirname,

      /**
       * Entry này gần như rỗng và KHÔNG BAO GIỜ được app vỏ tải.
       *
       * Thứ app vỏ tải là CONTAINER — một chunk riêng do Module Federation sinh
       * ra, khai báo ở `filename` bên dưới. Nhưng React Native CLI vẫn đòi một
       * entry, nên phải có. Xem src/index.ts để biết vì sao nó rỗng.
       */
      entry: { [container]: './src/index.ts' },

      output: {
        // Tên khác `index.bundle` mặc định của Re.Pack, và khác tên file
        // container bên dưới. Cùng tên là build hỏng với
        // "Conflict: Multiple assets emit different content to the same filename".
        filename: `${container}.bundle`,
        chunkFilename: '[name].chunk.bundle',
        uniqueName: container,
      },

      resolve: {
        // Bắt buộc, cùng lý do như ở host — xem mobile/rspack.config.mjs.
        ...Repack.getResolveOptions({ enablePackageExports: true }),
      },

      module: {
        // Giống hệt host. Thứ tự (swc khai trước nên chạy sau; preset RN khai
        // sau nên chạy trước) được giải thích đầy đủ ở mobile/rspack.config.mjs.
        rules: [
          ...Repack.getJsTransformRules({
            flow: { enabled: false },
            codegen: { enabled: false },
          }),
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

        new Repack.plugins.ModuleFederationPluginV2({
          name: container,

          /**
           * Mini-app phơi ĐÚNG MỘT module.
           *
           * Đây là toàn bộ bề mặt tiếp xúc của nó với app vỏ: một component gốc
           * nhận `MiniAppProps`. Phơi nhiều module hơn nghĩa là app vỏ phải biết
           * về cấu trúc bên trong mini-app, và hợp đồng hết là hợp đồng.
           */
          exposes: { './App': './src/App.tsx' },

          filename: `${container}.container.bundle`,

          shared: SHARED_MINI,

          // Xem mobile/rspack.config.mjs: plugin `dev` của MF mở WebSocket
          // trước khi React Native kịp cài polyfill.
          dts: false,
          dev: false,
        }),

        /**
         * KÝ BUNDLE.
         *
         * Ký ở MỌI chế độ, kể cả development. Cách làm phổ biến là
         * `enabled: mode === 'production'`, nhưng như thế thì đường code chạy
         * hằng ngày khác đường code chạy trên máy người dùng, và cái khác nhau
         * lại đúng là cơ chế bảo vệ. Lỗi cấu hình khoá sẽ chỉ lộ ra ở production.
         *
         * Không dùng `nativeProjectPaths`: khoá công không được nhúng vào
         * Info.plist. App vỏ tra khoá theo `keyId` trong trust store của nó —
         * xem mobile/src/mini/trustStore.ts và tools/keys-sync.mjs.
         */
        new Repack.plugins.CodeSigningPlugin({
          enabled: true,
          privateKeyPath: `../../keys/${keyId}.pem`,
        }),
      ],

      mode,
    };
  });
}
