import type { ScriptLocator } from '@callstack/repack/client';
import { publicKeyFor } from './trustStore';
import { MiniLoadError, type MiniAppDescriptor } from './types';

/**
 * Quyết định TẢI BUNDLE Ở ĐÂU VÀ XÁC MINH BẰNG KHOÁ NÀO.
 *
 * ScriptManager hỏi hàm này cho mỗi file nó sắp tải về. Câu trả lời gồm URL và
 * — phần quan trọng — chế độ xác minh chữ ký cùng khoá công khai để xác minh.
 *
 * KHÔNG CÓ NHÁNH __DEV__ Ở ĐÂY. CHỦ Ý.
 *
 * Cách làm phổ biến là tắt xác minh chữ ký trong dev cho tiện. Nhưng như thế là
 * đường code chạy hằng ngày KHÁC đường code chạy trên máy người dùng, và cái khác
 * nhau lại đúng là cơ chế bảo vệ. Lỗi cấu hình khoá sẽ chỉ lộ ra ở production.
 * Ở đây mini-app luôn được ký và luôn được xác minh, nên đường bảo mật được chạy
 * vài trăm lần mỗi ngày trong lúc phát triển.
 *
 * FILE NÀY KHÔNG ĐƯỢC IMPORT `react-native`, VÀ CŨNG KHÔNG ĐƯỢC IMPORT BẤT KỲ
 * MODULE SHARED NÀO.
 *
 * Nó nằm trong đồ thị phụ thuộc của một runtime plugin Module Federation, mà
 * runtime plugin chạy ở thời điểm SỚM NHẤT — trước khi share scope kịp khởi tạo.
 * Chỉ cần một dòng `import { Platform } from 'react-native'` ở đây là app chết
 * lúc khởi động với "factory is undefined
 * (webpack/sharing/consume/default/react-native/react-native)", một thông báo
 * không hề nhắc tới thứ tự khởi tạo.
 *
 * Cần biết platform? URL đã chứa sẵn: /mini/<id>/<version>/<platform>/…
 */

/**
 * Bản đồ từ TIỀN TỐ URL của một mini-app tới descriptor của nó.
 *
 * Vì sao theo tiền tố chứ không theo tên file: một mini-app gồm nhiều file —
 * manifest, container entry, và các chunk tách ra. ScriptManager hỏi lần lượt
 * từng file, và mọi file đều nằm dưới cùng một thư mục
 * `/mini/<id>/<version>/<platform>/`. Tiền tố đó nhận diện được cả bộ.
 */
const descriptorsByPrefix = new Map<string, MiniAppDescriptor>();

/** Bỏ phần tên file, giữ lại thư mục chứa. */
function directoryOf(url: string): string {
  return url.split('/').slice(0, -1).join('/');
}

/**
 * Ghi nhớ một mini-app trước khi nạp nó.
 *
 * Phải gọi TRƯỚC `registerRemotes` — nếu không, lúc ScriptManager hỏi khoá thì
 * không có câu trả lời và bundle bị từ chối.
 */
export function rememberDescriptor(desc: MiniAppDescriptor): void {
  descriptorsByPrefix.set(directoryOf(desc.entry), desc);
}

export function forgetAllDescriptors(): void {
  descriptorsByPrefix.clear();
}

/** Tìm mini-app sở hữu một URL. */
export function descriptorForUrl(url: string): MiniAppDescriptor | null {
  for (const [prefix, desc] of descriptorsByPrefix) {
    if (url.startsWith(prefix)) return desc;
  }
  return null;
}

/**
 * Dựng locator cho một URL mà Module Federation sắp tải.
 *
 * Ném `MiniLoadError` thay vì trả locator không có khoá. Trả locator thiếu khoá
 * sẽ khiến Re.Pack lặng lẽ quay về khoá mặc định nhúng trong app — và bundle của
 * một đội LẠ có thể qua được cửa. Thà chết ồn ào.
 */
export async function locatorForUrl(url: string): Promise<ScriptLocator> {
  const desc = descriptorForUrl(url);
  if (!desc) {
    throw new MiniLoadError(
      'UNTRUSTED_KEY',
      `Từ chối tải ${url}: không thuộc mini-app nào đã đăng ký`,
    );
  }

  const publicKey = publicKeyFor(desc.keyId);
  if (!publicKey) {
    throw new MiniLoadError(
      'UNTRUSTED_KEY',
      `Bản app này không tin đội phát hành '${desc.keyId}'. Cần cập nhật ứng dụng.`,
    );
  }

  return {
    url,
    verifyScriptSignature: 'strict',
    publicKey,
    // 10 giây rồi bỏ. Mini-app chậm không được làm treo app vỏ.
    timeout: 10_000,
    // Thử lại 2 lần cho lỗi MẠNG. Chữ ký sai không đi qua đường này —
    // nó hỏng ở bước xác minh sau khi tải xong, và không được thử lại.
    retry: 2,
    retryDelay: 1000,
  };
}
