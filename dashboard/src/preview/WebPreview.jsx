import React from 'react';
import { bind, evalExpr, truthy } from '../lib/bind';

/**
 * Bản dựng lại registry của app mobile bằng HTML/CSS để xem trước ngay trong dashboard.
 * Không pixel-perfect, nhưng đủ để kiểm tra cấu trúc + binding trước khi publish.
 */

const T = {
  brand: '#a50064', bg: '#f4f4f7', surface: '#fff',
  text: '#1c2024', muted: '#60646c', border: '#e4e4e9',
  danger: '#e5484d', success: '#30a46c',
};

const px = (v) => (typeof v === 'number' ? `${v}px` : v);

const boxStyle = (p) => ({
  background: p.background,
  padding: px(p.padding),
  paddingTop: px(p.paddingTop),
  paddingBottom: px(p.paddingBottom),
  margin: px(p.margin),
  marginTop: px(p.marginTop),
  marginBottom: px(p.marginBottom),
  borderRadius: px(p.radius),
  borderBottomLeftRadius: px(p.radiusBottom),
  borderBottomRightRadius: px(p.radiusBottom),
  flex: p.flex,
  gap: px(p.gap),
  alignItems: p.align === 'center' ? 'center' : p.align === 'end' ? 'flex-end' : undefined,
  width: px(p.width),
  height: px(p.height),
  display: 'flex',
  flexDirection: 'column',
});

const textStyle = (p) => ({
  color: p.color ?? T.text,
  fontSize: px(p.size ?? 14),
  fontWeight: p.weight,
  textAlign: p.align,
  margin: 0,
});

