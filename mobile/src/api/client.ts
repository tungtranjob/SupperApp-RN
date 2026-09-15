import AsyncStorage from '@react-native-async-storage/async-storage';
import { DEFAULT_API_BASE, STORAGE_KEYS } from '../config';

let apiBase = DEFAULT_API_BASE;
let authToken: string | null = null;

export function getApiBase() { return apiBase; }
export async function setApiBase(base: string) {
  apiBase = base.replace(/\/+$/, '');
  await AsyncStorage.setItem(STORAGE_KEYS.apiBase, apiBase);
}
export async function restoreApiBase() {
  const saved = await AsyncStorage.getItem(STORAGE_KEYS.apiBase);
  if (saved) apiBase = saved;
  return apiBase;
}

export function setAuthToken(token: string | null) { authToken = token; }
export function getAuthToken() { return authToken; }

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export type RequestOptions = {
  method?: string;
  body?: any;
  headers?: Record<string, string>;
  timeoutMs?: number;
};

/** url có thể là "/api/..." (ghép với apiBase) hoặc URL tuyệt đối. */
export async function request<T = any>(url: string, opts: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, headers = {}, timeoutMs = 10000 } = opts;
  const full = /^https?:\/\//.test(url) ? url : `${apiBase}${url.startsWith('/') ? '' : '/'}${url}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(full, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body ? { 'Content-Type': 'application/json' } : {}),
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });

    const text = await res.text();
    const data = text ? safeJson(text) : null;

    if (!res.ok) {
      throw new ApiError(data?.message || `Lỗi ${res.status}`, res.status);
    }
    return data as T;
  } catch (e: any) {
    if (e instanceof ApiError) throw e;
    if (e?.name === 'AbortError') throw new ApiError('Hết thời gian chờ máy chủ', 0);
    throw new ApiError(e?.message || 'Không kết nối được máy chủ', 0);
  } finally {
    clearTimeout(timer);
  }
}

function safeJson(text: string) {
  try { return JSON.parse(text); } catch { return { message: text }; }
}
