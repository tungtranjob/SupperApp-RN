# SupperApp

Super app React Native đổi được giao diện và tính năng **mà không phải phát hành lại lên
store**. Repo chạy được đầy đủ cả hai kỹ thuật mà các super app thật dùng chung với nhau:

| | Kỹ thuật | Dùng cho | Trong repo |
|---|---|---|---|
| **A** | **Server-Driven UI (SDUI)** — server gửi JSON mô tả màn hình, app render bằng bộ component dựng sẵn | Phần lớn màn hình: trang chủ, biểu mẫu, campaign | Login / Home / Profile, sửa và publish trên dashboard |
| **B** | **Remote JS bundle** — mini-app React Native thật, nạp lúc chạy qua Re.Pack + Module Federation, có ký số | Tính năng mà JSON không mô tả nổi, hoặc do đội/đối tác khác viết | Mini-app **Bảo hiểm** và **Đầu tư**, mỗi cái do một đội ký bằng khoá riêng |

```
┌─────────────────┐   JSON layout    ┌─────────────────┐   REST    ┌──────────────────┐
│  dashboard/     │ ───────────────► │   backend/      │ ────────► │    mobile/       │
│  React + Vite   │   publish        │  Node + Express │  manifest │  APP VỎ          │
│  soạn & preview │ ◄─────────────── │  version+publish│  + layout │  React Native    │
└─────────────────┘                  │                 │           │  + Re.Pack       │
                                     │  registry       │  bundle   │                  │
┌─────────────────┐   bundle đã ký   │  mini-app       │  đã ký    │  ├ SDUI Renderer │
│  mini-apps/     │ ───────────────► │  + xác minh     │ ────────► │  └ Module        │
│  React Native   │   mini:publish   │    chữ ký       │           │    Federation    │
└─────────────────┘                  └─────────────────┘           └──────────────────┘
```

## Mục lục

