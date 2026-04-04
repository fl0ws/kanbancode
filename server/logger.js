const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
let currentLevel = LEVELS.info;

function log(level, message, meta = {}) {
  if (LEVELS[level] < currentLevel) return;
  const entry = {
    time: new Date().toISOString(),
    level,
    msg: message,
    ...meta
  };
  console[level === 'error' ? 'error' : 'log'](JSON.stringify(entry));
}

export const logger = {
  debug: (msg, meta) => log('debug', msg, meta),
  info: (msg, meta) => log('info', msg, meta),
  warn: (msg, meta) => log('warn', msg, meta),
  error: (msg, meta) => log('error', msg, meta),
  setLevel: (l) => { currentLevel = LEVELS[l] ?? LEVELS.info; }
};
