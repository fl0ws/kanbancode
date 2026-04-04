import { readdirSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { logger } from '../logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

export function runMigrations(db) {
  // Ensure _migrations table exists
  db.run(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id         INTEGER PRIMARY KEY,
      name       TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Get already-applied migrations
  const applied = new Set();
  const stmt = db.prepare('SELECT name FROM _migrations');
  while (stmt.step()) {
    applied.add(stmt.getAsObject().name);
  }
  stmt.free();

  const files = readdirSync(__dirname)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    if (applied.has(file)) continue;

    const sql = readFileSync(join(__dirname, file), 'utf-8');
    logger.info('Applying migration', { migration: file });

    // Split on semicolons, filter empty, execute each
    const statements = sql.split(';').map(s => s.trim()).filter(Boolean);
    for (const s of statements) {
      db.run(s);
    }
    db.run('INSERT INTO _migrations (name) VALUES (?)', [file]);

    logger.info('Migration applied', { migration: file });
  }
}
