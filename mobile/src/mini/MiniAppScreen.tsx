import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { View, Text, ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import type { ComponentType } from 'react';
import type { MiniAppProps } from '@supper/mini-sdk';
import { useNavigation, useRoute } from '@react-navigation/native';
import { theme } from '../sdui/theme';
import { useAuth } from '../store/auth';
import { useMiniRegistry } from './registry';
import { loadMiniApp } from './loadMiniApp';
import { createBridge } from './bridge';
import { MiniAppBoundary } from './MiniAppBoundary';
import { MiniLoadError, type MiniLoadErrorCode } from './types';

/**
 * Màn hình chứa mini-app.
 *
 * Một route DUY NHẤT (`__mini`) phục vụ mọi mini-app, giống như RemoteScreen
 * phục vụ mọi màn hình SDUI. Mini-app nào được mở là do `params.id` quyết định.
 */

type LoadState =
  | { phase: 'loading' }
  | { phase: 'ready'; Component: ComponentType<MiniAppProps> }
  | { phase: 'error'; code: MiniLoadErrorCode; message: string };

/** Mỗi lý do thất bại một cách xử lý. Xem ghi chú ở types.ts. */
const FAILURES: Record<MiniLoadErrorCode, { emoji: string; title: string; retry: boolean }> = {
  NOT_FOUND: { emoji: '🔍', title: 'Không tìm thấy mini-app', retry: false },
  HOST_TOO_OLD: { emoji: '⬆️', title: 'Cần cập nhật ứng dụng', retry: false },
  UNTRUSTED_KEY: { emoji: '🚫', title: 'Nhà phát hành không được tin cậy', retry: false },
  // KHÔNG cho thử lại: chữ ký sai nghĩa là bundle đã bị sửa hoặc bị tráo. Thử
  // lại chỉ tải lại đúng thứ đó. Đây là dấu hiệu tấn công, không phải trục trặc.
  SIGNATURE_INVALID: { emoji: '🛑', title: 'Bản cài đặt không hợp lệ', retry: false },
  NETWORK: { emoji: '📡', title: 'Không tải được mini-app', retry: true },
  RUNTIME: { emoji: '💥', title: 'Mini-app gặp sự cố', retry: true },
};

export const MiniAppScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const auth = useAuth();
  const registry = useMiniRegistry();

  const id: string = route.params?.id;
  const params = useMemo(
    () => (route.params?.params ?? {}) as Record<string, unknown>,
    [route.params?.params],
  );

  const desc = registry.get(id);
  const [state, setState] = useState<LoadState>({ phase: 'loading' });
  const [attempt, setAttempt] = useState(0);

  const goHome = useCallback(() => {
    navigation.navigate('home');
  }, [navigation]);

  const goBack = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
    else goHome();
  }, [navigation, goHome]);

  useEffect(() => {
    let cancelled = false;

    // Registry còn đang tải thì chờ — chưa kết luận là không tìm thấy.
    if (registry.status === 'loading') return;

    if (!desc) {
      setState({
        phase: 'error',
        code: 'NOT_FOUND',
        message: `Mini-app '${id}' chưa được phát hành, hoặc phiên bản ứng dụng này không mở được.`,
      });
      return;
    }

    setState({ phase: 'loading' });
    loadMiniApp(desc)
      .then((Component) => {
        if (!cancelled) setState({ phase: 'ready', Component });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const e = err instanceof MiniLoadError ? err : null;
        setState({
          phase: 'error',
          code: e?.code ?? 'RUNTIME',
          message: e?.message ?? String(err),
        });
      });

    return () => {
      cancelled = true;
    };
  }, [desc, id, registry.status, attempt]);

  useEffect(() => {
    if (desc) navigation.setOptions({ title: `${desc.icon}  ${desc.title}` });
  }, [desc, navigation]);

  const bridge = useMemo(
    () => (desc ? createBridge({ desc, user: auth.user, goBack, goHome }) : null),
    [desc, auth.user, goBack, goHome],
  );

  if (state.phase === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={theme.brand} />
        <Text style={styles.hint}>Đang tải {desc?.title ?? 'mini-app'}…</Text>
        {desc ? <Text style={styles.version}>v{desc.version}</Text> : null}
      </View>
    );
  }

  if (state.phase === 'error') {
    const f = FAILURES[state.code];
    return (
      <View style={styles.center}>
        <Text style={styles.emoji}>{f.emoji}</Text>
        <Text style={styles.title}>{f.title}</Text>
        <Text style={styles.hint}>{state.message}</Text>
        <View style={styles.row}>
          {f.retry ? (
            <Pressable
              style={[styles.btn, styles.btnGhost]}
              onPress={() => setAttempt((n) => n + 1)}
            >
              <Text style={styles.btnGhostText}>Thử lại</Text>
            </Pressable>
          ) : null}
          <Pressable style={styles.btn} onPress={goHome}>
            <Text style={styles.btnText}>Về trang chủ</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const { Component } = state;
  return (
    <MiniAppBoundary title={desc!.title} onExit={goHome}>
      <Component bridge={bridge!} params={params} />
    </MiniAppBoundary>
  );
};

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, backgroundColor: theme.bg, gap: 4 },
  emoji: { fontSize: 44 },
  title: { fontSize: 18, fontWeight: '700', color: theme.text, marginTop: 10 },
  hint: { fontSize: 13, color: theme.muted, textAlign: 'center', marginTop: 8, lineHeight: 19 },
  version: { fontSize: 11, color: theme.muted, marginTop: 2 },
  row: { flexDirection: 'row', gap: 10, marginTop: 22 },
  btn: { backgroundColor: theme.brand, paddingHorizontal: 20, paddingVertical: 11, borderRadius: 10 },
  btnText: { color: '#fff', fontWeight: '700' },
  btnGhost: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border },
  btnGhostText: { color: theme.text, fontWeight: '700' },
});
