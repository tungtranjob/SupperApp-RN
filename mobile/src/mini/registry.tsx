import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { HOST_VERSION, STORAGE_KEYS, type Channel } from '../config';
import { request } from '../api/client';
import { useRemoteApp } from '../remote/RemoteAppProvider';
import { rememberDescriptor, forgetAllDescriptors } from './scriptLocator';
import type { MiniAppDescriptor, MiniRegistry } from './types';

/**
 * Tải và giữ DANH BẠ MINI-APP.
 *
 * Cùng chiến lược ba tầng với RemoteAppProvider của hướng A: CACHE hiện ngay để
 * không có màn hình trắng, rồi NETWORK cập nhật nền. Khác một điểm quan trọng:
 * ở đây `hostVersion` được gửi lên server, nên danh sách trả về đã được lọc theo
 * đúng khả năng của bản app này.
 */

type MiniRegistryValue = {
  status: 'loading' | 'ready' | 'error';
  apps: MiniAppDescriptor[];
  error: string | null;
  /** Lấy descriptor theo id, hoặc null nếu thiết bị này không mở được. */
  get: (id: string) => MiniAppDescriptor | null;
  reload: () => Promise<void>;
};

const MiniRegistryContext = createContext<MiniRegistryValue>(null as any);

export const MiniRegistryProvider: React.FC<{
  children: React.ReactNode;
  channel?: Channel;
}> = ({ children, channel: channelProp }) => {
  /**
   * Mặc định dùng CHUNG kênh với hướng A.
   *
   * Dev Panel đổi sang `draft` là để QA xem bản chưa publish. Nếu mini-app không
   * theo kênh đó thì QA sẽ thấy màn hình SDUI bản nháp nhưng mini-app bản
   * production — một trạng thái lai không tồn tại ở đâu trong thực tế, và là
   * cách chắc chắn để bỏ sót lỗi.
   */
  const remote = useRemoteApp();
  const channel: Channel = channelProp ?? remote?.channel ?? 'production';

  const [status, setStatus] = useState<MiniRegistryValue['status']>('loading');
  const [apps, setApps] = useState<MiniAppDescriptor[]>([]);
  const [error, setError] = useState<string | null>(null);

  /**
   * Mỗi lần danh sách đổi, nạp lại bản đồ tra khoá ký trong scriptLocator.
   *
   * Phải làm ở một chỗ duy nhất như thế này. Nếu để nơi khác tự nhớ descriptor,
   * sẽ có lúc registry đã cập nhật mà bản đồ khoá còn trỏ vào version cũ — và
   * triệu chứng là chữ ký "sai" một cách bí ẩn.
   */
  const apply = useCallback((list: MiniAppDescriptor[]) => {
    forgetAllDescriptors();
    list.forEach(rememberDescriptor);
    setApps(list);
  }, []);

  const load = useCallback(async () => {
    const cacheKey = STORAGE_KEYS.miniRegistry(channel);

    // 1) CACHE — hiện ngay, kể cả khi đang offline.
    try {
      const cached = await AsyncStorage.getItem(cacheKey);
      if (cached) {
        const parsed: MiniRegistry = JSON.parse(cached);
        apply(parsed.apps ?? []);
        setStatus('ready');
      }
    } catch {
      // Cache hỏng không phải lỗi đáng dừng — mạng sẽ sửa ở bước sau.
    }

    // 2) NETWORK — cập nhật.
    try {
      const fresh = await request<MiniRegistry>(
        `/api/mini-apps?channel=${channel}&hostVersion=${HOST_VERSION}&platform=${Platform.OS}`,
      );
      apply(fresh.apps ?? []);
      setStatus('ready');
      setError(null);
      await AsyncStorage.setItem(cacheKey, JSON.stringify(fresh));
    } catch (e: any) {
      setError(e?.message ?? 'Không tải được danh sách mini-app');
      // Có cache thì vẫn dùng được; không có thì mới coi là lỗi.
      setStatus((prev) => (prev === 'ready' ? 'ready' : 'error'));
    }
  }, [channel, apply]);

  useEffect(() => {
    void load();
  }, [load]);

  const get = useCallback(
    (id: string) => apps.find((a) => a.id === id) ?? null,
    [apps],
  );

  const value = useMemo(
    () => ({ status, apps, error, get, reload: load }),
    [status, apps, error, get, load],
  );

  return (
    <MiniRegistryContext.Provider value={value}>{children}</MiniRegistryContext.Provider>
  );
};

export const useMiniRegistry = () => useContext(MiniRegistryContext);
