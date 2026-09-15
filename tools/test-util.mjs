/**
 * Bộ khung test tối giản dùng chung.
 *
 * Cùng phong cách với tools/sdui-bind.test.mjs đã có: không framework, không
 * phụ thuộc, chạy thẳng bằng `node`. Đủ cho một repo ví dụ, và quan trọng hơn —
 * ai đọc cũng chạy được ngay mà không phải cài gì.
 */
export function createRunner(title) {
  let pass = 0;
  let fail = 0;

  console.log(`\n── ${title} ──`);

  const eq = (name, actual, expected) => {
    const ok = JSON.stringify(actual) === JSON.stringify(expected);
    ok ? pass++ : fail++;
    console.log(
      `${ok ? '✓' : '✗'} ${name}` +
        (ok ? '' : `\n    got  = ${JSON.stringify(actual)}\n    want = ${JSON.stringify(expected)}`),
    );
  };

  const ok = (name, value) => eq(name, !!value, true);

  /** Khẳng định một hàm NÉM lỗi, và thông báo khớp mẫu. */
  const throws = (name, fn, pattern) => {
    let thrown = null;
    try { fn(); } catch (e) { thrown = e; }
    const matched = thrown && (!pattern || pattern.test(thrown.message));
    matched ? pass++ : fail++;
    console.log(
      `${matched ? '✓' : '✗'} ${name}` +
        (matched ? '' : `\n    ${thrown ? `ném: ${thrown.message}` : 'KHÔNG ném lỗi nào'}`),
    );
  };

  const throwsAsync = async (name, fn, pattern) => {
    let thrown = null;
    try { await fn(); } catch (e) { thrown = e; }
    const matched = thrown && (!pattern || pattern.test(thrown.message ?? '') || pattern.test(thrown.code ?? ''));
    matched ? pass++ : fail++;
    console.log(
      `${matched ? '✓' : '✗'} ${name}` +
        (matched ? '' : `\n    ${thrown ? `ném: ${thrown.code ?? ''} ${thrown.message}` : 'KHÔNG ném lỗi nào'}`),
    );
  };

  const done = () => {
    console.log(`${pass} pass, ${fail} fail`);
    if (fail) process.exitCode = 1;
    return fail;
  };

  return { eq, ok, throws, throwsAsync, done };
}
