# SupperApp — Super app React Native điều khiển từ xa

Ví dụ chạy được đầy đủ của **cả hai hướng** mà super app thật dùng để đổi giao diện
không qua store:

- **Hướng A — Server-Driven UI.** 3 màn hình Login / Home / Profile không nằm trong code
  app mà được tải từ server dưới dạng JSON. Sửa trên dashboard → Publish → app đổi trong
  vài giây.
- **Hướng B — Remote JS bundle thật.** 2 mini-app (Bảo hiểm, Đầu tư) viết bằng React
  Native thật, do hai đội khác nhau ký bằng hai khoá khác nhau, tải lúc chạy qua native
  ScriptManager. Publish version mới hoặc rollback: app đổi mà **không build lại**.

```
┌─────────────────┐   JSON layout    ┌─────────────────┐   REST    ┌──────────────────┐
│  dashboard/     │ ───────────────► │   backend/      │ ────────► │    mobile/       │
│  React + Vite   │   publish        │  Node + Express │  manifest │  HOST            │
│  soạn & preview │ ◄─────────────── │  version+publish│  + layout │  bare React      │
└─────────────────┘                  │                 │           │  Native + Re.Pack│
                                     │  registry       │  bundle   │                  │
┌─────────────────┐   bundle đã ký   │  mini-app       │  đã ký    │  ├ SDUI Renderer │
│  mini-apps/     │ ───────────────► │  + xác minh     │ ────────► │  └ Module        │
│  React Native   │   mini:publish   │    chữ ký       │           │    Federation    │
└─────────────────┘                  └─────────────────┘           └──────────────────┘
```

---

## 1. Điều quan trọng nhất: vì sao KHÔNG "tải file .js rồi eval"

Ý tưởng đầu tiên ai cũng nghĩ tới là: server trả về code React Native dạng chuỗi, app `eval()` nó.
**Cách này không chạy được**, vì hai lý do:

1. **Hermes** — JS engine mặc định của React Native — **không hỗ trợ `eval()` và `new Function()`**.
   Code biên dịch sẵn ra bytecode; không có trình biên dịch lúc chạy. Bạn sẽ nhận lỗi ngay trên máy thật.
2. Kể cả có eval được thì cũng **không nên**: layout đến từ server. Cho phép eval nghĩa là bất kỳ ai
   chiếm được server (hoặc chen được vào đường truyền) đều chạy được code tuỳ ý trong app — đọc token,
   đọc dữ liệu người dùng. Đây là lỗ hổng RCE.

Các super app thật giải quyết bằng 3 hướng:

| | Cách làm | Ưu | Nhược | Ai dùng |
|---|---|---|---|---|
| **A** | **Server-Driven UI** — server gửi **JSON mô tả UI**, app render bằng registry component dựng sẵn | An toàn tuyệt đối, nhẹ, đổi UI tức thì, không cần native | Chỉ dựng được UI từ component app đã có | MoMo (trang chủ, campaign), Airbnb, Shopee, Lyft |
| **B** | **Remote JS bundle thật** — Re.Pack + Module Federation. Bundle nạp bằng **native ScriptManager**, không qua eval → chạy được trên Hermes | Mini-app viết bằng React Native thật, toàn quyền | Nặng: bare RN, cấu hình rspack, ký & xác thực bundle, quản lý version native | MoMo mini-app, Grab |
| **C** | **WebView mini-program** — mini app là web + JS bridge | Cách ly tốt nhất, hệ sinh thái web sẵn có | Hiệu năng & cảm giác native kém hơn | Zalo Mini App, WeChat |

