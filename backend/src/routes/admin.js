/**
 * API mà DASHBOARD gọi: CRUD màn hình, publish, rollback, xem lịch sử.
 * Production: bắt buộc phải có auth admin + audit log + quyền theo team.
 */
import { Router } from 'express';
import { load, save, reset, screens, computeRevision } from '../store.js';

export const router = Router();

const summary = (s) => ({
  id: s.id,
  route: s.route,
  title: s.title,
  icon: s.icon,
  requiresAuth: s.requiresAuth,
  showInMenu: s.showInMenu,
  draftVersion: s.draftVersion,
  publishedVersion: s.publishedVersion,
  hasUnpublishedChanges: s.draftVersion !== s.publishedVersion,
  versionCount: s.versions.length,
  updatedAt: screens.versionOf(s, s.draftVersion)?.createdAt ?? null,
});

router.get('/screens', (_req, res) => {
  res.json({ revision: computeRevision(), screens: screens.all().map(summary) });
});

router.get('/screens/:id', (req, res) => {
  const s = screens.byId(req.params.id);
  if (!s) return res.status(404).json({ message: 'Không tìm thấy' });
  res.json({
    ...summary(s),
    draft: screens.versionOf(s, s.draftVersion),
    published: screens.versionOf(s, s.publishedVersion),
    versions: s.versions.map((v) => ({ version: v.version, note: v.note, createdAt: v.createdAt })).reverse(),
  });
});

router.post('/screens', (req, res) => {
  const { id, route, title, icon, requiresAuth = true, showInMenu = true, layout, onLoad, initialState } = req.body || {};
  if (!id || !route || !title) return res.status(400).json({ message: 'Thiếu id / route / title' });
  if (screens.byId(id)) return res.status(409).json({ message: `Screen id "${id}" đã tồn tại` });
  if (screens.byRoute(route)) return res.status(409).json({ message: `Route "${route}" đã tồn tại` });

  const screen = {
    id, route, title, icon: icon || '✨', requiresAuth, showInMenu,
    draftVersion: 0, publishedVersion: 0, versions: [],
  };
  screens.addVersion(screen, {
    layout: layout || { type: 'Screen', props: { padding: 16 }, children: [{ type: 'Heading', props: { text: title } }] },
    onLoad, initialState, note: 'created',
  });
  load().screens.push(screen);
  save();
  res.status(201).json(summary(screen));
});

/** Lưu = tạo version mới (draft). App production CHƯA thấy gì cho tới khi publish. */
router.put('/screens/:id', (req, res) => {
  const s = screens.byId(req.params.id);
  if (!s) return res.status(404).json({ message: 'Không tìm thấy' });

  const { title, icon, requiresAuth, showInMenu, layout, onLoad, initialState, note } = req.body || {};
  if (title !== undefined) s.title = title;
  if (icon !== undefined) s.icon = icon;
  if (requiresAuth !== undefined) s.requiresAuth = requiresAuth;
  if (showInMenu !== undefined) s.showInMenu = showInMenu;

  if (layout !== undefined) {
    screens.addVersion(s, { layout, onLoad, initialState, note: note || 'edit' });
  }
  save();
  res.json(summary(s));
});

router.post('/screens/:id/publish', (req, res) => {
  const s = screens.byId(req.params.id);
  if (!s) return res.status(404).json({ message: 'Không tìm thấy' });
  s.publishedVersion = s.draftVersion;
  save();
  res.json({ ...summary(s), revision: computeRevision() });
});

router.post('/screens/:id/rollback/:version', (req, res) => {
  const s = screens.byId(req.params.id);
  if (!s) return res.status(404).json({ message: 'Không tìm thấy' });
  const version = Number(req.params.version);
  if (!screens.versionOf(s, version)) return res.status(404).json({ message: 'Version không tồn tại' });
  s.publishedVersion = version;
  s.draftVersion = version;
  save();
  res.json({ ...summary(s), revision: computeRevision() });
});

router.delete('/screens/:id', (req, res) => {
  const db = load();
  const i = db.screens.findIndex((s) => s.id === req.params.id);
  if (i === -1) return res.status(404).json({ message: 'Không tìm thấy' });
  db.screens.splice(i, 1);
  save();
  res.json({ ok: true });
});

router.post('/reset', (_req, res) => { reset(); res.json({ ok: true }); });
