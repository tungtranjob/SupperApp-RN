import express from 'express';
import cors from 'cors';
import { load, computeRevision } from './store.js';
import { router as authRouter } from './routes/auth.js';
import { router as appRouter } from './routes/app.js';
import { router as adminRouter } from './routes/admin.js';
import {
  router as miniRouter,
  adminRouter as miniAdminRouter,
  bundleRouter as miniBundleRouter,
} from './routes/mini.js';
import { router as miniApiRouter } from './routes/mini-api.js';

const app = express();
app.use(cors());
// 25mb thay vì 2mb: route publish mini-app nhận bundle dạng base64 trong JSON.
// Một bundle mini-app điển hình ~100-300KB, nhưng base64 phình 33% và một lần
// publish gửi cả chunk lẫn manifest.
app.use(express.json({ limit: '25mb' }));

app.use((req, _res, next) => {
  console.log(`${req.method} ${req.originalUrl}`);
  next();
});

app.get('/api/health', (_req, res) => res.json({ ok: true, revision: computeRevision() }));
app.use('/api/auth', authRouter);
app.use('/api', appRouter);            // /api/manifest, /api/screens/:route, /api/home/summary
app.use('/api', miniRouter);           // /api/mini-apps
app.use('/api/mini', miniApiRouter);   // thao tác nghiệp vụ mini-app gọi qua bridge
app.use('/api/admin', adminRouter);
app.use('/api/admin', miniAdminRouter);
app.use('/mini', miniBundleRouter);    // bundle đã ký (file tĩnh)

app.use((_req, res) => res.status(404).json({ message: 'Not found' }));

const PORT = process.env.PORT || 4000;
load();
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n  SupperApp backend → http://localhost:${PORT}`);
  console.log(`  Manifest (hướng A) → http://localhost:${PORT}/api/manifest`);
  console.log(`  Mini-app (hướng B) → http://localhost:${PORT}/api/mini-apps?hostVersion=1\n`);
});
