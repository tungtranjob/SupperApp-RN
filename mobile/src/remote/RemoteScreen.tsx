import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { View, Text, ActivityIndicator, Pressable, StyleSheet, Alert } from 'react-native';
import { ScreenDef } from '../sdui/types';
import { RenderNode } from '../sdui/Renderer';
import { ActionRuntime, runActions } from '../sdui/actions';
import { setPath, BindContext } from '../sdui/bind';
import { SduiRuntimeProvider } from '../sdui/runtime';
import { theme } from '../sdui/theme';
import { SDUI_VERSION } from '../config';
import { useAuth } from '../store/auth';
import { useRemoteApp } from './RemoteAppProvider';
import { loadScreen } from './screenStore';

/**
 * Một màn hình React Native duy nhất, dùng chung cho MỌI route.
 * Nó không biết trước nó là "login", "home" hay màn hình bạn vừa tạo trên dashboard.
 * Tất cả đến từ JSON.
 *
 * Vòng đời:
 *   1. lấy layout (cache → network)
 *   2. khởi tạo state = initialState
 *   3. chạy onLoad (thường là gọi API lấy dữ liệu)
 *   4. render cây node
 *   5. mọi tương tác → chạy chuỗi action → đổi state → render lại
 */
export const RemoteScreen: React.FC<any> = ({ navigation, route }) => {
  const routeName: string = route.name;
  const { channel, manifest } = useRemoteApp();
  const auth = useAuth();

  const entry = manifest?.screens.find((s) => s.route === routeName);

  const [def, setDef] = useState<ScreenDef | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  /**
   * State của màn hình nằm trong ref chứ không phải useState, vì một chuỗi action
   * (setState → http → setState) phải thấy được giá trị vừa ghi ở bước trước,
   * trong khi useState chỉ cập nhật ở lần render kế tiếp.
   * `force()` chịu trách nhiệm vẽ lại.
   */
  const stateRef = useRef<Record<string, any>>({});
  const [, force] = useReducer((x: number) => x + 1, 0);
  const appliedVersion = useRef<number | null>(null);
  const rtRef = useRef<ActionRuntime>(null as any);

  /* --------------------------- action runtime --------------------------- */
  const rt = useMemo<ActionRuntime>(() => ({
    buildContext: (scope: BindContext = {}) => ({
      state: stateRef.current,
      user: auth.user ?? {},
      params: route.params ?? {},
      app: { channel, screen: routeName, sduiVersion: SDUI_VERSION },
      ...scope,
    }),
    setStatePath: (path, value) => { setPath(stateRef.current, path, value); force(); },
    navigate: (to, params, opts) => {
      try {
        if (opts?.reset) navigation.reset({ index: 0, routes: [{ name: to, params }] });
        else if (opts?.replace) navigation.replace(to, params);
        else navigation.navigate(to, params);
      } catch {
        Alert.alert('Điều hướng lỗi', `Không tìm thấy màn hình "${to}" trong manifest.`);
      }
    },
    goBack: () => navigation.canGoBack() && navigation.goBack(),
    setAuth: (payload) => auth.signIn(payload as any),
    logout: () => auth.signOut(),
    refresh: () => { void onRefresh(); },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [auth.user, auth.signIn, auth.signOut, channel, routeName, navigation, route.params]);

  rtRef.current = rt;

  /* ------------------------------ tải layout ----------------------------- */
  const applyDef = useCallback((d: ScreenDef) => {
    setDef(d);
    setLoading(false);
    setError(null);
    if (appliedVersion.current === d.version) return;   // đã chạy onLoad cho version này rồi
    appliedVersion.current = d.version;
    stateRef.current = JSON.parse(JSON.stringify(d.initialState ?? {}));
    force();
    void runActions(d.onLoad, rtRef.current);
  }, []);

  const load = useCallback(async () => {
    setError(null);
    await loadScreen(channel, routeName, {
      onLocal: applyDef,
      onRemote: applyDef,
      onError: (e) => { setError(e.message); setLoading(false); },
    });
  }, [channel, routeName, applyDef]);

  // Chạy lại khi: đổi channel, hoặc manifest báo màn này có version mới
  // → publish trên dashboard là app tự cập nhật, không cần build lại.
  useEffect(() => { void load(); }, [load, entry?.version]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    appliedVersion.current = null;
    await load();
    setRefreshing(false);
  }, [load]);

  /* --------------------------- chặn theo quyền --------------------------- */
  useEffect(() => {
    if (entry?.requiresAuth && auth.ready && !auth.token) {
      navigation.reset({ index: 0, routes: [{ name: manifest?.entry ?? 'login' }] });
    }
  }, [entry?.requiresAuth, auth.ready, auth.token, manifest?.entry, navigation]);

  /* ------------------------------- render -------------------------------- */
  if (loading && !def) return <Centered><ActivityIndicator color={theme.brand} /><Text style={styles.hint}>Đang tải giao diện…</Text></Centered>;

  if (error && !def) {
    return (
      <Centered>
        <Text style={styles.emoji}>📡</Text>
        <Text style={styles.title}>Không tải được màn hình</Text>
        <Text style={styles.hint}>{error}</Text>
        <Pressable style={styles.retry} onPress={() => { setLoading(true); void load(); }}>
          <Text style={styles.retryText}>Thử lại</Text>
        </Pressable>
      </Centered>
    );
  }

  if (!def) return <Centered><Text style={styles.hint}>Màn hình trống</Text></Centered>;

  // Version skew: server yêu cầu DSL mới hơn app này hiểu.
  if ((def.minSdui ?? 1) > SDUI_VERSION) {
    return (
      <Centered>
        <Text style={styles.emoji}>⬆️</Text>
        <Text style={styles.title}>Cần cập nhật ứng dụng</Text>
        <Text style={styles.hint}>Màn hình này yêu cầu SDUI v{def.minSdui}, app đang ở v{SDUI_VERSION}.</Text>
      </Centered>
    );
  }

  return (
    <SduiRuntimeProvider value={{ refreshing, refresh: onRefresh }}>
      <RenderNode node={def.layout} rt={rt} />
    </SduiRuntimeProvider>
  );
};

const Centered: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <View style={styles.centered}>{children}</View>
);

const styles = StyleSheet.create({
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: theme.bg, gap: 8 },
  emoji: { fontSize: 40 },
  title: { fontSize: 17, fontWeight: '700', color: theme.text },
  hint: { fontSize: 13, color: theme.muted, textAlign: 'center' },
  retry: { marginTop: 12, backgroundColor: theme.brand, paddingHorizontal: 22, paddingVertical: 11, borderRadius: 10 },
  retryText: { color: '#fff', fontWeight: '700' },
});