**Repo này làm CẢ A LẪN B, cả hai đều chạy thật** — và làm đúng cách chúng được dùng
chung trong một super app: hướng A là nền cho phần lớn màn hình, hướng B chỉ dành cho
những mini-app thật sự cần. Xem [phần 9](#9-hướng-b--remote-js-bundle-thật) cho hướng B.

> **Lưu ý về hướng C.** Repo không làm WebView mini-program. Nếu bạn cần cách ly tối đa
> và đã có sẵn hệ sinh thái web, hướng C vẫn là lựa chọn đúng — nó không nằm trong phạm
> vi ví dụ này.

---

## 2. Chạy thử

Cần **Node 18+**, **Xcode** (iOS) hoặc **Android Studio**.

> **Khác với trước:** app vỏ giờ là **bare React Native**, không còn dùng được Expo Go.
> Hướng B bắt buộc như vậy — Expo Go không nạp được native ScriptManager. Đổi lại, lần
> đầu build mất ~5–10 phút; những lần sau thì nhanh.

```bash
# 0) Cài đặt + sinh khoá ký cho hai đội phát hành mini-app
npm run install:all
npm run keys:gen      # sinh keys/team-insurance.pem, keys/team-invest.pem
npm run keys:sync     # nhúng khoá CÔNG vào app vỏ (mobile/src/mini/trustStore.ts)

# 1) Backend  → http://localhost:4000
npm run backend

# 2) Dashboard → http://localhost:5173
npm run dashboard

# 3) Dev server của app vỏ (Re.Pack, không phải Metro)
npm start

# 4) Build & cài app lên simulator  (terminal thứ tư, lần đầu ~5-10 phút)
npm run ios          # hoặc: npm run android

# 5) Build, ký và phát hành cả hai mini-app
npm run mini:release
```

Đăng nhập demo: **demo@supper.app** / **123456**

> **Chạy trên điện thoại thật?** App tự lấy IP LAN của máy dev. Nếu vẫn không gọi được
> API, mở **Dev Panel** (nút 🛠 góc dưới phải) và sửa địa chỉ backend thành
> `http://<IP-máy-bạn>:4000`.

## 3. Demo: đổi giao diện mà không build lại app

1. Mở app tới màn **Home**.
2. Sang dashboard → mở **Trang chủ** → trong ô `Layout`, đổi `"text": "Số dư khả dụng"` thành
   `"text": "Ví của tôi"`. Khung xem trước bên phải đổi ngay.
3. Bấm **🚀 Publish**.
4. Nhìn app: trong ~8 giây (hoặc kéo xuống để refresh) chữ đã đổi. **Không hề build lại.**

### Demo: thêm màn hình HOÀN TOÀN MỚI

1. Dashboard → **+ Màn hình mới** → ID `promo`, tiêu đề `Khuyến mãi`, mẫu **Trang khuyến mãi** → Tạo.
2. Bấm **🚀 Publish**.
3. Quay lại **Trang chủ** trong dashboard, thêm một nút vào `layout.children`:

```json
{
  "type": "Button",
  "props": { "title": "🎁 Xem khuyến mãi", "variant": "secondary" },
  "actions": { "onPress": [{ "type": "navigate", "to": "promo" }] }
}
```

4. Publish. Trên app, nút mới xuất hiện và bấm vào **mở được màn hình chưa từng tồn tại trong bản build**.

### Demo: rollback

Trong màn editor, mục **Lịch sử version** → bấm **Rollback** ở version cũ. App quay về bản đó ngay.
Đây là thứ quan trọng nhất của remote UI: **sửa sai trong 5 giây thay vì chờ 2 ngày duyệt store**.

### Demo: kênh nháp (QA trước khi ra mắt)

Dev Panel → đổi kênh sang **draft**. App giờ hiển thị bản **đang soạn chưa publish**.
Đây là cách QA kiểm thử trước khi đẩy cho toàn bộ người dùng.

### Demo hướng B: mở mini-app React Native thật

Trên màn **Home**, hai ô dịch vụ đầu tiên — 🛡️ **Bảo hiểm** và 📈 **Đầu tư** — không phải
màn hình SDUI. Bấm vào là app tải một **bundle React Native thật** từ server, xác minh
chữ ký ở tầng native, rồi chạy nó trong chính JS context của app.

Thứ chúng làm mà hướng A không làm nổi: thanh chọn tuổi kéo bằng `PanResponder` với phản
hồi từng frame, số tiền chạy dần bằng `Animated`, biểu đồ tỉ trọng vẽ tay. Không JSON nào
mô tả được "khi ngón tay di chuyển thì…".

### Demo: đổi mini-app mà không build lại app

```bash
# Sửa gì đó trong mini-apps/insurance/src/App.tsx, rồi:
cd mini-apps/insurance && npm version minor   # 1.6.0 → 1.7.0
cd ../.. && npm run mini:build insurance && npm run mini:publish insurance
```

Dashboard → tab **Mini-app** → bấm **🚀 Publish** ở version mới.
Thoát mini-app rồi mở lại: **code React Native mới, trên đúng bản app đang cài.**

### Demo: rollback mini-app

Cũng ở tab **Mini-app**, bấm **↩ Chuyển về bản này** ở một version cũ. Mở lại mini-app →
về bản cũ. Version cũ không bao giờ bị xoá; publish và rollback chỉ đổi một con trỏ.

### Demo: chữ ký chặn bundle bị tráo

```bash
# Giả lập kẻ tấn công chiếm được server và sửa bundle sau khi nó đã được ký
printf '\x00' | dd of=backend/mini-bundles/insurance/1.6.0/ios/__federation_expose_App.chunk.bundle \
  bs=1 seek=300 count=1 conv=notrunc
```

Mở lại mini-app: app hiện **"Bản cài đặt không hợp lệ"** và **không có nút Thử lại** —
chữ ký sai là dấu hiệu tấn công, thử lại chỉ tải lại đúng thứ đó. Phần còn lại của app
vẫn chạy bình thường. Chạy `npm run mini:release insurance` để khôi phục.

### Demo: ranh giới quyền

Mở mini-app **Đầu tư**, kéo xuống cuối, bấm **🔒 Thử gọi thao tác ngoài quyền**. Mini-app
này chỉ được cấp `invest.portfolio`; nó cố gọi `insurance.quote` và app vỏ chặn lại với
`PERMISSION_DENIED`. Mini-app không bao giờ thấy token của người dùng.

### Demo: mở mini-app bằng deep link

```bash
xcrun simctl openurl booted "supperapp://mini/insurance"
```

Đây là cách mã QR ở quầy, thông báo đẩy, hay banner trong ứng dụng khác mở thẳng vào một
mini-app.

---

---

## 4. DSL — ngôn ngữ mô tả giao diện

Một màn hình là một cây node JSON:

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
| `type` | tên component trong **registry** của app (`mobile/src/sdui/registry.tsx`) |
| `props` | thuộc tính, có thể chứa binding |
| `children` | node con |
| `actions` | map `tên sự kiện → mảng action` chạy tuần tự |
| `if` | biểu thức; falsy thì không render |
| `repeat` | nhân bản node theo một mảng, tạo biến cục bộ tên `as` |

### Binding

```
"{{state.total}}"            → trả về GIÁ TRỊ GỐC (number vẫn là number)
"Chào {{user.name}}!"        → nội suy thành chuỗi
"{{state.total | currency}}" → qua filter
"!state.loading"             → phủ định (dùng trong `if`)
```

Gốc context: `state` (state của màn hình), `user` (người đăng nhập), `params` (tham số điều hướng),
`event` (payload sự kiện, vd `event.text`), `app`, và biến do `repeat` tạo ra.

Filter có sẵn: `currency`, `signedCurrency`, `number`, `upper`, `lower`, `date`, `json`, `not`.

> **Cố ý không dùng eval.** Engine chỉ hiểu đúng tập cú pháp nhỏ ở trên — đọc được, test được,
> và server không thể chạy code tuỳ ý trong app. Xem `mobile/src/sdui/bind.ts`.

### Action

| Action | Công dụng |
|---|---|
| `setState` | ghi vào state màn hình: `{ "type":"setState", "path":"email", "value":"{{event.text}}" }` |
| `http` | gọi API; `saveAs` lưu kết quả vào state; `onError` chạy khi lỗi và **dừng chuỗi** |
| `setAuth` / `logout` | ghi/xoá phiên đăng nhập |
| `navigate` | `{ "to":"home", "reset":true }` — sang màn khác |
| `goBack`, `toast`, `openUrl`, `refresh`, `delay` | tiện ích |

Ví dụ hoàn chỉnh — toàn bộ logic đăng nhập, viết bằng JSON:

```json
"onPress": [
  { "type": "setState", "path": "loading", "value": true },
  { "type": "http", "method": "POST", "url": "/api/auth/login",
    "body": { "email": "{{state.email}}", "password": "{{state.password}}" },
    "saveAs": "auth",
    "onError": [
      { "type": "setState", "path": "loading", "value": false },
      { "type": "setState", "path": "error",   "value": "{{error.message}}" }
    ] },
  { "type": "setState", "path": "loading", "value": false },
  { "type": "setAuth",  "from": "state.auth" },
  { "type": "navigate", "to": "home", "reset": true }
]
```

### Component có sẵn trong registry

`Screen` `View` `Row` `Card` `Grid` `Text` `Heading` `Caption` `Input` `Button`
`Image` `Avatar` `Badge` `ServiceIcon` `ListItem` `Banner` `Spacer` `Divider`

**Registry chính là ranh giới an toàn của cả hệ thống**: server chỉ dựng được UI từ những
component này. Muốn thêm khả năng mới → thêm vào registry → phát hành app mới → tăng `SDUI_VERSION`.

---

## 5. Luồng chạy khi mở app

```
App khởi động
   │
   ├─ restoreApiBase()            đọc địa chỉ backend đã lưu
   ├─ AuthProvider                khôi phục token từ AsyncStorage
   │
   ├─ initScriptManager()         bật cache bundle mini-app + bắt lỗi gốc từ native
   │
   ├─ RemoteAppProvider ── tải MANIFEST theo thứ tự:
   │     1. CACHE   (AsyncStorage)  → hiện ngay, không màn hình trắng
   │     2. NETWORK (/api/manifest) → cập nhật nếu `revision` khác
   │     3. BUNDLED (snapshot đóng gói trong app) → lần đầu mở mà offline
   │
   ├─ MiniRegistryProvider ── tải DANH BẠ MINI-APP (hướng B), cùng chiến lược
   │                           cache → network, kèm hostVersion để server lọc sẵn
   │                           những mini-app bản app này không chạy nổi
   │
   ├─ RootNavigator               sinh <Stack.Screen> TỪ manifest
   │                              + một route cố định `__mini` cho MỌI mini-app
   │                              → thêm route trên dashboard = có màn hình mới
   │
   └─ RemoteScreen (dùng chung cho MỌI route)
         1. tải layout của route (cache → network)
         2. state = initialState
         3. chạy onLoad (thường là gọi API lấy dữ liệu)
         4. RenderNode dựng cây React
         5. tương tác → chuỗi action → đổi state → render lại
```

Điểm mấu chốt: **`mobile/src/remote/RemoteScreen.tsx` là màn hình React Native DUY NHẤT**.
Nó không biết nó là "login", "home" hay màn hình bạn vừa tạo. Tất cả đến từ JSON.

---

## 6. Những chi tiết "production" đã xử lý sẵn

Đây là phần phân biệt một demo với một hệ thống dùng thật:

| Vấn đề | Cách xử lý trong repo | File |
|---|---|---|
| **Màn hình trắng khi mạng chậm** | Stale-while-revalidate: hiện bản cache ngay, tải bản mới ở nền | `remote/screenStore.ts` |
| **Lần đầu mở app mà offline** | Snapshot UI đóng gói sẵn trong app (`npm run export:bundled` như một bước build) | `fallback/bundled.json` |
| **Server sập** | 3 lớp dự phòng cache → bundled; app vẫn dùng được | `RemoteAppProvider.tsx` |
| **App cũ, UI mới** (version skew) | Mỗi màn có `minSdui`; app khai báo `SDUI_VERSION`. Yêu cầu cao hơn → hiện "cần cập nhật app" thay vì crash | `config.ts`, `RemoteScreen.tsx` |
| **Component app chưa biết** | Render `UnknownComponent` (khung cảnh báo), **không bao giờ crash** | `registry.tsx` |
| **Đẩy nhầm bản lỗi** | Mỗi lần lưu = một version bất biến; publish/rollback chỉ đổi con trỏ → rollback tức thì | `backend/src/store.js` |
| **Tốn băng thông** | `revision` là chữ ký của toàn bộ UI đang publish; app so chuỗi này trước, khác mới tải layout | `store.js`, `RemoteAppProvider` |
| **Lưu nháp làm phiền toàn bộ thiết bị** | `revision` production bỏ qua màn hình chưa publish | `computeRevision()` |
| **QA trước khi ra mắt** | Kênh `draft` — app xem được bản chưa publish | Dev Panel |
| **Đua trạng thái khi đăng nhập** | Đăng ký TẤT CẢ route trong navigator, chặn quyền bên trong màn hình — nếu lọc route theo token thì `navigate` chạy ngay sau `setAuth` sẽ trượt | `RootNavigator.tsx` |
| **`Grid` + `repeat`** | `repeat` được mở rộng ở cấp cha thành mảng phẳng, vì `React.Children.toArray` **không** mở Fragment — nếu không cả danh sách bị nhồi vào 1 ô lưới | `Renderer.tsx` |
| **Chuỗi action đọc state cũ** | State giữ trong `useRef` + `force()` render lại, để `setState → http → setState` thấy được giá trị vừa ghi | `RemoteScreen.tsx` |
| **Mini-app lỗi làm sập app vỏ** (B) | `MiniAppBoundary` — error boundary riêng, kèm nút thoát về trang chủ | `mini/MiniAppBoundary.tsx` |
| **Mini-app tải mãi không xong** (B) | Timeout 10s + `Promise.race`; lỗi mạng thì thử lại 2 lần, chữ ký sai thì **không** | `mini/loadMiniApp.ts` |
| **Nhầm "bundle bị tráo" thành "mạng chập chờn"** (B) | Module Federation bọc mọi lỗi nạp thành "Loading chunk failed" và nuốt nguyên nhân. Bắt lỗi GỐC qua `ScriptManager.on('error')` | `mini/scriptManager.ts` |
| **Mini-app khi offline** (B) | `ScriptManager.setStorage(AsyncStorage)` + entry là container đã ký (không phải manifest, vì manifest không đi qua ScriptManager) | `mini/scriptManager.ts` |
| **Lệch version react giữa host và mini-app** (B) | Một nguồn duy nhất + test canh mọi nơi khác phải khớp | `shared-deps.mjs` |
| **`expo prebuild --clean` xoá cấu hình Re.Pack** (B) | Cấu hình native nằm trong config plugin, chạy lại ở mỗi lần prebuild | `plugins/withRepack.js` |
| **Deep link sang mini-app khác không có phản ứng** (B) | Mọi mini-app dùng chung route `__mini`, nên navigator tưởng đã ở đúng chỗ. `getId` bắt nó coi mỗi `id` là một màn hình riêng | `RootNavigator.tsx` |

---

## 7. Còn thiếu gì nếu đưa lên production

Repo này cố ý dừng ở phạm vi demo. Trước khi dùng thật cần thêm:

- **Xác thực dashboard** — hiện `/api/admin/*` không có auth. Cần đăng nhập admin, phân quyền theo team, audit log ai sửa gì.
- **JWT thật** — token hiện là base64 của user id. Thay bằng JWT ký + refresh token.
- **Ký layout** — server ký JSON, app xác minh chữ ký trước khi render, chống can thiệp đường truyền.
- **Phát hành từ từ (staged rollout)** — publish cho 1% → 10% → 100%, kèm cờ theo phiên bản app / thiết bị / nhóm người dùng.
- **CDN + ETag** — `/api/manifest` và `/api/screens/*` nên đi qua CDN với `Cache-Control` + `ETag`.
- **Đo lường** — log tỉ lệ render lỗi, `UnknownComponent` xuất hiện bao nhiêu (dấu hiệu người dùng đang chạy app quá cũ), thời gian tải layout.
- **Tách `sdui-core` thành package dùng chung** — hiện binding engine bị lặp ở `mobile/src/sdui/bind.ts` và `dashboard/src/lib/bind.js`. Ở monorepo thật hãy để một nguồn sự thật duy nhất.
- **Kiểm tra schema** — validate JSON bằng Zod/JSON Schema ở backend trước khi cho publish, để không publish được layout hỏng.
- **Database thật** — thay file JSON bằng Postgres.

---

## 8. Cấu trúc thư mục

```
supper-app/
├── shared-deps.mjs              NGUỒN SỰ THẬT cho `shared` của Module Federation
├── keys/                        khoá ký mini-app (.pem riêng gitignore, .pem.pub commit)
│
├── backend/                     Node + Express
│   ├── src/store.js             hướng A: version / publish / rollback / revision
│   ├── src/seed/screens.js      3 màn hình mẫu viết bằng JSON  ← đọc file này trước
│   ├── src/routes/app.js        API cho mobile: manifest + layout
│   ├── src/routes/admin.js      API cho dashboard: CRUD + publish
│   ├── src/mini/store.js        hướng B: registry mini-app + MÔ HÌNH QUYỀN
│   ├── src/mini/signature.js    xác minh chữ ký bundle lúc publish
│   ├── src/mini/keys.js         đọc khoá công từ keys/
│   ├── src/routes/mini.js       registry API + phục vụ bundle đã ký
│   └── src/routes/mini-api.js   thao tác nghiệp vụ mini-app gọi qua bridge
│
├── dashboard/                   React + Vite
│   ├── src/pages/ScreensPage.jsx    hướng A: danh sách + tạo màn hình
│   ├── src/pages/EditorPage.jsx     hướng A: editor JSON + publish + lịch sử
│   ├── src/pages/MiniAppsPage.jsx   hướng B: version / publish / rollback / quyền
│   └── src/lib/bind.js              binding engine (bản web)
│
├── mobile/                      APP VỎ — bare React Native + Re.Pack
│   ├── rspack.config.mjs        ← ĐỌC FILE NÀY nếu build hỏng (9 bẫy cấu hình)
│   ├── react-native.config.js   trỏ RN CLI sang Re.Pack thay vì Metro
│   ├── plugins/withRepack.js    Expo config plugin: vá bản build native
│   ├── src/sdui/                hướng A: DSL, binding, registry, actions, renderer
│   ├── src/remote/              hướng A: cache → network → bundled
│   └── src/mini/                hướng B:
│       ├── trustStore.ts        SINH TỰ ĐỘNG — gốc tin cậy, khoá công của từng đội
│       ├── scriptLocator.ts     URL nào dùng khoá nào (không import react-native!)
│       ├── signedResolverPlugin.ts  nối resolver của Re.Pack với khoá ký
│       ├── scriptManager.ts     cache offline + bắt lỗi GỐC từ native
│       ├── loadMiniApp.ts       registerRemotes → loadRemote → timeout
│       ├── permissions.ts       LÕI RANH GIỚI QUYỀN (test được bằng Node)
│       ├── bridge.ts            hiện thực HostBridge, tự gắn token
│       ├── registry.tsx         danh bạ mini-app (cache → network)
│       ├── MiniAppScreen.tsx    một route `__mini` cho MỌI mini-app
│       ├── MiniAppBoundary.tsx  vách ngăn: mini-app lỗi không giết app vỏ
│       └── linking.ts           deep link supperapp://mini/<id>
│
├── mini-apps/
│   ├── rspack.mini.mjs          cấu hình build DÙNG CHUNG cho mọi mini-app
│   ├── insurance/src/App.tsx    PanResponder + Animated — thứ SDUI không làm nổi
│   └── invest/src/App.tsx       biểu đồ vẽ tay + FlatList + demo chặn quyền
│
├── packages/mini-sdk/index.ts   HỢP ĐỒNG host ↔ mini-app — CHỈ có kiểu
│
└── tools/                       script + test (npm test)
    ├── keys-gen.mjs  keys-sync.mjs
    ├── mini-build.mjs  mini-publish.mjs  mini-release.mjs
    └── *.test.mjs
```

---

## 9. Hướng B — Remote JS bundle thật

Khi nào cần? Khi mini-app phải có **logic phức tạp hoặc UI mà registry không mô tả nổi** —
hoặc khi đối tác thứ ba tự viết mini-app bằng React Native.

Phần lớn màn hình của một super app (trang chủ, danh sách dịch vụ, campaign, biểu mẫu,
chi tiết giao dịch) **không cần** hướng B. Hướng A rẻ hơn và an toàn hơn nhiều. Repo này
dùng A làm nền và chỉ đưa B vào đúng hai mini-app cần nó.

### 9.1 Các mảnh ghép

```
mini-apps/insurance/          remote container "miniInsurance" — đội team-insurance
mini-apps/invest/             remote container "miniInvest"    — đội team-invest
packages/mini-sdk/            HỢP ĐỒNG host ↔ mini-app (CHỈ có kiểu, không mã chạy)
shared-deps.mjs               nguồn sự thật duy nhất cho `shared` của Module Federation
keys/                         khoá ký của từng đội (.pem riêng — gitignore; .pem.pub công)

mobile/rspack.config.mjs      cấu hình build app vỏ (đọc file này nếu cấu hình vỡ)
mobile/plugins/withRepack.js  Expo config plugin: bắt bản build native dùng Re.Pack
mobile/src/mini/              loader, trust store, bridge, màn hình chứa mini-app

backend/src/mini/store.js     registry: version, publish, rollback, mô hình quyền
backend/src/mini/signature.js xác minh chữ ký lúc publish
backend/src/routes/mini.js    API cho app + API cho dashboard + phục vụ bundle
```

### 9.2 Nguyên lý khiến nó chạy được trên Hermes

Bundle được tải về và đưa cho **native ScriptManager** thực thi trong JS context của app,
**không đi qua `eval()`** → Hermes chấp nhận. Host và mini-app **chia sẻ** `react`,
`react-native` qua Module Federation, nên mã thật của mini-app rất nhẹ:

```
__federation_expose_App.chunk.bundle      8.6 KB   ← mã thật của mini-app
miniInsurance.container.bundle             197 KB   ← runtime Module Federation
vendors-…react-native….chunk.bundle        318 KB   ← DỰ PHÒNG, không tải nếu host đã có
```

### 9.3 Chỗ hướng A gặp hướng B

Đúng một đường may: một action mới trong DSL.

```json
{ "type": "ServiceIcon",
  "if": "svc.miniApp",
  "repeat": { "items": "state.home.services", "as": "svc" },
  "actions": { "onPress": [{ "type": "openMiniApp", "id": "{{svc.miniApp}}" }] } }
```

Nghĩa là **dashboard vẫn quyết định mini-app xuất hiện ở đâu** trên trang chủ, publish
bằng JSON như mọi thứ khác. Hướng B không cướp quyền của hướng A; nó chỉ thêm một loại
đích đến.

### 9.4 Mô hình bảo mật

Đây là phần khác biệt lớn nhất giữa "chạy được" và "dùng được". Năm yêu cầu ở bảng dưới
đều đã hiện thực và **có test**.

#### Ký bundle — và chỗ tài liệu này khác với hướng dẫn thông thường

Cách mô tả phổ biến là *"server ký, app xác minh chữ ký"*. Làm đúng chữ đó thì **thủng**:
nếu registry vừa đưa bundle vừa đưa public key, kẻ chiếm được registry đổi cả hai — chữ ký
xác minh chính khoá của kẻ tấn công và **luôn hợp lệ**.

Ở đây registry chỉ trả **`keyId`** — một cái tên. Khoá thật nằm trong *trust store* nhúng
sẵn trong app lúc build (`mobile/src/mini/trustStore.ts`, sinh bởi `npm run keys:sync`).

Hệ quả, và nó **đúng**: đội đã có khoá publish version mới thoải mái, không đụng tới app.
Đội phát hành **mới** thì phải chờ một bản app mới — vì cho một bên lạ quyền chạy mã trong
app của bạn là quyết định phải qua thẩm định, không phải một lệnh `POST`.

Cũng vì lý do đó, entry của remote là **container bundle đã ký**, không phải
`mf-manifest.json`: manifest là JSON và Module Federation tải nó bằng `fetch` thường,
không qua ScriptManager — nên không được ký, và cũng không được cache khi offline.

#### Quyền = GIAO(được cấp, được xin)

Mini-app **không tự khai quyền của mình**. Registry giữ `grantedPermissions` (nền tảng cấp
sau thẩm định); mỗi version khai `requestedPermissions` (mini-app xin lúc publish). Quyền
có hiệu lực là giao của hai tập, và phần bị từ chối hiện gạch ngang trên dashboard.

Mini-app gọi **tên thao tác**, không phải URL:

```ts
await bridge.request('insurance.quote', { plan, age });
```

App vỏ tra tên trong `mobile/src/mini/permissions.ts`, ánh xạ sang HTTP thật và tự gắn
token. Mini-app không biết địa chỉ backend và không bao giờ thấy token. Nếu mini-app tự
dựng được URL thì danh sách quyền chỉ còn là chú thích.

#### Năm yêu cầu bắt buộc

| # | Yêu cầu | Hiện thực ở đâu | Test |
|---|---|---|---|
| 1 | **Ký bundle** | `CodeSigningPlugin` ký mọi chunk; `verifyScriptSignature: 'strict'` + khoá từ trust store; server xác minh lại lúc publish | `tools/mini-signing.test.mjs` |
| 2 | **Khoá phiên bản native** | `minHostVersion` vs `HOST_VERSION`: server lọc khỏi registry (lớp 1), host chặn lúc mở (lớp 2) | `tools/mini-registry.test.mjs` |
| 3 | **Ranh giới quyền** | Tên thao tác + giao quyền + lọc thông tin người dùng | `tools/mini-bridge.test.mjs` |
| 4 | **Error boundary + timeout** | `MiniAppBoundary` bắt lỗi render; timeout 10s; 6 mã lỗi, mỗi mã một màn hình, chữ ký sai **không cho thử lại** | kiểm tay |
| 5 | **Quy trình review** | Cưỡng chế bằng kỹ thuật: đội mới cần khoá mới, khoá mới cần bản app mới | — |

### 9.5 Chín cái bẫy cấu hình (đọc trước khi tự dựng)

Đây là phần tốn thời gian nhất khi dựng hướng B. Mỗi dòng dưới đây là một lỗi **build vẫn
xanh nhưng app chết lúc chạy**, với thông báo không hề chỉ về nguyên nhân. Tất cả đều đã
ghi chú tại chỗ trong `mobile/rspack.config.mjs`.

| Triệu chứng | Nguyên nhân thật |
|---|---|
| `Can't resolve '@module-federation/runtime/helpers'` | `getResolveOptions()` mặc định TẮT package exports. Cần `{ enablePackageExports: true }` |
| `Expected ';', '}' or <eof>` trong `View.js` | RN 0.86 dùng cú pháp `component` của Flow. `flow-remove-types` chỉ xoá kiểu, không biến đổi được. Phải qua `@react-native/babel-preset` (hermes-parser) |
| `View config not found for component 'RNSSafeAreaView'` | Quy tắc babel chỉ khớp `jsx?`. File spec native của `safe-area-context` là `.ts`, nên codegen không chạy cho nó |
| `Could not find component config for native component` | Codegen chạy SAU bước xoá kiểu. Nó cần đọc kiểu Flow, nên phải chạy TRƯỚC |
| `Property 'WebSocket' doesn't exist` | `entry` khai dạng chuỗi. `NativeEntryPlugin` duyệt bằng `Object.keys()`, nên `'./index.ts'` thành 10 entrypoint rác và `InitializeCore` không được chèn. Khai `entry: { index: './index.ts' }` |
| `Multiple assets emit different content to the same filename` | `exposes: {}` ở host. Chỉ cần có mặt khoá đó là MF sinh thêm một container entrypoint tranh tên file. Bỏ hẳn |
| `Invalid loadShareSync … #RUNTIME-006` | Host thiếu `eager: true` trên shared deps mà nó import đồng bộ. Host phải eager; mini-app thì **không** (xem `shared-deps.mjs`) |
| `undefined cannot be used as a constructor` lúc khởi động | Plugin `dev` của MF mở WebSocket trước khi RN cài polyfill. Đặt `dts: false, dev: false` |
| `factory is undefined (…/react-native)` | Một runtime plugin của MF import module shared. Runtime plugin chạy TRƯỚC khi share scope khởi tạo — đồ thị phụ thuộc của nó không được chạm vào `react-native` |

### 9.6 Quy trình phát hành

```bash
npm run mini:build   insurance ios   # rspack bundle + ký bằng keys/team-insurance.pem
npm run mini:publish insurance ios   # server XÁC MINH CHỮ KÝ rồi nhận → kênh nháp
# dashboard → Mini-app → 🚀 Publish  → ra production
```

Server từ chối ngay lúc publish nếu bundle chưa ký hoặc ký sai khoá — thay vì publish trót
lọt rồi chết trên máy của toàn bộ người dùng.

`npm run mini:release` gộp cả ba bước, tiện cho demo. Quy trình thật nên tách, vì bước cuối
phải là quyết định của con người.

### 9.7 Còn thiếu gì nếu đưa lên production

- **Auth cho `/api/admin/*`** — hiện không có, giống phần hướng A.
- **CDN thật** thay cho việc backend tự phục vụ bundle.
- **Phát hành từ từ** cho mini-app: 1% → 10% → 100%, và tự động gỡ khi tỉ lệ lỗi tăng.
- **Đo lường theo mini-app**: tỉ lệ nạp thất bại, thời gian nạp, tỉ lệ crash — tách theo
  version, để biết version nào cần rollback.
- **Xoay khoá** có kế hoạch: hiện thay khoá là mọi bundle cũ bị từ chối ngay.
- **Hạn mức tài nguyên** cho mini-app (bộ nhớ, thời gian chạy nền).
- **Android**: repo đã cấu hình sẵn (`withRepack.js` vá cả `build.gradle`) nhưng bản demo
  mới chỉ chạy kiểm chứng trên iOS.

---

## 10. Kiểm thử

```bash
npm test          # 130 test, không cần simulator
npm run typecheck # app vỏ + 2 mini-app + mini-sdk
```

| Bộ test | Chứng minh điều gì |
|---|---|
| `tools/sdui-bind.test.mjs` (16) | binding engine: giữ nguyên kiểu, nội suy, filter, `if` phủ định, path không tồn tại |
| `tools/shared-deps.test.mjs` (46) | host và mini-app build với **cùng version** react/react-native; host eager, mini-app không; mọi shared đều singleton và khai version tường minh |
| `tools/mini-registry.test.mjs` (23) | cổng `minHostVersion`; publish/rollback chỉ đổi con trỏ; quyền = giao(cấp, xin); **registry không bao giờ trả khoá** |
| `tools/mini-bridge.test.mjs` (16) | thao tác ngoài quyền bị chặn; không thao tác nào trỏ vào `/api/admin`; object trao cho mini-app **không chứa** token/email/phone |
| `tools/mini-signing.test.mjs` (7) | sửa 1 byte → từ chối; chèn mã giữ chữ ký cũ → từ chối; ký bằng khoá đội khác → từ chối; chưa ký → từ chối |
| `dashboard/test/editor.render.test.jsx` (22) | render thật trong jsdom cả trang Màn hình lẫn trang Mini-app; **đếm số lần render để bắt vòng lặp vô hạn**; chốt rằng quyền bị từ chối phải hiện ra và khoá không bao giờ lọt vào dashboard |

Hai bộ đáng chú ý:

- `shared-deps.test.mjs` **đã bắt được một lỗi thật** ngay khi viết xong: `mobile/package.json`
  khai `react-native-screens: ~4.26.0` trong khi thực tế cài 4.26.2. Đúng kiểu lệch version
  sẽ biểu hiện thành "Invalid hook call" ở một chỗ chẳng liên quan.
- `editor.render.test.jsx` từng bắt được `useJsonField(x ?? [])` truyền mảng mới mỗi render
  vào dependency của `useEffect` → "Maximum update depth exceeded" → treo trình duyệt.
  Xem ghi chú trong `dashboard/src/lib/useJsonField.js`.

### Phải kiểm tay

Những thứ test tự động không với tới, vì chúng sống ở tầng native:

1. **Xác minh chữ ký ở tầng native.** Test Node kiểm đúng thuật toán (JWT RS256 + SHA-256),
   nhưng việc từ chối thật diễn ra trong Swift/Kotlin của Re.Pack. Kiểm bằng
   [demo chữ ký](#demo-chữ-ký-chặn-bundle-bị-tráo).
2. **Publish và rollback trên máy thật** — xem hai demo ở mục 3.
3. **Offline**: mở mini-app một lần, tắt backend, mở lại → mini-app vẫn chạy từ cache của
   ScriptManager; chỉ lời gọi dữ liệu báo lỗi inline.
4. **Android** — repo đã cấu hình sẵn nhưng bản demo mới kiểm chứng trên iOS.
