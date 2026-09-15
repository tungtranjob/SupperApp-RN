import ResolverPlugin from '@callstack/repack/mf/resolver-plugin';
import { locatorForUrl } from './scriptLocator';

/**
 * Runtime plugin của Module Federation: nối bước GIẢI URL của Re.Pack với bước
 * XÁC MINH CHỮ KÝ của chúng ta.
 *
 * Re.Pack có sẵn `@callstack/repack/mf/resolver-plugin` lo phần khó — tính URL
 * thật của từng chunk từ URL manifest của remote (rebase public path). Nó nhận
 * một hàm config để quyết định phần còn lại của locator. Chúng ta cắm khoá ký
 * vào đúng chỗ đó.
 *
 * Vì sao bọc lại thay vì tự viết resolver: logic rebase URL là thứ tinh vi và
 * gắn chặt với cách Re.Pack đặt tên chunk. Chép nó ra đây nghĩa là nhận nợ bảo
 * trì một bản sao sẽ lệch ở lần nâng cấp Re.Pack kế tiếp.
 *
 * Plugin này thay thế resolver-plugin mặc định — xem `defaultRuntimePlugins`
 * trong rspack.config.mjs.
 */
export default function repackSignedResolverPlugin() {
  return ResolverPlugin(async (entryUrl: string) => locatorForUrl(entryUrl));
}
