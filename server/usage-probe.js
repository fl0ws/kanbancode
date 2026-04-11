import { createRequire } from 'module';
import { join } from 'path';
import { homedir } from 'os';
import { tmpdir } from 'os';
import { logger } from './logger.js';

const require = createRequire(import.meta.url);
let pty;
try {
  pty = require('node-pty');
} catch {
  logger.warn('node-pty not available — usage probe disabled');
}

const ANSI_RE = /\x1B\[[0-9;]*[A-Za-z]/g;
const CTRL_RE = /[\x00-\x08\x0B\x0C\x0E-\x1F]/g;

function stripAnsi(str) {
  return str.replace(ANSI_RE, ' ').replace(/\x1B[^\[]/g, '').replace(CTRL_RE, '').replace(/[ \t]+/g, ' ');
}

function findClaude() {
  const isWindows = process.platform === 'win32';
  const ext = isWindows ? '.exe' : '';
  // Check common locations
  const candidates = [
    join(homedir(), '.local', 'bin', 'claude' + ext),
  ];
  const { existsSync } = require('fs');
  for (const c of candidates) {
    if (existsSync(c)) return c;
  }
  // Fallback: hope it's on PATH
  return 'claude' + ext;
}

/**
 * Spawn claude in a PTY, send /usage, parse the output.
 * Returns { session, weekly, weeklySonnet } with { percentUsed, resetInfo } each.
 */
export function probeUsage() {
  if (!pty) return Promise.reject(new Error('node-pty not available'));

  return new Promise((resolve, reject) => {
    const claudePath = findClaude();
    let proc;
    try {
      proc = pty.spawn(claudePath, [], {
        name: 'xterm-256color',
        cols: 120,
        rows: 30,
        cwd: tmpdir(),
      });
    } catch (err) {
      return reject(new Error('Failed to spawn claude: ' + err.message));
    }

    let out = '';
    let state = 'waiting_banner';
    let captureStart = 0;
    let idleTimer = null;
    let done = false;

    function cleanup() {
      if (idleTimer) clearTimeout(idleTimer);
      if (timeout) clearTimeout(timeout);
      try { proc.kill(); } catch {}
    }

    function finish() {
      if (done) return;
      done = true;

      const captured = out.slice(captureStart);
      const clean = stripAnsi(captured);
      logger.debug('Usage probe raw output', { length: clean.length });

      const result = parseUsageOutput(clean);

      proc.write('/exit\r');
      setTimeout(cleanup, 1500);
      resolve(result);
    }

    proc.onData(data => {
      if (done) return;
      out += data;
      const clean = stripAnsi(out);

      if (state === 'waiting_banner') {
        if (clean.includes('Quick safety check')) {
          state = 'trust_sent';
          proc.write('\r');
          return;
        }
        if (clean.match(/Claude Code v\d/)) {
          state = 'waiting_prompt';
        }
      }

      if (state === 'trust_sent' && clean.match(/Claude Code v\d/)) {
        state = 'waiting_prompt';
      }

      if (state === 'waiting_prompt' && clean.includes('shortcuts')) {
        state = 'sent_usage';
        setTimeout(() => proc.write('/usage\r'), 500);
      }

      if (state === 'sent_usage' && clean.includes('Current session')) {
        state = 'capturing';
        captureStart = Math.max(0, out.length - 500);
      }

      if (state === 'capturing') {
        if (idleTimer) clearTimeout(idleTimer);
        idleTimer = setTimeout(() => finish(), 2500);
      }
    });

    const timeout = setTimeout(() => {
      if (!done) {
        done = true;
        cleanup();
        reject(new Error('Usage probe timed out'));
      }
    }, 30000);
  });
}

function parseUsageOutput(text) {
  const result = { session: null, weekly: null, weeklySonnet: null };

  // Split into lines and find usage blocks
  // Format: "███████ XX% used Reset[s] <time info>"
  // Preceded by labels like "Current session", "Current week (all models)", "Current week (Sonnet only)"

  // Extract all percentage matches with surrounding context
  const segments = text.split(/(?=Current session|Current week)/i);

  for (const seg of segments) {
    const pctMatch = seg.match(/(\d+)\s*%\s*used/);
    const resetMatch = seg.match(/Rese?t?s?\s+(.+?)(?=Current|Esc|$)/i);

    if (!pctMatch) continue;

    let resetRaw = resetMatch ? resetMatch[1].trim() : '';
    // Strip timezone parenthetical e.g. "(Europe/Copenhagen)"
    resetRaw = resetRaw.replace(/\s*\([^)]*\)\s*/g, '').trim();
    // Clean up stray characters from ANSI stripping (e.g. leading "s " from mangled "Resets")
    resetRaw = resetRaw.replace(/^[a-z]\s+/i, '').trim();
    // Convert 12hr to 24hr: "9am" -> "09:00", "12pm" -> "12:00", "1pm" -> "13:00"
    resetRaw = resetRaw.replace(/(\d{1,2})(am|pm)/gi, (_, h, ampm) => {
      let hour = parseInt(h, 10);
      if (ampm.toLowerCase() === 'pm' && hour !== 12) hour += 12;
      if (ampm.toLowerCase() === 'am' && hour === 12) hour = 0;
      return String(hour).padStart(2, '0') + ':00';
    });

    const entry = {
      percentUsed: parseInt(pctMatch[1], 10),
      resetInfo: resetRaw,
    };

    const lower = seg.toLowerCase();
    if (lower.startsWith('current session') || lower.includes('current session')) {
      result.session = entry;
    } else if (lower.includes('sonnet')) {
      result.weeklySonnet = entry;
    } else if (lower.includes('current week') || lower.includes('all models')) {
      result.weekly = entry;
    } else if (!result.session) {
      // First unmatched entry is likely session
      result.session = entry;
    }
  }

  return result;
}
