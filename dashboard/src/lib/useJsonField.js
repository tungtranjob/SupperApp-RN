import { useCallback, useEffect, useState } from 'react';

/**
 * Textarea JSON có validate: giữ text thô để gõ thoải mái, chỉ parse khi hợp lệ.
 *
 * CHÚ Ý dependency: nơi gọi thường viết `useJsonField(screen?.draft?.onLoad ?? [])`,
 * tức là truyền vào một object/mảng MỚI sau mỗi lần render. Nếu đặt trực tiếp
 * `initialValue` vào mảng dependency của useEffect thì effect chạy mỗi render →
 * setValue(tham chiếu mới) → render lại → VÒNG LẶP VÔ HẠN treo trình duyệt.
 * Vì vậy dependency phải là CHUỖI đã serialize (so sánh theo giá trị).
 */
export function useJsonField(initialValue) {
  const serialized = JSON.stringify(initialValue ?? null, null, 2);

  const [text, setText] = useState(serialized);
  const [value, setValue] = useState(() => initialValue ?? null);
  const [error, setError] = useState(null);

  useEffect(() => {
    setText(serialized);
    setValue(JSON.parse(serialized));
    setError(null);
  }, [serialized]);

  const onChange = useCallback((next) => {
    setText(next);
    try {
      setValue(JSON.parse(next));
      setError(null);
    } catch (e) {
      setError(e.message);
    }
  }, []);

  const format = useCallback(() => {
    try { setText(JSON.stringify(JSON.parse(text), null, 2)); } catch { /* JSON chưa hợp lệ, bỏ qua */ }
  }, [text]);

  return { text, value, error, onChange, format, valid: !error };
}
