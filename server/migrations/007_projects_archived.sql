-- Add archived column to projects table (0 = active, 1 = archived)
ALTER TABLE projects ADD COLUMN archived INTEGER DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_projects_archived ON projects(archived);
