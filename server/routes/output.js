import { Router } from 'express';
import { getOutput, getTask } from '../db.js';

const router = Router();

router.get('/api/tasks/:id/output', (req, res) => {
  const task = getTask(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const output = getOutput(req.params.id);
  res.json({ taskId: req.params.id, output });
});

export default router;
