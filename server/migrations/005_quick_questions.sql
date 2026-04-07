CREATE TABLE quick_questions (
  id          TEXT PRIMARY KEY,
  project_id  TEXT NOT NULL,
  title       TEXT NOT NULL,
  messages    TEXT NOT NULL DEFAULT '[]',
  conversation_id TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_qq_project ON quick_questions(project_id)
