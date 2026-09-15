import { Alert } from 'react-native';
import type { HostBridge } from '@supper/mini-sdk';
import { request, ApiError } from '../api/client';
import { theme } from '../sdui/theme';
import type { AuthUser } from '../store/auth';
import { miniError, publicUser, resolveOperation } from './permissions';
import type { MiniAppDescriptor } from './types';

/**
 * RANH GIỚI QUYỀN — hiện thực phía host của `HostBridge`.
 *
 * Mini-app không biết backend nằm ở đâu và không giữ token. Nó chỉ gọi được các
 * THAO TÁC CÓ TÊN, và chỉ những tên nằm trong `permissions` mà registry cấp cho
 * chính nó. Phần quyết định đó nằm ở ./permissions.ts — tách riêng để test được
 * bằng Node, không cần simulator.
 */

export type BridgeDeps = {
  desc: MiniAppDescriptor;
  user: AuthUser | null;
  goBack: () => void;
  goHome: () => void;
};

export function createBridge({ desc, user, goBack, goHome }: BridgeDeps): HostBridge {
  return {
    user: publicUser(user),

    theme: {
      brand: theme.brand,
      bg: theme.bg,
      card: theme.surface,
      text: theme.text,
      muted: theme.muted,
      border: theme.border,
      danger: theme.danger,
      success: theme.success,
    },

    async request<T = unknown>(op: string, payload?: unknown): Promise<T> {
      /**
       * KIỂM QUYỀN MỖI LẦN GỌI, không phải một lần lúc nạp.
       *
       * Kiểm một lần rồi trao cho mini-app một đối tượng "đã mở khoá" nghĩa là
       * quyền bị đóng băng ở thời điểm nạp. Ở đây `desc.permissions` được đọc
       * lại mỗi lần, nên thu hồi quyền trên registry có hiệu lực ngay ở lần gọi
       * kế tiếp, không phải chờ người dùng khởi động lại app.
       */
      const operation = resolveOperation(desc.permissions, op);

      try {
        // `request` của host tự gắn Authorization. Token không bao giờ đi qua
        // tay mini-app.
        return await request<T>(operation.path, {
          method: operation.method,
          body: operation.method === 'GET' ? undefined : (payload ?? {}),
        });
      } catch (e) {
        if (e instanceof ApiError) {
          throw miniError(
            e.status === 401 ? 'UNAUTHENTICATED' : 'REQUEST_FAILED',
            e.message,
            e.status,
          );
        }
        throw miniError('REQUEST_FAILED', (e as Error)?.message ?? 'Lỗi không xác định');
      }
    },

    navigate(to) {
      if (to === 'home') goHome();
      else goBack();
    },

    toast(message) {
      // Dùng giao diện của app vỏ. Mini-app không tự dựng được overlay toàn màn
      // hình vì nó bị bọc trong một <View> của host.
      Alert.alert(desc.title, String(message));
    },
  };
}
