/**
 * Bản port của mobile/src/sdui/bind.ts sang web để dashboard preview được.
 *
 * Ở dự án thật bạn nên tách engine này thành một package dùng chung
 * (vd. packages/sdui-core) cho cả mobile lẫn dashboard — một nguồn sự thật duy nhất.
 */
const FULL = /^\s*\{\{([^}]+)\}\}\s*$/;
const ANY = /\{\{([^}]+)\}\}/g;

const vnd = (n) => new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND', maximumFractionDigits: 0 }).format(n);

const FILTERS = {
  currency: (v) => (typeof v === 'number' ? vnd(v) : v ?? ''),
  signedCurrency: (v) => (typeof v === 'number' ? `${v > 0 ? '+' : v < 0 ? '-' : ''}${vnd(Math.abs(v))}` : v ?? ''),
  number: (v) => (typeof v === 'number' ? new Intl.NumberFormat('vi-VN').format(v) : v ?? ''),
  upper: (v) => String(v ?? '').toUpperCase(),
  lower: (v) => String(v ?? '').toLowerCase(),
  date: (v) => (v ? new Date(v).toLocaleDateString('vi-VN') : ''),
  json: (v) => JSON.stringify(v),
  not: (v) => !v,
};

export function getPath(ctx, path) {
  let cur = ctx;
  for (const part of String(path).split('.').map((s) => s.trim()).filter(Boolean)) {
    if (cur == null) return undefined;
    cur = cur[part];
  }
  return cur;
}

export function evalExpr(expr, ctx) {
  const pipes = String(expr).split('|').map((s) => s.trim());
  let source = pipes.shift() || '';
  let negate = false;
  while (source.startsWith('!')) { negate = !negate; source = source.slice(1).trim(); }
  let value = getPath(ctx, source);
  for (const f of pipes) if (FILTERS[f]) value = FILTERS[f](value);
  return negate ? !value : value;
}

export function truthy(expr, ctx) {
  if (!expr) return true;
  const v = evalExpr(expr, ctx);
  return Array.isArray(v) ? v.length > 0 : Boolean(v);
}

export function bind(value, ctx) {
  if (typeof value === 'string') {
    const full = value.match(FULL);
    if (full) return evalExpr(full[1], ctx);
    if (!value.includes('{{')) return value;
    return value.replace(ANY, (_m, e) => {
      const v = evalExpr(e, ctx);
      return v === undefined || v === null ? '' : String(v);
    });
  }
  if (Array.isArray(value)) return value.map((v) => bind(v, ctx));
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[k] = bind(v, ctx);
    return out;
  }
  return value;
}
