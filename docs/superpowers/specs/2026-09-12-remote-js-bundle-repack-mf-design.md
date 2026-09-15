# Hướng B — Remote JS bundle thật (Re.Pack + Module Federation)

> Thiết kế · 2026-09-12 · trạng thái: **đã thi công và kiểm chứng trên iOS**
>
> Thiết kế gốc giữ nguyên bên dưới. Những điểm thi công làm khác đi — cùng lý do —
> nằm ở [phụ lục](#phụ-lục-những-gì-đổi-khi-thi-công) cuối tài liệu.

## 1. Bối cảnh

Repo hiện làm **hướng A** (Server-Driven UI): server gửi JSON mô tả UI, app render
bằng registry component dựng sẵn. Ranh giới an toàn là registry — server chỉ dựng
được UI từ những component app đã có.

Hướng A không mô tả nổi mini-app có logic phức tạp hoặc UI ngoài registry (animation
tuỳ biến, cử chỉ, biểu đồ vẽ tay), và không cho phép đối tác thứ ba tự viết màn hình
bằng React Native thật.

README mục 9 đã mô tả hướng B ở mức nguyên lý. Tài liệu này biến nó thành thiết kế
thi công được, và **sửa một lỗ hổng trong chính mô tả đó** (mục 6.2).

## 2. Mục tiêu

Hướng B **bổ sung** cho hướng A, không thay thế:

- Màn hình chính (login/home/profile) tiếp tục chạy bằng SDUI như hiện nay.
- Hai mini-app (`insurance`, `invest`) viết bằng React Native thật, nạp lúc chạy
  qua native ScriptManager, không qua `eval`.
- Đủ năm yêu cầu bắt buộc ở README mục 9: ký bundle, khoá phiên bản native,
  ranh giới quyền, error boundary + timeout, quy trình review.
- Thêm mini-app version mới hoặc rollback: **không build lại app vỏ**.

### Ngoài phạm vi

- CDN thật (bundle phục vụ từ chính backend Express).
- Cửa hàng mini-app cho đối tác tự đăng ký (xem 6.2 — cố ý).
- Over-the-air update cho chính app vỏ.
- Mini-app dùng native module mà host không có (chặn bằng `minHostVersion`).

## 3. Kiến trúc

```
supper-app/
├── backend/
│   ├── src/mini/store.js        registry mini-app: version, publish, rollback
│   ├── src/routes/mini.js       API cho app  + API cho dashboard
│   ├── src/routes/mini-api.js   endpoint nghiệp vụ mini-app gọi qua bridge
│   └── mini-bundles/            bundle đã ký, theo id/version/platform (gitignore)
├── dashboard/
│   └── src/pages/MiniAppsPage.jsx   xem version, publish, rollback
├── mobile/                      HOST — bare RN (expo prebuild) + Re.Pack/Rspack
│   ├── ios/ android/            sinh bởi expo prebuild
│   ├── rspack.config.mjs
│   ├── plugins/withRepack.js    Expo config plugin — vá build phase Xcode
│   └── src/mini/                loader, resolver, bridge, trust store, màn hình
├── mini-apps/
│   ├── insurance/               remote container "miniInsurance"
│   └── invest/                  remote container "miniInvest"
├── packages/
│   └── mini-sdk/                HỢP ĐỒNG host ↔ mini-app (chỉ type, không runtime)
└── shared-deps.mjs              nguồn sự thật duy nhất cho `shared` của MF
```

### 3.1 Bốn ranh giới

| Đơn vị | Làm gì | Không được biết |
|---|---|---|
| `mini-sdk` | Kiểu dữ liệu + interface `HostBridge` cả hai bên cùng biên dịch theo | Cách host hiện thực |
| Host loader | Đọc registry, kiểm `minHostVersion`, `registerRemotes`, `loadRemote`, bọc boundary + timeout | Nội dung mini-app |
| Host bridge | Hiện thực `HostBridge`, kiểm `permissions` mỗi lần gọi, tự gắn token | — |
| Mini-app | UI + logic nghiệp vụ, nhận `bridge` qua props | Token, AsyncStorage, `apiBase` |

Mini-app **không import** module nào của host ngoài `mini-sdk`, và `mini-sdk` chỉ có
type — biên dịch xong không còn gì lúc chạy. Đây là lý do nó phải là package riêng
chứ không phải vài file import chéo.

## 4. Chỗ hướng A gặp hướng B

Một đường may duy nhất: thêm action `openMiniApp` vào SDUI.

```json
{ "type": "Button", "props": { "title": "🛡️ Bảo hiểm" },
  "actions": { "onPress": [{ "type": "openMiniApp", "id": "insurance" }] } }
```

`mobile/src/sdui/actions.ts` nhận thêm một case → `navigate('__mini', { id })`.
Dashboard vẫn là nơi quyết định mini-app xuất hiện ở đâu trên Home, publish bằng JSON
như mọi thứ khác. Hướng B chỉ thêm một loại đích đến.

`types.ts` thêm `openMiniApp` vào union action. Registry component **không đổi**.

## 5. Registry

### 5.1 API cho app

`GET /api/mini-apps?channel=production&hostVersion=1&platform=ios`

```json
{
  "revision": "a91f…",
  "channel": "production",
  "apps": [{
    "id": "insurance",
    "container": "miniInsurance",
    "title": "Bảo hiểm",
    "icon": "🛡️",
    "version": "1.4.0",
    "minHostVersion": 1,
    "entry": "http://10.0.0.5:4000/mini/insurance/1.4.0/ios/mf-manifest.json",
    "keyId": "team-insurance",
    "permissions": ["home.summary", "insurance.quote"]
  }]
}
```

Server **lọc sẵn** theo `hostVersion`: app cần `minHostVersion` cao hơn host thì
không xuất hiện trong danh sách. Host kiểm lại lần nữa lúc mở (phòng thủ hai lớp).

Response **không bao giờ** chứa khoá ký — xem 6.2.

### 5.2 API cho dashboard (yêu cầu quyền admin)

| Endpoint | Việc |
|---|---|
| `GET /api/admin/mini-apps` | danh sách + mọi version + version đang publish theo từng kênh |
| `POST /api/admin/mini-apps/:id/versions` | nhận bundle đã ký từ script `mini:publish` |
| `POST /api/admin/mini-apps/:id/publish` | `{ version, channel }` |
| `POST /api/admin/mini-apps/:id/rollback` | `{ version }` |

### 5.3 Phục vụ bundle

`GET /mini/:id/:version/:platform/*` → file tĩnh từ `backend/mini-bundles/`.
Không cần auth: bundle đã ký, tính toàn vẹn do chữ ký bảo đảm chứ không do đường truyền.

### 5.4 Lưu trữ

`backend/src/mini/store.js`, cùng kiểu với `store.js` hiện có (JSON trên đĩa).
Tách file riêng để `store.js` giữ đúng một trách nhiệm.

## 6. Bảo mật

### 6.1 Cổng phiên bản native

`HOST_VERSION` là một số nguyên trong `mobile/src/config.ts`, tăng mỗi khi hợp đồng
bridge hoặc `shared` đổi theo cách không tương thích ngược. Mini-app khai
`minHostVersion`. Lớp một ở server (lọc khỏi registry), lớp hai ở host (chặn lúc mở,
hiện "Cần cập nhật ứng dụng").

### 6.2 Ký bundle — và chỗ sửa lại README

README mục 9 viết *"server ký, app xác minh chữ ký"*. Làm đúng chữ đó thì thủng:
nếu registry vừa đưa bundle vừa đưa public key, kẻ chiếm được registry đổi cả hai —
chữ ký xác minh chính khoá của kẻ tấn công và **luôn hợp lệ**.

Thiết kế này: registry chỉ trả **`keyId`**. Host nhúng sẵn *trust store* các public key
lúc build, một khoá cho mỗi đội phát hành:

```ts
// mobile/src/mini/trustStore.ts  — sinh từ mini-apps/*/code-signing.pem.pub
export const TRUST_STORE: Record<string, string> = {
  'team-insurance': '-----BEGIN PUBLIC KEY-----…',
  'team-invest':    '-----BEGIN PUBLIC KEY-----…',
};
```

Resolver tra `keyId` → khoá trong app → `verifyScriptSignature: 'strict'`.

Hệ quả, và nó **đúng**: đội đã có khoá publish version mới thoải mái, không đụng app.
Đội phát hành **mới** phải chờ bản app mới — vì kết nạp một bên được chạy code trong
app của bạn là quyết định phải qua thẩm định, không phải một lệnh `POST`. Đây chính là
yêu cầu #5 (quy trình review) được cưỡng chế bằng kỹ thuật thay vì bằng lời hứa.

Ký lúc build bằng `Repack.plugins.CodeSigningPlugin({ enabled: mode === 'production',
privateKeyPath })`. Không dùng `nativeProjectPaths` — khoá đến từ resolver theo từng
script, không phải một khoá duy nhất nhúng trong Info.plist.

Khoá riêng (`mini-apps/*/code-signing.pem`) **gitignore**. Public key commit.
`npm run keys:gen` sinh cặp khoá cho máy mới, `npm run keys:sync` nhúng khoá công vào app vỏ.

### 6.3 Ranh giới quyền

```ts
// packages/mini-sdk/index.ts — chỉ type
export interface HostBridge {
  request(op: string, payload?: unknown): Promise<unknown>;
  navigate(to: 'back' | 'home'): void;
  toast(message: string): void;
  user: { name: string; avatar?: string };
}
export interface MiniAppProps { bridge: HostBridge; params: Record<string, unknown>; }
```

Host hiện thực `request` bằng cách tra `op` trong `desc.permissions` **mỗi lần gọi**,
rồi ánh xạ sang HTTP thật và tự gắn token:

| `op` | Ánh xạ |
|---|---|
| `home.summary` | `GET /api/home/summary` |
| `insurance.quote` | `POST /api/mini/insurance/quote` |
| `invest.portfolio` | `GET /api/mini/invest/portfolio` |

`op` ngoài `permissions` → ném `PermissionDenied`, ghi log. Mini-app không có đường
gọi backend nào khác vì nó không biết `apiBase`.

`user` là bản đã lọc: chỉ `name` và `avatar`. Không email, không token.

### 6.4 Bốn đường thất bại

Không đường nào giết app vỏ. Mỗi đường một màn hình riêng trong `MiniAppBoundary`:

| Tình huống | Hiển thị | Thử lại? |
|---|---|---|
| Sai chữ ký | "Bản cài đặt không hợp lệ" | **Không** — chữ ký sai là dấu hiệu tấn công |
| Quá 10s | "Mạng chậm, thử lại" | Có |
| `minHostVersion` > host | "Cần cập nhật ứng dụng" | Không |
| Mini-app ném lỗi lúc render | "Mini-app gặp sự cố" + thoát về Home | Có |

## 7. Host

### 7.1 Chuyển từ Expo managed sang bare

1. `npx expo prebuild` → sinh `ios/`, `android/`.
2. `react-native.config.js` → `{ commands: require('@callstack/repack/commands/rspack') }`.
3. `rspack.config.mjs`: `RepackPlugin` + `ExpoModulesPlugin` +
   `ModuleFederationPluginV2({ name: 'host', shared: SHARED })`.
4. **Expo config plugin** `plugins/withRepack.js` vá build phase "Bundle React Native
   code and images" để export `CLI_PATH` trỏ về RN CLI.

Bước 4 **phải** là config plugin, không phải sửa tay: `expo prebuild --clean` xoá
`ios/` và nuốt luôn sửa tay, app im lặng quay về Metro và mini-app chết không rõ lý do.

Expo modules (`expo-constants`, `expo-status-bar`, AsyncStorage) tiếp tục chạy nhờ
`@callstack/repack-plugin-expo-modules`. Bỏ qua phần "Configure Expo CLI for bundling"
trong tài liệu Expo — Re.Pack lo việc bundling.

**Mất Expo Go.** Từ đây chạy bằng `npm run ios` / `npm run android`.

### 7.2 `shared` dùng chung

`shared-deps.mjs` ở gốc, import bởi cả `mobile/rspack.config.mjs` lẫn hai mini-app:

```js
export const SHARED = {
  react:            { singleton: true, eager: true, requiredVersion: '19.2.3' },
  'react-native':   { singleton: true, eager: true, requiredVersion: '0.86.3' },
  '@react-navigation/native':        { singleton: true },
  'react-native-safe-area-context':  { singleton: true },
  'react-native-screens':            { singleton: true },
};
```

Lệch một con số patch → hai bản React cùng chạy → hook vỡ với lỗi không liên quan gì
tới nguyên nhân. Một file, không chép tay ba nơi.

### 7.3 Nạp mini-app

`mobile/src/mini/scriptManager.ts`, gọi một lần lúc boot trước khi render:

```ts
ScriptManager.shared.setStorage(AsyncStorage);   // cache → mở lần sau tức thì, offline vẫn chạy
ScriptManager.shared.addResolver(async (scriptId, caller) => {
  const desc = descriptorFor(caller ?? scriptId);
  if (!desc) return undefined;
  if (__DEV__) return { url: devServerURL(desc), verifyScriptSignature: 'off', cache: false };
  return {
    url: Script.getRemoteURL(urlFor(desc, scriptId)),
    query: { platform: Platform.OS },
    verifyScriptSignature: 'strict',
    publicKey: TRUST_STORE[desc.keyId],
    retry: 2, retryDelay: 1000,
  };
});
```

`mobile/src/mini/loadMiniApp.ts`:

```
1. desc = registry.get(id)                        cache → network, như RemoteAppProvider
2. if desc.minHostVersion > HOST_VERSION → ném HostTooOld
3. registerRemotes([{ name: desc.container, entry: desc.entry }])   // @module-federation/runtime
4. loadRemote(`${desc.container}/App`)  ⟨race timeout 10s⟩
```

`registerRemotes` lúc chạy (không khai `remotes` tĩnh trong rspack.config) là điều cho
phép thêm mini-app mà không build lại host.

### 7.4 Màn hình

`RootNavigator` thêm route cố định `__mini` → `MiniAppScreen`, đứng cạnh các route
sinh từ manifest. `MiniAppScreen` nhận `params.id`, gọi `loadMiniApp`, render:

```tsx
<MiniAppBoundary onExit={goHome}>
  <Suspense fallback={<MiniAppLoading />}>
    <MiniApp bridge={bridge} params={params} />
  </Suspense>
</MiniAppBoundary>
```

## 8. Hai mini-app

Cả hai cố ý làm thứ SDUI registry **không** làm nổi — nếu chúng chỉ là form và danh
sách thì hướng A đã đủ và hướng B không có lý do tồn tại.

**`insurance`** (container `miniInsurance`, đội `team-insurance`): chọn gói bảo hiểm
bằng slider tuổi + `Animated` chuyển cảnh giữa các gói, gọi `bridge.request('insurance.quote')`,
hiện báo giá với animation số chạy.

**`invest`** (container `miniInvest`, đội `team-invest`): biểu đồ danh mục vẽ tay
(`Animated` + `react-native-svg` **bundle kèm**, không share — chứng minh mini-app
mang được dependency riêng), `FlatList` mã chứng khoán, pull-to-refresh qua
`bridge.request('invest.portfolio')`.

Mỗi mini-app expose `./App`, default export nhận `MiniAppProps`.

## 9. Dashboard

Thêm `MiniAppsPage.jsx` (tab thứ ba cạnh Screens/Editor):

- Danh sách mini-app, version đang publish theo từng kênh.
- Lịch sử version + nút **Publish** / **Rollback** — cùng kiểu với lịch sử version
  màn hình đã có.
- Hiện `minHostVersion`, `keyId`, `permissions` của từng version (chỉ đọc — đây là
  thuộc tính của bundle, không phải thứ sửa được từ dashboard).

## 10. Quy trình

### Dev

```bash
npm run backend      # :4000
npm run dashboard    # :5173
npm start            # dev server Re.Pack của app vỏ, :8081
npm run ios          # build & cài lên simulator (lần đầu ~5-10 phút)
```

> Thi công đã bỏ ý tưởng "dev thì tắt xác minh chữ ký" — xem phụ lục, mục 1. Mini-app
> luôn được ký và luôn được xác minh, kể cả trong dev. Vòng lặp phát triển mini-app là
> `npm run mini:build <id> && npm run mini:publish <id>`, mất vài giây.

### Phát hành

```bash
npm run mini:build   insurance         # rspack bundle + CodeSigningPlugin ký
npm run mini:publish insurance 1.4.0   # đẩy lên registry
```

→ Dashboard → Mini Apps → Publish `1.4.0` → mở app, bấm 🛡️ Bảo hiểm: **code React
Native thật chưa từng có trong bản build đang chạy**. Rollback về `1.3.0` → mở lại,
về bản cũ. Không build lại app lần nào.

## 11. Kiểm thử

Bộ test hiện có chạy bằng node/jsdom, không cần simulator. Giữ đúng tinh thần đó.

| Test | Chứng minh |
|---|---|
| `tools/mini-registry.test.mjs` | lọc `minHostVersion` (host v1 không thấy app cần v2); publish/rollback đổi version trả về; **registry không bao giờ trả khoá** — chốt hồi quy vào bẫy ở 6.2 |
| `tools/mini-bridge.test.mjs` | `op` trong `permissions` chạy được; ngoài danh sách ném `PermissionDenied`; object truyền cho mini-app không chứa `token`/`apiBase` |
| `tools/mini-signing.test.mjs` | ký bằng khoá đội A rồi đổi 1 byte → verify thất bại; ký bằng khoá B nhưng khai `keyId: team-a` → thất bại |
| `tsc --noEmit` ở host + 2 mini-app | hợp đồng `mini-sdk` lệch là **không biên dịch được**, không phải lỗi lúc chạy |

Gộp vào `npm test` ở gốc.

### Phải kiểm tay (test tự động không với tới)

1. Verify chữ ký ở tầng native — test node chỉ mô phỏng đúng thuật toán JWT, không
   chạy code native.
2. Build iOS release → sửa một byte bundle trên server → app từ chối mở, báo
   "Bản cài đặt không hợp lệ".
3. Publish version mới trong lúc app đang chạy → thoát mini-app rồi mở lại → bản mới.
4. Tắt mạng sau lần mở đầu → mini-app vẫn mở được từ cache ScriptManager.
5. Android emulator: ít nhất một lần mở được cả hai mini-app.

## 12. Rủi ro

| Rủi ro | Giảm thiểu |
|---|---|
| **RN 0.86.3 + Re.Pack 5.3.0** — peer ghi `>=0.74` nhưng 0.86 rất mới so với bản `latest` | Việc **đầu tiên** trong kế hoạch là spike dựng host rỗng chạy được. Vỡ ở đây thì mọi thứ sau vô nghĩa; biết sớm rẻ hơn biết muộn. Dự phòng: kênh `canary` |
| **Expo 57 + prebuild + Re.Pack** ít người đi | Rủi ro nằm ở autolinking expo-modules, không ở Module Federation. Spike kiểm luôn trong cùng bước |
| `expo prebuild --clean` nuốt cấu hình | Config plugin thay cho sửa tay (7.1) |
| Lệch version React giữa host và mini | `shared-deps.mjs` một nguồn (7.2) |
| Android cần emulator | Ưu tiên iOS trước, Android ở bước kiểm tay cuối |

## 13. Tiêu chí hoàn thành

1. `npm test` xanh, gồm cả ba bộ test mới.
2. `tsc --noEmit` sạch ở `mobile/`, `mini-apps/insurance`, `mini-apps/invest`.
3. Trên simulator iOS: Home → 🛡️ Bảo hiểm mở được mini-app; → 📈 Đầu tư mở được.
4. Publish version mới → app thấy bản mới **không build lại**; rollback → về bản cũ.
5. Bundle bị sửa → app từ chối mở.
6. Mini-app gọi `op` ngoài `permissions` → bị chặn, app vỏ vẫn sống.
7. README cập nhật: mục 9 trỏ sang tài liệu này, thêm mục demo hướng B.


---

## Phụ lục: những gì đổi khi thi công

Thiết kế trên được duyệt trước khi viết dòng code đầu tiên. Bảy điểm dưới đây bị thực tế
sửa lại. Ghi ra vì lý do đằng sau mới là thứ đáng giữ.

### 1. Ký ở MỌI chế độ, không chỉ production

Thiết kế: `CodeSigningPlugin({ enabled: mode === 'production' })`, dev thì
`verifyScriptSignature: 'off'`.

Đã đổi thành: luôn ký, luôn xác minh `strict`.

Vì sao: tắt xác minh trong dev nghĩa là đường code chạy hằng ngày KHÁC đường code chạy
trên máy người dùng, và cái khác nhau lại đúng là cơ chế bảo vệ. Một lỗi cấu hình khoá sẽ
chỉ lộ ra ở production. Luôn bật thì đường bảo mật được chạy vài trăm lần mỗi ngày.

Chi phí: gần như bằng không — ký một chunk mất vài mili giây.

### 2. Entry là container bundle, không phải `mf-manifest.json`

Thiết kế: `entry` trỏ tới `mf-manifest.json`.

Đã đổi thành: `entry` trỏ tới `<container>.container.bundle`.

Vì sao — phát hiện lúc kiểm offline: Module Federation tải manifest bằng `fetch` thường,
**không qua ScriptManager**. Hai hệ quả, cả hai đều tệ:

- Manifest **không được ký**. Ai đổi được manifest thì đổi được đường dẫn mọi chunk.
- Manifest **không được cache**. Mất mạng là không mở được mini-app, dù mọi chunk đã nằm
  sẵn trên máy.

Dùng container bundle thì cả đường tin cậy lẫn đường cache đều đi qua ScriptManager.

### 3. Tách `permissions.ts` khỏi `bridge.ts`

Không có trong thiết kế. Lý do: `bridge.ts` phải import `Alert` từ `react-native`, nên
không chạy được trong Node, nên phần quan trọng nhất về an ninh của hướng B lại là phần
không test được. Tách phần quyết định ra một file không phụ thuộc React Native đổi được
điều đó — `tools/mini-bridge.test.mjs` giờ kiểm nó trực tiếp, 16 test.

### 4. Bắt lỗi GỐC từ native qua `ScriptManager.on('error')`

Thiết kế giả định có thể nhận ra lỗi chữ ký từ thông điệp của lỗi ném ra. Không được:
Module Federation bọc mọi thất bại thành `Loading chunk <tên> failed.` và nuốt nguyên nhân.
Tầng native cũng dùng chung mã `ScriptDownloadFailure` cho cả lỗi mạng lẫn lỗi chữ ký.

Lần chạy thử đầu tiên với bundle bị sửa cho ra màn hình "Mini-app gặp sự cố" kèm nút
**Thử lại** — tức là mời người dùng tải lại đúng cái bundle có thể đã bị chèn mã.

`mobile/src/mini/scriptManager.ts` đăng ký listener, giữ lại lỗi gốc, và `loadMiniApp`
hỏi nó thay vì đọc thông điệp đã bị bọc. Sau khi sửa: **"Bản cài đặt không hợp lệ"**,
không có nút thử lại.

### 5. Deep link `supperapp://mini/<id>`

Không có trong thiết kế. Thêm vào vì nó vốn là một tính năng thật của super app (mã QR ở
quầy, thông báo đẩy, banner từ ứng dụng khác mở thẳng mini-app) — và tiện thể làm cho việc
kiểm chứng tự động trên simulator khả thi.

### 6. Config plugin phải vá thêm AppDelegate

Thiết kế chỉ nói tới build phase của Xcode. Thực tế còn một chỗ nữa: Expo prebuild sinh
`AppDelegate.swift` trỏ vào `.expo/.virtual-metro-entry` — một entry ẢO chỉ Metro dựng
được. Re.Pack trả 404 và app chết ngay lúc khởi động.

### 7. npm workspaces chỉ gồm `mini-apps/*` và `packages/*`

`mobile/` giữ node_modules riêng. Vừa tránh phải dựng lại toàn bộ native khi đổi cấu trúc,
vừa phản ánh thực tế: đội đối tác không dùng chung node_modules với app vỏ.

---

## Phụ lục: chín cái bẫy cấu hình

Toàn bộ đã ghi chú tại chỗ trong `mobile/rspack.config.mjs` và tóm tắt ở README mục 9.5.
Điểm chung của cả chín: **build vẫn xanh, app chết lúc chạy, thông báo lỗi không chỉ về
nguyên nhân.** Đó là lý do chúng đáng được ghi lại thay vì chỉ sửa cho xong.

## Trạng thái kiểm chứng

Đã kiểm trên iPhone 17 Pro simulator, iOS 26.5:

- ✅ App vỏ bare RN + Re.Pack + Expo modules khởi động, màn SDUI render
- ✅ Hai mini-app nạp từ bundle remote đã ký, chia sẻ chung một bản React
- ✅ `bridge.request` gọi backend, token do host gắn, mini-app không thấy token
- ✅ Publish v1.5.0 → app đổi mà không build lại; rollback → về bản cũ
- ✅ Sửa 1 byte trong bundle → "Bản cài đặt không hợp lệ", không cho thử lại
- ✅ Tắt backend → mini-app vẫn mở từ cache, chỉ lời gọi dữ liệu báo lỗi inline
- ✅ `npm test` 130 test xanh, `npm run typecheck` sạch
- ⏳ Android: đã cấu hình, chưa chạy kiểm chứng
