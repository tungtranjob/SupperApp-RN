import { Router } from 'express';
import { load } from '../store.js';

export const router = Router();

/** Token giả lập cho demo. Production: JWT ký bằng secret + refresh token. */
const encode = (userId) => Buffer.from(`${userId}:${Date.now()}`).toString('base64url');
const decode = (token) => {
  try { return Buffer.from(token, 'base64url').toString('utf8').split(':')[0]; }
  catch { return null; }
};

export function currentUser(req) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return null;
  const userId = decode(token);
  return load().users.find((u) => u.id === userId) || null;
}

export function requireAuth(req, res, next) {
  const user = currentUser(req);
  if (!user) return res.status(401).json({ message: 'Phiên đăng nhập đã hết hạn' });
  req.user = user;
  next();
}

const publicUser = (u) => ({ id: u.id, email: u.email, name: u.name, avatar: u.avatar, phone: u.phone, tier: u.tier });

router.post('/login', (req, res) => {
  const { email, password } = req.body || {};
  const user = load().users.find((u) => u.email === String(email || '').trim().toLowerCase());
  if (!user || user.password !== password) {
    return res.status(401).json({ message: 'Email hoặc mật khẩu không đúng' });
  }
  res.json({ token: encode(user.id), user: publicUser(user) });
});

router.get('/me', requireAuth, (req, res) => res.json({ user: publicUser(req.user) }));
