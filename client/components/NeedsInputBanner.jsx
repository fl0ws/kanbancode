import React from 'react';

export default function NeedsInputBanner({ task, onStop }) {
  return (
    <div style={styles.banner}>
      <div style={styles.header}>
        <span style={styles.icon}>!</span>
        <span style={styles.label}>Claude may need input</span>
      </div>
      {task.pending_prompt && (
        <pre style={styles.prompt}>{task.pending_prompt}</pre>
      )}
      <p style={styles.hint}>
        In headless mode, stdin is closed. Use the Stop button to end the process and reply.
      </p>
      <button style={styles.stopBtn} onClick={onStop}>Stop Process</button>
    </div>
  );
}

const styles = {
  banner: {
    margin: '12px 0',
    padding: 12,
    borderRadius: 8,
    background: 'var(--yellow-bg)',
    border: '1px solid var(--yellow-border)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  icon: {
    width: 20,
    height: 20,
    borderRadius: '50%',
    background: 'var(--yellow)',
    color: 'var(--text-primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 12,
    fontWeight: 700,
    flexShrink: 0,
  },
  label: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--yellow-dark)',
  },
  prompt: {
    fontSize: 12,
    color: 'var(--text-secondary)',
    background: 'var(--yellow-light-bg)',
    padding: 8,
    borderRadius: 4,
    whiteSpace: 'pre-wrap',
    maxHeight: 100,
    overflowY: 'auto',
    marginBottom: 8,
    fontFamily: "'Cascadia Code', 'Consolas', monospace",
  },
  hint: {
    fontSize: 12,
    color: 'var(--text-tertiary)',
    marginBottom: 8,
  },
  stopBtn: {
    padding: '4px 10px',
    borderRadius: 6,
    border: '1px solid var(--red)',
    background: 'var(--bg-elevated)',
    color: 'var(--red)',
    fontSize: 12,
    cursor: 'pointer',
  },
};
