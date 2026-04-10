import React from 'react';
import { useStore } from '../store.js';

export default function TaskCard({ task, color, isDragging = false }) {
  const setSelectedTask = useStore(s => s.setSelectedTask);
  const toggleCardSelection = useStore(s => s.toggleCardSelection);
  const selectedTaskId = useStore(s => s.selectedTaskId);
  const selectedCardIds = useStore(s => s.selectedCardIds);
  const poolStatus = useStore(s => s.poolStatus);

  const isSelected = selectedTaskId === task.id;
  const isMultiSelected = selectedCardIds.has(task.id);
  const isRunning = poolStatus.running?.includes(task.id);
  const isQueued = poolStatus.queued?.includes(task.id);
  const isDone = task.column === 'done';

  function handleClick(e) {
    if (e.ctrlKey || e.metaKey) {
      e.stopPropagation();
      toggleCardSelection(task.id);
    } else {
      setSelectedTask(task.id);
    }
  }

  return (
    <div
      style={{
        ...styles.card,
        ...(isSelected || isMultiSelected ? styles.cardSelected : {}),
        ...(isDone ? styles.cardDone : {}),
        opacity: isDragging ? 0.5 : 1,
      }}
      onClick={handleClick}
    >
      {/* Left accent bar */}
      <div style={{
        ...styles.accent,
        ...(isRunning ? { opacity: 1, background: 'var(--purple)' } :
            isSelected || isMultiSelected ? { opacity: 1, background: color } : {}),
      }} />

      {/* Status tag row */}
      {(isRunning || isQueued || task.needs_input === 1) && (
        <div style={styles.tagRow}>
          {isRunning && (
            <span style={styles.runningTag}>
              <span style={styles.runningDot} />
              Running
            </span>
          )}
          {isQueued && <span style={styles.queuedTag}>Queued</span>}
          {task.needs_input === 1 && (
            <span style={styles.inputTag}>
              <span className="material-symbols-outlined" style={{ fontSize: 12 }}>priority_high</span>
              Needs Input
            </span>
          )}
        </div>
      )}

      {isDone && (
        <div style={styles.tagRow}>
          <span style={styles.doneTag}>Done</span>
          <div style={{ flex: 1 }} />
          <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--tertiary)' }}>check_circle</span>
        </div>
      )}

      <span style={{
        ...styles.title,
        ...(isDone ? styles.titleDone : {}),
      }}>{task.title}</span>

      {task.description && (
        <p style={{
          ...styles.desc,
          ...(isDone ? { color: 'var(--text-muted)' } : {}),
        }}>{task.description.slice(0, 100)}{task.description.length > 100 ? '...' : ''}</p>
      )}

      <div style={styles.footer}>
        <span className="material-symbols-outlined" style={{ fontSize: 13, color: 'var(--text-muted)' }}>schedule</span>
        <span style={styles.timeTag}>{task.updated_at ? formatRelativeTime(task.updated_at) : ''}</span>
      </div>
    </div>
  );
}

function formatRelativeTime(ts) {
  try {
    const now = Date.now();
    const then = new Date(ts + 'Z').getTime();
    const diff = Math.floor((now - then) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return new Date(ts + 'Z').toLocaleDateString();
  } catch {
    return '';
  }
}

const styles = {
  card: {
    background: 'var(--bg-surface)',
    borderRadius: 'var(--radius-lg)',
    padding: '14px 16px',
    paddingLeft: 20,
    cursor: 'pointer',
    transition: 'transform 0.15s, box-shadow 0.15s',
    position: 'relative',
    overflow: 'hidden',
  },
  cardSelected: {
    boxShadow: 'var(--shadow-md)',
  },
  cardDone: {
    opacity: 0.75,
  },
  accent: {
    position: 'absolute',
    left: 0,
    top: 12,
    bottom: 12,
    width: 3,
    borderRadius: '0 3px 3px 0',
    opacity: 0,
    transition: 'opacity 0.15s',
  },
  tagRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  runningTag: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    fontSize: 10,
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: 6,
    background: 'var(--purple-bg)',
    color: 'var(--purple)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  runningDot: {
    width: 5,
    height: 5,
    borderRadius: '50%',
    background: 'var(--purple)',
    animation: 'gentle-pulse 2.5s ease-in-out infinite',
  },
  queuedTag: {
    fontSize: 10,
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: 6,
    background: 'var(--bg-elevated)',
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  inputTag: {
    display: 'flex',
    alignItems: 'center',
    gap: 3,
    fontSize: 10,
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: 6,
    background: 'var(--orange-bg)',
    color: 'var(--orange)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  doneTag: {
    fontSize: 10,
    fontWeight: 700,
    padding: '2px 8px',
    borderRadius: 6,
    background: 'var(--bg-highest)',
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  title: {
    fontFamily: 'var(--font-headline)',
    fontSize: 14,
    fontWeight: 700,
    color: 'var(--text-primary)',
    lineHeight: 1.3,
    overflowWrap: 'break-word',
    wordBreak: 'break-word',
    display: 'block',
    marginBottom: 4,
  },
  titleDone: {
    color: 'var(--text-secondary)',
    textDecoration: 'line-through',
    textDecorationColor: 'var(--text-muted)',
  },
  desc: {
    fontSize: 13,
    color: 'var(--text-secondary)',
    overflowWrap: 'break-word',
    wordBreak: 'break-word',
    lineHeight: 1.5,
    marginBottom: 10,
  },
  footer: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  timeTag: {
    fontSize: 11,
    color: 'var(--text-muted)',
  },
};
