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
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 200,
    animation: 'modal-overlay-in 180ms ease',
  },
  modal: {
    background: 'var(--bg-surface)',
    borderRadius: 'var(--radius-xl)',
    padding: 28,
    width: 400,
    maxWidth: '90vw',
    boxShadow: 'var(--shadow-lg)',
    animation: 'modal-in 200ms cubic-bezier(0.2, 0.9, 0.3, 1)',
  },
  heading: {
    fontSize: 18,
    fontFamily: 'var(--font-headline)',
    fontWeight: 700,
    color: 'var(--text-primary)',
    marginBottom: 12,
  },
  text: {
    fontSize: 13,
    color: 'var(--text-secondary)',
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
    borderRadius: 'var(--radius-sm)',
    border: 'none',
    background: 'var(--bg-input)',
    color: 'var(--text-primary)',
    fontSize: 16,
    textAlign: 'center',
  },
  btn: {
    padding: '8px 20px',
    borderRadius: 'var(--radius-lg)',
    border: 'none',
    background: 'linear-gradient(135deg, var(--green), var(--green-dark))',
    color: 'var(--text-on-accent)',
    fontFamily: 'var(--font-headline)',
    fontWeight: 600,
    fontSize: 14,
    cursor: 'pointer',
  },
  hint: {
    fontSize: 12,
    color: 'var(--text-muted)',
    lineHeight: 1.4,
  },
};
