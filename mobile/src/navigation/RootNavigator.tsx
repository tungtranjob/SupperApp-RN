import React from 'react';
import { View, Text, ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RemoteScreen } from '../remote/RemoteScreen';
import { MiniAppScreen } from '../mini/MiniAppScreen';
import { useRemoteApp } from '../remote/RemoteAppProvider';
import { useAuth } from '../store/auth';
import { theme } from '../sdui/theme';

const Stack = createNativeStackNavigator();

/**
 * Navigator được SINH RA TỪ MANIFEST.
 *
 * Thêm một màn hình mới trên dashboard → manifest có thêm route →
 * <Stack.Screen> mới xuất hiện → action {"type":"navigate","to":"<route mới>"}
 * chạy được ngay, KHÔNG cần build lại app.
 */
export const RootNavigator: React.FC = () => {
  const { manifest, status, error, hardReload } = useRemoteApp();
  const auth = useAuth();

  if (!auth.ready || (status === 'loading' && !manifest)) {
    return (
      <View style={styles.center}>
        <Text style={{ fontSize: 42 }}>💜</Text>
        <ActivityIndicator color={theme.brand} style={{ marginTop: 12 }} />
        <Text style={styles.hint}>Đang tải cấu hình ứng dụng…</Text>
      </View>
    );
  }

  if (!manifest) {
    return (
      <View style={styles.center}>
        <Text style={{ fontSize: 42 }}>📡</Text>
        <Text style={styles.title}>Không tải được manifest</Text>
        <Text style={styles.hint}>{error}</Text>
        <Pressable style={styles.btn} onPress={() => void hardReload()}>
          <Text style={styles.btnText}>Thử lại</Text>
        </Pressable>
      </View>
    );
  }

  const initialRouteName = auth.token ? manifest.home : manifest.entry;

  /**
   * ĐĂNG KÝ TẤT CẢ route, kể cả route cần đăng nhập.
   * Lý do: action {"type":"navigate","to":"home"} chạy ngay sau setAuth trong cùng một
   * chuỗi action. Nếu lọc route theo auth.token thì lúc navigate chạy, React có thể
   * chưa kịp render lại navigator → "home" chưa tồn tại → điều hướng thất bại.
   * Việc chặn quyền được làm bên trong RemoteScreen (redirect về màn đăng nhập).
   */
  const visible = manifest.screens;

  return (
    <Stack.Navigator
      initialRouteName={initialRouteName}
      screenOptions={{
        headerStyle: { backgroundColor: theme.surface },
        headerTintColor: theme.text,
        headerTitleStyle: { fontSize: 16, fontWeight: '700' },
        contentStyle: { backgroundColor: theme.bg },
      }}
    >
      {/**
       * MỘT route cố định cho TẤT CẢ mini-app (hướng B), đứng cạnh các route
       * sinh từ manifest (hướng A). Mini-app nào được mở là do params.id quyết
       * định — nên phát hành thêm mini-app KHÔNG cần thêm route ở đây, và cũng
       * không cần build lại app.
       *
       * Tên bắt đầu bằng "__" để không bao giờ đụng route do dashboard đặt.
       */}
      <Stack.Screen
        name="__mini"
        component={MiniAppScreen}
        /**
         * `getId` bắt React Navigation coi mỗi mini-app là một MÀN HÌNH KHÁC
         * NHAU dù dùng chung một route.
         *
         * Thiếu nó thì đang mở mini-app Bảo hiểm mà nhận deep link (hoặc thông
         * báo đẩy) sang Đầu tư sẽ KHÔNG có gì xảy ra: navigator thấy cùng tên
         * route `__mini` nên coi như đã ở đúng chỗ rồi. Không lỗi, không log —
         * chỉ là bấm vào thông báo mà không có phản ứng gì.
         */
        getId={({ params }) => String((params as any)?.id ?? '')}
        options={{ title: 'Mini-app', headerShown: true }}
      />

      {visible.map((s) => (
        <Stack.Screen
          key={s.route}
          name={s.route}
          component={RemoteScreen}
          options={{
            title: s.title,
            headerShown: s.route !== manifest.entry && s.route !== manifest.home,
          }}
        />
      ))}
    </Stack.Navigator>
  );
};

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, backgroundColor: theme.bg, gap: 6 },
  title: { fontSize: 17, fontWeight: '700', color: theme.text, marginTop: 8 },
  hint: { fontSize: 13, color: theme.muted, textAlign: 'center', marginTop: 6 },
  btn: { marginTop: 16, backgroundColor: theme.brand, paddingHorizontal: 22, paddingVertical: 11, borderRadius: 10 },
  btnText: { color: '#fff', fontWeight: '700' },
});
