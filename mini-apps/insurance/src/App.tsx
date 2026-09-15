import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, Pressable, ScrollView, Animated, PanResponder, StyleSheet, ActivityIndicator,
} from 'react-native';
import type { MiniAppProps, MiniAppError } from '@supper/mini-sdk';

/**
 * MINI-APP BẢO HIỂM — chạy bằng React Native thật, nạp lúc chạy.
 *
 * VÌ SAO MÀN HÌNH NÀY KHÔNG THỂ LÀ SDUI
 *
 * Hướng A dựng UI từ một registry component có sẵn. Nó làm rất tốt những gì
 * registry mô tả được: thẻ, danh sách, biểu mẫu, nút. Màn hình này thì không:
 *
 *   - Thanh chọn tuổi dùng `PanResponder` — cử chỉ kéo liên tục với phản hồi
 *     tức thì mỗi frame. JSON không mô tả được "khi ngón tay di chuyển thì…".
 *   - Số tiền chạy dần bằng `Animated` với nội suy tuỳ biến.
 *   - Thẻ gói bảo hiểm co giãn theo lò xo khi chọn.
 *
 * Muốn làm bằng hướng A thì phải thêm cả ba thứ đó vào registry của app vỏ và
 * phát hành bản app mới — tức là đúng cái mà hướng B tồn tại để tránh.
 *
 * Chú ý những gì mini-app này KHÔNG có: không `fetch`, không địa chỉ backend,
 * không token. Mọi liên hệ với thế giới bên ngoài đi qua `bridge`.
 */

type Quote = {
  plan: string;
  label: string;
  age: number;
  monthly: number;
  yearly: number;
  cover: number;
};

const PLANS = [
  { id: 'basic', label: 'Cơ bản', blurb: 'Tai nạn & nằm viện', cover: '100 triệu' },
  { id: 'plus', label: 'Nâng cao', blurb: 'Thêm bệnh hiểm nghèo', cover: '300 triệu' },
  { id: 'premium', label: 'Toàn diện', blurb: 'Toàn cầu, không giới hạn', cover: '1 tỷ' },
];

const MIN_AGE = 18;
const MAX_AGE = 70;

const currency = (n: number) => `${Math.round(n).toLocaleString('vi-VN')} ₫`;

