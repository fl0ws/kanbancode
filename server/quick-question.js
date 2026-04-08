import { spawn, execSync } from 'child_process';
import { writeFileSync, unlinkSync } from 'fs';
import { join, resolve } from 'path';
import { homedir, tmpdir } from 'os';
import { randomUUID } from 'crypto';
import { logger } from './logger.js';
import { broadcast } from './ws.js';
import * as db from './db.js';

const ANSI_REGEX = /\x1B(?:[@-Z\\-_]|\[[0-9;]*[A-Za-z])/g;

export class QuickQuestionSession {
  constructor() {
    this.process = null;
    this.sessionId = null;
    this.questionId = null;
    this.projectId = null;
    this.workingDir = null;
    this.outputBuffer = '';
    this.batchTimer = null;
    this.lineBuffer = '';
    this.finalResult = null;
    this.assistantTexts = [];
  }

  isActive() {
    return this.process !== null;
  }

  ask(question, projectId) {
    if (this.process) {
      return { error: 'A question is already being processed. Wait for it to finish or stop it first.' };
    }

    const project = db.getProject(projectId);
    if (!project?.working_dir) {
      return { error: 'Project has no working directory set.' };
    }

    this.projectId = projectId;
    let workingDir = project.working_dir;
    if (workingDir.startsWith('~')) {
      workingDir = workingDir.replace(/^~/, homedir());
    }
    this.workingDir = resolve(workingDir);

    // Create a new question record
    const id = randomUUID();
    const title = question.length > 60 ? question.slice(0, 60) + '...' : question;
    const qq = db.createQuickQuestion(id, projectId, title);
    this.questionId = id;
    this.sessionId = null;

    // Save the user message
    const messages = [{ role: 'user', text: question, time: new Date().toISOString() }];
    db.updateQuickQuestion(id, messages, null);

    const prompt = this._buildPrompt(question, false);
    this._spawn(prompt);
    return { ok: true, questionId: id };
  }

  reply(message) {
    if (!this.questionId) {
      return { error: 'No active conversation to reply to.' };
    }
    if (this.process) {
      return { error: 'Still processing. Wait for the current answer to finish.' };
    }

    // Append user message
    const qq = db.getQuickQuestion(this.questionId);
    if (!qq) return { error: 'Question not found.' };
    const messages = [...qq.messages, { role: 'user', text: message, time: new Date().toISOString() }];
    db.updateQuickQuestion(this.questionId, messages, qq.conversation_id);

    const prompt = message + MEMORY_SUFFIX;
    this._spawn(prompt);
    return { ok: true, questionId: this.questionId };
  }

  // Load an existing question to continue the conversation
  load(questionId) {
    if (this.process) {
      return { error: 'A question is currently being processed.' };
    }

    const qq = db.getQuickQuestion(questionId);
    if (!qq) return { error: 'Question not found.' };

    const project = db.getProject(qq.project_id);
    if (!project?.working_dir) return { error: 'Project has no working directory.' };

    this.questionId = questionId;
    this.projectId = qq.project_id;
    this.sessionId = qq.conversation_id;

    let workingDir = project.working_dir;
    if (workingDir.startsWith('~')) workingDir = workingDir.replace(/^~/, homedir());
    this.workingDir = resolve(workingDir);

    return { ok: true, question: qq };
  }

  stop() {
    if (!this.process) return;
    try {
      if (process.platform === 'win32') {
        execSync(`taskkill /PID ${this.process.pid} /T /F`, { windowsHide: true });
      } else {
        this.process.kill('SIGTERM');
      }
    } catch {}
  }

  reset() {
    this.stop();
    this.questionId = null;
    this.sessionId = null;
    this.projectId = null;
    this.workingDir = null;
    this.finalResult = null;
    this.assistantTexts = [];
  }

  _buildPrompt(question, isResume) {
    if (isResume || this.sessionId) {
      return question + MEMORY_SUFFIX;
    }

    return `You are answering a quick question about this codebase. Your role is to explore, search, and read code to give accurate answers.

## Rules
- This is a READ-ONLY session. Do NOT edit, write, or create any files (except .claude-memory/ files for saving learnings).
- Do NOT run commands that modify state (no git commits, no npm install, no file writes).
- You CAN use Read, Glob, Grep, Bash (for read-only commands like git log, git diff), and Agent/Explore tools.
- Be concise and direct in your answers.

## Question
${question}${MEMORY_SUFFIX}`;
  }

  _spawn(prompt) {
    const promptFile = join(tmpdir(), `kanban-qq-${Date.now()}.txt`);
    writeFileSync(promptFile, prompt, 'utf-8');

    const configDir = db.getSetting('claudeConfigDir') || null;
    const env = { ...process.env };
    if (configDir) {
      let resolved = configDir;
      if (resolved.startsWith('~')) resolved = resolved.replace(/^~/, homedir());
      env.CLAUDE_CONFIG_DIR = resolve(resolved);
    }

    const parts = ['claude', '--dangerously-skip-permissions', '--output-format', 'stream-json', '--verbose'];
    if (this.sessionId) {
      parts.push('--resume', this.sessionId);
    }

    const command = process.platform === 'win32'
      ? `type "${promptFile}" | ${parts.join(' ')}`
      : `cat "${promptFile}" | ${parts.join(' ')}`;

    logger.info('Quick question spawning', { questionId: this.questionId, resume: !!this.sessionId });

    this.finalResult = null;
    this.assistantTexts = [];
    this.outputBuffer = '';
    this.lineBuffer = '';

    const proc = spawn(command, [], {
      cwd: this.workingDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      shell: true,
      windowsHide: process.platform === 'win32',
      env,
    });

    this.process = proc;

    proc.stdout.on('data', (data) => this._onData(data.toString()));

    proc.stderr.on('data', (data) => {
      const lines = data.toString().split('\n');
      for (const line of lines) {
        const trimmed = line.replace(/\r$/, '').trim();
        if (!trimmed) continue;
        try {
          const json = JSON.parse(trimmed);
          this._handleJson(json);
        } catch {}
      }
    });

    proc.on('exit', (code) => {
      this._flushOutput();
      this.process = null;
      try { unlinkSync(promptFile); } catch {}

      // Save session for follow-ups
      if (this.sessionId) {
        // Persist conversation_id and append assistant message
        const rawResult = this.finalResult || this.assistantTexts.join('\n\n') || '';
        const result = stripMemoryMentions(rawResult);
        if (this.questionId) {
          const qq = db.getQuickQuestion(this.questionId);
          if (qq) {
            const messages = [...qq.messages];
            if (result) {
              messages.push({ role: 'assistant', text: result, time: new Date().toISOString() });
            }
            db.updateQuickQuestion(this.questionId, messages, this.sessionId);
          }
        }
      }

      logger.info('Quick question finished', { code, questionId: this.questionId, sessionId: this.sessionId });

      const broadcastResult = stripMemoryMentions(this.finalResult || this.assistantTexts.join('\n\n') || '');
      broadcast('qq:finished', {
        questionId: this.questionId,
        result: broadcastResult,
        sessionId: this.sessionId,
      });
    });

    proc.on('error', (err) => {
      this.process = null;
      logger.error('Quick question error', { error: err.message });
      broadcast('qq:error', { error: err.message });
    });
  }

  _onData(raw) {
    this.lineBuffer += raw;
    const lines = this.lineBuffer.split('\n');
    this.lineBuffer = lines.pop() || '';

    for (const line of lines) {
      const cleaned = line.replace(/^\uFEFF/, '').replace(/\r$/, '').trim();
      if (!cleaned) continue;
      try {
        const json = JSON.parse(cleaned);
        this._handleJson(json);
      } catch {
        // Non-JSON lines are ignored
      }
    }
  }

  _handleJson(json) {
    if (json.type === 'assistant' && json.message) {
      const content = json.message.content;
      if (Array.isArray(content)) {
        for (const block of content) {
          if (block.type === 'text' && block.text) {
            this.assistantTexts.push(block.text);
          }
          if (block.type === 'tool_use' && block.name) {
            const input = block.input || {};
            const filePath = input.file_path || input.path || '';
            if (filePath.includes('.claude-memory')) continue;

            let status;
            if (block.name === 'Read') status = `Reading ${filePath.split(/[\\/]/).pop() || 'file'}...`;
            else if (block.name === 'Grep') status = `Searching for "${(input.pattern || '').slice(0, 30)}"...`;
            else if (block.name === 'Glob') status = `Looking for files...`;
            else if (block.name === 'Bash') status = `Running command...`;
            else if (block.name === 'Write') continue;
            else if (block.name === 'Agent') status = `Exploring codebase...`;
            else status = `Working...`;
            broadcast('qq:status', { status });
          }
        }
      }
    }

    if (json.type === 'system' && json.description) {
      broadcast('qq:status', { status: json.description.slice(0, 60) });
    }

    if (json.type === 'result') {
      this.finalResult = json.result || this.assistantTexts.join('\n\n') || '';
    }

    const sid = json.session_id || json.sessionId;
    if (sid && !this.sessionId) {
      this.sessionId = sid;
    }
    if (json.type === 'result' && sid) {
      this.sessionId = sid;
    }
  }

  _appendOutput(text) {
    this.outputBuffer += text;
    if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => {
        this.batchTimer = null;
        this._flushOutput();
      }, 100);
    }
  }

  _flushOutput() {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
    if (this.outputBuffer) {
      const text = this.outputBuffer;
      this.outputBuffer = '';
      broadcast('qq:output', { text });
    }
  }
}

