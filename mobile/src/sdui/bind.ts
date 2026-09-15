/**
 * Binding engine.
 *
 * Cố tình KHÔNG dùng eval / new Function:
 *   1. Hermes (JS engine của React Native) không hỗ trợ eval.
 *   2. Quan trọng hơn: layout đến từ server. Cho phép eval nghĩa là server
 *      (hoặc bất kỳ ai chiếm được server) chạy được code tuỳ ý trong app.
 * Vì vậy ta chỉ hỗ trợ một tập biểu thức nhỏ, an toàn, có thể đọc được:
 *      state.a.b      user.name      item.price      !state.loading
 *      state.total | currency
 */

export type BindContext = Record<string, any>;

const BINDING_RE = /\{\{([^}]+)\}\}/g;
const FULL_BINDING_RE = /^\s*\{\{([^}]+)\}\}\s*$/;

/* ------------------------------- filters -------------------------------- */

const vnd = (n: number) =>
  new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(n);

export const FILTERS: Record<string, (v: any, ctx: BindContext) => any> = {
  currency: (v) => (typeof v === 'number' ? vnd(v) : v ?? ''),
  signedCurrency: (v) => {
    if (typeof v !== 'number') return v ?? '';
    return `${v > 0 ? '+' : v < 0 ? '-' : ''}${vnd(Math.abs(v))}`;
  },
  number: (v) => (typeof v === 'number' ? new Intl.NumberFormat('vi-VN').format(v) : v ?? ''),
  upper: (v) => String(v ?? '').toUpperCase(),
  lower: (v) => String(v ?? '').toLowerCase(),
  date: (v) => (v ? new Date(v).toLocaleDateString('vi-VN') : ''),
  json: (v) => JSON.stringify(v),
  not: (v) => !v,
};

/* ------------------------------ path lookup ----------------------------- */

export function getPath(ctx: BindContext, path: string): any {
  const parts = path.split('.').map((s) => s.trim()).filter(Boolean);
  let cur: any = ctx;
  for (const part of parts) {
    if (cur == null) return undefined;
    cur = cur[part];
  }
  return cur;
}

export function setPath(target: Record<string, any>, path: string, value: any) {
  const parts = path.split('.').filter(Boolean);
  let cur = target;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i];
    if (typeof cur[k] !== 'object' || cur[k] === null) cur[k] = {};
    cur = cur[k];
  }
  cur[parts[parts.length - 1]] = value;
  return target;
}

/* ------------------------------ expressions ----------------------------- */

/** "state.total | currency" hoặc "!state.loading" → giá trị thật (giữ nguyên kiểu) */
export function evalExpr(expr: string, ctx: BindContext): any {
  let source = expr.trim();

  const pipes = source.split('|').map((s) => s.trim());
  source = pipes.shift() || '';

  let negate = false;
  while (source.startsWith('!')) {
    negate = !negate;
    source = source.slice(1).trim();
  }

  let value = getPath(ctx, source);
  for (const f of pipes) {
    const fn = FILTERS[f];
    if (fn) value = fn(value, ctx);
  }
  if (negate) value = !value;
  return value;
}

export function truthy(expr: string | undefined, ctx: BindContext): boolean {
  if (expr === undefined || expr === null || expr === '') return true;
  const v = evalExpr(expr, ctx);
  if (Array.isArray(v)) return v.length > 0;
  return Boolean(v);
}

/**
 * Áp binding lên bất kỳ giá trị nào (đệ quy qua object / array).
 * - "{{state.x}}"        → trả về GIÁ TRỊ GỐC (number/bool/object vẫn giữ kiểu)
 * - "Chào {{user.name}}" → nội suy thành chuỗi
 */
export function bind<T = any>(value: T, ctx: BindContext): T {
  if (typeof value === 'string') {
    const full = value.match(FULL_BINDING_RE);
    if (full) return evalExpr(full[1], ctx) as T;
    if (!value.includes('{{')) return value;
    return value.replace(BINDING_RE, (_m, expr) => {
      const v = evalExpr(expr, ctx);
      return v === undefined || v === null ? '' : String(v);
    }) as T;
  }
  if (Array.isArray(value)) return value.map((v) => bind(v, ctx)) as unknown as T;
  if (value && typeof value === 'object') {
    const out: Record<string, any> = {};
    for (const [k, v] of Object.entries(value as Record<string, any>)) out[k] = bind(v, ctx);
    return out as T;
  }
  return value;
}
