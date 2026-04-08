import { Router } from 'express';
import { randomUUID } from 'crypto';
import * as db from '../db.js';
import { validateTransition, COLUMNS } from '../state-machine.js';
import { broadcast } from '../ws.js';
import { logger } from '../logger.js';

const router = Router();

// Get all active tasks
router.get('/api/tasks', (req, res) => {
  const column = req.query.column;
  const projectId = req.query.project_id;
  if (column && !COLUMNS.includes(column)) {
    return res.status(400).json({ error: `Invalid column: ${column}` });
  }
  const tasks = db.getTasks(column || null, projectId || null);
  res.json(tasks);
});

// Get archived tasks
router.get('/api/tasks/archived', (req, res) => {
  const tasks = db.getArchivedTasks(req.query.q || null, req.query.project_id || null);
  res.json(tasks);
});

// Reorder tasks within a column
router.post('/api/tasks/reorder', (req, res) => {
  const { column, ids } = req.body;
  if (!column || !COLUMNS.includes(column)) {
    return res.status(400).json({ error: 'Invalid column' });
  }
  if (!Array.isArray(ids)) {
    return res.status(400).json({ error: 'ids must be an array' });
  }
  db.reorderTasks(column, ids);
  broadcast('tasks:reordered', { column, ids });
  res.json({ ok: true });
});

// Get single task
router.get('/api/tasks/:id', (req, res) => {
  const task = db.getTask(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });
  res.json(task);
});

// Create task
router.post('/api/tasks', (req, res) => {
  const { title, description, working_dir, project_id } = req.body;
  if (!title || !title.trim()) {
    return res.status(400).json({ error: 'Title is required' });
  }
  const id = randomUUID();
  const pid = project_id || 'default';
  // Inherit working_dir from project if not provided
  let taskDir = working_dir || null;
  if (!taskDir) {
    const project = db.getProject(pid);
    if (project?.working_dir) taskDir = project.working_dir;
  }
  const task = db.createTask(id, title.trim(), description || '', taskDir, pid);
  db.addActivity(id, 'system', 'Task created');
  const freshTask = db.getTask(id);
  broadcast('task:created', { task: freshTask });
  logger.info('Task created', { taskId: id, title: title.trim(), projectId: project_id });
  res.status(201).json(freshTask);
});

