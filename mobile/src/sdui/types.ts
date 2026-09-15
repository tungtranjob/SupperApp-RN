/** ---- Kiểu dữ liệu của DSL. Server và app phải thống nhất đúng file này. ---- */

export type SduiNode = {
  /** Tên component trong registry: "Text", "Button", "Card", ... */
  type: string;
  props?: Record<string, any>;
  children?: SduiNode[];
  /** Map tên sự kiện → chuỗi action: { onPress: [...], onChangeText: [...] } */
  actions?: Record<string, SduiAction[]>;
  /** Biểu thức; falsy thì node không được render. Ví dụ: "state.error" hoặc "!state.loading" */
  if?: string;
  /** Lặp node theo một mảng trong context. */
  repeat?: { items: string; as: string };
};

export type SduiAction =
  | { type: 'setState'; path: string; value: any }
  | { type: 'http'; method?: string; url: string; body?: any; headers?: Record<string, string>; saveAs?: string; onError?: SduiAction[] }
  | { type: 'setAuth'; from: string }
  | { type: 'logout' }
  | { type: 'navigate'; to: string; params?: Record<string, any>; reset?: boolean; replace?: boolean }
  | { type: 'goBack' }
  /**
   * ĐƯỜNG MAY DUY NHẤT GIỮA HƯỚNG A VÀ HƯỚNG B.
   *
   * Mở một mini-app React Native thật (remote bundle) từ một layout JSON. Nhờ
   * action này, DASHBOARD vẫn là nơi quyết định mini-app xuất hiện ở đâu trên
   * trang chủ — hướng B không cướp quyền của hướng A, nó chỉ thêm một loại đích.
   */
  | { type: 'openMiniApp'; id: string; params?: Record<string, any> }
  | { type: 'toast'; title?: string; message: string }
  | { type: 'openUrl'; url: string }
  | { type: 'refresh' }
  | { type: 'delay'; ms: number };

export type ScreenDef = {
  id: string;
  route: string;
  title: string;
  icon?: string;
  requiresAuth: boolean;
  showInMenu?: boolean;
  version: number;
  minSdui?: number;
  onLoad?: SduiAction[];
  initialState?: Record<string, any>;
  layout: SduiNode;
  updatedAt?: string;
};

export type ManifestScreen = Pick<
  ScreenDef,
  'id' | 'route' | 'title' | 'icon' | 'requiresAuth' | 'showInMenu' | 'version' | 'minSdui'
>;

export type Manifest = {
  revision: string;
  channel: string;
  entry: string;
  home: string;
  sduiVersion: number;
  screens: ManifestScreen[];
  updatedAt?: string;
};
