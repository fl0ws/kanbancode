CREATE TABLE commands (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  description TEXT NOT NULL DEFAULT '',
  template    TEXT NOT NULL,
  builtin     INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

INSERT INTO commands (id, name, description, template, builtin) VALUES
  ('cmd-review', 'review', 'Review code changes', 'Review the code changes in this project. Focus on correctness, potential bugs, security issues, and code quality. Provide specific, actionable feedback.', 1),
  ('cmd-test', 'test', 'Write tests', 'Write comprehensive tests for the described functionality. Include edge cases, error scenarios, and happy path tests. Use the existing test framework and patterns in the project.', 1),
  ('cmd-refactor', 'refactor', 'Refactor code', 'Refactor the described code to improve readability, maintainability, and performance. Preserve existing behavior. Explain the changes you make and why.', 1),
  ('cmd-fix', 'fix', 'Fix a bug', 'Investigate and fix the described bug. First reproduce and understand the root cause, then implement a minimal fix. Explain what caused the issue and how your fix addresses it.', 1),
  ('cmd-docs', 'docs', 'Write documentation', 'Write clear documentation for the described code or feature. Include usage examples, API reference if applicable, and any important caveats or limitations.', 1),
  ('cmd-explain', 'explain', 'Explain code', 'Explain how the described code or feature works. Walk through the logic step by step, describe the data flow, and highlight any non-obvious design decisions.', 1)
