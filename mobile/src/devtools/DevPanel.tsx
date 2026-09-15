import React, { useState } from 'react';
import { View, Text, Modal, Pressable, TextInput, ScrollView, StyleSheet, Switch } from 'react-native';
import { useRemoteApp } from '../remote/RemoteAppProvider';
import { getApiBase, setApiBase } from '../api/client';
import { useAuth } from '../store/auth';
import { theme } from '../sdui/theme';
import { SUPPORTED_COMPONENTS } from '../sdui/registry';
import { SDUI_VERSION } from '../config';

/**
 * Bảng điều khiển dev — không có trong bản release.
 * Cho phép: đổi địa chỉ backend, chuyển kênh production/draft, xoá cache, xem manifest.
 * Kênh `draft` chính là cơ chế "xem thử trước khi publish" của super app.
 */
export const DevPanel: React.FC = () => {
  const [open, setOpen] = useState(false);
  const [base, setBase] = useState(getApiBase());
  const { manifest, source, channel, setChannel, hardReload, revalidate, autoRefresh, setAutoRefresh, error } = useRemoteApp();
  const auth = useAuth();

  if (!__DEV__) return null;

  return (
    <>
      <Pressable style={styles.fab} onPress={() => setOpen(true)}>
        <Text style={{ fontSize: 18 }}>🛠</Text>
      </Pressable>

      <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOpen(false)}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <Text style={styles.h1}>Dev Panel</Text>
            <Pressable onPress={() => setOpen(false)}><Text style={styles.close}>Đóng</Text></Pressable>
          </View>

          <ScrollView contentContainerStyle={{ padding: 16, gap: 18 }}>
            <Section title="Backend">
              <TextInput style={styles.input} value={base} onChangeText={setBase} autoCapitalize="none" placeholder="http://192.168.x.x:4000" />
              <Btn label="Lưu & tải lại" onPress={async () => { await setApiBase(base); await hardReload(); }} />
            </Section>

            <Section title="Kênh phát hành">
              <Row>
                <Chip label="production" active={channel === 'production'} onPress={() => setChannel('production')} />
                <Chip label="draft (bản nháp)" active={channel === 'draft'} onPress={() => setChannel('draft')} />
              </Row>
              <Text style={styles.note}>
                `draft` hiển thị bản đang soạn trên dashboard mà chưa publish — dùng để QA trước khi ra mắt.
              </Text>
            </Section>

            <Section title="Đồng bộ">
              <Row>
                <Text style={styles.kv}>Tự kiểm tra bản mới (8s)</Text>
                <Switch value={autoRefresh} onValueChange={setAutoRefresh} />
              </Row>
              <Btn label="Kiểm tra ngay" onPress={() => void revalidate()} />
              <Btn label="Xoá cache & tải lại" tone="danger" onPress={() => void hardReload()} />
            </Section>

            <Section title="Trạng thái">
              <KV k="Nguồn UI" v={source ?? '—'} />
              <KV k="Revision" v={manifest?.revision ?? '—'} />
              <KV k="SDUI app hỗ trợ" v={`v${SDUI_VERSION}`} />
              <KV k="SDUI server" v={`v${manifest?.sduiVersion ?? '—'}`} />
              <KV k="Đăng nhập" v={auth.user ? `${auth.user.name}` : 'chưa'} />
              {!!error && <Text style={[styles.note, { color: theme.danger }]}>{error}</Text>}
            </Section>

            <Section title={`Màn hình trong manifest (${manifest?.screens.length ?? 0})`}>
              {manifest?.screens.map((s) => (
                <KV key={s.route} k={`${s.icon ?? ''} ${s.title} (/${s.route})`} v={`v${s.version}`} />
              ))}
            </Section>

            <Section title={`Component app hỗ trợ (${SUPPORTED_COMPONENTS.length})`}>
              <Text style={styles.note}>{SUPPORTED_COMPONENTS.join(' · ')}</Text>
            </Section>

            {!!auth.token && <Btn label="Đăng xuất" tone="danger" onPress={() => void auth.signOut()} />}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <View style={{ gap: 8 }}>
    <Text style={styles.h2}>{title}</Text>
    {children}
  </View>
);
const Row: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'space-between' }}>{children}</View>
);
const KV: React.FC<{ k: string; v: string }> = ({ k, v }) => (
  <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 }}>
    <Text style={styles.kv}>{k}</Text>
    <Text style={[styles.kv, { fontWeight: '700' }]}>{v}</Text>
  </View>
);
const Chip: React.FC<{ label: string; active: boolean; onPress: () => void }> = ({ label, active, onPress }) => (
  <Pressable onPress={onPress} style={[styles.chip, active && { backgroundColor: theme.brand, borderColor: theme.brand }]}>
    <Text style={{ color: active ? '#fff' : theme.text, fontSize: 12, fontWeight: '600' }}>{label}</Text>
  </Pressable>
);
const Btn: React.FC<{ label: string; onPress: () => void; tone?: 'danger' }> = ({ label, onPress, tone }) => (
  <Pressable onPress={onPress} style={[styles.btn, tone === 'danger' && { backgroundColor: '#fdeced' }]}>
    <Text style={{ color: tone === 'danger' ? theme.danger : '#fff', fontWeight: '700', fontSize: 13 }}>{label}</Text>
  </Pressable>
);

const styles = StyleSheet.create({
  fab: { position: 'absolute', right: 14, bottom: 34, width: 42, height: 42, borderRadius: 21, backgroundColor: '#1c2024', alignItems: 'center', justifyContent: 'center', opacity: 0.85 },
  sheet: { flex: 1, backgroundColor: theme.surface },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderColor: theme.border },
  h1: { fontSize: 18, fontWeight: '800', color: theme.text },
  h2: { fontSize: 12, fontWeight: '800', color: theme.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  close: { color: theme.brand, fontWeight: '700' },
  input: { borderWidth: 1, borderColor: theme.border, borderRadius: 10, padding: 12, fontSize: 14, color: theme.text },
  btn: { backgroundColor: theme.brand, paddingVertical: 11, borderRadius: 10, alignItems: 'center' },
  chip: { borderWidth: 1, borderColor: theme.border, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 7 },
  kv: { fontSize: 12, color: theme.muted },
  note: { fontSize: 11, color: theme.muted, lineHeight: 16 },
});
