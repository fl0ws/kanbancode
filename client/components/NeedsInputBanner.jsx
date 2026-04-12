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
    borderRadius: 'var(--radius-lg)',
    background: 'var(--orange-bg)',
    border: 'none',
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
    background: 'var(--orange)',
    color: 'var(--text-primary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 'var(--fs-small)',
    fontWeight: 700,
    flexShrink: 0,
  },
  label: {
    fontSize: 'var(--fs-body)',
    fontFamily: 'var(--font-headline)',
    fontWeight: 700,
    color: 'var(--orange)',
  },
  prompt: {
    fontSize: 'var(--fs-small)',
    color: 'var(--text-secondary)',
    background: 'var(--orange-bg)',
    padding: 8,
    borderRadius: 'var(--radius-sm)',
    whiteSpace: 'pre-wrap',
    maxHeight: 100,
    overflowY: 'auto',
    marginBottom: 8,
    fontFamily: "'Cascadia Code', 'Consolas', monospace",
  },
  hint: {
    fontSize: 'var(--fs-small)',
    color: 'var(--text-secondary)',
    marginBottom: 8,
  },
  stopBtn: {
    padding: '4px 10px',
    borderRadius: 'var(--radius-sm)',
    border: 'none',
    background: 'var(--bg-elevated)',
    color: 'var(--red)',
    fontSize: 'var(--fs-small)',
    cursor: 'pointer',
  },
};
