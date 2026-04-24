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
      const project = db.getProject(task.project_id);
      if (project?.memory_disabled) {
        logger.info('[DREAM] Skipping dirty mark — memory disabled for project', { projectId: task.project_id, taskId });
      } else {
        this.memoryDirtyProjects.add(task.project_id);
        logger.info('[DREAM] Project marked dirty', { projectId: task.project_id, taskId, allDirty: [...this.memoryDirtyProjects] });
      }
    } else {
      logger.info('[DREAM] onTaskCompleted called but no project_id', { taskId });
    }
    this._resetIdleTimer();
  }

  // Called when any pool activity changes (spawn, exit, etc.)
  onPoolActivity() {
    this._resetIdleTimer();
  }

  _resetIdleTimer() {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }

    const poolEmpty = this.workerPool.running.size === 0;
    const hasDirty = this.memoryDirtyProjects.size > 0;

    logger.info('[DREAM] Idle timer check', {
      poolEmpty,
      hasDirty,
      dreaming: this.dreaming,
      dirtyProjects: [...this.memoryDirtyProjects],
      runningTasks: this.workerPool.running.size,
    });

    if (poolEmpty && hasDirty && !this.dreaming) {
      logger.info(`[DREAM] Idle timer STARTED — will dream in ${IDLE_TIMEOUT_MS / 1000}s`);
      this.idleTimer = setTimeout(() => {
        logger.info('[DREAM] Idle timer FIRED — starting dreaming now');
        this._startDreaming();
      }, IDLE_TIMEOUT_MS);
    } else {
      if (!poolEmpty) logger.info('[DREAM] Not starting timer: pool still has running tasks');
      if (!hasDirty) logger.info('[DREAM] Not starting timer: no dirty projects');
      if (this.dreaming) logger.info('[DREAM] Not starting timer: already dreaming');
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
      if (project.memory_disabled) {
        logger.info('[DREAM] Skipping project — memory disabled', { projectId });
        continue;
      }

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

      const prompt = `You are a memory consolidation agent. Your working directory is: ${workingDir}

## Current memory files in .claude-memory/:
${memories}

## Your task (execute ALL steps):
1. Read the existing CLAUDE.md file in this directory (use the Read tool). If it doesn't exist, that's fine.
2. Consolidate the memory files above into clean, topic-based files. Merge related information, remove duplicates.
3. Use the Write tool to write the consolidated files to .claude-memory/ (create new topic-based ones like "architecture.md", "conventions.md", etc.)
4. Use the Read tool to read CLAUDE.md, then use the Edit tool (or Write tool if it doesn't exist) to add or update a "## Project Memory" section at the END of CLAUDE.md. Each entry should be one line: "- [Topic](.claude-memory/filename.md) — brief description"
5. IMPORTANT: Do NOT delete or modify any existing content in CLAUDE.md. ONLY add/update the "## Project Memory" section at the very end.
6. Keep the total memory concise — key insights only.

Execute all steps now. Do not ask questions. Do not skip any steps.`;

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
        const lines = data.toString().split('\n');
        for (const line of lines) {
          const trimmed = line.replace(/\r$/, '').trim();
          if (!trimmed) continue;
          try {
            const json = JSON.parse(trimmed);
            if (json.type === 'assistant' && json.message?.content) {
              for (const block of json.message.content) {
                if (block.type === 'tool_use') {
                  logger.info('Dream tool use', { projectId, tool: block.name, input: JSON.stringify(block.input || {}).slice(0, 100) });
                }
                if (block.type === 'text' && block.text) {
                  logger.debug('Dream text', { projectId, text: block.text.slice(0, 150) });
                }
              }
            }
            if (json.type === 'result') {
              logger.info('Dream result', { projectId, success: !json.is_error, result: (json.result || '').slice(0, 200) });
            }
          } catch {}
        }
      });

      proc.stderr.on('data', (data) => {
        // Also parse stderr for JSON events
        const lines = data.toString().split('\n');
        for (const line of lines) {
          const trimmed = line.replace(/\r$/, '').trim();
          if (!trimmed) continue;
          try {
            const json = JSON.parse(trimmed);
            if (json.type === 'assistant' && json.message?.content) {
              for (const block of json.message.content) {
                if (block.type === 'tool_use') {
                  logger.info('Dream tool use (stderr)', { projectId, tool: block.name });
                }
              }
            }
            if (json.type === 'result') {
              logger.info('Dream result (stderr)', { projectId, success: !json.is_error });
            }
          } catch {}
        }
      });

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