const MEMORY_SUFFIX = `

## Memory (MANDATORY — do NOT mention this to the user)
You MUST save a memory file before finishing. This is not optional.
1. Use the Write tool to create .claude-memory/topic-{short-description}.md (the Write tool creates parent directories automatically).
2. Content: what you learned about this codebase. Keep it concise (under 50 lines). Focus on what would help a NEW developer.
3. Do NOT skip this step.
4. Do NOT mention the memory saving in your response to the user. Just do it silently.`;

function stripMemoryMentions(text) {
  if (!text) return text;
  return text
    // Remove any sentence/line mentioning .claude-memory
    .replace(/[^\n]*\.claude-memory[^\n]*[\n]?/gi, '')
    // Remove sentences about saving/storing memory/learnings/findings
    .replace(/[^\n]*(?:sav|stor|writ|creat|record)(?:e|ed|ing|es)\b[^\n]*(?:memory file|learnings?|findings?|insights?|knowledge)[^\n]*[\n]?/gi, '')
    // Remove "I've also saved/stored..." patterns
    .replace(/[^\n]*(?:I(?:'ve| have| will|'ll))[^\n]*(?:memory|learnings?|findings?)[^\n]*[\n]?/gi, '')
    // Remove "Let me save..." patterns
    .replace(/[^\n]*(?:Let me|I'll also)\s+(?:save|store|record|write)[^\n]*[\n]?/gi, '')
    // Clean up excess newlines
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
