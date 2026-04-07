import initSqlJs from 'sql.js';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { runMigrations } from './migrations/runner.js';
import { logger } from './logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '..', 'data');

if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

const dbPath = join(dataDir, 'kanban.db');

// Initialize sql.js and open/create database
const SQL = await initSqlJs();

let db;
if (existsSync(dbPath)) {
  const buffer = readFileSync(dbPath);
  db = new SQL.Database(buffer);
} else {
  db = new SQL.Database();
}

// Enable foreign keys
db.run('PRAGMA foreign_keys = ON');

// Save helper — writes DB to disk
let saveTimeout = null;
function saveToDisk() {
  const data = db.export();
  writeFileSync(dbPath, Buffer.from(data));
}

// Debounced save — batches rapid writes, saves at most every 500ms
function scheduleSave() {
  if (saveTimeout) return;
  saveTimeout = setTimeout(() => {
    saveTimeout = null;
    saveToDisk();
  }, 500);
}

// Immediate save for critical operations
function saveNow() {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    saveTimeout = null;
  }
  saveToDisk();
}

// Run migrations
runMigrations(db);
saveNow();
logger.info('Database initialized', { path: dbPath });

// --- Query helpers ---

function run(sql, params = []) {
  db.run(sql, params);
  scheduleSave();
}

function get(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  let row = null;
  if (stmt.step()) {
    row = stmt.getAsObject();
  }
  stmt.free();
  return row;
}

function all(sql, params = []) {
  const rows = [];
  const stmt = db.prepare(sql);
  stmt.bind(params);
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

function getLastInsertRowId() {
  return get('SELECT last_insert_rowid() as id').id;
}

// --- Public API ---

function hydrateTask(task) {
  if (!task) return null;
  const activities = all(
    'SELECT * FROM activity_log WHERE task_id = ? ORDER BY timestamp ASC',
    [task.id]
  );
  let pendingQuestions = null;
  if (task.pending_questions) {
    try { pendingQuestions = JSON.parse(task.pending_questions); } catch {}
  }
  return { ...task, pending_questions: pendingQuestions, activity_log: activities };
}

export function getTasks(column, projectId) {
  if (column && projectId) {
    return all('SELECT * FROM tasks WHERE archived = 0 AND column = ? AND project_id = ? ORDER BY position', [column, projectId]).map(hydrateTask);
  }
  if (projectId) {
    return all('SELECT * FROM tasks WHERE archived = 0 AND project_id = ? ORDER BY column, position', [projectId]).map(hydrateTask);
  }
  if (column) {
    return all('SELECT * FROM tasks WHERE archived = 0 AND column = ? ORDER BY position', [column]).map(hydrateTask);
  }
  return all('SELECT * FROM tasks WHERE archived = 0 ORDER BY column, position').map(hydrateTask);
}

export function getTask(id) {
  return hydrateTask(get('SELECT * FROM tasks WHERE id = ?', [id]));
}

export function createTask(id, title, description, workingDir, projectId) {
  run(
    `INSERT INTO tasks (id, title, description, working_dir, project_id, column, position)
     VALUES (?, ?, ?, ?, ?, 'not_started',
       (SELECT COALESCE(MAX(position), -1) + 1 FROM tasks WHERE column = 'not_started' AND project_id = ?))`,
    [id, title, description || '', workingDir || null, projectId || 'default', projectId || 'default']
  );
  return getTask(id);
}

export function updateTask(id, title, description) {
  run(
    `UPDATE tasks SET title = ?, description = ?, updated_at = datetime('now') WHERE id = ?`,
    [title, description, id]
  );
  return getTask(id);
}

export function moveTask(id, column) {
  run(
    `UPDATE tasks SET column = ?, position = (SELECT COALESCE(MAX(position), -1) + 1 FROM tasks WHERE column = ?), updated_at = datetime('now') WHERE id = ?`,
    [column, column, id]
  );
  run(
    `UPDATE tasks SET needs_input = 0, pending_prompt = NULL, updated_at = datetime('now') WHERE id = ?`,
    [id]
  );
  return getTask(id);
}

export function claimTask(id, workingDir, branch, conversationId) {
  run(
    `UPDATE tasks SET working_dir = ?, branch = ?, conversation_id = ?, updated_at = datetime('now') WHERE id = ?`,
    [workingDir || null, branch || null, conversationId || null, id]
  );
  return getTask(id);
}

export function setConversationId(id, conversationId) {
  run(
    `UPDATE tasks SET conversation_id = ?, updated_at = datetime('now') WHERE id = ?`,
    [conversationId, id]
  );
}

export function setPendingQuestions(id, questions) {
  run(
    `UPDATE tasks SET pending_questions = ?, updated_at = datetime('now') WHERE id = ?`,
    [questions ? JSON.stringify(questions) : null, id]
  );
}

export function clearPendingQuestions(id) {
  run(
    `UPDATE tasks SET pending_questions = NULL, updated_at = datetime('now') WHERE id = ?`,
    [id]
  );
}

export function updateTaskInput(id, needsInput, pendingPrompt) {
  run(
    `UPDATE tasks SET needs_input = ?, pending_prompt = ?, updated_at = datetime('now') WHERE id = ?`,
    [needsInput ? 1 : 0, pendingPrompt || null, id]
  );
  return getTask(id);
}

export function archiveTask(id) {
  run(`UPDATE tasks SET archived = 1, updated_at = datetime('now') WHERE id = ?`, [id]);
}

export function unarchiveTask(id) {
  run(
    `UPDATE tasks SET archived = 0, column = 'not_started', position = (SELECT COALESCE(MAX(position), -1) + 1 FROM tasks WHERE column = 'not_started'), updated_at = datetime('now') WHERE id = ?`,
    [id]
  );
  return getTask(id);
}

export function deleteTask(id) {
  run('DELETE FROM tasks WHERE id = ?', [id]);
}

export function getArchivedTasks(query, projectId) {
  if (query && projectId) {
    const like = `%${query}%`;
    return all(
      'SELECT * FROM tasks WHERE archived = 1 AND project_id = ? AND (title LIKE ? OR description LIKE ?) ORDER BY updated_at DESC',
      [projectId, like, like]
    );
  }
  if (projectId) {
    return all('SELECT * FROM tasks WHERE archived = 1 AND project_id = ? ORDER BY updated_at DESC', [projectId]);
  }
  if (query) {
    const like = `%${query}%`;
    return all(
      'SELECT * FROM tasks WHERE archived = 1 AND (title LIKE ? OR description LIKE ?) ORDER BY updated_at DESC',
      [like, like]
    );
  }
  return all('SELECT * FROM tasks WHERE archived = 1 ORDER BY updated_at DESC');
}

export function reorderTasks(column, ids) {
  for (let i = 0; i < ids.length; i++) {
    run('UPDATE tasks SET position = ? WHERE id = ?', [i, ids[i]]);
  }
  saveNow();
}

export function addActivity(taskId, author, message) {
  run(
    'INSERT INTO activity_log (task_id, author, message) VALUES (?, ?, ?)',
    [taskId, author, message]
  );
  const id = getLastInsertRowId();
  return get('SELECT * FROM activity_log WHERE id = ?', [id]);
}

export function getActivities(taskId) {
  return all('SELECT * FROM activity_log WHERE task_id = ? ORDER BY timestamp ASC', [taskId]);
}

// Output buffer with 64KB cap
const OUTPUT_MAX_BYTES = 64 * 1024;

export function insertOutput(taskId, chunk) {
  run('INSERT INTO output_buffer (task_id, chunk) VALUES (?, ?)', [taskId, chunk]);

  const sizeRow = get('SELECT COALESCE(SUM(LENGTH(chunk)), 0) as total FROM output_buffer WHERE task_id = ?', [taskId]);
  if (sizeRow.total > OUTPUT_MAX_BYTES) {
    const countRow = get('SELECT COUNT(*) as count FROM output_buffer WHERE task_id = ?', [taskId]);
    const toRemove = Math.max(1, Math.floor(countRow.count / 2));
    run(
      'DELETE FROM output_buffer WHERE id IN (SELECT id FROM output_buffer WHERE task_id = ? ORDER BY id ASC LIMIT ?)',
      [taskId, toRemove]
    );
  }
}

export function getOutput(taskId) {
  const rows = all('SELECT chunk FROM output_buffer WHERE task_id = ? ORDER BY id ASC', [taskId]);
  return rows.map(r => r.chunk).join('');
}

export function clearOutput(taskId) {
  run('DELETE FROM output_buffer WHERE task_id = ?', [taskId]);
}

export function getSetting(key) {
  const row = get('SELECT value FROM settings WHERE key = ?', [key]);
  return row ? row.value : null;
}

export function setSetting(key, value) {
  run(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, String(value)]
  );
  saveNow();
}

