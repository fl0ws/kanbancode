import React, { useState } from 'react';
import { createTask } from '../api.js';
import { useStore } from '../store.js';

export default function CreateTaskModal({ onClose }) {
  const activeProjectId = useStore(s => s.activeProjectId);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      await createTask({
        title: title.trim(),
        description,
        project_id: activeProjectId,
      });
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.modalHeader}>
          <h2 style={styles.heading}>New Task</h2>
          <button style={styles.closeBtn} onClick={onClose}>&#x2715;</button>
        </div>
        <form onSubmit={handleSubmit}>
          <label style={styles.label}>
            Title
            <input
              style={styles.input}
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="What needs to be done?"
              autoFocus
            />
          </label>
          <label style={styles.label}>
            Description
            <textarea
              style={{ ...styles.input, ...styles.textarea }}
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="Details, requirements, context..."
              rows={4}
            />
          </label>
          {error && <p style={styles.error}>{error}</p>}
          <div style={styles.actions}>
            <button type="button" style={styles.btn} onClick={onClose}>Cancel</button>
            <button type="submit" style={{ ...styles.btn, ...styles.btnPrimary }} disabled={submitting || !title.trim()}>
              {submitting ? 'Creating...' : 'Create Task'}
            </button>
          </div>
        </form>
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
    zIndex: 100,
  },
  modal: {
    background: 'var(--bg-surface)',
    border: 'none',
    borderRadius: 12,
    padding: 24,
    width: 440,
    maxWidth: '90vw',
    boxShadow: 'var(--shadow-lg)',
  },
  modalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  heading: {
    fontSize: 16,
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    border: 'none',
    background: 'transparent',
    color: 'var(--text-tertiary)',
    fontSize: 16,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  label: {
    display: 'block',
    fontSize: 13,
    color: 'var(--text-tertiary)',
    marginBottom: 12,
  },
  input: {
    display: 'block',
    width: '100%',
    marginTop: 4,
    padding: '8px 10px',
    borderRadius: 6,
    border: '1px solid var(--border)',
    background: 'var(--bg-input)',
    color: 'var(--text-primary)',
    fontSize: 13,
    outline: 'none',
  },
  textarea: {
    resize: 'vertical',
    fontFamily: 'inherit',
  },
  error: {
    color: 'var(--red)',
    fontSize: 13,
    marginBottom: 8,
  },
  actions: {
    display: 'flex',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 16,
  },
  btn: {
    padding: '6px 14px',
    borderRadius: 6,
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    color: 'var(--text-secondary)',
    fontSize: 13,
    cursor: 'pointer',
  },
  btnPrimary: {
    background: 'var(--green)',
    borderColor: 'var(--green-dark)',
    color: 'var(--text-on-accent)',
  },
};
