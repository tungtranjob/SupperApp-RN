/**
 * NGUỒN SỰ THẬT DUY NHẤT cho `shared` của Module Federation.
 *
 * Host và MỌI mini-app phải import chính file này. Không chép tay.
 *
 * Vì sao quan trọng: `react` và `react-native` phải là SINGLETON — chỉ một bản
 * duy nhất tồn tại lúc chạy. Nếu host dùng react 19.2.3 còn mini-app kéo theo
 * react 19.2.4, Module Federation sẽ nạp CẢ HAI. Lúc đó component của mini-app
 * gọi hook trên bản React thứ hai, trong khi cây component thuộc bản thứ nhất →
 * "Invalid hook call" hoặc state mất sạch giữa chừng, với thông báo lỗi không
 * dính dáng gì tới nguyên nhân thật. Một file, không chép tay ba nơi.
 */

/**
 * Version phải khớp CHÍNH XÁC với mobile/package.json.
 *
 * Đổi bất kỳ dòng nào ở đây thì phải đổi mobile/package.json, tăng HOST_VERSION
 * trong mobile/src/config.ts, và build lại TẤT CẢ mini-app.
 * `tools/shared-deps.test.mjs` canh chuyện lệch version này.
 */
export const VERSIONS = {
  react: '19.2.3',
  'react-native': '0.86.3',
  '@react-navigation/native': '7.3.18',
  'react-native-safe-area-context': '5.7.0',
  'react-native-screens': '4.26.2',
};

/**
 * Dựng object `shared` cho một phía.
 *
 * `eager` KHÁC NHAU giữa host và mini-app, và đây là điểm dễ sai nhất:
 *
 *   HOST (eager: true)  — host `import` những package này ĐỒNG BỘ ngay ở
 *     App.tsx, trước khi có mini-app nào được nạp. Module Federation mặc định
 *     coi shared module là bất đồng bộ; import đồng bộ một shared module không
 *     eager sẽ chết lúc khởi động với "[ Federation Runtime ]: Invalid
 *     loadShareSync function call from runtime #RUNTIME-006" — thông báo không
 *     hề nói rằng vấn đề là thiếu một chữ `eager`.
 *
 *   MINI-APP (eager: false) — mini-app chỉ được nạp SAU khi host đã chạy, nên
 *     share scope đã sẵn sàng. Để eager ở đây là buộc mini-app nhét cả React và
 *     React Native vào bundle của nó: từ vài chục KB phình lên vài MB, và mất
 *     luôn ý nghĩa của việc chia sẻ.
 */
function makeShared({ eager }) {
  const entries = Object.entries(VERSIONS).map(([name, version]) => [
    name,
    {
      singleton: true,
      eager,
      /**
       * `version` phải khai TƯỜNG MINH cho các package có `exports` trỏ vào thư
       * mục con (`lib/module/`). Module Federation dò version bằng cách đọc
       * package.json cạnh file được resolve; thư mục con không có package.json
       * nên nó chịu, cảnh báo "No version specified and unable to automatically
       * determine one", rồi ÂM THẦM bỏ qua ràng buộc singleton.
       */
      version,
      requiredVersion: version,
    },
  ]);
  return Object.fromEntries(entries);
}

/** Dùng trong mobile/rspack.config.mjs. */
export const SHARED_HOST = makeShared({ eager: true });

/** Dùng trong mini-apps/ * /rspack.config.mjs. */
export const SHARED_MINI = makeShared({ eager: false });
