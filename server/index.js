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
import { QuickQuestionSession } from './quick-question.js';
import * as db from './db.js';
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

// Quick question
const qq = new QuickQuestionSession();

app.post('/api/qq/ask', (req, res) => {
  const { question, project_id } = req.body;
  if (!question?.trim()) return res.status(400).json({ error: 'Question is required' });
  if (!project_id) return res.status(400).json({ error: 'project_id is required' });
  const result = qq.ask(question.trim(), project_id);
  if (result.error) return res.status(400).json(result);
  res.json(result);
});

app.post('/api/qq/reply', (req, res) => {
  const { message } = req.body;
  if (!message?.trim()) return res.status(400).json({ error: 'Message is required' });
  const result = qq.reply(message.trim());
  if (result.error) return res.status(400).json(result);
  res.json(result);
});

app.post('/api/qq/stop', (req, res) => {
  qq.stop();
  res.json({ ok: true });
});

app.post('/api/qq/reset', (req, res) => {
  qq.reset();
  res.json({ ok: true });
});

// Manual dream trigger
app.post('/api/dreaming/trigger', (req, res) => {
  // Mark all projects with a working_dir as dirty so dreaming processes them
  const projects = db.getProjects();
  for (const p of projects) {
    if (p.working_dir) dreaming.memoryDirtyProjects.add(p.id);
  }
  dreaming._startDreaming();
  res.json({ ok: true, message: 'Dreaming triggered' });
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
