import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import prisma from './utils/prisma';
import { errorHandler } from './middleware/errorHandler';
import { logger } from './utils/logger';
import authRoutes from './routes/auth.routes';
import pricingRoutes from './routes/pricing.routes';
import uploadRoutes from './routes/upload.routes';
import storeRoutes from './routes/store.routes';
import aiRoutes from './routes/ai.routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// ─── Security middleware ─────────────────────────────────────────────────────

app.use(helmet());
app.use(cors({
  origin: '*',
  credentials: true
}));

// ─── Rate limiting ───────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-var-requires
const rateLimit = require('express-rate-limit').default || require('express-rate-limit');

const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'),
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  standardHeaders: true,
  legacyHeaders: false,
  message: { status: 'error', message: 'Too many requests, please try again later' }
});

app.use('/api/', limiter);

// Stricter limit for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { status: 'error', message: 'Too many login attempts, please try again later' }
});

// ─── Body parsing ────────────────────────────────────────────────────────────

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true, limit: '1mb' }));

// ─── Request logging ─────────────────────────────────────────────────────────

app.use((req, _res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// ─── Health check ────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── Bootstrap: create store managers (hit /api/bootstrap in browser) ────────

app.get('/api/bootstrap', async (_req, res) => {
  try {
    const bcrypt = require('bcrypt');
    const password = await bcrypt.hash('manager123', 10);

    const stores = await prisma.store.findMany({ orderBy: { storeId: 'asc' } });
    const managers = [
      { email: 'newyork@example.com', firstName: 'New York', lastName: 'Manager', storeId: 'STORE001' },
      { email: 'london@example.com', firstName: 'London', lastName: 'Manager', storeId: 'STORE002' },
      { email: 'tokyo@example.com', firstName: 'Tokyo', lastName: 'Manager', storeId: 'STORE003' },
      { email: 'paris@example.com', firstName: 'Paris', lastName: 'Manager', storeId: 'STORE004' },
      { email: 'sydney@example.com', firstName: 'Sydney', lastName: 'Manager', storeId: 'STORE005' }
    ];

    const results = [];
    for (const mgr of managers) {
      const store = stores.find((s: any) => s.storeId === mgr.storeId);
      if (!store) { results.push(`${mgr.email}: store not found`); continue; }

      const user = await prisma.user.upsert({
        where: { email: mgr.email },
        update: { password },
        create: {
          email: mgr.email, password,
          firstName: mgr.firstName, lastName: mgr.lastName,
          role: 'STORE_MANAGER', storeId: store.id
        }
      });
      results.push(`${mgr.email} -> ${store.storeName} (${user.id})`);
    }

    res.json({ status: 'success', message: 'Store managers created', results });
  } catch (err: any) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// ─── Routes ──────────────────────────────────────────────────────────────────

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/pricing', pricingRoutes);
app.use('/api/upload', uploadRoutes);
app.use('/api/stores', storeRoutes);
app.use('/api/ai', aiRoutes);

// ─── Error handling ──────────────────────────────────────────────────────────

app.use(errorHandler);

// ─── Graceful shutdown ───────────────────────────────────────────────────────

const server = app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV}`);
});

const shutdown = async (signal: string) => {
  logger.info(`${signal} received. Shutting down gracefully...`);
  server.close(async () => {
    await prisma.$disconnect();
    logger.info('Database connection closed');
    process.exit(0);
  });

  // Force shutdown after 10s
  setTimeout(() => {
    logger.error('Forced shutdown after timeout');
    process.exit(1);
  }, 10000);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

export default app;
