/**
 * CÁC THAO TÁC NGHIỆP VỤ MÀ MINI-APP GỌI QUA BRIDGE.
 *
 * Mini-app KHÔNG gọi thẳng vào đây. Nó gọi `bridge.request('insurance.quote', …)`;
 * app vỏ tra quyền, ánh xạ tên thao tác sang đường dẫn dưới đây, rồi tự gắn token.
 * Xem bảng ánh xạ tại mobile/src/mini/bridge.ts.
 *
 * Vì sao tách khỏi routes/app.js: các endpoint này có một tính chất riêng —
 * chúng là BỀ MẶT TIẾP XÚC với mã của bên thứ ba. Gom một chỗ thì lúc rà soát an
 * ninh chỉ cần đọc đúng một file, thay vì tìm trong đống endpoint nội bộ.
 */
import { Router } from 'express';
import { requireAuth } from './auth.js';

export const router = Router();

/** Bảng giá demo: phí cơ bản theo gói, nhân hệ số tuổi. */
const PLANS = {
  basic: { label: 'Cơ bản', base: 89_000, cover: 100_000_000 },
  plus: { label: 'Nâng cao', base: 179_000, cover: 300_000_000 },
  premium: { label: 'Toàn diện', base: 349_000, cover: 1_000_000_000 },
};

router.post('/insurance/quote', requireAuth, (req, res) => {
  const { plan = 'basic', age = 30 } = req.body || {};
  const config = PLANS[plan];
  if (!config) return res.status(400).json({ message: 'Gói không hợp lệ' });

  const numericAge = Math.min(70, Math.max(18, Number(age) || 30));
  // Hệ số tuổi: dưới 30 giữ nguyên, sau đó mỗi tuổi +1.8%.
  const factor = 1 + Math.max(0, numericAge - 30) * 0.018;
  const monthly = Math.round((config.base * factor) / 1000) * 1000;

  res.json({
    plan,
    label: config.label,
    age: numericAge,
    monthly,
    yearly: monthly * 11, // trả năm được tặng 1 tháng
    cover: config.cover,
    quotedAt: new Date().toISOString(),
  });
});

router.get('/invest/portfolio', requireAuth, (_req, res) => {
  const holdings = [
    { id: 'fpt', name: 'FPT', shares: 120, price: 138_500, change: 2.4, color: '#30a46c' },
    { id: 'mwg', name: 'MWG', shares: 80, price: 62_300, change: -1.1, color: '#e5484d' },
    { id: 'vnm', name: 'VNM', shares: 200, price: 71_900, change: 0.6, color: '#0d7ee0' },
    { id: 'hpg', name: 'HPG', shares: 500, price: 27_450, change: 1.9, color: '#f0870a' },
    { id: 'tcb', name: 'TCB', shares: 300, price: 24_800, change: -0.4, color: '#5b5bd6' },
  ];
  const total = holdings.reduce((sum, h) => sum + h.shares * h.price, 0);

  res.json({
    total,
    // Lãi/lỗ giả lập cho demo — đủ để mini-app có thứ vẽ biểu đồ.
    pnl: Math.round(total * 0.0734),
    pnlPercent: 7.34,
    holdings: holdings.map((h) => ({
      ...h,
      value: h.shares * h.price,
      weight: (h.shares * h.price) / total,
    })),
    updatedAt: new Date().toISOString(),
  });
});
