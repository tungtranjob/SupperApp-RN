/**
 * HỢP ĐỒNG GIỮA APP VỎ VÀ MINI-APP
 *
 * File này CHỈ CHỨA KIỂU. Biên dịch xong không còn gì lúc chạy.
 *
 * Đó là chủ ý, không phải tình cờ. Mini-app là mã của người khác chạy trong app
 * của bạn. Nếu nó `import` được mã thật từ host, ranh giới quyền lập tức thủng:
 * hôm nay import một hàm tiện ích, ngày mai import `apiClient` rồi tự gọi backend
 * với token của người dùng. Kiểu thì không mang theo được gì.
 *
 * Mọi khả năng mini-app có đều đi qua đúng một cửa: object `bridge` mà host TRUYỀN
 * VÀO qua props. Host quyết định cửa đó mở tới đâu, và kiểm tra ở mỗi lần gọi.
 */

/**
 * Thông tin người dùng mà mini-app được thấy.
 *
 * Cố ý nghèo nàn. KHÔNG có token, KHÔNG có email, KHÔNG có id nội bộ. Mini-app
 * cần chào tên người dùng thì đủ; cần gì hơn thì phải xin qua `request` và bị
 * kiểm quyền.
 */
export interface MiniAppUser {
  name: string;
  avatar?: string;
}

/**
 * Bảng màu của app vỏ, truyền xuống để mini-app trông liền mạch với phần còn lại.
 * Mini-app không bắt buộc dùng.
 */
export interface MiniAppTheme {
  brand: string;
  bg: string;
  card: string;
  text: string;
  muted: string;
  border: string;
  danger: string;
  success: string;
}

/** Mã lỗi mà `bridge.request` có thể ném. */
export type MiniAppErrorCode =
  /** `op` không nằm trong `permissions` của mini-app này. Host đã chặn. */
  | 'PERMISSION_DENIED'
  /** `op` không có trong bảng ánh xạ của host. Sai tên, hoặc host quá cũ. */
  | 'UNKNOWN_OPERATION'
  /** Backend trả lỗi. `status` cho biết mã HTTP. */
  | 'REQUEST_FAILED'
  /** Người dùng chưa đăng nhập mà `op` lại cần. */
  | 'UNAUTHENTICATED';

/**
 * Hình dạng lỗi mà `bridge.request` ném ra.
 *
 * Khai bằng interface chứ không phải class có thật, để giữ nguyên tắc "không mã
 * chạy" ở trên. Bên mini-app kiểm bằng `code`:
 *
 *     try { await bridge.request('insurance.quote', body); }
 *     catch (e) {
 *       if ((e as MiniAppError).code === 'PERMISSION_DENIED') { ... }
 *     }
 */
export interface MiniAppError extends Error {
  code: MiniAppErrorCode;
  status?: number;
}

/**
 * Toàn bộ những gì mini-app có thể làm với thế giới bên ngoài.
 *
 * Chú ý những thứ KHÔNG có ở đây: không `fetch`, không địa chỉ backend, không
 * kho lưu trữ, không token. Mini-app không biết backend nằm ở đâu.
 */
export interface HostBridge {
  /**
   * Gọi một thao tác nghiệp vụ THEO TÊN, không phải theo URL.
   *
   * Host tra `op` trong danh sách `permissions` của mini-app (do registry khai,
   * không phải do mini-app khai), ánh xạ sang lời gọi HTTP thật, và tự gắn token.
   *
   * Vì sao theo tên chứ không theo URL: nếu mini-app tự dựng URL thì danh sách
   * quyền thành vô nghĩa — chỉ cần đổi đường dẫn là thoát. Tên thao tác là một
   * tập đóng do host định nghĩa.
   *
   * Ném `MiniAppError` khi bị chặn hoặc khi backend lỗi.
   */
  request<T = unknown>(op: string, payload?: unknown): Promise<T>;

  /** Rời mini-app. `'back'` quay lại màn trước, `'home'` về trang chủ app vỏ. */
  navigate(to: 'back' | 'home'): void;

  /** Hiện thông báo ngắn bằng giao diện của app vỏ. */
  toast(message: string): void;

  /** Người dùng đang đăng nhập, đã lọc. */
  readonly user: MiniAppUser;

  /** Bảng màu của app vỏ. */
  readonly theme: MiniAppTheme;
}

/**
 * Props mà app vỏ truyền vào component gốc của mini-app.
 *
 * Mini-app expose đúng một module `./App`, default export là component nhận
 * props này.
 */
export interface MiniAppProps {
  bridge: HostBridge;
  /** Tham số điều hướng, ví dụ `{ plan: 'basic' }`. */
  params: Record<string, unknown>;
}
