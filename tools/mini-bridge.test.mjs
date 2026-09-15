/**
 * TEST RANH GIỚI QUYỀN.
 *
 * Yêu cầu #3 ở README mục 9 ("mini-app chỉ được gọi API qua một bridge do host
 * kiểm soát, không đưa thẳng token cho nó") là một lời hứa. Những test này biến
 * nó thành thứ kiểm chứng được.
 *
 * Import thẳng file .ts của app vỏ — Node 22+ tự bỏ chú thích kiểu. Được như vậy
 * là nhờ mobile/src/mini/permissions.ts cố ý không import gì từ 'react-native'.
 */
import {
  OPERATIONS, resolveOperation, publicUser,
} from '../mobile/src/mini/permissions.ts';
import { createRunner } from './test-util.mjs';

const t = createRunner('Ranh giới quyền của mini-app');

/* Đúng những gì registry cấp cho mini-app 'insurance'. */
const INSURANCE = ['home.summary', 'insurance.quote'];
const INVEST = ['invest.portfolio'];

/* ---------- cho qua đúng phần được cấp ---------- */

t.eq(
  'thao tác trong danh sách → ánh xạ sang HTTP thật',
  resolveOperation(INSURANCE, 'insurance.quote'),
  { method: 'POST', path: '/api/mini/insurance/quote' },
);
t.eq(
  'thao tác thứ hai cũng qua',
  resolveOperation(INSURANCE, 'home.summary').method,
  'GET',
);

/* ---------- chặn đúng phần không được cấp ---------- */

t.throws(
  'thao tác của mini-app KHÁC → chặn',
  () => resolveOperation(INSURANCE, 'invest.portfolio'),
  /không được cấp quyền/,
);
t.throws(
  'mini-app đầu tư không gọi được báo giá bảo hiểm',
  () => resolveOperation(INVEST, 'insurance.quote'),
  /không được cấp quyền/,
);
t.throws(
  'danh sách quyền rỗng → chặn mọi thứ',
  () => resolveOperation([], 'home.summary'),
  /không được cấp quyền/,
);

/* Kiểm quyền phải đến TRƯỚC khi tra bảng thao tác. Nếu ngược lại, thông báo lỗi
   sẽ tiết lộ thao tác nào tồn tại — một kênh dò dẫm nho nhỏ nhưng không cần thiết. */
t.throws(
  'thao tác không tồn tại và không được cấp → báo THIẾU QUYỀN, không lộ bảng thao tác',
  () => resolveOperation(INSURANCE, 'admin.publish'),
  /không được cấp quyền/,
);

/* Được cấp một quyền mà host không biết: host cũ hơn mini-app. */
t.throws(
  'được cấp nhưng host không biết thao tác → UNKNOWN_OPERATION',
  () => resolveOperation(['some.future.op'], 'some.future.op'),
  /không biết thao tác/,
);

/* Mã lỗi phải đúng — mini-app phân nhánh dựa vào nó. */
let denied = null;
try { resolveOperation(INSURANCE, 'invest.portfolio'); } catch (e) { denied = e; }
t.eq('mã lỗi là PERMISSION_DENIED', denied?.code, 'PERMISSION_DENIED');

/* ---------- bảng thao tác không được chứa đường dẫn quản trị ---------- */

const adminish = Object.entries(OPERATIONS).filter(([, v]) => /\/admin\b/.test(v.path));
t.eq('không thao tác nào trỏ vào /api/admin', adminish, []);

/* ---------- không rò rỉ thông tin người dùng ---------- */

const full = {
  id: 'u1',
  name: 'Trần Tùng',
  email: 'demo@supper.app',
  avatar: '🦊',
  phone: '0909 123 456',
  tier: 'Kim cương',
  token: 'dTE6MTc4OTE4ODg0NTI2NA',
};
const exposed = publicUser(full);

t.eq('chỉ lộ đúng name và avatar', Object.keys(exposed).sort(), ['avatar', 'name']);
t.eq('tên đi qua', exposed.name, 'Trần Tùng');

/* Chốt chặn hồi quy: đây là lỗi sẽ xảy ra nếu ai đó đổi publicUser thành kiểu
   "sao chép rồi xoá vài trường". */
const serialized = JSON.stringify(exposed);
for (const secret of ['token', 'email', 'phone', 'u1']) {
  t.ok(`không rò rỉ '${secret}'`, !serialized.includes(secret));
}

t.eq('chưa đăng nhập → tên mặc định, không nổ', publicUser(null).name, 'Khách');

t.done();
