import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Channel, STORAGE_KEYS } from '../config';
import { Manifest } from '../sdui/types';
import { fetchManifest, getCachedManifest, getBundledManifest, clearRemoteCache } from './screenStore';

type Source = 'cache' | 'network' | 'bundled' | null;

type RemoteAppValue = {
  status: 'loading' | 'ready' | 'error';
  manifest: Manifest | null;
  source: Source;
  error: string | null;
  channel: Channel;
  setChannel: (c: Channel) => void;
  /** gọi lại /api/manifest, cập nhật nếu revision khác */
  revalidate: () => Promise<void>;
  /** xoá sạch cache rồi tải lại từ server */
  hardReload: () => Promise<void>;
  autoRefresh: boolean;
  setAutoRefresh: (v: boolean) => void;
};

const Ctx = createContext<RemoteAppValue>(null as any);
export const useRemoteApp = () => useContext(Ctx);

const POLL_MS = 8000;

export const RemoteAppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [source, setSource] = useState<Source>(null);
  const [error, setError] = useState<string | null>(null);
  const [channel, setChannelState] = useState<Channel>('production');
  const [autoRefresh, setAutoRefresh] = useState(__DEV__);
  const revisionRef = useRef<string | null>(null);

  const apply = useCallback((m: Manifest, src: Source) => {
    // Chỉ set state khi revision thật sự đổi → tránh render lại vô ích mỗi lần poll.
    if (revisionRef.current === m.revision && src !== 'network') return;
    const changed = revisionRef.current !== m.revision;
    revisionRef.current = m.revision;
    if (changed) setManifest(m);
    setSource(src);
    setStatus('ready');
    setError(null);
  }, []);

  /** boot: cache trước (hiện ngay), rồi network, cuối cùng mới tới bundled */
  const boot = useCallback(async (ch: Channel) => {
    setStatus('loading');
    revisionRef.current = null;

    const cached = await getCachedManifest(ch);
    if (cached) apply(cached, 'cache');

    try {
      const fresh = await fetchManifest(ch);
      apply(fresh, 'network');
    } catch (e: any) {
      if (!cached) {
        const bundledManifest = getBundledManifest();
        if (bundledManifest) {
          apply(bundledManifest, 'bundled');
          setError(`Không kết nối được máy chủ (${e.message}) — đang dùng bản đóng gói sẵn`);
        } else {
          setStatus('error');
          setError(e.message);
        }
      }
    }
  }, [apply]);

  useEffect(() => { void boot(channel); }, [channel, boot]);

  /** khôi phục channel đã chọn trong Dev Panel */
  useEffect(() => {
    (async () => {
      const saved = (await AsyncStorage.getItem(STORAGE_KEYS.channel)) as Channel | null;
      if (saved === 'draft' || saved === 'production') setChannelState(saved);
    })();
  }, []);

  const setChannel = useCallback((c: Channel) => {
    void AsyncStorage.setItem(STORAGE_KEYS.channel, c);
    setChannelState(c);
  }, []);

  const revalidate = useCallback(async () => {
    try {
      const fresh = await fetchManifest(channel);
      apply(fresh, 'network');
    } catch { /* offline: giữ nguyên bản đang dùng */ }
  }, [channel, apply]);

  const hardReload = useCallback(async () => {
    await clearRemoteCache();
    await boot(channel);
  }, [channel, boot]);

  /** Tự kiểm tra bản mới: khi app quay lại foreground + polling nhẹ lúc dev. */
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => { if (s === 'active') void revalidate(); });
    return () => sub.remove();
  }, [revalidate]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => { void revalidate(); }, POLL_MS);
    return () => clearInterval(id);
  }, [autoRefresh, revalidate]);

  const value = useMemo<RemoteAppValue>(
    () => ({ status, manifest, source, error, channel, setChannel, revalidate, hardReload, autoRefresh, setAutoRefresh }),
    [status, manifest, source, error, channel, setChannel, revalidate, hardReload, autoRefresh],
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};