export default function InsuranceMiniApp({ bridge }: MiniAppProps) {
  const t = bridge.theme;

  const [plan, setPlan] = useState('plus');
  const [age, setAge] = useState(32);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ---------- thanh chọn tuổi: cử chỉ kéo liên tục ---------- */

  const [trackWidth, setTrackWidth] = useState(0);
  // Giữ tuổi trong ref song song với state: PanResponder được tạo MỘT LẦN và
  // closure của nó sẽ đóng băng giá trị state đầu tiên nếu đọc trực tiếp.
  const ageRef = useRef(age);
  ageRef.current = age;
  const trackRef = useRef(0);
  trackRef.current = trackWidth;

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderMove: (_evt, gesture) => {
          const width = trackRef.current;
          if (width <= 0) return;
          const ratio = Math.min(1, Math.max(0, gesture.moveX / width));
          const next = Math.round(MIN_AGE + ratio * (MAX_AGE - MIN_AGE));
          if (next !== ageRef.current) setAge(next);
        },
      }),
    [],
  );

  const ageRatio = (age - MIN_AGE) / (MAX_AGE - MIN_AGE);

  /* ---------- số tiền chạy dần ---------- */

  const counter = useRef(new Animated.Value(0)).current;
  const [displayed, setDisplayed] = useState(0);

  useEffect(() => {
    if (!quote) return;
    counter.setValue(0);
    const id = counter.addListener(({ value }) => {
      setDisplayed(value * quote.monthly);
    });
    Animated.timing(counter, {
      toValue: 1,
      duration: 700,
      // `useNativeDriver: false` là bắt buộc: ta đọc giá trị ở JS mỗi frame để
      // render chuỗi. Driver native chạy animation ở luồng UI, JS không thấy.
      useNativeDriver: false,
    }).start();
    return () => counter.removeListener(id);
  }, [quote, counter]);

  /* ---------- gọi backend QUA BRIDGE ---------- */

  const fetchQuote = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      // Không phải URL — là TÊN THAO TÁC. App vỏ kiểm quyền, ánh xạ sang HTTP
      // thật, và tự gắn token. Mini-app không bao giờ thấy token.
      const result = await bridge.request<Quote>('insurance.quote', { plan, age });
      setQuote(result);
    } catch (e) {
      const err = e as MiniAppError;
      setError(
        err.code === 'PERMISSION_DENIED'
          ? 'Mini-app này chưa được cấp quyền báo giá.'
          : (err.message ?? 'Không lấy được báo giá'),
      );
    } finally {
      setLoading(false);
    }
  }, [bridge, plan, age]);

  useEffect(() => {
    void fetchQuote();
  }, [fetchQuote]);

  const s = useMemo(() => makeStyles(t), [t]);

  return (
    <ScrollView style={s.root} contentContainerStyle={s.content}>
      <Text style={s.hello}>Chào {bridge.user.name}</Text>
      <Text style={s.lead}>
        Màn hình này là <Text style={s.bold}>React Native thật</Text>, tải về lúc chạy —
        chưa từng có trong bản build đang chạy trên máy bạn.
      </Text>

      <View style={s.promo}>
        <Text style={s.promoText}>🎉 Ưu đãi tháng 9 — giảm 10% phí năm đầu</Text>
      </View>

      <Text style={s.section}>Chọn gói</Text>
      <View style={s.plans}>
        {PLANS.map((p) => (
          <PlanCard
            key={p.id}
            plan={p}
            selected={p.id === plan}
            theme={t}
            onPress={() => setPlan(p.id)}
          />
        ))}
      </View>

      <Text style={s.section}>Tuổi người được bảo hiểm</Text>
      <View style={s.ageBox}>
        <Text style={s.ageValue}>{age}</Text>
        <View
          style={s.track}
          onLayout={(e) => setTrackWidth(e.nativeEvent.layout.width)}
          {...panResponder.panHandlers}
        >
          <View style={[s.trackFill, { width: `${ageRatio * 100}%` }]} />
          <View style={[s.knob, { left: `${ageRatio * 100}%` }]} />
        </View>
        <View style={s.trackLabels}>
          <Text style={s.trackLabel}>{MIN_AGE}</Text>
          <Text style={s.trackLabel}>{MAX_AGE}</Text>
        </View>
      </View>

      <View style={s.quote}>
        {loading ? (
          <ActivityIndicator color={t.brand} />
        ) : error ? (
          <Text style={s.error}>{error}</Text>
        ) : quote ? (
          <>
            <Text style={s.quoteLabel}>Phí hằng tháng</Text>
            <Text style={s.quoteValue}>{currency(displayed)}</Text>
            <Text style={s.quoteSub}>
              Trả năm {currency(quote.yearly)} · Quyền lợi tới{' '}
              {currency(quote.cover)}
            </Text>
          </>
        ) : null}
      </View>

      <Pressable
        style={s.cta}
        onPress={() => bridge.toast(`Đã ghi nhận yêu cầu gói ${quote?.label ?? plan}.`)}
      >
        <Text style={s.ctaText}>Đăng ký ngay</Text>
      </Pressable>

      <Pressable style={s.ghost} onPress={() => bridge.navigate('home')}>
        <Text style={s.ghostText}>Về trang chủ</Text>
      </Pressable>
    </ScrollView>
  );
}

