import React, { useState } from 'react';
import { configurePool } from '../api.js';
import { useStore } from '../store.js';

export default function ConcurrencyPrompt() {
  const [value, setValue] = useState(3);
  const [submitting, setSubmitting] = useState(false);
  const setPoolStatus = useStore(s => s.setPoolStatus);

  async function handleSubmit(e) {
    e.preventDefault();
    const num = Number(value);
    if (!num || num < 1) return;
    setSubmitting(true);
    try {
      await configurePool(num);
      setPoolStatus({ running: [], queued: [], maxConcurrency: num });
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <h2 style={styles.heading}>Configure Concurrency</h2>
        <p style={styles.text}>
          How many Claude Code processes should be allowed to run simultaneously?
          This controls how many tasks can be actively worked on by Claude at the same time.
        </p>
        <form onSubmit={handleSubmit} style={styles.form}>
          <input
            type="number"
            min="1"
            max="20"
            style={styles.input}
            value={value}
            onChange={e => setValue(e.target.value)}
            autoFocus
          />
          <button type="submit" style={styles.btn} disabled={submitting}>
            {submitting ? 'Saving...' : 'Save'}
          </button>
        </form>
        <p style={styles.hint}>
          Recommended: 3-5 for most machines. Tasks beyond the limit will be queued automatically.
        </p>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'var(--overlay)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 200,
  },
  modal: {
    background: 'var(--bg-surface)',
    border: 'none',
    borderRadius: 12,
    padding: 28,
    width: 400,
    maxWidth: '90vw',
    boxShadow: 'var(--shadow-lg)',
  },
  heading: {
    fontSize: 18,
    fontWeight: 600,
    color: 'var(--text-primary)',
    marginBottom: 12,
  },
  text: {
    fontSize: 13,
    color: 'var(--text-tertiary)',
    lineHeight: 1.5,
    marginBottom: 16,
  },
  form: {
    display: 'flex',
    gap: 8,
    marginBottom: 12,
  },
  input: {
    width: 80,
    padding: '8px 12px',
    borderRadius: 6,
    border: '1px solid var(--border)',
    background: 'var(--bg-input)',
    color: 'var(--text-primary)',
    fontSize: 16,
    textAlign: 'center',
  },
  btn: {
    padding: '8px 20px',
    borderRadius: 6,
    border: '1px solid var(--green-dark)',
    background: 'var(--green)',
    color: 'var(--text-on-accent)',
    fontSize: 14,
    cursor: 'pointer',
  },
  hint: {
    fontSize: 12,
    color: 'var(--text-muted)',
    lineHeight: 1.4,
  },
};
