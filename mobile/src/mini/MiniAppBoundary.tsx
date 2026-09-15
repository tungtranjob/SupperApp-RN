import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { theme } from '../sdui/theme';

/**
 * Vách ngăn giữa mã của bên thứ ba và app vỏ.
 *
 * Mini-app ném lỗi lúc render sẽ làm sập TOÀN BỘ cây React nếu không có error
 * boundary — nghĩa là một đối tác viết sai một dòng là app ngân hàng của bạn
 * trắng màn hình. Đây là yêu cầu #4 ở README mục 9, và nó phải là class
 * component vì React chỉ cho bắt lỗi render qua `componentDidCatch`.
 */

type Props = {
  title: string;
  children: React.ReactNode;
  onExit: () => void;
};

type State = { error: Error | null };

export class MiniAppBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Thật thì đẩy về hệ thống giám sát, KÈM id và version mini-app, để đội vận
    // hành biết cần gỡ bản nào khỏi kênh production.
    console.error(`[mini-app: ${this.props.title}] lỗi render`, error, info.componentStack);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <View style={styles.wrap}>
        <Text style={styles.emoji}>💥</Text>
        <Text style={styles.title}>{this.props.title} gặp sự cố</Text>
        <Text style={styles.hint}>
          Lỗi nằm trong mini-app, không phải ở ứng dụng. Bạn có thể quay lại và dùng
          các tính năng khác bình thường.
        </Text>
        <Text style={styles.detail} numberOfLines={3}>
          {this.state.error.message}
        </Text>

        <View style={styles.row}>
          <Pressable
            style={[styles.btn, styles.btnGhost]}
            onPress={() => this.setState({ error: null })}
          >
            <Text style={styles.btnGhostText}>Thử lại</Text>
          </Pressable>
          <Pressable style={styles.btn} onPress={this.props.onExit}>
            <Text style={styles.btnText}>Về trang chủ</Text>
          </Pressable>
        </View>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, backgroundColor: theme.bg },
  emoji: { fontSize: 44 },
  title: { fontSize: 18, fontWeight: '700', color: theme.text, marginTop: 10 },
  hint: { fontSize: 13, color: theme.muted, textAlign: 'center', marginTop: 8, lineHeight: 19 },
  detail: { fontSize: 11, color: theme.muted, textAlign: 'center', marginTop: 12, fontFamily: 'Menlo' },
  row: { flexDirection: 'row', gap: 10, marginTop: 22 },
  btn: { backgroundColor: theme.brand, paddingHorizontal: 20, paddingVertical: 11, borderRadius: 10 },
  btnText: { color: '#fff', fontWeight: '700' },
  btnGhost: { backgroundColor: theme.surface, borderWidth: 1, borderColor: theme.border },
  btnGhostText: { color: theme.text, fontWeight: '700' },
});
