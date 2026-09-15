/**
 * 3 màn hình mẫu, viết hoàn toàn bằng JSON (SDUI DSL).
 * Đây chính là thứ dashboard sẽ sửa và app mobile sẽ render.
 *
 * Cú pháp node:
 *   { type, props?, children?, actions?, if?, repeat? }
 *
 * Binding trong props:  "{{state.email}}"  "{{user.name}}"  "{{state.home.balance | currency}}"
 * Điều kiện hiển thị :  "if": "state.error"      (hoặc "!state.loading")
 * Lặp danh sách      :  "repeat": { "items": "state.home.services", "as": "svc" }
 */

const now = () => new Date().toISOString();

/* ------------------------------------------------------------------ LOGIN */
const loginLayout = {
  type: 'Screen',
  props: { scroll: true, padding: 24, background: '#ffffff' },
  children: [
    { type: 'Spacer', props: { size: 40 } },
    { type: 'Text', props: { text: '💜', size: 56, align: 'center' } },
    { type: 'Spacer', props: { size: 8 } },
    { type: 'Heading', props: { text: 'SupperPay', align: 'center' } },
    { type: 'Caption', props: { text: 'Màn hình này được tải từ server — sửa trên dashboard là app đổi ngay', align: 'center' } },
    { type: 'Spacer', props: { size: 28 } },

    {
      type: 'Input',
      props: { label: 'Email', value: '{{state.email}}', placeholder: 'demo@supper.app', keyboardType: 'email-address' },
      actions: { onChangeText: [{ type: 'setState', path: 'email', value: '{{event.text}}' }] },
    },
    {
      type: 'Input',
      props: { label: 'Mật khẩu', value: '{{state.password}}', placeholder: '••••••', secure: true },
      actions: { onChangeText: [{ type: 'setState', path: 'password', value: '{{event.text}}' }] },
    },

    { type: 'Banner', props: { text: '{{state.error}}', tone: 'danger' }, if: 'state.error' },
    { type: 'Spacer', props: { size: 16 } },

    {
      type: 'Button',
      props: { title: 'Đăng nhập', loading: '{{state.loading}}' },
      actions: {
        onPress: [
          { type: 'setState', path: 'error', value: '' },
          { type: 'setState', path: 'loading', value: true },
          {
            type: 'http',
            method: 'POST',
            url: '/api/auth/login',
            body: { email: '{{state.email}}', password: '{{state.password}}' },
            saveAs: 'auth',
            onError: [
              { type: 'setState', path: 'loading', value: false },
              { type: 'setState', path: 'error', value: '{{error.message}}' },
            ],
          },
          { type: 'setState', path: 'loading', value: false },
          { type: 'setAuth', from: 'state.auth' },
          { type: 'navigate', to: 'home', reset: true },
        ],
      },
    },

    { type: 'Spacer', props: { size: 12 } },
    { type: 'Caption', props: { text: 'demo@supper.app / 123456', align: 'center' } },
  ],
};

