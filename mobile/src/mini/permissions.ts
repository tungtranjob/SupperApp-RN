import type { MiniAppError, MiniAppErrorCode, MiniAppUser } from '@supper/mini-sdk';

/**
 * LÕI CỦA RANH GIỚI QUYỀN — cố ý KHÔNG phụ thuộc React Native.
 *
 * Tách khỏi bridge.ts vì hai lý do:
 *
 *   1. Đây là mã quan trọng nhất về mặt an ninh trong toàn bộ hướng B. Nó xứng
 *      đáng được đọc và kiểm chứng độc lập, không lẫn với việc dựng giao diện.
 *   2. Không `import` gì từ 'react-native' nghĩa là chạy thẳng được trong Node —
 *      nên `tools/mini-bridge.test.mjs` kiểm được nó mà không cần simulator.
 *      Cơ chế bảo vệ nào không test được thì sớm muộn sẽ hỏng lặng lẽ.
 */

/**
 * Tập ĐÓNG các thao tác host chấp nhận uỷ quyền cho mini-app.
 *
 * VÌ SAO LÀ TÊN CHỨ KHÔNG PHẢI URL: nếu mini-app tự dựng URL thì danh sách
 * quyền thành vô nghĩa — chỉ cần đổi đường dẫn là thoát. Tên thao tác là tập
 * đóng do host định nghĩa; thêm một khả năng mới buộc phải sửa file này, tức là
 * buộc phải phát hành bản app mới, tức là phải đi qua thẩm định.
 */
export const OPERATIONS: Record<string, { method: string; path: string }> = {
  'home.summary': { method: 'GET', path: '/api/home/summary' },
  'insurance.quote': { method: 'POST', path: '/api/mini/insurance/quote' },
  'invest.portfolio': { method: 'GET', path: '/api/mini/invest/portfolio' },
};

export function miniError(code: MiniAppErrorCode, message: string, status?: number): MiniAppError {
  const err = new Error(message) as MiniAppError;
  err.name = 'MiniAppError';
  err.code = code;
  if (status !== undefined) err.status = status;
  return err;
}

/**
 * Quy một tên thao tác về lời gọi HTTP thật, SAU KHI kiểm quyền.
 *
 * Ném `MiniAppError` nếu không được phép. Không trả null — gọi hàm này nghĩa là
 * bạn sắp thực hiện một hành động thay mặt mã của bên thứ ba, và im lặng thất
 * bại ở đây là cách tốt nhất để một lỗ hổng đi vào production.
 */
export function resolveOperation(
  permissions: readonly string[],
  op: string,
): { method: string; path: string } {
  if (!permissions.includes(op)) {
    throw miniError('PERMISSION_DENIED', `Mini-app không được cấp quyền gọi '${op}'`);
  }
  const operation = OPERATIONS[op];
  if (!operation) {
    throw miniError('UNKNOWN_OPERATION', `Host không biết thao tác '${op}'`);
  }
  return operation;
}

/**
 * Lọc thông tin người dùng xuống mức mini-app được thấy.
 *
 * Viết ra tường minh TỪNG TRƯỜNG, thay vì loại bỏ vài trường khỏi object gốc.
 * Kiểu loại-bỏ sẽ rò rỉ ngay lần đầu ai đó thêm trường mới vào `AuthUser` —
 * lặng lẽ, và không ai để ý cho tới lúc quá muộn.
 */
export function publicUser(
  user: { name?: string; avatar?: string } | null | undefined,
): MiniAppUser {
  return {
    name: user?.name ?? 'Khách',
    avatar: user?.avatar,
  };
}
