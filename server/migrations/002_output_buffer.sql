CREATE TABLE output_buffer (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id   TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  chunk     TEXT NOT NULL,
  timestamp TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX idx_output_task ON output_buffer(task_id);