// Update task
router.patch('/api/tasks/:id', (req, res) => {
  const task = db.getTask(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const { title, description, needs_input, pending_prompt } = req.body;

  if (title !== undefined || description !== undefined) {
    db.updateTask(
      req.params.id,
      title !== undefined ? title : task.title,
      description !== undefined ? description : task.description
    );
  }

  if (needs_input !== undefined) {
    db.updateTaskInput(req.params.id, needs_input, pending_prompt || null);
  }

  const updated = db.getTask(req.params.id);
  broadcast('task:updated', { task: updated });
  res.json(updated);
});

// Move task to column
router.post('/api/tasks/:id/move', (req, res) => {
  const task = db.getTask(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const { column } = req.body;
  if (!column) return res.status(400).json({ error: 'Column is required' });

  try {
    validateTransition(task.column, column);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }

  const from = task.column;
  db.clearPendingQuestions(req.params.id);
  const moved = db.moveTask(req.params.id, column);
  db.addActivity(req.params.id, 'system', `Moved from ${from} to ${column}`);
  broadcast('task:moved', { task: moved, from, to: column });
  logger.info('Task moved', { taskId: req.params.id, from, to: column });

  // If moving to claude, the worker pool handles spawning (Phase 2)
  // Emit an event that the worker pool listens for
  if (column === 'claude' && router.onMoveToClaudeCallback) {
    router.onMoveToClaudeCallback(req.params.id, moved);
  }

  res.json(moved);
});

// Claim task
router.post('/api/tasks/:id/claim', (req, res) => {
  const task = db.getTask(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const { working_dir, branch, session_id } = req.body;
  const claimed = db.claimTask(req.params.id, working_dir, branch, session_id);
  db.addActivity(req.params.id, 'system', 'Session started');
  broadcast('task:updated', { task: claimed });
  res.json(claimed);
});

// Log activity
router.post('/api/tasks/:id/log', (req, res) => {
  const task = db.getTask(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const { author, message } = req.body;
  if (!author || !message) {
    return res.status(400).json({ error: 'author and message are required' });
  }
  if (!['user', 'claude', 'system'].includes(author)) {
    return res.status(400).json({ error: 'author must be user, claude, or system' });
  }

  const entry = db.addActivity(req.params.id, author, message);
  broadcast('task:activity', { taskId: req.params.id, entry });
  res.json(entry);
});

// Stop Claude process
router.post('/api/tasks/:id/stop', (req, res) => {
  const task = db.getTask(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  if (task.column !== 'claude') {
    return res.status(400).json({ error: 'Task is not in claude column' });
  }

  // Worker pool handles the actual kill (Phase 2)
  if (router.onStopCallback) {
    router.onStopCallback(req.params.id);
  }

  // Move to your_turn
  const moved = db.moveTask(req.params.id, 'your_turn');
  db.addActivity(req.params.id, 'system', 'Process stopped by user');
  broadcast('task:moved', { task: moved, from: 'claude', to: 'your_turn' });
  logger.info('Task stopped', { taskId: req.params.id });
  res.json(moved);
});

// Archive task
router.post('/api/tasks/:id/archive', (req, res) => {
  const task = db.getTask(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  db.archiveTask(req.params.id);
  broadcast('task:archived', { id: req.params.id });
  logger.info('Task archived', { taskId: req.params.id });
  res.json({ ok: true });
});

// Unarchive task
router.post('/api/tasks/:id/unarchive', (req, res) => {
  const task = db.getTask(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const restored = db.unarchiveTask(req.params.id);
  db.addActivity(req.params.id, 'system', 'Task restored from archive');
  broadcast('task:unarchived', { task: restored });
  logger.info('Task unarchived', { taskId: req.params.id });
  res.json(restored);
});

// Delete task permanently
router.delete('/api/tasks/:id', (req, res) => {
  const task = db.getTask(req.params.id);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  // Stop process if running
  if (task.column === 'claude' && router.onStopCallback) {
    router.onStopCallback(req.params.id);
  }

  db.deleteTask(req.params.id);
  broadcast('task:deleted', { id: req.params.id });
  logger.info('Task deleted', { taskId: req.params.id });
  res.json({ ok: true });
});

// Settings
router.get('/api/settings/:key', (req, res) => {
  const value = db.getSetting(req.params.key);
  res.json({ key: req.params.key, value });
});

router.post('/api/settings', (req, res) => {
  const { key, value } = req.body;
  if (!key) return res.status(400).json({ error: 'key is required' });
  db.setSetting(key, value);
  broadcast('settings:updated', { key, value });
  logger.info('Setting updated', { key, value });
  res.json({ ok: true });
});

// --- Projects ---

router.get('/api/projects', (req, res) => {
  res.json(db.getProjects());
});

router.get('/api/projects/:id', (req, res) => {
  const project = db.getProject(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });
  res.json(project);
});

router.post('/api/projects', (req, res) => {
  const { name, working_dir } = req.body;
  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Name is required' });
  }
  const id = randomUUID();
  const project = db.createProject(id, name.trim(), working_dir || null);
  broadcast('project:created', { project });
  logger.info('Project created', { projectId: id, name: name.trim() });
  res.status(201).json(project);
});

router.patch('/api/projects/:id', (req, res) => {
  const project = db.getProject(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  const { name, working_dir } = req.body;
  const updated = db.updateProject(
    req.params.id,
    name !== undefined ? name : project.name,
    working_dir !== undefined ? working_dir : project.working_dir
  );
  broadcast('project:updated', { project: updated });
  res.json(updated);
});

router.delete('/api/projects/:id', (req, res) => {
  const project = db.getProject(req.params.id);
  if (!project) return res.status(404).json({ error: 'Project not found' });

  // Stop any running tasks in this project
  const tasks = db.getTasks(null, req.params.id);
  for (const task of tasks) {
    if (task.column === 'claude' && router.onStopCallback) {
      router.onStopCallback(task.id);
    }
  }

  db.deleteProject(req.params.id);
  broadcast('project:deleted', { id: req.params.id });
  logger.info('Project deleted', { projectId: req.params.id });
  res.json({ ok: true });
});

// --- Commands ---

router.get('/api/commands', (req, res) => {
  res.json(db.getCommands());
});

router.post('/api/commands', (req, res) => {
  const { name, description, template } = req.body;
  if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
  if (!template?.trim()) return res.status(400).json({ error: 'Template is required' });
  const id = randomUUID();
  const cmd = db.createCommand(id, name.trim(), description || '', template.trim());
  res.status(201).json(cmd);
});

router.patch('/api/commands/:id', (req, res) => {
  const cmd = db.getCommand(req.params.id);
  if (!cmd) return res.status(404).json({ error: 'Command not found' });
  const { name, description, template } = req.body;
  const updated = db.updateCommand(
    req.params.id,
    name !== undefined ? name : cmd.name,
    description !== undefined ? description : cmd.description,
    template !== undefined ? template : cmd.template
  );
  res.json(updated);
});

router.delete('/api/commands/:id', (req, res) => {
  const cmd = db.getCommand(req.params.id);
  if (!cmd) return res.status(404).json({ error: 'Command not found' });
  if (cmd.builtin) return res.status(400).json({ error: 'Cannot delete built-in commands' });
  db.deleteCommand(req.params.id);
  res.json({ ok: true });
});

// Hook for worker pool integration
router.onMoveToClaudeCallback = null;
router.onStopCallback = null;

export default router;
