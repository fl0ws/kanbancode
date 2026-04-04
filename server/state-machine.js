export const COLUMNS = ['not_started', 'claude', 'your_turn', 'done'];

const TRANSITIONS = new Map([
  ['not_started', new Set(['claude', 'done'])],
  ['claude', new Set(['your_turn'])],
  ['your_turn', new Set(['claude', 'done', 'not_started'])],
  ['done', new Set(['your_turn', 'not_started'])],
]);

export function canTransition(from, to) {
  const allowed = TRANSITIONS.get(from);
  return allowed ? allowed.has(to) : false;
}

export function validateTransition(from, to) {
  if (!COLUMNS.includes(from)) {
    throw new Error(`Invalid source column: ${from}`);
  }
  if (!COLUMNS.includes(to)) {
    throw new Error(`Invalid target column: ${to}`);
  }
  if (!canTransition(from, to)) {
    throw new Error(`Cannot move from "${from}" to "${to}". Allowed targets: ${[...(TRANSITIONS.get(from) || [])].join(', ')}`);
  }
}

export const COLUMN_LABELS = {
  not_started: 'Not Started',
  claude: 'Claude',
  your_turn: 'Your Turn',
  done: 'Done',
};
