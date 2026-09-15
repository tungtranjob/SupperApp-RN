import AsyncStorage from '@react-native-async-storage/async-storage';
import { ScriptManager } from '@callstack/repack/client';

/**
 * Cấu hình ScriptManager — lớp native tải và THỰC THI bundle mini-app.
 *
 * Gọi một lần lúc app khởi động, trước khi render.
 *
 * Đây cũng là nơi giải quyết một vấn đề khó chịu: KHI CHỮ KÝ SAI, THÔNG ĐIỆP
 * THẬT BỊ MẤT TRÊN ĐƯỜNG ĐI.
 *
 * Tầng native từ chối bundle bị sửa với thông điệp rất rõ ("The bundle
 * verification failed because the bundle hash is invalid"), nhưng nó dùng chung
 * mã lỗi `ScriptDownloadFailure` với lỗi mạng. Tệ hơn, Module Federation bọc lại
 * thành "Loading chunk __federation_expose_App failed." và nuốt mất nguyên nhân.
 *
 * Nếu tin vào thông điệp đã bị bọc, ta sẽ xếp "bundle bị tráo" chung nhóm với
 * "mạng chập chờn", rồi hiện nút "Thử lại" cho người dùng — tức là mời họ tải
 * lại đúng cái bundle có thể đã bị chèn mã. Nên ta bắt lỗi GỐC ngay tại nguồn.
 */

export type ScriptFailure = {
  scriptId?: string;
  code?: string;
  message: string;
};

let lastFailure: ScriptFailure | null = null;

/**
 * Những thông điệp mà `CodeSigningErrors.swift` / bản Android tương ứng sinh ra.
 * Lỗi mạng không bao giờ nhắc tới token, public key hay "verification".
 */
const SIGNATURE_HINT = /verification|token|public\s?key/i;

export function initScriptManager(): void {
  /**
   * Cache bundle đã tải, trên đĩa.
   *
   * Hai hệ quả, cả hai đều mong muốn:
   *   - Mở mini-app lần thứ hai là tức thì, và MỞ ĐƯỢC KHI OFFLINE.
   *   - Bản đã cache là bản ĐÃ QUA XÁC MINH. Kẻ tráo file trên server sau đó
   *     không chạm được tới thiết bị đã cache — tới khi có version mới, mà
   *     version mới thì URL khác nên lại phải qua xác minh.
   */
  ScriptManager.shared.setStorage(AsyncStorage);

  ScriptManager.shared.on('error', (event: any) => {
    const original = event?.originalError;
    // args[1] chứa { scriptId, caller, locator } — xem handleError trong Re.Pack.
    const detail = Array.isArray(event?.args)
      ? event.args.find((a: any) => a && typeof a === 'object' && 'scriptId' in a)
      : undefined;

    lastFailure = {
      scriptId: detail?.scriptId,
      code: original?.code,
      message: String(original?.message ?? event?.message ?? ''),
    };
  });
}

/**
 * Lấy VÀ XOÁ lỗi gần nhất từ tầng native.
 *
 * Xoá luôn là cố ý: một lỗi chỉ được quy trách nhiệm cho đúng một lần nạp. Giữ
 * lại sẽ khiến lần nạp sau — có thể của mini-app khác — bị gán nhầm nguyên nhân.
 */
export function takeLastScriptFailure(): ScriptFailure | null {
  const failure = lastFailure;
  lastFailure = null;
  return failure;
}

/** Lỗi này có phải do xác minh chữ ký thất bại không? */
export function isSignatureFailure(failure: ScriptFailure | null): boolean {
  return !!failure && SIGNATURE_HINT.test(failure.message);
}
