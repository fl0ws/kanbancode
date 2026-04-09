import { spawn, execSync } from 'child_process';
import { EventEmitter } from 'events';
import { resolve, join } from 'path';
import { homedir, tmpdir } from 'os';
import { writeFileSync, unlinkSync } from 'fs';
import { logger } from './logger.js';

// Regex patterns for detecting input prompts
const INPUT_PATTERNS = [
  /\[y\/n\]/i,
  /\[Y\/n\]/,
  /\[yes\/no\]/i,
  /Allow\?/,
  /Would you like to/i,
  /Do you want to/i,
  /Press Enter/i,
  /Confirm/i,
];

const ANSI_REGEX = /\x1B(?:[@-Z\\-_]|\[[0-9;]*[A-Za-z])/g;

function stripAnsi(str) {
  return str.replace(ANSI_REGEX, '');
}

export class ClaudeProcess extends EventEmitter {
  constructor(taskId, workingDir, prompt, conversationId = null, configDir = null) {
    super();
    this.taskId = taskId;
    this.workingDir = workingDir;
    this.prompt = prompt;
    this.conversationId = conversationId;
    this.configDir = configDir;
    this.process = null;
    this.pid = null;
    this.outputBuffer = '';
    this.batchTimer = null;
    this.silenceTimer = null;
    this.lineBuffer = '';
    this.sessionId = null;
    this.finalResult = null; // The result field from the result event
    this.assistantTexts = []; // All assistant text blocks accumulated
    this.killed = false;
  }

  start() {
    const isWindows = process.platform === 'win32';
    const env = { ...process.env };
    if (this.configDir) {
      let resolved = this.configDir;
      if (resolved.startsWith('~')) {
        resolved = resolved.replace(/^~/, homedir());
      }
      resolved = resolve(resolved);
      env.CLAUDE_CONFIG_DIR = resolved;
      logger.info('Using config dir', { taskId: this.taskId, configDir: resolved });
    }

    // Write prompt to a temp file to avoid shell argument escaping issues.
    // Newlines, quotes, and special chars in the prompt break cmd.exe arg passing.
    this.promptFile = join(tmpdir(), `kanban-prompt-${this.taskId}-${Date.now()}.txt`);
    writeFileSync(this.promptFile, this.prompt, 'utf-8');
    logger.info('Wrote prompt file', { taskId: this.taskId, path: this.promptFile });

    // Build command parts
    const parts = ['claude', '--dangerously-skip-permissions', '--output-format', 'stream-json', '--verbose'];
    if (this.conversationId) {
      parts.push('--resume', this.conversationId);
    }

    // Pipe the prompt file to claude via shell
    const promptFilePath = this.promptFile.replace(/\\/g, '/');
    let command;
    if (isWindows) {
      command = `type "${this.promptFile}" | ${parts.join(' ')}`;
    } else {
      command = `cat "${promptFilePath}" | ${parts.join(' ')}`;
    }

    logger.info('Spawning Claude', { taskId: this.taskId, command: command.slice(0, 200) });

    this.process = spawn(command, [], {
      cwd: this.workingDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
      windowsHide: isWindows,
      env,
    });

    this.pid = this.process.pid;
    logger.info('Claude process started', {
      taskId: this.taskId,
      pid: this.pid,
      resume: !!this.conversationId,
    });

    this.process.stdout.on('data', (data) => {
      this._onData(data.toString());
    });

    this.process.stderr.on('data', (data) => {
      const text = data.toString();
      // stderr may also contain JSON stream events — try parsing
      const lines = text.split('\n');
      for (const line of lines) {
        const trimmed = line.replace(/\r$/, '').trim();
        if (!trimmed) continue;
        try {
          const json = JSON.parse(trimmed);
          this._handleJsonEvent(json);
        } catch {
          const clean = stripAnsi(trimmed);
          if (clean) {
            logger.debug('Claude stderr', { taskId: this.taskId, text: clean.slice(0, 200) });
          }
        }
      }
    });

    this.process.on('error', (err) => {
      logger.error('Claude process error', { taskId: this.taskId, error: err.message });
      this.emit('error', err);
    });

    this.process.on('exit', (code, signal) => {
      this._flushOutput();
      this._clearTimers();
      // Clean up temp prompt file
      if (this.promptFile) {
        try { unlinkSync(this.promptFile); } catch {}
      }
      logger.info('Claude process exited', {
        taskId: this.taskId,
        code,
        signal,
        sessionId: this.sessionId,
      });
      // Final safety net: if no result event was received, use accumulated assistant text
      const finalResult = this.finalResult || this.assistantTexts.join('\n\n') || '';
      this.emit('exit', { code, signal, sessionId: this.sessionId, finalResult });
    });

    this._resetSilenceTimer();
  }

  stop() {
    if (this.killed || !this.process) return;
    this.killed = true;
    this._clearTimers();

    const isWindows = process.platform === 'win32';

    try {
      if (isWindows) {
        execSync(`taskkill /PID ${this.pid} /T /F`, { windowsHide: true });
      } else {
        process.kill(-this.pid, 'SIGTERM');
        // Force kill after 3 seconds if still alive
        setTimeout(() => {
          try {
            process.kill(-this.pid, 'SIGKILL');
          } catch {
            // Already dead
          }
        }, 3000);
      }
    } catch (err) {
      logger.warn('Kill process failed', { taskId: this.taskId, error: err.message });
    }
  }

  _onData(raw) {
    this.lineBuffer += raw;
    const lines = this.lineBuffer.split('\n');
    // Keep the last incomplete line in buffer
    this.lineBuffer = lines.pop() || '';

    for (const line of lines) {
      this._parseLine(line.trim());
    }

    this._resetSilenceTimer();
  }

  _parseLine(line) {
    if (!line) return;

    // Strip any BOM or carriage return
    const cleaned = line.replace(/^\uFEFF/, '').replace(/\r$/, '');
    if (!cleaned) return;

    try {
      const json = JSON.parse(cleaned);
      this._handleJsonEvent(json);
    } catch {
      // Not JSON — raw text output
      const clean = stripAnsi(cleaned);
      if (clean.trim()) {
        logger.debug('Non-JSON line', { taskId: this.taskId, line: clean.slice(0, 100) });
        this._appendOutput(clean);
      }
    }
  }

  _handleJsonEvent(json) {
    logger.debug('Stream event', { taskId: this.taskId, type: json.type, keys: Object.keys(json) });

    // --- Thoughts stream (tool use, reasoning, system events) ---

    if (json.type === 'assistant' && json.message) {
      const content = json.message.content;
      if (Array.isArray(content)) {
        for (const block of content) {
          // Assistant text → thoughts stream + emit as chat message
          if (block.type === 'text' && block.text) {
            this._appendOutput(block.text);
            this.assistantTexts.push(block.text);
            this.emit('chat_message', block.text);
          }
          // Intercept AskUserQuestion tool calls
          if (block.type === 'tool_use' && block.name === 'AskUserQuestion' && block.input?.questions) {
            this._appendOutput('\n[Asking questions...]\n');
            this.emit('ask_user', block.input.questions);
          }
          // Other tool use → thoughts
          else if (block.type === 'tool_use' && block.name) {
            const input = block.input || {};
            let detail = '';
            if (input.file_path || input.path) detail = ` ${input.file_path || input.path}`;
            else if (input.command) detail = ` $ ${input.command.slice(0, 80)}`;
            else if (input.pattern) detail = ` ${input.pattern}`;
            this._appendOutput(`\n[${block.name}${detail}]\n`);
          }
        }
      }
    }

    // Content deltas → thoughts
    if (json.type === 'content_block_delta' && json.delta?.text) {
      this._appendOutput(json.delta.text);
    }

    // System descriptions → thoughts
    if (json.type === 'system' && json.description) {
      this._appendOutput(`\n> ${json.description}\n`);
    }

    // --- Final result (chat response) ---

    if (json.type === 'result') {
      if (json.is_error) {
        // Error result — include the error message so the user sees it
        this.finalResult = json.result || 'Claude encountered an error.';
      } else {
        // Prefer the result field; fall back to accumulated assistant text
        this.finalResult = json.result || this.assistantTexts.join('\n\n') || '';
      }
    }

    // Rate limit events — surface to the user
    if (json.type === 'rate_limit_event' && json.rate_limit_info?.status === 'blocked') {
      const resetsAt = json.rate_limit_info.resetsAt;
      const resetsIn = resetsAt ? Math.max(0, Math.ceil((resetsAt * 1000 - Date.now()) / 60000)) : 0;
      const msg = resetsIn > 0
        ? `Rate limited. Resets in ~${resetsIn} minutes.`
        : 'Rate limited. Please try again later.';
      this._appendOutput(`\n[Rate limit: ${msg}]\n`);
      this.emit('rate_limited', msg);
    }

    // --- Session ID extraction ---

    const sid = json.session_id || json.sessionId;
    if (json.type === 'result' && sid) {
      this.sessionId = sid;
      logger.info('Extracted session ID', { taskId: this.taskId, sessionId: sid });
    }
    if (!this.sessionId && sid) {
      this.sessionId = sid;
    }
  }

  _appendOutput(text) {
    this.outputBuffer += text;
    this._scheduleBatch();
    this._checkForInputPrompt(text);
  }

  _scheduleBatch() {
    if (this.batchTimer) return;
    this.batchTimer = setTimeout(() => {
      this._flushOutput();
    }, 150); // 150ms for snappy feel
  }

  _flushOutput() {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    if (this.outputBuffer) {
      const text = this.outputBuffer;
      this.outputBuffer = '';
      this.emit('output', text);
    }
  }

  _checkForInputPrompt(text) {
    for (const pattern of INPUT_PATTERNS) {
      if (pattern.test(text)) {
        this.emit('needs_input', text.slice(-800));
        return;
      }
    }
  }

  _resetSilenceTimer() {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
    }
    this.silenceTimer = setTimeout(() => {
      // 8 seconds of silence with pending output
      if (this.outputBuffer || this.lineBuffer) {
        this.emit('needs_input', (this.outputBuffer + this.lineBuffer).slice(-800));
      }
    }, 8000);
  }

  _clearTimers() {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer);
      this.silenceTimer = null;
    }
  }
}
