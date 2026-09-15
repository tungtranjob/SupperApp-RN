import { Alert, Linking } from 'react-native';
import { SduiAction } from './types';
import { bind, evalExpr, BindContext } from './bind';
import { request, ApiError } from '../api/client';

/**
 * ACTION RUNNER — "phần logic" mà server điều khiển.
 * Mỗi handler trong JSON là một MẢNG action chạy tuần tự.
 * Action sau nhìn thấy state mà action trước vừa ghi (nhờ buildContext() gọi lại mỗi vòng).
 */

export type ActionRuntime = {
  buildContext: (scope?: BindContext) => BindContext;
  setStatePath: (path: string, value: any) => void;
  navigate: (to: string, params?: any, opts?: { reset?: boolean; replace?: boolean }) => void;
  goBack: () => void;
  setAuth: (payload: { token: string; user: any }) => Promise<void> | void;
  logout: () => Promise<void> | void;
  refresh: () => void;
};

export async function runActions(
  actions: SduiAction[] | undefined,
  rt: ActionRuntime,
  scope: BindContext = {},
): Promise<void> {
  if (!actions?.length) return;

  for (const action of actions) {
    // Mỗi vòng lặp dựng lại context để thấy state mới nhất.
    const ctx = rt.buildContext(scope);
    const stop = await runOne(action, ctx, rt, scope);
    if (stop) return;
  }
}

/** trả về true nghĩa là dừng cả chuỗi (ví dụ http lỗi và đã chạy onError) */
async function runOne(
  action: SduiAction,
  ctx: BindContext,
  rt: ActionRuntime,
  scope: BindContext,
): Promise<boolean> {
  switch (action.type) {
    case 'openMiniApp': {
      // Điều hướng tới màn hình chứa mini-app. Toàn bộ việc tải, xác minh chữ ký
      // và bọc error boundary nằm ở MiniAppScreen — action runner của SDUI không
      // cần biết gì về Module Federation.
      rt.navigate('__mini', {
        id: bind(action.id, ctx),
        params: action.params ? bind(action.params, ctx) : {},
      });
      return false;
    }

    case 'setState': {
      rt.setStatePath(bind(action.path, ctx), bind(action.value, ctx));
      return false;
    }

    case 'http': {
      const url = bind(action.url, ctx);
      try {
        const data = await request(url, {
          method: bind(action.method, ctx) || 'GET',
          body: action.body ? bind(action.body, ctx) : undefined,
          headers: action.headers ? bind(action.headers, ctx) : undefined,
        });
        if (action.saveAs) rt.setStatePath(action.saveAs, data);
        return false;
      } catch (e) {
        const err = e as ApiError;
        const errCtx = { ...rt.buildContext(scope), error: { message: err.message, status: err.status ?? 0 } };
        if (action.onError?.length) {
          for (const a of action.onError) {
            await runOne(a, { ...errCtx }, rt, scope);
          }
        } else {
          Alert.alert('Lỗi', err.message);
        }
        return true; // dừng chuỗi
      }
    }

    case 'setAuth': {
      // action.from là một ĐƯỜNG DẪN ("state.auth"), không phải chuỗi có binding.
      const payload: any = action.from ? evalExpr(action.from, ctx) : null;
      if (payload?.token) await rt.setAuth(payload);
      return false;
    }

    case 'logout': {
      await rt.logout();
      return false;
    }

    case 'navigate': {
      rt.navigate(bind(action.to, ctx), action.params ? bind(action.params, ctx) : undefined, {
        reset: action.reset,
        replace: action.replace,
      });
      return false;
    }

    case 'goBack':
      rt.goBack();
      return false;

    case 'toast':
      Alert.alert(bind(action.title ?? 'Thông báo', ctx), bind(action.message, ctx));
      return false;

    case 'openUrl': {
      const url = bind(action.url, ctx);
      if (url) Linking.openURL(url).catch(() => Alert.alert('Lỗi', 'Không mở được liên kết'));
      return false;
    }

    case 'refresh':
      rt.refresh();
      return false;

    case 'delay':
      await new Promise((r) => setTimeout(r, (action as any).ms ?? 300));
      return false;

    default: {
      // Server gửi action mà app này chưa biết → bỏ qua, không crash.
      console.warn('[SDUI] action chưa hỗ trợ:', (action as any)?.type);
      return false;
    }
  }
}
