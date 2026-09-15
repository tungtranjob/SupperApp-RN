import type { ComponentType } from 'react';
import { registerRemotes, loadRemote } from '@module-federation/runtime';
import type { MiniAppProps } from '@supper/mini-sdk';
import { HOST_VERSION } from '../config';
import { rememberDescriptor } from './scriptLocator';
import { isSignatureFailure, takeLastScriptFailure } from './scriptManager';
import { MiniLoadError, type MiniAppDescriptor } from './types';

/**
 * NẠP MỘT MINI-APP.
 *
 * Đây là nơi hướng B thực sự xảy ra: một bundle React Native chưa từng có trong
 * bản build đang chạy được tải về, xác minh chữ ký ở TẦNG NATIVE, rồi thực thi
 * trong cùng JS context — không đi qua `eval` một lần nào, nên Hermes chấp nhận.
 */

/** 10 giây. Mini-app chậm không được quyền làm treo app vỏ. */
const LOAD_TIMEOUT_MS = 10_000;

/**
 * Những container đã đăng ký trong phiên này.
 *
 * `registerRemotes` không idempotent theo cách mình cần: gọi lại với cùng tên sẽ
 * in cảnh báo, và nếu URL đổi (do rollback sang version khác) mà không đặt
 * `force` thì bản cũ vẫn được dùng. Tự theo dõi ở đây để biết khi nào cần `force`.
 */
const registered = new Map<string, string>();

function timeoutAfter(ms: number): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(
      () => reject(new MiniLoadError('NETWORK', `Quá ${ms / 1000}s mà chưa tải xong mini-app`)),
      ms,
    );
  });
}

/**
 * Trả về component gốc của mini-app, sẵn sàng render.
 *
 * Ném `MiniLoadError` với mã cụ thể — mỗi mã ứng với một màn hình lỗi khác nhau
 * ở MiniAppScreen. Đặc biệt `SIGNATURE_INVALID` KHÔNG BAO GIỜ được thử lại.
 */
export async function loadMiniApp(
  desc: MiniAppDescriptor,
): Promise<ComponentType<MiniAppProps>> {
  /**
   * Cổng phiên bản, lớp thứ hai.
   *
   * Server đã lọc mini-app cần host mới hơn ra khỏi registry. Kiểm lại ở đây vì
   * registry có thể đến từ CACHE — được ghi lúc app còn là bản cũ hơn hoặc mới
   * hơn — và vì một cơ chế bảo vệ chỉ tồn tại ở một phía là một cơ chế bảo vệ
   * sẽ hỏng lặng lẽ.
   */
  if (desc.minHostVersion > HOST_VERSION) {
    throw new MiniLoadError(
      'HOST_TOO_OLD',
      `${desc.title} cần phiên bản ứng dụng mới hơn (cần v${desc.minHostVersion}, đang chạy v${HOST_VERSION}).`,
    );
  }

  // Phải nhớ TRƯỚC khi đăng ký: ScriptManager sẽ hỏi khoá ký ngay khi bắt đầu tải.
  rememberDescriptor(desc);

  const previousEntry = registered.get(desc.container);
  if (previousEntry !== desc.entry) {
    registerRemotes(
      [{ name: desc.container, entry: desc.entry, alias: desc.container }],
      // `force` khi URL đổi — đúng tình huống publish version mới hoặc rollback.
      { force: previousEntry !== undefined },
    );
    registered.set(desc.container, desc.entry);
  }

  try {
    const mod = await Promise.race([
      loadRemote<{ default: ComponentType<MiniAppProps> }>(`${desc.container}/App`),
      timeoutAfter(LOAD_TIMEOUT_MS),
    ]);

    const Component = mod?.default;
    if (typeof Component !== 'function') {
      throw new MiniLoadError(
        'RUNTIME',
        `${desc.title} không export default một component từ './App'`,
      );
    }
    return Component;
  } catch (err) {
    throw toMiniLoadError(err, desc);
  }
}

/**
 * Quy lỗi thô về một mã xử lý được.
 *
 * KHÔNG tin vào thông điệp của lỗi ném ra. Module Federation bọc mọi thất bại
 * lúc nạp thành "Loading chunk <tên> failed." và nuốt mất nguyên nhân — kể cả
 * khi nguyên nhân là CHỮ KÝ SAI. Thay vào đó, hỏi ScriptManager về lỗi GỐC mà
 * tầng native vừa báo (xem ./scriptManager.ts).
 *
 * Phân biệt này không phải chuyện thẩm mỹ: nhầm "bundle bị tráo" thành "mạng
 * chập chờn" nghĩa là hiện nút "Thử lại", tức là mời người dùng tải lại đúng
 * cái bundle có thể đã bị chèn mã.
 */
function toMiniLoadError(err: unknown, desc: MiniAppDescriptor): MiniLoadError {
  if (err instanceof MiniLoadError) return err;

  const native = takeLastScriptFailure();

  if (isSignatureFailure(native)) {
    return new MiniLoadError(
      'SIGNATURE_INVALID',
      `Bản cài đặt của ${desc.title} không hợp lệ và đã bị từ chối. ` +
        'Hãy liên hệ bộ phận hỗ trợ.',
    );
  }

  const message = native?.message ?? (err instanceof Error ? err.message : String(err));

  if (/network|fetch|timeout|connect|ECONN|offline|Unable to load script|ScriptDownloadFailure/i.test(
      `${native?.code ?? ''} ${message}`,
    )) {
    return new MiniLoadError('NETWORK', `Không tải được ${desc.title}: ${message}`);
  }
  return new MiniLoadError('RUNTIME', `${desc.title} gặp lỗi khi khởi động: ${message}`);
}
