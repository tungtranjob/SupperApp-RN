import React from 'react';
import {
  View, Text, TextInput, Pressable, Image, ScrollView, ActivityIndicator,
  RefreshControl, StyleSheet, ViewStyle, TextStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { theme } from './theme';
import { useSduiRuntime } from './runtime';

/**
 * REGISTRY — "từ điển" ánh xạ `type` trong JSON → component React Native thật.
 *
 * Đây là ranh giới an toàn của cả hệ thống: server CHỈ có thể dựng UI bằng
 * những component có trong đây. Muốn thêm khả năng mới cho server → thêm vào
 * registry rồi phát hành app mới, và nâng SDUI_VERSION.
 */

export type SduiComponentProps = {
  /** props đã được resolve binding */
  p: Record<string, any>;
  children?: React.ReactNode;
  /** bắn một sự kiện được khai báo trong node.actions */
  on: (event: string, payload?: Record<string, any>) => void;
  /** node có khai báo handler cho sự kiện này không */
  has: (event: string) => boolean;
};

type Comp = React.FC<SduiComponentProps>;

/* -------------------------------- helpers -------------------------------- */

const boxStyle = (p: Record<string, any>): ViewStyle => ({
  backgroundColor: p.background,
  padding: p.padding,
  paddingTop: p.paddingTop,
  paddingBottom: p.paddingBottom,
  paddingHorizontal: p.paddingX,
  paddingVertical: p.paddingY,
  margin: p.margin,
  marginTop: p.marginTop,
  marginBottom: p.marginBottom,
  borderRadius: p.radius,
  borderBottomLeftRadius: p.radiusBottom,
  borderBottomRightRadius: p.radiusBottom,
  flex: p.flex,
  gap: p.gap,
  alignItems: p.align === 'center' ? 'center' : p.align === 'end' ? 'flex-end' : undefined,
  justifyContent: p.justify,
  width: p.width,
  height: p.height,
  ...(p.style || {}),
});

const textStyle = (p: Record<string, any>): TextStyle => ({
  color: p.color ?? theme.text,
  fontSize: p.size ?? 14,
  fontWeight: p.weight,
  textAlign: p.align,
  lineHeight: p.lineHeight,
  ...(p.style || {}),
});

/* ------------------------------- components ------------------------------ */

const Screen: Comp = ({ p, children }) => {
  const rt = useSduiRuntime();
  const body = (
    <View style={{ padding: p.padding, flexGrow: 1 }}>{children}</View>
  );
  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: p.background ?? theme.bg }}>
      {p.scroll === false ? (
        body
      ) : (
        <ScrollView
          contentContainerStyle={{ flexGrow: 1 }}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            p.refreshable ? <RefreshControl refreshing={rt.refreshing} onRefresh={rt.refresh} tintColor={theme.brand} /> : undefined
          }
        >
          {body}
        </ScrollView>
      )}
    </SafeAreaView>
  );
};

const Box: Comp = ({ p, children }) => <View style={boxStyle(p)}>{children}</View>;

const Row: Comp = ({ p, children }) => (
  <View style={[{ flexDirection: 'row', alignItems: 'center' }, boxStyle(p)]}>{children}</View>
);

const Card: Comp = ({ p, children }) => (
  <View style={[styles.card, boxStyle(p), { padding: p.padding ?? 16 }]}>{children}</View>
);

const Grid: Comp = ({ p, children }) => {
  const columns = p.columns ?? 4;
  const items = React.Children.toArray(children);
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
      {items.map((child, i) => (
        <View key={i} style={{ width: `${100 / columns}%`, paddingVertical: 8 }}>
          {child}
        </View>
      ))}
    </View>
  );
};

const SduiText: Comp = ({ p }) => <Text style={textStyle(p)}>{p.text ?? ''}</Text>;

const Heading: Comp = ({ p }) => (
  <Text style={[{ fontSize: 24, fontWeight: '700', color: theme.text }, textStyle({ ...p, size: p.size ?? 24, weight: p.weight ?? '700' })]}>
    {p.text ?? ''}
  </Text>
);

const Caption: Comp = ({ p }) => (
  <Text style={textStyle({ ...p, size: p.size ?? 13, color: p.color ?? theme.muted })}>{p.text ?? ''}</Text>
);

const Spacer: Comp = ({ p }) => <View style={{ height: p.size ?? 12, width: p.horizontal ? p.size ?? 12 : undefined }} />;

const Divider: Comp = ({ p }) => <View style={{ height: 1, backgroundColor: p.color ?? theme.border, marginVertical: p.margin ?? 4 }} />;

const Input: Comp = ({ p, on }) => (
  <View style={{ marginBottom: 14 }}>
    {!!p.label && <Text style={styles.label}>{p.label}</Text>}
    <TextInput
      style={styles.input}
      value={p.value == null ? '' : String(p.value)}
      placeholder={p.placeholder}
      placeholderTextColor="#9a9aa2"
      secureTextEntry={!!p.secure}
      keyboardType={p.keyboardType}
      autoCapitalize={p.autoCapitalize ?? 'none'}
      editable={p.editable !== false}
      onChangeText={(text) => on('onChangeText', { text })}
    />
  </View>
);

