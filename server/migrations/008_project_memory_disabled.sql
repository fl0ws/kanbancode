-- Per-project toggle to completely disable memory: no MEMORY_INSTRUCTION in
-- prompts, no dreaming, no .claude-memory consolidation for this project.
ALTER TABLE projects ADD COLUMN memory_disabled INTEGER NOT NULL DEFAULT 0;