export function getStuckClaudeTasks() {
  return all('SELECT * FROM tasks WHERE archived = 0 AND column = ? ORDER BY position', ['claude']);
}

// --- Projects ---

export function getProjects() {
  return all('SELECT * FROM projects ORDER BY created_at ASC');
}

export function getProject(id) {
  return get('SELECT * FROM projects WHERE id = ?', [id]);
}

export function createProject(id, name, workingDir) {
  run(
    'INSERT INTO projects (id, name, working_dir) VALUES (?, ?, ?)',
    [id, name, workingDir || null]
  );
  return getProject(id);
}

export function updateProject(id, name, workingDir) {
  run(
    'UPDATE projects SET name = ?, working_dir = ?, updated_at = datetime(\'now\') WHERE id = ?',
    [name, workingDir || null, id]
  );
  return getProject(id);
}

export function deleteProject(id) {
  // Tasks cascade-delete via FK
  run('DELETE FROM projects WHERE id = ?', [id]);
}

// --- Quick Questions ---

export function getQuickQuestions(projectId) {
  return all(
    'SELECT id, project_id, title, conversation_id, created_at, updated_at FROM quick_questions WHERE project_id = ? ORDER BY updated_at DESC',
    [projectId]
  );
}

export function getQuickQuestion(id) {
  const row = get('SELECT * FROM quick_questions WHERE id = ?', [id]);
  if (row && row.messages) {
    try { row.messages = JSON.parse(row.messages); } catch { row.messages = []; }
  }
  return row;
}

export function createQuickQuestion(id, projectId, title) {
  run(
    'INSERT INTO quick_questions (id, project_id, title) VALUES (?, ?, ?)',
    [id, projectId, title]
  );
  return getQuickQuestion(id);
}

export function updateQuickQuestion(id, messages, conversationId) {
  run(
    'UPDATE quick_questions SET messages = ?, conversation_id = ?, updated_at = datetime(\'now\') WHERE id = ?',
    [JSON.stringify(messages), conversationId || null, id]
  );
}

export function deleteQuickQuestion(id) {
  run('DELETE FROM quick_questions WHERE id = ?', [id]);
}

// Save on process exit
process.on('exit', () => saveNow());
process.on('SIGINT', () => { saveNow(); process.exit(0); });
process.on('SIGTERM', () => { saveNow(); process.exit(0); });

export { db };