/* ------------------------------------------------------------------- HOME */
const homeLayout = {
  type: 'Screen',
  props: { scroll: true, background: '#f4f4f7', refreshable: true },
  children: [
    {
      type: 'View',
      props: { background: '#a50064', padding: 20, paddingTop: 16, radiusBottom: 24 },
      children: [
        {
          type: 'Row',
          props: { align: 'center', gap: 12 },
          children: [
            { type: 'Avatar', props: { emoji: '{{user.avatar}}' } },
            {
              type: 'View',
              props: { flex: 1 },
              children: [
                { type: 'Text', props: { text: 'Xin chào,', color: '#f0c8e0', size: 13 } },
                { type: 'Text', props: { text: '{{user.name}}', color: '#ffffff', size: 18, weight: 'bold' } },
              ],
            },
            { type: 'Badge', props: { text: '{{user.tier}}' } },
          ],
        },
        { type: 'Spacer', props: { size: 18 } },
        { type: 'Text', props: { text: 'Số dư khả dụng', color: '#f0c8e0', size: 13 } },
        { type: 'Text', props: { text: '{{state.home.balance | currency}}', color: '#ffffff', size: 30, weight: 'bold' } },
      ],
    },

    {
      type: 'Card',
      props: { margin: 16 },
      children: [
        { type: 'Text', props: { text: 'Dịch vụ', size: 15, weight: 'bold' } },
        { type: 'Spacer', props: { size: 12 } },
        {
          type: 'Grid',
          props: { columns: 4 },
          children: [
            {
              // DỊCH VỤ CÓ MINI-APP THẬT (hướng B).
              // Bấm vào là tải một bundle React Native chưa từng có trong bản
              // build đang chạy, xác minh chữ ký ở tầng native, rồi thực thi.
              type: 'ServiceIcon',
              if: 'svc.miniApp',
              repeat: { items: 'state.home.services', as: 'svc' },
              props: { emoji: '{{svc.emoji}}', label: '{{svc.label}}', color: '{{svc.color}}' },
              actions: { onPress: [{ type: 'openMiniApp', id: '{{svc.miniApp}}' }] },
            },
            {
              // Dịch vụ chưa có mini-app — vẫn là hướng A thuần.
              type: 'ServiceIcon',
              if: '!svc.miniApp',
              repeat: { items: 'state.home.services', as: 'svc' },
              props: { emoji: '{{svc.emoji}}', label: '{{svc.label}}', color: '{{svc.color}}' },
              actions: { onPress: [{ type: 'toast', title: '{{svc.label}}', message: 'Dịch vụ này chưa có mini-app' }] },
            },
          ],
        },
      ],
    },

    {
      type: 'Card',
      props: { margin: 16, marginTop: 0 },
      children: [
        { type: 'Text', props: { text: 'Giao dịch gần đây', size: 15, weight: 'bold' } },
        { type: 'Spacer', props: { size: 4 } },
        {
          type: 'ListItem',
          repeat: { items: 'state.home.transactions', as: 'tx' },
          props: {
            emoji: '{{tx.emoji}}',
            title: '{{tx.title}}',
            subtitle: '{{tx.time}}',
            value: '{{tx.amount | signedCurrency}}',
            valueColor: '{{tx.color}}',
          },
        },
        { type: 'Caption', props: { text: 'Chưa có giao dịch nào' }, if: '!state.home.transactions' },
      ],
    },

    {
      type: 'View',
      props: { padding: 16, paddingTop: 0 },
      children: [
        {
          type: 'Button',
          props: { title: 'Xem hồ sơ', variant: 'secondary' },
          actions: { onPress: [{ type: 'navigate', to: 'profile' }] },
        },
      ],
    },
    { type: 'Spacer', props: { size: 24 } },
  ],
};

/* ---------------------------------------------------------------- PROFILE */
const profileLayout = {
  type: 'Screen',
  props: { scroll: true, background: '#f4f4f7' },
  children: [
    {
      type: 'View',
      props: { padding: 24, align: 'center', background: '#ffffff' },
      children: [
        { type: 'Avatar', props: { emoji: '{{user.avatar}}', size: 72 } },
        { type: 'Spacer', props: { size: 12 } },
        { type: 'Text', props: { text: '{{user.name}}', size: 20, weight: 'bold' } },
        { type: 'Caption', props: { text: '{{user.email}}' } },
      ],
    },
    { type: 'Spacer', props: { size: 16 } },
    {
      type: 'Card',
      props: { margin: 16, marginTop: 0 },
      children: [
        { type: 'ListItem', props: { emoji: '📱', title: 'Số điện thoại', value: '{{user.phone}}' } },
        { type: 'Divider' },
        { type: 'ListItem', props: { emoji: '💎', title: 'Hạng thành viên', value: '{{user.tier}}' } },
        { type: 'Divider' },
        { type: 'ListItem', props: { emoji: '🆔', title: 'User ID', value: '{{user.id}}' } },
      ],
    },
    {
      type: 'View',
      props: { padding: 16, paddingTop: 0 },
      children: [
        {
          type: 'Button',
          props: { title: 'Đăng xuất', variant: 'danger' },
          actions: { onPress: [{ type: 'logout' }, { type: 'navigate', to: 'login', reset: true }] },
        },
      ],
    },
  ],
};

/* ------------------------------------------------------------------------ */

function mk({ id, route, title, icon, requiresAuth, showInMenu, layout, onLoad = [], initialState = {} }) {
  return {
    id,
    route,
    title,
    icon,
    requiresAuth,
    showInMenu,
    draftVersion: 1,
    publishedVersion: 1,
    versions: [
      { version: 1, layout, onLoad, initialState, minSdui: 1, note: 'seed', createdAt: now() },
    ],
  };
}

export function seedScreens() {
  return [
    mk({
      id: 'login', route: 'login', title: 'Đăng nhập', icon: '🔐',
      requiresAuth: false, showInMenu: false,
      layout: loginLayout,
      initialState: { email: 'demo@supper.app', password: '123456', loading: false, error: '' },
    }),
    mk({
      id: 'home', route: 'home', title: 'Trang chủ', icon: '🏠',
      requiresAuth: true, showInMenu: true,
      layout: homeLayout,
      onLoad: [{ type: 'http', method: 'GET', url: '/api/home/summary', saveAs: 'home' }],
    }),
    mk({
      id: 'profile', route: 'profile', title: 'Hồ sơ', icon: '👤',
      requiresAuth: true, showInMenu: true,
      layout: profileLayout,
    }),
  ];
}
