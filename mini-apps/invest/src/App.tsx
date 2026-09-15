import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, FlatList, RefreshControl, Animated, Pressable, StyleSheet, ActivityIndicator,
} from 'react-native';
import type { MiniAppProps, MiniAppError } from '@supper/mini-sdk';

/**
 * MINI-APP ĐẦU TƯ — do một ĐỘI KHÁC phát hành, ký bằng một KHOÁ KHÁC.
 *
 * Sự tồn tại của mini-app thứ hai không phải để có thêm màn hình đẹp. Nó chứng
 * minh ba điều mà một mini-app đơn lẻ không chứng minh được:
 *
 *   1. Hai remote container cùng sống trong một app, cùng DÙNG CHUNG một bản
 *      React và React Native qua Module Federation. Mở lần lượt cả hai mà không
 *      gặp "Invalid hook call" nghĩa là share scope hoạt động thật.
 *   2. Hai đội publish ĐỘC LẬP với khoá ký riêng. Khoá của đội này không mở
 *      được cửa cho đội kia.
 *   3. Quyền tách bạch: mini-app này chỉ được `invest.portfolio`. Nó gọi
 *      `insurance.quote` là bị app vỏ chặn — thử bằng nút ở cuối màn hình.
 *
 * Biểu đồ dưới đây vẽ tay bằng View + Animated, không dùng thư viện biểu đồ —
 * đây là loại giao diện mà registry SDUI không mô tả nổi.
 */

type Holding = {
  id: string; name: string; shares: number; price: number;
  change: number; color: string; value: number; weight: number;
};

type Portfolio = {
  total: number; pnl: number; pnlPercent: number; holdings: Holding[];
};

const currency = (n: number) => `${Math.round(n).toLocaleString('vi-VN')} ₫`;

export default function InvestMiniApp({ bridge }: MiniAppProps) {
  const t = bridge.theme;

  const [data, setData] = useState<Portfolio | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [denied, setDenied] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const result = await bridge.request<Portfolio>('invest.portfolio');
      setData(result);
    } catch (e) {
      setError((e as MiniAppError).message ?? 'Không tải được danh mục');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [bridge]);

  useEffect(() => {
    void load();
  }, [load]);

  /**
   * Thử một thao tác NGOÀI phần quyền được cấp.
   *
   * Đây là nút demo cho ranh giới quyền: app vỏ sẽ ném `PERMISSION_DENIED` vì
   * registry chỉ cấp `invest.portfolio` cho mini-app này. Không có lời hứa nào
   * ở đây cả — app vỏ chặn thật.
   */
  const probeForbidden = useCallback(async () => {
    try {
      await bridge.request('insurance.quote', { plan: 'basic', age: 30 });
      setDenied('Gọi được — lẽ ra không nên! Ranh giới quyền đang hỏng.');
    } catch (e) {
      const err = e as MiniAppError;
      setDenied(`${err.code}: ${err.message}`);
    }
  }, [bridge]);

  const s = useMemo(() => makeStyles(t), [t]);

  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator color={t.brand} />
      </View>
    );
  }

  if (error || !data) {
    return (
      <View style={s.center}>
        <Text style={s.error}>{error}</Text>
      </View>
    );
  }

  const gain = data.pnl >= 0;

  return (
    <FlatList
      style={s.root}
      contentContainerStyle={s.content}
      data={data.holdings}
      keyExtractor={(h) => h.id}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => {
            setRefreshing(true);
            void load();
          }}
          tintColor={t.brand}
        />
      }
      ListHeaderComponent={
        <View>
          <Text style={s.label}>Tổng tài sản</Text>
          <Text style={s.total}>{currency(data.total)}</Text>
          <Text style={[s.pnl, { color: gain ? t.success : t.danger }]}>
            {gain ? '▲' : '▼'} {currency(Math.abs(data.pnl))} ({data.pnlPercent}%)
          </Text>

          <WeightBar holdings={data.holdings} />

          <Text style={s.section}>Danh mục</Text>
        </View>
      }
      renderItem={({ item, index }) => <HoldingRow holding={item} index={index} theme={t} />}
      ListFooterComponent={
        <View style={s.footer}>
          <Pressable style={s.probe} onPress={probeForbidden}>
            <Text style={s.probeText}>🔒 Thử gọi thao tác ngoài quyền</Text>
          </Pressable>
          {denied ? <Text style={s.deniedText}>{denied}</Text> : null}
        </View>
      }
    />
  );
}

