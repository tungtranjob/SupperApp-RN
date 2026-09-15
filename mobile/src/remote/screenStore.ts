import AsyncStorage from '@react-native-async-storage/async-storage';
import { request } from '../api/client';
import { STORAGE_KEYS, Channel } from '../config';
import { Manifest, ScreenDef } from '../sdui/types';
import bundled from '../fallback/bundled.json';

/**
 * Chiến lược tải UI từ xa — đúng thứ tự ưu tiên của một super app:
 *
 *   1. CACHE   → hiện ngay lập tức, không màn hình trắng (stale-while-revalidate)
 *   2. NETWORK → tải bản mới ở nền, khác thì cập nhật
 *   3. BUNDLED → bản đóng gói sẵn trong app, dùng cho lần mở đầu tiên khi offline
 *
 * Nhờ 3 lớp này app KHÔNG BAO GIỜ chết vì server sập hay mất mạng.
 */

/* --------------------------------- cache --------------------------------- */

async function readCache<T>(key: string): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch { return null; }
}

async function writeCache(key: string, value: any) {
  try { await AsyncStorage.setItem(key, JSON.stringify(value)); } catch {}
}

export async function clearRemoteCache() {
  const keys = await AsyncStorage.getAllKeys();
  const mine = keys.filter((k) => k.startsWith('sdui:'));
  if (mine.length) await AsyncStorage.multiRemove(mine);
}

/* -------------------------------- manifest ------------------------------- */

export const getCachedManifest = (channel: Channel) =>
  readCache<Manifest>(STORAGE_KEYS.manifest(channel));

export async function fetchManifest(channel: Channel): Promise<Manifest> {
  const data = await request<Manifest>(`/api/manifest?channel=${channel}`);
  await writeCache(STORAGE_KEYS.manifest(channel), data);
  return data;
}

export function getBundledManifest(): Manifest {
  return bundled.manifest as unknown as Manifest;
}

/* --------------------------------- screen -------------------------------- */

export const getCachedScreen = (channel: Channel, route: string) =>
  readCache<ScreenDef>(STORAGE_KEYS.screen(channel, route));

export async function fetchScreen(channel: Channel, route: string): Promise<ScreenDef> {
  const data = await request<ScreenDef>(`/api/screens/${route}?channel=${channel}`);
  await writeCache(STORAGE_KEYS.screen(channel, route), data);
  return data;
}

export function getBundledScreen(route: string): ScreenDef | null {
  const map = bundled.screens as Record<string, any>;
  return (map[route] as ScreenDef) ?? null;
}

/**
 * Lấy layout một màn hình:
 *  - trả về ngay bản cache/bundled (nếu có) qua callback `onLocal`
 *  - đồng thời gọi mạng, có bản mới hơn thì gọi `onRemote`
 */
export async function loadScreen(
  channel: Channel,
  route: string,
  handlers: { onLocal?: (def: ScreenDef) => void; onRemote?: (def: ScreenDef) => void; onError?: (e: Error) => void },
): Promise<void> {
  const local = (await getCachedScreen(channel, route)) ?? getBundledScreen(route);
  if (local) handlers.onLocal?.(local);

  try {
    const fresh = await fetchScreen(channel, route);
    if (!local || local.version !== fresh.version) handlers.onRemote?.(fresh);
    else handlers.onRemote?.(fresh); // vẫn báo để tắt trạng thái "đang tải"
  } catch (e) {
    if (!local) handlers.onError?.(e as Error);
  }
}
