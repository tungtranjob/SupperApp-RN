/**
 * Xác minh chữ ký bundle theo đúng định dạng của Re.Pack.
 *
 * ĐỊNH DẠNG (đọc từ CodeSigningPlugin của @callstack/repack):
 *
 *     <nội dung bundle><"/* RCSSB *\/"><JWT RS256>
 *
 * JWT có payload `{ hash }` với `hash` là SHA-256 (hex) của phần nội dung.
 * Toàn bộ đuôi chữ ký được đệm cho đủ 1280 byte.
 *
 * VÌ SAO SERVER CŨNG PHẢI KIỂM
 *
 * Việc xác minh thật sự diễn ra trên máy người dùng, ở tầng native. Server kiểm
 * lại không phải để thay thế điều đó — mà để bắt lỗi SỚM. Không có bước này, một
 * bundle quên ký hoặc ký nhầm khoá vẫn publish trót lọt, rồi chết trên máy thật
 * của toàn bộ người dùng với thông báo "Bản cài đặt không hợp lệ". Chặn lúc
 * publish thì người phải sửa là người vừa gây ra lỗi, ngay lúc họ còn nhớ.
 */
import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';

/** Dấu mở phần chữ ký. Alias của "Repack Code-Signing Signature Begin". */
const BEGIN_MARK = '/* RCSSB */';

export class SignatureError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SignatureError';
  }
}

/**
 * Tách một bundle đã ký thành phần nội dung và token.
 * Ném `SignatureError` nếu không tìm thấy dấu mở.
 */
export function splitSignedBundle(buffer) {
  const markIndex = buffer.lastIndexOf(BEGIN_MARK);
  if (markIndex === -1) {
    throw new SignatureError('Bundle chưa được ký (không thấy dấu /* RCSSB */)');
  }
  return {
    content: buffer.subarray(0, markIndex),
    // Cắt bỏ phần đệm NUL ở đuôi — plugin đệm cho đủ 1280 byte.
    token: buffer.subarray(markIndex + BEGIN_MARK.length).toString('utf8').replace(/\0+$/, ''),
  };
}

/**
 * Kiểm bundle đã ký bằng đúng khoá công khai cho trước và nội dung chưa bị sửa.
 *
 * Ném `SignatureError` kèm lý do cụ thể. Không trả false — gọi đến hàm này nghĩa
 * là bạn cần biết VÌ SAO nó hỏng.
 */
export function verifySignedBundle(buffer, publicKeyPem) {
  const { content, token } = splitSignedBundle(buffer);

  let payload;
  try {
    payload = jwt.verify(token, publicKeyPem, { algorithms: ['RS256'] });
  } catch (err) {
    throw new SignatureError(`Chữ ký không hợp lệ với khoá đã khai: ${err.message}`);
  }

  const actualHash = crypto.createHash('sha256').update(content).digest('hex');
  if (payload.hash !== actualHash) {
    throw new SignatureError(
      'Nội dung bundle không khớp chữ ký — file đã bị sửa sau khi ký',
    );
  }

  return { hash: actualHash };
}