/**
 * Thanh tỉ trọng: các đoạn màu giãn ra từ 0 khi xuất hiện.
 *
 * Dùng `useNativeDriver: false` vì đang animate `flex`, một thuộc tính layout —
 * driver native chỉ xử lý được transform và opacity.
 */
function WeightBar({ holdings }: { holdings: Holding[] }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(progress, {
      toValue: 1,
      duration: 800,
      useNativeDriver: false,
    }).start();
  }, [progress]);

  return (
    <View style={barStyles.bar}>
      {holdings.map((h) => (
        <Animated.View
          key={h.id}
          style={{
            flex: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [0.0001, h.weight],
            }),
            backgroundColor: h.color,
          }}
        />
      ))}
    </View>
  );
}

/** Mỗi dòng trượt vào theo thứ tự, tạo cảm giác danh sách "đổ" xuống. */
function HoldingRow({
  holding, index, theme,
}: {
  holding: Holding;
  index: number;
  theme: MiniAppProps['bridge']['theme'];
}) {
  const slide = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(slide, {
      toValue: 1,
      duration: 320,
      delay: index * 55,
      useNativeDriver: true,
    }).start();
  }, [slide, index]);

  const up = holding.change >= 0;

  return (
    <Animated.View
      style={[
        rowStyles.row,
        { backgroundColor: theme.card, borderColor: theme.border },
        {
          opacity: slide,
          transform: [{ translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
        },
      ]}
    >
      <View style={[rowStyles.dot, { backgroundColor: holding.color }]} />
      <View style={{ flex: 1 }}>
        <Text style={[rowStyles.name, { color: theme.text }]}>{holding.name}</Text>
        <Text style={[rowStyles.sub, { color: theme.muted }]}>
          {holding.shares} CP · {currency(holding.price)}
        </Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[rowStyles.value, { color: theme.text }]}>{currency(holding.value)}</Text>
        <Text style={[rowStyles.change, { color: up ? theme.success : theme.danger }]}>
          {up ? '+' : ''}{holding.change}%
        </Text>
      </View>
    </Animated.View>
  );
}

const barStyles = StyleSheet.create({
  bar: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', marginTop: 18 },
});

const rowStyles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 8 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  name: { fontSize: 15, fontWeight: '700' },
  sub: { fontSize: 11, marginTop: 2 },
  value: { fontSize: 14, fontWeight: '700' },
  change: { fontSize: 11, fontWeight: '700', marginTop: 2 },
});

function makeStyles(t: MiniAppProps['bridge']['theme']) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: t.bg },
    content: { padding: 16, paddingBottom: 40 },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: t.bg, padding: 24 },
    label: { fontSize: 12, color: t.muted },
    total: { fontSize: 32, fontWeight: '800', color: t.text, marginTop: 2 },
    pnl: { fontSize: 13, fontWeight: '700', marginTop: 4 },
    section: { fontSize: 12, fontWeight: '700', color: t.muted, marginTop: 22, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
    error: { fontSize: 13, color: t.danger, textAlign: 'center' },
    footer: { marginTop: 14, alignItems: 'center' },
    probe: { borderWidth: 1, borderColor: t.border, backgroundColor: t.card, borderRadius: 10, paddingHorizontal: 16, paddingVertical: 11 },
    probeText: { fontSize: 13, color: t.text, fontWeight: '600' },
    deniedText: { fontSize: 11, color: t.danger, marginTop: 10, textAlign: 'center', paddingHorizontal: 12, lineHeight: 16 },
  });
}
