/**
 * API mà APP MOBILE gọi. Chỉ đọc, chỉ trả bản đã publish (trừ khi ?channel=draft).
 */
import { Router } from 'express';
import { screens, computeRevision } from '../store.js';
import { requireAuth } from './auth.js';

export const router = Router();

/**
 * Manifest = "danh bạ màn hình".
 * App tải cái này TRƯỚC, biết có những route nào, rồi mới tải layout từng màn khi cần.
 * `revision` cho phép app hỏi "có gì mới không?" cực rẻ.
 */
router.get('/manifest', (req, res) => {
  const channel = req.query.channel === 'draft' ? 'draft' : 'production';
  const list = screens.all()
    .map((s) => screens.resolve(s, channel))
    .filter(Boolean)
    .map(({ id, route, title, icon, requiresAuth, showInMenu, version, minSdui }) => ({
      id, route, title, icon, requiresAuth, showInMenu, version, minSdui,
    }));

  res.json({
    revision: computeRevision(channel),
    channel,
    entry: 'login',
    home: 'home',
    sduiVersion: 1,          // version của DSL mà server đang nói
    screens: list,
    updatedAt: new Date().toISOString(),
  });
});

/** Layout đầy đủ của 1 màn hình. */
router.get('/screens/:route', (req, res) => {
  const channel = req.query.channel === 'draft' ? 'draft' : 'production';
  const screen = screens.byRoute(req.params.route);
  if (!screen) return res.status(404).json({ message: 'Không tìm thấy màn hình' });
  const resolved = screens.resolve(screen, channel);
  if (!resolved) return res.status(404).json({ message: 'Màn hình chưa được publish' });
  res.json(resolved);
});

/** Dữ liệu demo cho màn Home (onLoad của nó gọi vào đây). */
router.get('/home/summary', requireAuth, (req, res) => {
  res.json({
    balance: 12_450_000,
    services: [
      { id: 'transfer', emoji: '💸', label: 'Chuyển tiền', color: '#a50064' },
      { id: 'topup', emoji: '📱', label: 'Nạp điện thoại', color: '#0d7ee0' },
      { id: 'bill', emoji: '🧾', label: 'Hoá đơn', color: '#f0870a' },
      { id: 'movie', emoji: '🎬', label: 'Vé xem phim', color: '#e5484d' },
      { id: 'flight', emoji: '✈️', label: 'Vé máy bay', color: '#12a594' },
      // `miniApp` là cây cầu giữa hướng A và hướng B: layout JSON dùng trường
      // này để quyết định bấm vào thì mở mini-app thật hay chỉ hiện thông báo.
      { id: 'insurance', emoji: '🛡️', label: 'Bảo hiểm', color: '#5b5bd6', miniApp: 'insurance' },
      { id: 'invest', emoji: '📈', label: 'Đầu tư', color: '#30a46c', miniApp: 'invest' },
      { id: 'more', emoji: '⋯', label: 'Tất cả', color: '#8b8d98' },
    ],
    transactions: [
      { id: 't1', emoji: '☕', title: 'The Coffee House', time: 'Hôm nay, 08:24', amount: -65000, color: '#1c2024' },
      { id: 't2', emoji: '💰', title: 'Nhận từ Minh Anh', time: 'Hôm qua, 19:02', amount: 500000, color: '#30a46c' },
      { id: 't3', emoji: '🛵', title: 'Grab Bike', time: 'Hôm qua, 08:10', amount: -42000, color: '#1c2024' },
      { id: 't4', emoji: '⚡', title: 'Tiền điện tháng 8', time: '10/09', amount: -387500, color: '#1c2024' },
    ],
  });
});
