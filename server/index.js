import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { setupWebSocket } from './ws.js';
import { logger } from './logger.js';
logger.setLevel(process.env.LOG_LEVEL || 'debug');
import { WorkerPool } from './worker-pool.js';
import { DreamingEngine } from './dreaming.js';
import tasksRouter from './routes/tasks.js';
import healthRouter from './routes/health.js';
import outputRouter from './routes/output.js';
import fsRouter from './routes/fs.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 3001;

// Initialize worker pool
const pool = new WorkerPool();
pool.init();

// Initialize dreaming engine
const dreaming = new DreamingEngine(pool);
dreaming.init();

// Wire pool → dreaming: notify when tasks complete
pool.onTaskExited = (taskId) => {
  dreaming.onTaskCompleted(taskId);
};

// Wire pool callbacks into task routes
tasksRouter.onMoveToClaudeCallback = (taskId, task) => {
  const result = pool.enqueue(taskId, task);
  if (result.error) {
    logger.warn('Failed to enqueue task', { taskId, error: result.error });
  }
};

tasksRouter.onStopCallback = (taskId) => {
  pool.stop(taskId);
};

// Make pool accessible to health route
healthRouter.getPoolStatus = () => pool.getStatus();

const app = express();
app.use(cors());
app.use(express.json());

// API routes
app.use(tasksRouter);
app.use(healthRouter);
app.use(outputRouter);
app.use(fsRouter);

// Pool status endpoint
app.get('/api/pool/status', (req, res) => {
  res.json(pool.getStatus());
});

// Dreaming status
app.get('/api/dreaming/status', (req, res) => {
  res.json(dreaming.getStatus());
});

// Configure concurrency via pool
app.post('/api/pool/configure', (req, res) => {
  const { maxConcurrency } = req.body;
  if (!maxConcurrency || typeof maxConcurrency !== 'number' || maxConcurrency < 1) {
    return res.status(400).json({ error: 'maxConcurrency must be a positive number' });
  }
  pool.configure(maxConcurrency);
  res.json({ ok: true, maxConcurrency });
});

// Serve static files in production
const distPath = join(__dirname, '..', 'client', 'dist');
if (existsSync(distPath)) {
  app.use(express.static(distPath));
  // SPA fallback — but never for /api/ routes
  app.get('*', (req, res) => {
    if (req.path.startsWith('/api/')) {
      return res.status(404).json({ error: 'Not found' });
    }
    res.sendFile(join(distPath, 'index.html'));
  });
}

const server = createServer(app);
setupWebSocket(server);

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    logger.error(`Port ${PORT} is already in use. Kill the existing process or set a different PORT.`, { port: PORT });
  } else {
    logger.error('Server error', { error: err.message });
  }
  process.exit(1);
});

server.listen(PORT, () => {
  logger.info('Server started', { port: PORT });
});

// Graceful shutdown
function shutdown() {
  logger.info('Shutting down...');
  pool.stopAll();
  dreaming.stop();
  server.close(() => {
    logger.info('Server stopped');
    process.exit(0);
  });
  // Force exit after 5s if graceful shutdown hangs
  setTimeout(() => process.exit(1), 5000);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
