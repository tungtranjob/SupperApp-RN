import Constants from 'expo-constants';

/**
 * Khi chạy Expo Go trên điện thoại thật, "localhost" là chính cái điện thoại đó → gọi API sẽ fail.
 * Expo cho biết IP LAN của máy dev qua `hostUri` (ví dụ "192.168.1.12:8081"),
 * ta lấy IP đó rồi ghép cổng backend 4000.
 */
function guessApiBase(): string {
  const hostUri =
    Constants.expoConfig?.hostUri ??
    (Constants as any).expoGoConfig?.debuggerHost ??
    '';
  const host = String(hostUri).split(':')[0];
  if (host) return `http://${host}:4000`;
  return 'http://localhost:4000';
}

/** Có thể ghi đè trong Dev Panel lúc chạy. */
export const DEFAULT_API_BASE = guessApiBase();

/**
 * Phiên bản DSL mà APP NÀY hiểu được.
 * Server gắn `minSdui` cho từng màn hình; nếu màn hình yêu cầu cao hơn app hiện tại,
 * app sẽ từ chối render và hiện thông báo "hãy cập nhật app" thay vì crash.
 * Đây là cách xử lý version skew của super app.
 */
export const SDUI_VERSION = 1;

/**
 * Phiên bản HỢP ĐỒNG HOST mà bản app này cung cấp cho mini-app (hướng B).
 *
 * Song song với SDUI_VERSION ở trên, nhưng cho một thứ khác: SDUI_VERSION nói
 * app hiểu được DSL đời nào; HOST_VERSION nói app cung cấp được bridge đời nào,
 * và có sẵn những native module nào.
 *
 * TĂNG SỐ NÀY KHI: thêm/xoá/đổi nghĩa một thao tác trong bridge, đổi version
 * trong shared-deps.mjs, hoặc thêm native module mà mini-app có thể cần.
 *
 * Mini-app khai `minHostVersion`. Server loại bỏ khỏi registry những mini-app
 * cần host mới hơn (lớp một), host chặn lại lần nữa lúc mở (lớp hai). Không có
 * cơ chế này thì mini-app mới gặp app cũ sẽ crash ở một chỗ ngẫu nhiên bên
 * trong mã của bên thứ ba — gần như không thể chẩn đoán từ log.
 */
export const HOST_VERSION = 1;

export const STORAGE_KEYS = {
  token: 'auth:token',
  user: 'auth:user',
  apiBase: 'dev:apiBase',
  channel: 'dev:channel',
  manifest: (channel: string) => `sdui:manifest:${channel}`,
  screen: (channel: string, route: string) => `sdui:screen:${channel}:${route}`,
  miniRegistry: (channel: string) => `mini:registry:${channel}`,
};

export type Channel = 'production' | 'draft';