const Button: Comp = ({ p, on }) => {
  const variant = p.variant ?? 'primary';
  const disabled = !!p.disabled || !!p.loading;
  return (
    <Pressable
      onPress={() => on('onPress')}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        variant === 'primary' && { backgroundColor: theme.brand },
        variant === 'secondary' && { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border },
        variant === 'danger' && { backgroundColor: '#fdeced', borderWidth: 1, borderColor: '#f5c3c5' },
        disabled && { opacity: 0.6 },
        pressed && { opacity: 0.85 },
      ]}
    >
      {p.loading ? (
        <ActivityIndicator color={variant === 'primary' ? '#fff' : theme.brand} />
      ) : (
        <Text
          style={[
            styles.btnText,
            variant === 'primary' && { color: '#fff' },
            variant === 'secondary' && { color: theme.text },
            variant === 'danger' && { color: theme.danger },
          ]}
        >
          {p.title ?? ''}
        </Text>
      )}
    </Pressable>
  );
};

const SduiImage: Comp = ({ p }) => (
  <Image source={{ uri: p.uri }} style={{ width: p.width ?? '100%', height: p.height ?? 160, borderRadius: p.radius ?? 8 }} resizeMode={p.resizeMode ?? 'cover'} />
);

const Avatar: Comp = ({ p }) => {
  const size = p.size ?? 44;
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: p.background ?? 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: size * 0.5 }}>{p.emoji ?? '🙂'}</Text>
    </View>
  );
};

const Badge: Comp = ({ p }) => (
  <View style={{ backgroundColor: p.background ?? 'rgba(255,255,255,0.22)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 }}>
    <Text style={{ color: p.color ?? '#fff', fontSize: 12, fontWeight: '600' }}>{p.text ?? ''}</Text>
  </View>
);

const ServiceIcon: Comp = ({ p, on }) => (
  <Pressable onPress={() => on('onPress')} style={({ pressed }) => [{ alignItems: 'center' }, pressed && { opacity: 0.6 }]}>
    <View style={{ width: 46, height: 46, borderRadius: 14, backgroundColor: (p.color ?? theme.brand) + '1A', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 22 }}>{p.emoji ?? '📦'}</Text>
    </View>
    <Text numberOfLines={2} style={{ fontSize: 11, color: theme.muted, textAlign: 'center', marginTop: 6 }}>
      {p.label ?? ''}
    </Text>
  </Pressable>
);

const ListItem: Comp = ({ p, on, has }) => {
  const content = (
    <View style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 12 }}>
      {!!p.emoji && (
        <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: theme.bg, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
          <Text style={{ fontSize: 18 }}>{p.emoji}</Text>
        </View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, color: theme.text, fontWeight: '500' }}>{p.title ?? ''}</Text>
        {!!p.subtitle && <Text style={{ fontSize: 12, color: theme.muted, marginTop: 2 }}>{p.subtitle}</Text>}
      </View>
      {!!p.value && <Text style={{ fontSize: 14, fontWeight: '600', color: p.valueColor ?? theme.text }}>{p.value}</Text>}
    </View>
  );
  if (!has('onPress')) return content;
  return <Pressable onPress={() => on('onPress')} style={({ pressed }) => pressed && { opacity: 0.6 }}>{content}</Pressable>;
};

const Banner: Comp = ({ p }) => {
  const tone = p.tone ?? 'info';
  const colors: Record<string, [string, string]> = {
    info: ['#eaf2fb', '#0d7ee0'],
    danger: ['#fdeced', theme.danger],
    success: ['#e9f7ef', theme.success],
    warning: ['#fdf3e7', '#f0870a'],
  };
  const [bg, fg] = colors[tone] ?? colors.info;
  return (
    <View style={{ backgroundColor: bg, borderRadius: 10, padding: 12 }}>
      <Text style={{ color: fg, fontSize: 13 }}>{p.text ?? ''}</Text>
    </View>
  );
};

/**
 * Fallback khi server gửi component mà bản app này chưa biết.
 * KHÔNG BAO GIỜ để nó crash — người dùng đang chạy app cũ là chuyện bình thường.
 */
export const UnknownComponent: React.FC<{ type: string }> = ({ type }) => (
  <View style={styles.unknown}>
    <Text style={{ color: '#8a6d1f', fontSize: 12 }}>
      ⚠️ Component "{type}" chưa được hỗ trợ ở phiên bản app này. Vui lòng cập nhật ứng dụng.
    </Text>
  </View>
);

export const registry: Record<string, Comp> = {
  Screen,
  View: Box,
  Column: Box,
  Row,
  Card,
  Grid,
  Text: SduiText,
  Heading,
  Caption,
  Spacer,
  Divider,
  Input,
  Button,
  Image: SduiImage,
  Avatar,
  Badge,
  ServiceIcon,
  ListItem,
  Banner,
};

/** Dùng cho dashboard/debug: server có thể hỏi app hỗ trợ gì. */
export const SUPPORTED_COMPONENTS = Object.keys(registry);

const styles = StyleSheet.create({
  card: { backgroundColor: theme.surface, borderRadius: theme.radius },
  label: { fontSize: 12, color: theme.muted, marginBottom: 6, fontWeight: '600' },
  input: {
    borderWidth: 1, borderColor: theme.border, borderRadius: 10,
    paddingHorizontal: 14, paddingVertical: 12, fontSize: 15,
    backgroundColor: theme.surface, color: theme.text,
  },
  btn: { borderRadius: 12, paddingVertical: 14, alignItems: 'center', justifyContent: 'center', minHeight: 50 },
  btnText: { fontSize: 15, fontWeight: '700' },
  unknown: { backgroundColor: '#fdf3e7', borderRadius: 8, padding: 10, marginVertical: 4 },
});
