import { Router } from 'express';
import { getSetting } from '../db.js';

const router = Router();

const startTime = Date.now();

router.get('/api/health', (req, res) => {
  const maxConcurrency = getSetting('maxConcurrency');
  const poolStatus = router.getPoolStatus ? router.getPoolStatus() : null;
  res.json({
    status: 'ok',
    uptime: Math.floor((Date.now() - startTime) / 1000),
    concurrencyConfigured: maxConcurrency !== null,
    maxConcurrency: maxConcurrency ? Number(maxConcurrency) : null,
    pool: poolStatus,
  });
});

export default router;
