import React from 'react';
import { useStore } from '../store.js';

export default function TaskCard({ task, color, isDragging = false }) {
  const setSelectedTask = useStore(s => s.setSelectedTask);
  const selectedTaskId = useStore(s => s.selectedTaskId);
  const poolStatus = useStore(s => s.poolStatus);

  const isSelected = selectedTaskId === task.id;
  const isRunning = poolStatus.running?.includes(task.id);
  const isQueued = poolStatus.queued?.includes(task.id);

  return (
    <div
      style={{
        ...styles.card,
        borderColor: isSelected ? color : 'var(--card-selected-border)',
        opacity: isDragging ? 0.5 : 1,
      }}
      onClick={() => setSelectedTask(task.id)}
    >
      <div style={styles.titleRow}>
        <span style={{ ...styles.dot, background: color }} />
        <span style={styles.title}>{task.title}</span>
      </div>
      {task.description && (
        <p style={styles.desc}>{task.description.slice(0, 100)}{task.description.length > 100 ? '...' : ''}</p>
      )}
      <div style={styles.footer}>
        {task.working_dir && (
          <span style={styles.tag} title={task.working_dir}>
            {task.working_dir.split(/[\\/]/).pop()}
          </span>
        )}
        {isRunning && <span style={{ ...styles.tag, ...styles.runningTag }}>Running</span>}
        {isQueued && <span style={{ ...styles.tag, ...styles.queuedTag }}>Queued</span>}
        {task.needs_input === 1 && <span style={{ ...styles.tag, ...styles.inputTag }}>Needs Input</span>}
      </div>
    </div>
  );
}

const styles = {
  card: {
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    padding: '10px 12px',
    cursor: 'pointer',
    transition: 'border-color 0.15s, box-shadow 0.15s',
    boxShadow: 'var(--shadow-xs)',
  },
  titleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: '50%',
    flexShrink: 0,
  },
  title: {
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--text-primary)',
    lineHeight: 1.3,
  },
  desc: {
    fontSize: 12,
    color: 'var(--text-tertiary)',
    marginTop: 6,
    lineHeight: 1.4,
  },
  footer: {
    display: 'flex',
    gap: 6,
    marginTop: 8,
    flexWrap: 'wrap',
  },
  tag: {
    fontSize: 11,
    padding: '2px 6px',
    borderRadius: 4,
    background: 'var(--bg-hover)',
    color: 'var(--text-tertiary)',
  },
  runningTag: {
    background: 'var(--purple-bg)',
    color: 'var(--purple)',
  },
  queuedTag: {
    background: 'var(--orange-bg)',
    color: 'var(--orange-dark)',
  },
  inputTag: {
    background: 'var(--yellow)',
    color: 'var(--text-primary)',
    fontWeight: 600,
  },
};
