CREATE TABLE projects (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  working_dir TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO projects (id, name) VALUES ('default', 'Default');

ALTER TABLE tasks ADD COLUMN project_id TEXT DEFAULT 'default';

UPDATE tasks SET project_id = 'default' WHERE project_id IS NULL
