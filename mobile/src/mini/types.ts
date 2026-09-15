/**
 * Kiểu dữ liệu phía HOST cho hướng B.
 *
 * Khác với packages/mini-sdk (hợp đồng dùng chung với mini-app), file này là
 * chuyện nội bộ của app vỏ: hình dạng dữ liệu registry trả về và các lỗi nạp.
 * Mini-app không thấy gì ở đây.
 */

/** Một mini-app như registry mô tả. Xem backend/src/mini/store.js → resolve(). */
export type MiniAppDescriptor = {
  id: string;
  /** Tên container Module Federation, ví dụ 'miniInsurance'. */
  container: string;
  title: string;
  icon: string;
  version: string;
  minHostVersion: number;
  /** URL tuyệt đối tới mf-manifest.json của bản build này. */
  entry: string;
  /** TÊN khoá, không phải khoá. Tra trong trustStore.ts. */
  keyId: string;
  /** Các thao tác mini-app được phép gọi qua bridge. */
  permissions: string[];
  publishedAt: string;
};

export type MiniRegistry = {
  revision: string;
  channel: string;
  hostVersion: number;
  platform: string;
  apps: MiniAppDescriptor[];
  updatedAt: string;
};

/**
 * Vì sao mỗi lý do thất bại là một mã riêng, chứ không phải một Error chung:
 * bốn tình huống dưới đây cần BỐN cách xử lý khác nhau ở giao diện, và một
 * trong số đó (chữ ký sai) tuyệt đối không được thử lại.
 */
export type MiniLoadErrorCode =
  /** Registry không có mini-app này, hoặc nó chưa publish. */
  | 'NOT_FOUND'
  /** minHostVersion > HOST_VERSION. Người dùng cần cập nhật app. */
  | 'HOST_TOO_OLD'
  /** App này không biết keyId đó → không tin đội phát hành. */
  | 'UNTRUSTED_KEY'
  /** Chữ ký sai hoặc bundle bị sửa. KHÔNG BAO GIỜ thử lại. */
  | 'SIGNATURE_INVALID'
  /** Tải quá lâu hoặc lỗi mạng. Thử lại được. */
  | 'NETWORK'
  /** Bundle tải về nhưng ném lỗi lúc khởi tạo. Lỗi của mini-app. */
  | 'RUNTIME';

export class MiniLoadError extends Error {
  code: MiniLoadErrorCode;
  constructor(code: MiniLoadErrorCode, message: string) {
    super(message);
    this.name = 'MiniLoadError';
    this.code = code;
  }
}