/** Thẻ gói: co giãn bằng lò xo khi được chọn. */
function PlanCard({
  plan, selected, theme, onPress,
}: {
  plan: (typeof PLANS)[number];
  selected: boolean;
  theme: MiniAppProps['bridge']['theme'];
  onPress: () => void;
}) {
  const scale = useRef(new Animated.Value(selected ? 1 : 0.96)).current;

  useEffect(() => {
    Animated.spring(scale, {
      toValue: selected ? 1 : 0.96,
      friction: 6,
      tension: 120,
      useNativeDriver: true,
    }).start();
  }, [selected, scale]);

  return (
    <Pressable onPress={onPress} style={{ flex: 1 }}>
      <Animated.View
        style={[
          {
            transform: [{ scale }],
            backgroundColor: selected ? theme.brand : theme.card,
            borderColor: selected ? theme.brand : theme.border,
          },
          planStyles.card,
        ]}
      >
        <Text style={[planStyles.label, { color: selected ? '#fff' : theme.text }]}>
          {plan.label}
        </Text>
        <Text style={[planStyles.blurb, { color: selected ? '#ffffffcc' : theme.muted }]}>
          {plan.blurb}
        </Text>
        <Text style={[planStyles.cover, { color: selected ? '#fff' : theme.text }]}>
          {plan.cover}
        </Text>
      </Animated.View>
    </Pressable>
  );
}

const planStyles = StyleSheet.create({
  card: { borderWidth: 1, borderRadius: 14, padding: 12, minHeight: 104, justifyContent: 'space-between' },
  label: { fontSize: 14, fontWeight: '700' },
  blurb: { fontSize: 11, marginTop: 2, lineHeight: 15 },
  cover: { fontSize: 13, fontWeight: '700', marginTop: 6 },
});

function makeStyles(t: MiniAppProps['bridge']['theme']) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: t.bg },
    content: { padding: 16, paddingBottom: 40 },
    hello: { fontSize: 20, fontWeight: '800', color: t.text },
    lead: { fontSize: 13, color: t.muted, marginTop: 6, lineHeight: 19 },
    bold: { fontWeight: '700', color: t.text },
    promo: { backgroundColor: '#fff4e0', borderColor: '#f0870a', borderWidth: 1, borderRadius: 12, padding: 12, marginTop: 16 },
    promoText: { fontSize: 13, fontWeight: '700', color: '#8a4b00', textAlign: 'center' },
    section: { fontSize: 12, fontWeight: '700', color: t.muted, marginTop: 22, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 },
    plans: { flexDirection: 'row', gap: 8 },
    ageBox: { backgroundColor: t.card, borderRadius: 14, borderWidth: 1, borderColor: t.border, padding: 16 },
    ageValue: { fontSize: 30, fontWeight: '800', color: t.text, textAlign: 'center' },
    track: { height: 34, justifyContent: 'center', marginTop: 6 },
    trackFill: { position: 'absolute', height: 6, borderRadius: 3, backgroundColor: t.brand },
    knob: { position: 'absolute', width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff', borderWidth: 3, borderColor: t.brand, marginLeft: -12 },
    trackLabels: { flexDirection: 'row', justifyContent: 'space-between' },
    trackLabel: { fontSize: 11, color: t.muted },
    quote: { backgroundColor: t.card, borderRadius: 14, borderWidth: 1, borderColor: t.border, padding: 20, marginTop: 16, minHeight: 116, alignItems: 'center', justifyContent: 'center' },
    quoteLabel: { fontSize: 12, color: t.muted },
    quoteValue: { fontSize: 32, fontWeight: '800', color: t.brand, marginTop: 4 },
    quoteSub: { fontSize: 12, color: t.muted, marginTop: 6, textAlign: 'center' },
    error: { fontSize: 13, color: t.danger, textAlign: 'center' },
    cta: { backgroundColor: t.brand, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 18 },
    ctaText: { color: '#fff', fontWeight: '700', fontSize: 15 },
    ghost: { paddingVertical: 12, alignItems: 'center', marginTop: 4 },
    ghostText: { color: t.muted, fontWeight: '600' },
  });
}
