CREATE TABLE IF NOT EXISTS _migrations (
  id         INTEGER PRIMARY KEY,
  name       TEXT NOT NULL UNIQUE,
  applied_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE tasks (
  id              TEXT PRIMARY KEY,
  title           TEXT NOT NULL,
  description     TEXT NOT NULL DEFAULT '',
  column          TEXT NOT NULL DEFAULT 'not_started'
                  CHECK(column IN ('not_started','claude','your_turn','done')),
  position        INTEGER NOT NULL DEFAULT 0,
  working_dir     TEXT,
  branch          TEXT,
  conversation_id TEXT,
  needs_input     INTEGER NOT NULL DEFAULT 0,
  pending_prompt  TEXT,
  archived        INTEGER NOT NULL DEFAULT 0,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE activity_log (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id   TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  author    TEXT NOT NULL CHECK(author IN ('user','claude','system')),
  message   TEXT NOT NULL,
  timestamp TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT
);

CREATE INDEX idx_activity_task ON activity_log(task_id);
CREATE INDEX idx_tasks_column ON tasks(column);
CREATE INDEX idx_tasks_archived ON tasks(archived);
