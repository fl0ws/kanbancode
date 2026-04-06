import { ClaudeProcess } from './claude-process.js';
import { logger } from './logger.js';
import { broadcast } from './ws.js';
import * as db from './db.js';

function stripMemoryMentions(text) {
  if (!text) return text;
  return text
    .replace(/I(?:'ve| have) (?:also )?(?:saved|stored|written|created|recorded).*?\.claude-memory.*?[.\n]/gi, '')
    .replace(/I(?:'ll| will) (?:also )?(?:save|store|write|create|record).*?\.claude-memory.*?[.\n]/gi, '')
    .replace(/(?:I )?(?:saved|stored|wrote|created).*?memory file.*?[.\n]/gi, '')
    .replace(/(?:Let me |I'll )(?:also )?save (?:this|these|some|the) (?:learnings?|findings?|insights?).*?[.\n]/gi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const DEFAULT_SYSTEM_PROMPT = `Do not make any changes until you have 95% confidence in what you need to build. Ask me follow-up questions until you reach that confidence.
IMPORTANT: When you have questions for the user, you MUST use the AskUserQuestion tool instead of writing questions as plain text. The AskUserQuestion tool renders interactive buttons the user can click. Always provide 2-4 concrete options per question. Example usage: AskUserQuestion with questions array containing question text, header, and options with label and description.
Use subagents for any exploration or research. If a task needs 3+ files or multi-file analysis, spawn a subagent and return only summarized insights.
Complete the task described above. When finished, provide a summary of what you did.`;

const MEMORY_INSTRUCTION = `

## Memory (MANDATORY)
You MUST save a memory file before finishing. This is not optional.
1. Use the Write tool to create .claude-memory/task-{short-description}.md (the Write tool creates parent directories automatically).
2. Content should cover what you learned about this codebase:
   - How the relevant parts of the code are structured
   - Key files you read and what they do
   - Patterns, conventions, or gotchas you discovered
   - Architectural decisions and why they exist
3. Keep it concise (under 50 lines). Focus on what would help a NEW developer working on a different task in this codebase.
4. Do NOT skip this step. Every task produces learnings.
5. Do NOT mention the memory saving in your response to the user. Just do it silently.`;

export class WorkerPool {
  constructor() {
    this.maxConcurrency = null;
    this.running = new Map(); // taskId -> ClaudeProcess
    this.queue = []; // { taskId, prompt, workingDir, conversationId }
  }

  init() {
    // Load concurrency setting
    const max = db.getSetting('maxConcurrency');
    if (max !== null) {
      this.maxConcurrency = Number(max);
      logger.info('Worker pool initialized', { maxConcurrency: this.maxConcurrency });
    } else {
      logger.info('Worker pool initialized, concurrency not configured');
    }

    // Reconcile stuck tasks (server crashed while Claude was running)
    const stuck = db.getStuckClaudeTasks();
    for (const task of stuck) {
      if (!this.running.has(task.id)) {
        logger.warn('Reconciling stuck task', { taskId: task.id, title: task.title });
        db.moveTask(task.id, 'your_turn');
        db.addActivity(task.id, 'system', 'Process recovered after server restart — moved to Your Turn');
        const moved = db.getTask(task.id);
        broadcast('task:moved', { task: moved, from: 'claude', to: 'your_turn' });
      }
    }
  }

  configure(max) {
    this.maxConcurrency = max;
    db.setSetting('maxConcurrency', String(max));
    logger.info('Concurrency configured', { maxConcurrency: max });
    this._broadcastStatus();
    this.drain();
  }

  enqueue(taskId, task) {
    if (this.maxConcurrency === null) {
      logger.warn('Cannot enqueue — concurrency not configured', { taskId });
      return { error: 'Concurrency limit not configured. Please set it in settings.' };
    }

    if (this.running.has(taskId)) {
      logger.warn('Task already running', { taskId });
      return { error: 'Task is already running' };
    }

    // Check if already in queue
    if (this.queue.some(q => q.taskId === taskId)) {
      logger.warn('Task already queued', { taskId });
      return { error: 'Task is already queued' };
    }

    const prompt = this._buildPrompt(task);
    const entry = {
      taskId,
      prompt,
      workingDir: task.working_dir,
      conversationId: task.conversation_id,
    };

    if (this.running.size < this.maxConcurrency) {
      this._spawn(entry);
    } else {
      this.queue.push(entry);
      const position = this.queue.length;
      db.addActivity(taskId, 'system', `Queued (position ${position} of ${position})`);
      logger.info('Task queued', { taskId, position });
    }

    this._broadcastStatus();
    return { ok: true };
  }

  drain() {
    while (this.running.size < (this.maxConcurrency || 0) && this.queue.length > 0) {
      const entry = this.queue.shift();
      // Verify task is still in claude column
      const task = db.getTask(entry.taskId);
      if (task && task.column === 'claude' && !task.archived) {
        this._spawn(entry);
      }
    }
    this._broadcastStatus();
  }

  stop(taskId) {
    // Remove from queue if queued
    const queueIdx = this.queue.findIndex(q => q.taskId === taskId);
    if (queueIdx !== -1) {
      this.queue.splice(queueIdx, 1);
      this._broadcastStatus();
      return;
    }

    // Kill if running
    const proc = this.running.get(taskId);
    if (proc) {
      proc.stop();
      // The 'exit' handler will clean up
    }
  }

  stopAll() {
    this.queue = [];
    for (const [taskId, proc] of this.running) {
      proc.stop();
    }
  }

  isRunning(taskId) {
    return this.running.has(taskId);
  }

  isQueued(taskId) {
    return this.queue.some(q => q.taskId === taskId);
  }

  getStatus() {
    return {
      running: [...this.running.keys()],
      queued: this.queue.map(q => q.taskId),
      maxConcurrency: this.maxConcurrency,
    };
  }

  _spawn(entry) {
    const { taskId, prompt, workingDir, conversationId } = entry;

    const configDir = db.getSetting('claudeConfigDir') || null;
    const proc = new ClaudeProcess(taskId, workingDir, prompt, conversationId, configDir);
    this.running.set(taskId, proc);

    db.addActivity(taskId, 'system', 'Claude started');
    db.clearOutput(taskId);

    proc.on('output', (text) => {
      // Output goes to thoughts section only (LiveOutput via WebSocket)
      db.insertOutput(taskId, text);
      broadcast('task:output', { taskId, text });
    });

    proc.on('needs_input', (pendingPrompt) => {
      const task = db.updateTaskInput(taskId, true, pendingPrompt);
      broadcast('task:updated', { task });
    });

    proc.on('ask_user', (questions) => {
      logger.info('Claude asking user questions', { taskId, questionCount: questions.length });
      // Persist to DB so they survive page refresh
      db.setPendingQuestions(taskId, questions);
      broadcast('task:questions', { taskId, questions });
    });

    proc.on('error', (err) => {
      logger.error('Claude process error', { taskId, error: err.message });
      db.addActivity(taskId, 'system', `Process error: ${err.message}`);
    });

    proc.on('exit', ({ code, signal, sessionId, finalResult }) => {
      this.running.delete(taskId);

      // Save session ID for conversation resume
      if (sessionId) {
        db.setConversationId(taskId, sessionId);
      }

      // Save only the final result as a chat message, strip memory mentions
      const chatResponse = stripMemoryMentions((finalResult || '').trim());
      if (chatResponse) {
        const entry = db.addActivity(taskId, 'claude', chatResponse);
        broadcast('task:activity', { taskId, entry });
      }

      const task = db.getTask(taskId);
      // Only auto-move if still in claude column (stop handler may have already moved it)
      if (task && task.column === 'claude') {
        db.addActivity(taskId, 'system',
          code === 0 ? 'Claude finished' : `Claude exited (code: ${code}, signal: ${signal})`
        );
        const moved = db.moveTask(taskId, 'your_turn');
        broadcast('task:moved', { task: moved, from: 'claude', to: 'your_turn' });
      }

      // Notify listeners (dreaming engine)
      if (this.onTaskExited) this.onTaskExited(taskId);

      this.drain();
    });

    proc.start();
    this._broadcastStatus();
  }

  _buildPrompt(task) {
    const desc = task.description ? `\n\nDescription:\n${task.description}` : '';
    const activities = db.getActivities(task.id);
    const lastUserMsg = [...activities].reverse().find(a => a.author === 'user');

    if (task.conversation_id) {
      // Resuming with --resume: Claude already has the full prior conversation.
      // Just send the user's reply as the prompt — no boilerplate.
      const prompt = (lastUserMsg
        ? lastUserMsg.message
        : 'Continue where you left off.') + MEMORY_INSTRUCTION;

      logger.info('Built resume prompt', { taskId: task.id, prompt });
      return prompt;
    }

    // No conversation_id — fresh session. But there may be user replies
    // from previous runs where session_id extraction failed.
    if (lastUserMsg) {
      // User's reply IS the prompt. Task context is secondary.
      const prompt = `${lastUserMsg.message}

(Context: this is a follow-up on task "${task.title}" in ${task.working_dir || 'unset directory'})${MEMORY_INSTRUCTION}`;

      logger.info('Built reply prompt', { taskId: task.id, prompt });
      return prompt;
    }

    // First run, no replies yet — include system prompt instructions
    const systemPrompt = db.getSetting('systemPrompt') || DEFAULT_SYSTEM_PROMPT;

    const prompt = `# Task: ${task.title}${desc}

Working directory: ${task.working_dir || 'not set'}

## Instructions
${systemPrompt}${MEMORY_INSTRUCTION}`;

    logger.info('Built initial prompt', { taskId: task.id, prompt });
    return prompt;
  }

  _broadcastStatus() {
    broadcast('pool:status', this.getStatus());
  }
}
