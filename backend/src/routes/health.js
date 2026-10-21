import { Router } from 'express';
import { prisma } from '../index.js';
import { pool } from '../db.js';

const router = Router();

router.get('/', async (_req, res) => {
  try {
    await Promise.all([
      prisma.$queryRaw`SELECT 1`,
      pool.query('SELECT 1'),
    ]);
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      database: 'connected',
      pool: 'connected',
    });
  } catch {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
    });
  }
});

router.get('/ready', async (_req, res) => {
  try {
    await Promise.all([
      prisma.$queryRaw`SELECT 1`,
      pool.query('SELECT 1'),
    ]);
    res.json({ ready: true });
  } catch {
    res.status(503).json({ ready: false });
  }
});

router.get('/db', async (_req, res) => {
  try {
    const [rows] = await pool.query('SELECT VERSION() AS version, @@port AS port;');
    res.json({
      status: 'healthy',
      database: 'connected',
      version: rows[0]?.version,
      port: rows[0]?.port,
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      database: 'disconnected',
      error: error.code || 'CONNECTION_FAILED',
    });
  }
});

export default router;