1. [Chạy thử](#1-chạy-thử)
2. [Vì sao không "tải file .js rồi eval"](#2-vì-sao-không-tải-file-js-rồi-eval)
3. [Cấu trúc thư mục](#3-cấu-trúc-thư-mục)
4. [Hướng A — Server-Driven UI](#4-hướng-a--server-driven-ui)
5. [Hướng B — Mini-app remote bundle](#5-hướng-b--mini-app-remote-bundle)
6. [Kịch bản demo](#6-kịch-bản-demo)
7. [Kiểm thử](#7-kiểm-thử)
8. [Các lệnh npm](#8-các-lệnh-npm)
9. [Còn thiếu gì để lên production](#9-còn-thiếu-gì-để-lên-production)

---

## 1. Chạy thử

**Cần:** Node **20.11+**, Xcode (iOS) hoặc Android Studio (Android).

App vỏ là React Native dùng Expo prebuild, **không chạy được trên Expo Go** — Expo Go
không có native ScriptManager mà hướng B cần. Lần build native đầu tiên mất khoảng 5–10 phút.

```bash
# 0) Cài đặt, sinh khoá ký cho hai đội mini-app, nhúng khoá CÔNG vào app vỏ
npm run install:all
npm run keys:gen       # tạo keys/team-insurance.pem, keys/team-invest.pem
npm run keys:sync      # ghi khoá công vào mobile/src/mini/trustStore.ts

# 1) Backend          → http://localhost:4000
npm run backend

# 2) Dashboard        → http://localhost:5173
npm run dashboard

# 3) Dev server app vỏ (cổng 8081)
npm start

# 4) Build & cài app lên simulator (terminal khác)
npm run ios            # hoặc: npm run android

# 5) Build, ký, publish cả hai mini-app (cần backend đang chạy)
npm run mini:release
```

Tài khoản demo: **demo@supper.app** / **123456**

> **Chạy trên điện thoại thật?** App tự đoán IP LAN của máy dev. Nếu vẫn không gọi được
> API, mở **Dev Panel** (nút 🛠 góc dưới phải) và đặt địa chỉ backend thành
> `http://<IP-máy-bạn>:4000`.

---

## 2. Vì sao không "tải file .js rồi eval"

Cách đầu tiên ai cũng nghĩ tới — server trả code dạng chuỗi, app `eval()` — **không dùng được**:

1. **Hermes**, JS engine mặc định của React Native, **không hỗ trợ `eval()` hay `new Function()`**.
   Code được biên dịch sẵn thành bytecode, lúc chạy không có trình biên dịch.
2. Kể cả eval được thì cũng **không nên**: ai chiếm được server hoặc chen được vào đường
   truyền sẽ chạy được code tuỳ ý trong app — đọc token, đọc dữ liệu người dùng (RCE).

Các super app thật đi theo một trong ba hướng:

| | Cách làm | Ưu | Nhược | Ví dụ |
|---|---|---|---|---|
| **A** | Server-Driven UI | An toàn, nhẹ, đổi tức thì, không đụng native | Chỉ ghép được từ component app đã có | MoMo (trang chủ, campaign), Airbnb, Shopee, Lyft |
| **B** | Remote JS bundle, nạp bằng native ScriptManager (không qua eval) | Mini-app là React Native thật, toàn quyền về UI và logic | Cấu hình rspack phức tạp, phải ký bundle, quản lý tương thích native | MoMo mini-app, Grab |
| **C** | WebView mini-program + JS bridge | Cách ly tốt nhất, tận dụng hệ sinh thái web | Hiệu năng và cảm giác kém native | Zalo Mini App, WeChat |

Repo này làm **A và B**, theo đúng cách chúng được phối hợp: A là nền cho phần lớn màn hình,
B chỉ dành cho những mini-app thật sự cần. Hướng C nằm ngoài phạm vi.

---

## 3. Cấu trúc thư mục

```
supper-app/
├── shared-deps.mjs              nguồn sự thật cho `shared` của Module Federation
├── keys/                        khoá ký mini-app (.pem bị gitignore, .pem.pub được commit)
│
├── backend/                     Node + Express, dữ liệu lưu file JSON
│   ├── src/seed/screens.js      3 màn hình mẫu viết bằng JSON  ← nên đọc đầu tiên
│   ├── src/store.js             A: version / publish / rollback / revision
│   ├── src/routes/app.js        A: API cho mobile (manifest + layout)
│   ├── src/routes/admin.js      A: API cho dashboard (CRUD + publish)
│   ├── src/routes/auth.js       đăng nhập demo
│   ├── src/mini/store.js        B: registry mini-app + mô hình quyền
│   ├── src/mini/signature.js    B: xác minh chữ ký bundle lúc publish
│   ├── src/mini/keys.js         B: đọc khoá công từ keys/
│   ├── src/routes/mini.js       B: registry API + phục vụ bundle đã ký
│   └── src/routes/mini-api.js   B: thao tác nghiệp vụ mini-app gọi qua bridge
│
├── dashboard/                   React + Vite
│   ├── src/pages/ScreensPage.jsx    A: danh sách + tạo màn hình
│   ├── src/pages/EditorPage.jsx     A: sửa JSON, xem trước, publish, lịch sử
│   ├── src/pages/MiniAppsPage.jsx   B: version / publish / rollback / quyền
│   └── src/preview/WebPreview.jsx   render layout trên web để xem trước
│
├── mobile/                      APP VỎ — React Native 0.86 + Expo prebuild + Re.Pack
│   ├── rspack.config.mjs        cấu hình bundler (xem mục 5.6 nếu build hỏng)
│   ├── react-native.config.js   trỏ React Native CLI sang Re.Pack thay vì Metro
│   ├── plugins/withRepack.js    Expo config plugin vá bản build native sang Re.Pack
│   ├── src/sdui/                A: kiểu DSL, binding, registry, action, renderer
│   ├── src/remote/              A: tải manifest/layout (cache → network → bundled)
│   ├── src/fallback/bundled.json    A: snapshot UI cho lần mở đầu tiên khi offline
│   ├── src/devtools/DevPanel.tsx    đổi địa chỉ backend, đổi kênh production/draft
│   └── src/mini/                B:
│       ├── trustStore.ts        SINH TỰ ĐỘNG — khoá công của từng đội
│       ├── scriptLocator.ts     URL nào xác minh bằng khoá nào
│       ├── signedResolverPlugin.ts  nối resolver của Re.Pack với khoá ký
│       ├── scriptManager.ts     cache offline + bắt lỗi gốc từ native
│       ├── loadMiniApp.ts       registerRemotes → loadRemote → timeout
│       ├── permissions.ts       lõi ranh giới quyền (test được bằng Node)
│       ├── bridge.ts            hiện thực HostBridge, tự gắn token
│       ├── registry.tsx         danh bạ mini-app (cache → network)
│       ├── MiniAppScreen.tsx    một route `__mini` dùng cho MỌI mini-app
│       ├── MiniAppBoundary.tsx  mini-app lỗi không làm sập app vỏ
│       └── linking.ts           deep link supperapp://mini/<id>
│
├── mini-apps/
│   ├── rspack.mini.mjs          cấu hình build dùng chung cho mọi mini-app
│   ├── insurance/src/App.tsx    PanResponder + Animated
│   └── invest/src/App.tsx       biểu đồ vẽ tay, FlatList, demo bị chặn quyền
│
├── packages/mini-sdk/index.ts   hợp đồng host ↔ mini-app (chỉ có kiểu)
│
├── tools/                       script build/ký/publish + test
└── docs/superpowers/specs/      tài liệu thiết kế hướng B
```

---

## 4. Hướng A — Server-Driven UI

### 4.1 DSL

Mỗi màn hình là một cây node JSON:

```json
{
  "type": "Card",
  "props": { "margin": 16 },
  "if": "state.hasData",
  "repeat": { "items": "state.list", "as": "row" },
  "actions": { "onPress": [ ... ] },
  "children": [ ... ]
}
```

| Trường | Ý nghĩa |
|---|---|
| `type` | tên component trong registry của app ([mobile/src/sdui/registry.tsx](mobile/src/sdui/registry.tsx)) |
| `props` | thuộc tính, có thể chứa binding |
| `children` | các node con |
| `actions` | map `tên sự kiện → mảng action`, chạy tuần tự |
| `if` | biểu thức; nếu falsy thì không render |
| `repeat` | nhân bản node theo một mảng, tạo biến cục bộ có tên `as` |

**Component có sẵn:** `Screen` `View` `Row` `Card` `Grid` `Text` `Heading` `Caption` `Input`
`Button` `Image` `Avatar` `Badge` `ServiceIcon` `ListItem` `Banner` `Spacer` `Divider`

Registry chính là **ranh giới an toàn** của hướng A: server chỉ ghép được UI từ các component
này. Muốn thêm khả năng mới thì thêm component vào registry, phát hành bản app mới và tăng
`SDUI_VERSION`.

### 4.2 Binding

```
"{{state.total}}"            → giữ nguyên kiểu gốc (number vẫn là number)
"Chào {{user.name}}!"        → nội suy thành chuỗi
"{{state.total | currency}}" → qua filter
"!state.loading"             → phủ định (dùng trong `if`)
```

- **Gốc dữ liệu:** `state` (state màn hình), `user` (người đăng nhập), `params` (tham số điều
  hướng), `event` (payload sự kiện, ví dụ `event.text`), `app`, và các biến do `repeat` tạo.
- **Filter:** `currency`, `signedCurrency`, `number`, `upper`, `lower`, `date`, `json`, `not`.

Engine **cố ý không dùng eval** — nó chỉ hiểu đúng tập cú pháp trên, nên đọc được, test được,
và server không chạy được code tuỳ ý. Xem [mobile/src/sdui/bind.ts](mobile/src/sdui/bind.ts).

### 4.3 Action

| Action | Công dụng |
|---|---|
| `setState` | ghi vào state: `{ "type": "setState", "path": "email", "value": "{{event.text}}" }` |
| `http` | gọi API; `saveAs` lưu kết quả vào state; `onError` chạy khi lỗi và **dừng chuỗi** |
| `setAuth` / `logout` | ghi / xoá phiên đăng nhập |
| `navigate` | chuyển màn: `{ "to": "home", "reset": true }` |
| `openMiniApp` | mở mini-app hướng B: `{ "type": "openMiniApp", "id": "insurance" }` |
| `goBack`, `toast`, `openUrl`, `refresh`, `delay` | tiện ích |

Ví dụ — toàn bộ logic đăng nhập viết bằng JSON:

```json
"onPress": [
  { "type": "setState", "path": "loading", "value": true },
  { "type": "http", "method": "POST", "url": "/api/auth/login",
    "body": { "email": "{{state.email}}", "password": "{{state.password}}" },
    "saveAs": "auth",
    "onError": [
      { "type": "setState", "path": "loading", "value": false },
      { "type": "setState", "path": "error", "value": "{{error.message}}" }
    ] },
  { "type": "setState", "path": "loading", "value": false },
  { "type": "setAuth", "from": "state.auth" },
  { "type": "navigate", "to": "home", "reset": true }
]
```

### 4.4 Luồng khi mở app

```
App khởi động
   ├─ restoreApiBase()           đọc địa chỉ backend đã lưu
   ├─ AuthProvider               khôi phục token từ AsyncStorage
   ├─ initScriptManager()        bật cache bundle mini-app, bắt lỗi gốc từ native
   │
   ├─ RemoteAppProvider          tải MANIFEST theo thứ tự:
   │     1. cache   (AsyncStorage)   → hiện ngay, không màn hình trắng
   │     2. network (/api/manifest)  → cập nhật nếu `revision` khác
   │     3. bundled (snapshot trong app) → lần đầu mở mà offline
   │
   ├─ MiniRegistryProvider       tải danh bạ mini-app (cache → network), gửi kèm
   │                             hostVersion để server lọc bỏ mini-app không tương thích
   │
   ├─ RootNavigator              sinh <Stack.Screen> từ manifest
   │                             + một route cố định `__mini` cho mọi mini-app
   │
   └─ RemoteScreen (dùng chung cho MỌI route)
         1. tải layout của route (cache → network)
         2. state = initialState
         3. chạy onLoad (thường là gọi API)
         4. RenderNode dựng cây React
         5. tương tác → chuỗi action → đổi state → render lại
```

[mobile/src/remote/RemoteScreen.tsx](mobile/src/remote/RemoteScreen.tsx) là **màn hình React
Native duy nhất** của hướng A. Nó không biết mình đang là "login", "home" hay một màn hình vừa
tạo trên dashboard — mọi thứ đến từ JSON.

---

## 5. Hướng B — Mini-app remote bundle

Chỉ dùng khi mini-app cần **logic hoặc UI mà registry không mô tả nổi** (cử chỉ, animation
theo từng frame, biểu đồ tuỳ biến), hoặc khi đội khác / đối tác tự viết bằng React Native.
Hướng A rẻ và an toàn hơn nhiều, nên phần còn lại của app vẫn dùng A.

### 5.1 Vì sao chạy được trên Hermes

Bundle được tải về và giao cho **native ScriptManager** thực thi trong JS context của app —
**không qua `eval()`**. Host và mini-app **chia sẻ** `react`, `react-native` qua Module
Federation, nên phần mã riêng của mini-app rất nhỏ:

```
__federation_expose_App.chunk.bundle     8.6 KB   ← mã thật của mini-app
miniInsurance.container.bundle            197 KB   ← runtime Module Federation
vendors-…react-native….chunk.bundle       318 KB   ← dự phòng, không tải nếu host đã có
```

### 5.2 Điểm nối giữa A và B

Mini-app xuất hiện ở đâu vẫn do **dashboard quyết định**, bằng JSON như mọi thứ khác:

```json
{ "type": "ServiceIcon",
  "if": "svc.miniApp",
  "repeat": { "items": "state.home.services", "as": "svc" },
  "actions": { "onPress": [{ "type": "openMiniApp", "id": "{{svc.miniApp}}" }] } }
```

### 5.3 Ký bundle

Cách mô tả phổ biến *"server ký, app xác minh"* **có lỗ hổng** nếu làm đúng từng chữ: khi
registry vừa trả bundle vừa trả public key, kẻ chiếm được registry chỉ cần đổi cả hai.

Ở đây registry chỉ trả **`keyId`** (một cái tên). Khoá công thật được nhúng vào app lúc build,
trong [mobile/src/mini/trustStore.ts](mobile/src/mini/trustStore.ts) (sinh bởi `npm run keys:sync`).
Hệ quả:

- Đội **đã có khoá** phát hành version mới tuỳ ý, không cần build lại app.
- Đội **mới** phải chờ một bản app mới — cho bên lạ chạy mã trong app là quyết định cần thẩm
  định, không phải một request `POST`.

Entry của remote là **container bundle đã ký**, không phải `mf-manifest.json`: Module
Federation tải manifest bằng `fetch` thường, không qua ScriptManager, nên nó không được ký và
không được cache khi offline.

### 5.4 Quyền

- Quyền có hiệu lực = **giao** của `grantedPermissions` (nền tảng cấp, lưu ở registry) và
  `requestedPermissions` (mini-app xin, khai trong từng version). Quyền bị từ chối hiện gạch
  ngang trên dashboard.
- Mini-app gọi **tên thao tác**, không gọi URL:

  ```ts
  await bridge.request('insurance.quote', { plan, age });
  ```

  App vỏ tra tên đó trong [mobile/src/mini/permissions.ts](mobile/src/mini/permissions.ts),
  ánh xạ sang HTTP và tự gắn token. Mini-app không biết địa chỉ backend và **không bao giờ
  thấy token** hay email/số điện thoại của người dùng.

### 5.5 Các lớp bảo vệ

| # | Yêu cầu | Hiện thực | Test |
|---|---|---|---|
| 1 | Ký bundle | `CodeSigningPlugin` ký mọi chunk; host xác minh `strict` bằng khoá trong trust store; server xác minh lại lúc publish | `tools/mini-signing.test.mjs` |
| 2 | Tương thích native | `minHostVersion` so với `HOST_VERSION`: server lọc khỏi registry, host chặn lần nữa lúc mở | `tools/mini-registry.test.mjs` |
| 3 | Ranh giới quyền | tên thao tác + giao quyền + lọc thông tin người dùng | `tools/mini-bridge.test.mjs` |
| 4 | Cô lập lỗi | `MiniAppBoundary` bắt lỗi render; timeout 10s; lỗi mạng thử lại 2 lần, chữ ký sai **không cho thử lại** | kiểm tay |
| 5 | Quy trình duyệt | đội mới cần khoá mới, khoá mới cần bản app mới | — |

### 5.6 Các bẫy cấu hình Re.Pack

Mỗi dòng dưới đây là một lỗi mà **build vẫn thành công nhưng app chết lúc chạy**, với thông báo
không chỉ ra nguyên nhân. Tất cả đều có chú thích tại chỗ trong
[mobile/rspack.config.mjs](mobile/rspack.config.mjs).

| Triệu chứng | Nguyên nhân |
|---|---|
| `Can't resolve '@module-federation/runtime/helpers'` | `getResolveOptions()` mặc định tắt package exports → cần `{ enablePackageExports: true }` |
| `Expected ';', '}' or <eof>` trong `View.js` | RN 0.86 dùng cú pháp `component` của Flow; `flow-remove-types` không xử lý được → phải qua `@react-native/babel-preset` |
| `View config not found for component 'RNSSafeAreaView'` | rule babel chỉ khớp `jsx?`, còn spec native của `safe-area-context` là `.ts` nên codegen không chạy |
| `Could not find component config for native component` | codegen cần đọc kiểu Flow nên phải chạy **trước** bước xoá kiểu |
| `Property 'WebSocket' doesn't exist` | `entry` khai dạng chuỗi làm `InitializeCore` không được chèn → khai `entry: { index: './index.ts' }` |
| `Multiple assets emit different content to the same filename` | có `exposes: {}` ở host sinh thêm một container entry → bỏ hẳn khoá này |
| `Invalid loadShareSync … #RUNTIME-006` | host thiếu `eager: true` cho shared deps; host phải eager, mini-app thì **không** (xem `shared-deps.mjs`) |
| `undefined cannot be used as a constructor` lúc khởi động | plugin `dev` của MF mở WebSocket trước khi RN cài polyfill → `dts: false, dev: false` |
| `factory is undefined (…/react-native)` | runtime plugin của MF chạy trước khi share scope khởi tạo, nên không được import `react-native` |

Ngoài ra, `npx expo prebuild --clean` xoá sạch `ios/` và `android/`. Cấu hình Re.Pack cho bản
build native vì vậy nằm trong [mobile/plugins/withRepack.js](mobile/plugins/withRepack.js) và
được áp lại mỗi lần prebuild.

### 5.7 Quy trình phát hành

```bash
npm run mini:build   insurance ios   # bundle bằng rspack + ký bằng keys/team-insurance.pem
npm run mini:publish insurance ios   # server xác minh chữ ký rồi nhận vào kênh nháp
# Dashboard → Mini-app → 🚀 Publish  → ra production
```

Server từ chối ngay lúc publish nếu bundle chưa ký hoặc ký sai khoá. `npm run mini:release`
gộp cả ba bước cho tiện demo; quy trình thật nên tách, vì bước cuối là quyết định của con người.

Version cũ không bao giờ bị xoá — publish và rollback chỉ đổi một con trỏ.

---

## 6. Kịch bản demo

### Hướng A

**Đổi chữ trên trang chủ.** Mở app tới **Home** → trên dashboard mở **Trang chủ**, đổi
`"text": "Số dư khả dụng"` thành `"text": "Ví của tôi"` (khung xem trước đổi ngay) → **🚀 Publish**.
Trong khoảng 8 giây (hoặc kéo xuống để refresh) app đổi theo.

**Thêm màn hình hoàn toàn mới.**

1. Dashboard → **+ Màn hình mới** → ID `promo`, tiêu đề `Khuyến mãi`, mẫu **Trang khuyến mãi** → Tạo → Publish.
2. Mở lại **Trang chủ**, thêm vào `layout.children`:

   ```json
   {
     "type": "Button",
     "props": { "title": "🎁 Xem khuyến mãi", "variant": "secondary" },
     "actions": { "onPress": [{ "type": "navigate", "to": "promo" }] }
   }
   ```

3. Publish. Nút mới xuất hiện trên app và mở được màn hình **không có trong bản build**.

**Rollback.** Trong editor, mục **Lịch sử version** → **Rollback** ở version cũ. App quay về
bản đó ngay.

**Kênh nháp.** Dev Panel → đổi kênh sang **draft**: app hiển thị bản đang soạn, chưa publish —
dùng cho QA trước khi ra mắt.

### Hướng B

**Mở mini-app.** Trên **Home**, bấm 🛡️ **Bảo hiểm** hoặc 📈 **Đầu tư**. App tải bundle, xác
minh chữ ký ở tầng native rồi chạy trong JS context của app. Thanh chọn tuổi kéo bằng
`PanResponder`, số tiền chạy bằng `Animated`, biểu đồ vẽ tay — những thứ JSON không mô tả nổi.

**Phát hành version mới.**

```bash
# sửa mini-apps/insurance/src/App.tsx, rồi:
cd mini-apps/insurance && npm version minor
cd ../.. && npm run mini:build insurance && npm run mini:publish insurance
```

Dashboard → tab **Mini-app** → **🚀 Publish** ở version mới. Thoát rồi mở lại mini-app: chạy
code mới trên đúng bản app đang cài.

**Rollback.** Tab **Mini-app** → **↩ Chuyển về bản này** ở version cũ.

**Chữ ký chặn bundle bị tráo.** Giả lập kẻ tấn công sửa bundle sau khi đã ký:

```bash
printf '\x00' | dd of=backend/mini-bundles/insurance/1.6.0/ios/__federation_expose_App.chunk.bundle \
  bs=1 seek=300 count=1 conv=notrunc
```

Mở lại mini-app: app báo **"Bản cài đặt không hợp lệ"** và **không có nút Thử lại** (tải lại
cũng chỉ nhận đúng bundle đó). Phần còn lại của app vẫn chạy. Khôi phục bằng
`npm run mini:release insurance`.

**Chặn quyền.** Mở **Đầu tư**, kéo xuống cuối, bấm **🔒 Thử gọi thao tác ngoài quyền**.
Mini-app này chỉ có `invest.portfolio`; lời gọi `insurance.quote` bị app vỏ chặn với
`PERMISSION_DENIED`.

**Deep link.**

```bash
xcrun simctl openurl booted "supperapp://mini/insurance"
```

---

## 7. Kiểm thử

```bash
npm test            # 130 test, không cần simulator
npm run typecheck   # app vỏ + 2 mini-app + mini-sdk
```

| Bộ test | Kiểm tra |
|---|---|
| `tools/sdui-bind.test.mjs` (16) | binding: giữ kiểu gốc, nội suy, filter, `if` phủ định, path không tồn tại |
| `tools/shared-deps.test.mjs` (46) | host và mini-app dùng **cùng version** react/react-native; host eager, mini-app không; mọi shared đều singleton |
| `tools/mini-registry.test.mjs` (23) | cổng `minHostVersion`; publish/rollback chỉ đổi con trỏ; quyền = giao(cấp, xin); registry không trả khoá |
| `tools/mini-bridge.test.mjs` (16) | thao tác ngoài quyền bị chặn; không thao tác nào trỏ vào `/api/admin`; mini-app không nhận token/email/phone |
| `tools/mini-signing.test.mjs` (7) | sửa 1 byte, giữ chữ ký cũ, ký bằng khoá đội khác, chưa ký → đều bị từ chối |
| `dashboard/test/editor.render.test.jsx` (22) | render thật trong jsdom trang Màn hình và Mini-app; đếm số lần render để bắt vòng lặp vô hạn; khoá không lộ ra dashboard |

**Phải kiểm tay** (nằm ở tầng native, test Node không với tới):

1. Xác minh chữ ký thật trong Swift/Kotlin của Re.Pack — dùng demo "chữ ký chặn bundle bị tráo".
2. Publish và rollback trên máy thật.
3. Offline: mở mini-app một lần, tắt backend, mở lại → mini-app chạy từ cache, chỉ lời gọi dữ
   liệu báo lỗi.
4. Android — đã cấu hình sẵn nhưng mới kiểm chứng trên iOS.

---

## 8. Các lệnh npm

Chạy ở thư mục gốc.

| Lệnh | Tác dụng |
|---|---|
| `npm run install:all` | cài dependency cho root, backend, dashboard, mobile |
| `npm run backend` | chạy backend ở chế độ watch (cổng 4000, đổi bằng `PORT`) |
| `npm run dashboard` | chạy dashboard Vite (cổng 5173) |
| `npm start` | dev server của app vỏ |
| `npm run ios` / `npm run android` | build native và cài lên simulator/emulator |
| `npm run keys:gen` | sinh cặp khoá cho từng đội mini-app vào `keys/` |
| `npm run keys:sync` | nhúng khoá công vào `mobile/src/mini/trustStore.ts` |
| `npm run mini:build <id> [ios\|android]` | build và ký một mini-app |
| `npm run mini:publish <id> [ios\|android]` | đẩy bundle đã ký lên backend (kênh nháp) |
| `npm run mini:release [id] [ios\|android]` | build + publish + đưa ra production; bỏ `id` để chạy mọi mini-app |
| `npm run export:bundled` | xuất snapshot UI hiện tại vào `mobile/src/fallback/bundled.json` |
| `npm test` | chạy toàn bộ test |
| `npm run typecheck` | kiểm tra kiểu TypeScript |

Nền tảng mặc định của các lệnh `mini:*` là `ios`.

---

## 9. Còn thiếu gì để lên production

Repo cố ý dừng ở phạm vi demo. Trước khi dùng thật cần bổ sung:

**Chung**

- **Xác thực dashboard** — `/api/admin/*` hiện không có auth. Cần đăng nhập, phân quyền theo đội, audit log.
- **JWT thật** — token hiện chỉ là base64 của user id; thay bằng JWT có ký + refresh token.
- **Database thật** — thay file JSON bằng Postgres hoặc tương đương.
- **CDN** — manifest, layout và bundle mini-app nên đi qua CDN với `Cache-Control` + `ETag`.
- **Phát hành từ từ** — 1% → 10% → 100%, lọc theo phiên bản app / thiết bị / nhóm người dùng, tự gỡ khi tỉ lệ lỗi tăng.

**Hướng A**

- **Ký layout** — server ký JSON, app xác minh trước khi render.
- **Validate schema** — kiểm tra layout bằng Zod/JSON Schema ở backend trước khi cho publish.
- **Đo lường** — tỉ lệ render lỗi, số lần gặp `UnknownComponent` (dấu hiệu app quá cũ), thời gian tải layout.
- **Gộp binding engine** — hiện bị lặp ở `mobile/src/sdui/bind.ts` và `dashboard/src/lib/bind.js`; nên tách thành một package dùng chung.

**Hướng B**

- **Đo lường theo mini-app và version** — tỉ lệ nạp thất bại, thời gian nạp, crash.
- **Xoay khoá có kế hoạch** — hiện đổi khoá là mọi bundle cũ bị từ chối ngay.
- **Hạn mức tài nguyên** cho mini-app (bộ nhớ, chạy nền).
- **Kiểm chứng Android** trên thiết bị thật.

Thiết kế chi tiết của hướng B: [docs/superpowers/specs/2026-09-12-remote-js-bundle-repack-mf-design.md](docs/superpowers/specs/2026-09-12-remote-js-bundle-repack-mf-design.md).
