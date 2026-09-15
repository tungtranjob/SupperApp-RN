import type { LinkingOptions } from '@react-navigation/native';

/**
 * DEEP LINK VÀO MINI-APP.
 *
 *     supperapp://mini/insurance
 *     supperapp://mini/invest
 *
 * Không phải tiện ích cho lập trình viên — đây là một trong những lý do chính
 * người ta xây super app: mã QR ở quầy mở thẳng mini-app thanh toán, thông báo
 * đẩy mở thẳng mini-app bảo hiểm, banner trong ứng dụng khác mở mini-app đầu tư.
 *
 * Chỉ khai đúng route `__mini`. Các route còn lại sinh từ manifest lúc chạy, mà
 * cấu hình linking của React Navigation thì tĩnh — nên deep link tới màn hình
 * SDUI đi qua `navigate` bên trong app thay vì qua URL.
 */
export const linking: LinkingOptions<any> = {
  prefixes: ['supperapp://'],
  config: {
    screens: {
      __mini: 'mini/:id',
    },
  },
};