const COMPONENTS = {
  Screen: ({ p, children }) => (
    <div style={{ background: p.background ?? T.bg, minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: px(p.padding), display: 'flex', flexDirection: 'column', flex: 1 }}>{children}</div>
    </div>
  ),
  View: ({ p, children }) => <div style={boxStyle(p)}>{children}</div>,
  Column: ({ p, children }) => <div style={boxStyle(p)}>{children}</div>,
  Row: ({ p, children }) => <div style={{ ...boxStyle(p), flexDirection: 'row', alignItems: 'center' }}>{children}</div>,
  Card: ({ p, children }) => (
    <div style={{ ...boxStyle(p), background: T.surface, borderRadius: 14, padding: px(p.padding ?? 16) }}>{children}</div>
  ),
  Grid: ({ p, children }) => (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${p.columns ?? 4}, 1fr)`, rowGap: 12 }}>{children}</div>
  ),
  Text: ({ p }) => <p style={textStyle(p)}>{p.text ?? ''}</p>,
  Heading: ({ p }) => <p style={{ ...textStyle({ ...p, size: p.size ?? 24, weight: p.weight ?? 700 }) }}>{p.text ?? ''}</p>,
  Caption: ({ p }) => <p style={textStyle({ ...p, size: p.size ?? 13, color: p.color ?? T.muted })}>{p.text ?? ''}</p>,
  Spacer: ({ p }) => <div style={{ height: px(p.size ?? 12), flexShrink: 0 }} />,
  Divider: ({ p }) => <div style={{ height: 1, background: p.color ?? T.border, margin: '4px 0' }} />,
  Banner: ({ p }) => {
    const tones = { info: ['#eaf2fb', '#0d7ee0'], danger: ['#fdeced', T.danger], success: ['#e9f7ef', T.success], warning: ['#fdf3e7', '#f0870a'] };
    const [bg, fg] = tones[p.tone ?? 'info'] ?? tones.info;
    return <div style={{ background: bg, color: fg, borderRadius: 10, padding: 12, fontSize: 13 }}>{p.text}</div>;
  },
  Input: ({ p }) => (
    <div style={{ marginBottom: 14 }}>
      {p.label && <div style={{ fontSize: 12, color: T.muted, fontWeight: 600, marginBottom: 6 }}>{p.label}</div>}
      <div style={{ border: `1px solid ${T.border}`, borderRadius: 10, padding: '12px 14px', background: '#fff', fontSize: 15, color: p.value ? T.text : '#9a9aa2' }}>
        {p.secure && p.value ? '••••••' : p.value || p.placeholder || ''}
      </div>
    </div>
  ),
  Button: ({ p }) => {
    const v = p.variant ?? 'primary';
    const styles = {
      primary: { background: T.brand, color: '#fff', border: 'none' },
      secondary: { background: '#fff', color: T.text, border: `1px solid ${T.border}` },
      danger: { background: '#fdeced', color: T.danger, border: '1px solid #f5c3c5' },
    }[v];
    return <div style={{ ...styles, borderRadius: 12, padding: '14px 0', textAlign: 'center', fontWeight: 700, fontSize: 15 }}>{p.loading ? '…' : p.title}</div>;
  },
  Image: ({ p }) => <img src={p.uri} alt="" style={{ width: '100%', height: px(p.height ?? 160), objectFit: 'cover', borderRadius: px(p.radius ?? 8) }} />,
  Avatar: ({ p }) => {
    const s = p.size ?? 44;
    return <div style={{ width: s, height: s, borderRadius: s, background: p.background ?? 'rgba(255,255,255,0.22)', display: 'grid', placeItems: 'center', fontSize: s * 0.5, flexShrink: 0 }}>{p.emoji ?? '🙂'}</div>;
  },
  Badge: ({ p }) => <span style={{ background: p.background ?? 'rgba(255,255,255,0.22)', color: p.color ?? '#fff', padding: '4px 10px', borderRadius: 999, fontSize: 12, fontWeight: 600 }}>{p.text}</span>,
  ServiceIcon: ({ p }) => (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <div style={{ width: 46, height: 46, borderRadius: 14, background: (p.color ?? T.brand) + '1A', display: 'grid', placeItems: 'center', fontSize: 22 }}>{p.emoji}</div>
      <div style={{ fontSize: 11, color: T.muted, textAlign: 'center', marginTop: 6 }}>{p.label}</div>
    </div>
  ),
  ListItem: ({ p }) => (
    <div style={{ display: 'flex', alignItems: 'center', padding: '12px 0' }}>
      {p.emoji && <div style={{ width: 38, height: 38, borderRadius: 19, background: T.bg, display: 'grid', placeItems: 'center', marginRight: 12, fontSize: 18 }}>{p.emoji}</div>}
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 500 }}>{p.title}</div>
        {p.subtitle && <div style={{ fontSize: 12, color: T.muted, marginTop: 2 }}>{p.subtitle}</div>}
      </div>
      {p.value && <div style={{ fontSize: 14, fontWeight: 600, color: p.valueColor ?? T.text }}>{p.value}</div>}
    </div>
  ),
};

function Node({ node, ctx, scope = {} }) {
  if (!node || typeof node !== 'object') return null;
  const full = { ...ctx, ...scope };

  if (node.repeat) {
    const items = evalExpr(node.repeat.items, full);
    const alias = node.repeat.as || 'item';
    const { repeat, ...rest } = node;
    return (
      <>
        {(Array.isArray(items) ? items : []).map((item, index) => (
          <Node key={item?.id ?? index} node={rest} ctx={ctx} scope={{ ...scope, [alias]: item, index }} />
        ))}
      </>
    );
  }

  if (!truthy(node.if, full)) return null;

  const Comp = COMPONENTS[node.type];
  const p = bind(node.props ?? {}, full);
  const children = node.children?.map((c, i) => <Node key={i} node={c} ctx={ctx} scope={scope} />);

  if (!Comp) {
    return <div style={{ background: '#fdf3e7', color: '#8a6d1f', borderRadius: 8, padding: 10, fontSize: 12, margin: '4px 0' }}>⚠️ Component "{node.type}" chưa có trong registry của app</div>;
  }
  return <Comp p={p}>{children}</Comp>;
}

export function WebPreview({ layout, ctx }) {
  return (
    <div className="phone">
      <div className="phone-notch" />
      <div className="phone-screen">
        <Node node={layout} ctx={ctx} />
      </div>
    </div>
  );
}
