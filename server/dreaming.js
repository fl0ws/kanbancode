import { spawn, execSync } from 'child_process';
import { existsSync, readdirSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import { join, resolve } from 'path';
import { homedir, tmpdir } from 'os';
import { logger } from './logger.js';
import { broadcast } from './ws.js';
import * as db from './db.js';

const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export class DreamingEngine {
  constructor(workerPool) {
    this.workerPool = workerPool;
    this.idleTimer = null;
    this.dreaming = false;
    this.process = null;
    this.lastDreamTime = null;
    this.memoryDirtyProjects = new Set(); // project IDs that have new memories since last dream
  }

  init() {
    const lastDream = db.getSetting('lastDreamTime');
    if (lastDream) this.lastDreamTime = new Date(lastDream);
    logger.info('Dreaming engine initialized', { lastDream: this.lastDreamTime });
  }

  // Called when a task completes — marks that project as having new memories
  onTaskCompleted(taskId) {
    const task = db.getTask(taskId);
    if (task?.project_id) {
      this.memoryDirtyProjects.add(task.project_id);
      logger.debug('Project marked dirty for dreaming', { projectId: task.project_id });
    }
    this._resetIdleTimer();
  }

  // Called when any pool activity changes (spawn, exit, etc.)
  onPoolActivity() {
    this._resetIdleTimer();
  }

  _resetIdleTimer() {
    if (this.idleTimer) clearTimeout(this.idleTimer);

    // Only start timer if pool is empty and there are dirty projects
    if (this.workerPool.running.size === 0 && this.memoryDirtyProjects.size > 0 && !this.dreaming) {
      this.idleTimer = setTimeout(() => {
        this._startDreaming();
      }, IDLE_TIMEOUT_MS);
      logger.debug('Idle timer started', { timeoutMs: IDLE_TIMEOUT_MS, dirtyProjects: [...this.memoryDirtyProjects] });
    }
  }

  async _startDreaming() {
    if (this.dreaming) return;
    if (this.memoryDirtyProjects.size === 0) return;

    // Check which projects actually have memory files and a working_dir
    const projectsToDream = [];
    for (const projectId of this.memoryDirtyProjects) {
      const project = db.getProject(projectId);
      if (!project?.working_dir) continue;

      let workingDir = project.working_dir;
      if (workingDir.startsWith('~')) {
        workingDir = workingDir.replace(/^~/, homedir());
      }
      workingDir = resolve(workingDir);

      const memDir = join(workingDir, '.claude-memory');
      if (existsSync(memDir)) {
        const files = readdirSync(memDir).filter(f => f.endsWith('.md'));
        if (files.length > 0) {
          projectsToDream.push({ projectId, workingDir, memDir, files });
        }
      }
    }

    if (projectsToDream.length === 0) {
      this.memoryDirtyProjects.clear();
      return;
    }

    this.dreaming = true;
    broadcast('dreaming:started', {});
    logger.info('Dreaming started', { projects: projectsToDream.map(p => p.projectId) });

    for (const proj of projectsToDream) {
      try {
        await this._dreamProject(proj);
        this.memoryDirtyProjects.delete(proj.projectId);
      } catch (err) {
        logger.error('Dream failed for project', { projectId: proj.projectId, error: err.message });
      }
    }

    this.dreaming = false;
    this.lastDreamTime = new Date();
    db.setSetting('lastDreamTime', this.lastDreamTime.toISOString());
    broadcast('dreaming:finished', {});
    logger.info('Dreaming finished');
  }

  _dreamProject({ projectId, workingDir, memDir, files }) {
    return new Promise((resolvePromise, reject) => {
      // Read all memory files to build the prompt
      const memories = files.map(f => {
        const content = readFileSync(join(memDir, f), 'utf-8');
        return `### ${f}\n${content}`;
      }).join('\n\n---\n\n');

      const prompt = `You are a memory consolidation agent. Your job is to organize and clean up project memory files.

## Current memory files in .claude-memory/:
${memories}

## Your task:
1. Read all the memory files above
2. Consolidate them into clean, topic-based files. Merge related information, remove duplicates, and delete stale/outdated entries.
3. Write the consolidated files to .claude-memory/ (you can delete old task-specific files and create new topic-based ones like "architecture.md", "conventions.md", "api-patterns.md", etc.)
4. Rebuild the CLAUDE.md file with a "## Project Memory" section that indexes the consolidated files. Each entry should be one line: "- [Topic](.claude-memory/filename.md) — brief description"
5. IMPORTANT: Preserve any existing non-memory content in CLAUDE.md (anything above or below the "## Project Memory" section). Only update the memory section.
6. Keep the total memory concise — aim for key insights, not exhaustive documentation. If something is obvious from the code, don't store it.

Do this now. Do not ask questions.`;

      const promptFile = join(tmpdir(), `kanban-dream-${projectId}-${Date.now()}.txt`);
      writeFileSync(promptFile, prompt, 'utf-8');

      const configDir = db.getSetting('claudeConfigDir') || null;
      const env = { ...process.env };
      if (configDir) {
        let resolved = configDir;
        if (resolved.startsWith('~')) resolved = resolved.replace(/^~/, homedir());
        env.CLAUDE_CONFIG_DIR = resolve(resolved);
      }

      const command = process.platform === 'win32'
        ? `type "${promptFile}" | claude --dangerously-skip-permissions --output-format stream-json --verbose`
        : `cat "${promptFile}" | claude --dangerously-skip-permissions --output-format stream-json --verbose`;

      logger.info('Dream spawning for project', { projectId, workingDir });

      const proc = spawn(command, [], {
        cwd: workingDir,
        stdio: ['ignore', 'pipe', 'pipe'],
        shell: true,
        windowsHide: process.platform === 'win32',
        env,
      });

      this.process = proc;

      proc.stdout.on('data', (data) => {
        // Parse for completion, but we don't need to stream output
        const lines = data.toString().split('\n');
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const json = JSON.parse(trimmed);
            if (json.type === 'result') {
              logger.info('Dream result', { projectId, success: !json.is_error });
            }
          } catch {}
        }
      });

      proc.stderr.on('data', () => {}); // ignore stderr

      proc.on('exit', (code) => {
        this.process = null;
        try { unlinkSync(promptFile); } catch {}
        if (code === 0) {
          logger.info('Dream completed for project', { projectId });
          resolvePromise();
        } else {
          reject(new Error(`Dream process exited with code ${code}`));
        }
      });

      proc.on('error', (err) => {
        this.process = null;
        reject(err);
      });
    });
  }

  stop() {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    if (this.process) {
      try {
        if (process.platform === 'win32') {
          execSync(`taskkill /PID ${this.process.pid} /T /F`, { windowsHide: true });
        } else {
          this.process.kill('SIGTERM');
        }
      } catch {}
    }
  }

  getStatus() {
    return {
      dreaming: this.dreaming,
      lastDreamTime: this.lastDreamTime?.toISOString() || null,
      dirtyProjects: [...this.memoryDirtyProjects],
    };
  }
}
