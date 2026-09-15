import React, { useEffect, useMemo, useState } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer } from '@react-navigation/native';

import { AuthProvider } from './src/store/auth';
import { RemoteAppProvider } from './src/remote/RemoteAppProvider';
import { MiniRegistryProvider } from './src/mini/registry';
import { linking } from './src/mini/linking';
import { initScriptManager } from './src/mini/scriptManager';
import { RootNavigator } from './src/navigation/RootNavigator';
import { DevPanel } from './src/devtools/DevPanel';
import { restoreApiBase } from './src/api/client';
import { theme } from './src/sdui/theme';

export default function App() {
  const [booted, setBooted] = useState(false);

  // Khôi phục địa chỉ backend đã lưu TRƯỚC khi bất kỳ request nào chạy.
  useEffect(() => { restoreApiBase().finally(() => setBooted(true)); }, []);

  /**
   * Cấu hình ScriptManager MỘT LẦN, ở tầng module chứ không trong effect.
   *
   * Effect chạy sau lần render đầu, mà mini-app thì có thể được mở ngay từ một
   * deep link lúc khởi động — lúc đó cache và bộ bắt lỗi native chưa kịp gắn.
   */
  useMemo(() => initScriptManager(), []);

  if (!booted) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.bg }}>
        <ActivityIndicator color={theme.brand} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <RemoteAppProvider>
          {/* Danh bạ mini-app (hướng B). Tải song song với manifest SDUI
              (hướng A) — hai hệ độc lập, hỏng cái nào cái kia vẫn chạy. */}
          <MiniRegistryProvider>
            <NavigationContainer linking={linking}>
              <RootNavigator />
            </NavigationContainer>
            <DevPanel />
            <StatusBar style="auto" />
          </MiniRegistryProvider>
        </RemoteAppProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
