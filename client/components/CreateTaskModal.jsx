import React, { useState, useEffect, useRef } from 'react';
import { createTask, fetchCommands } from '../api.js';
import { useStore } from '../store.js';
import SlashCommandOverlay from './SlashCommandOverlay.jsx';

export default function CreateTaskModal({ onClose }) {
  const activeProjectId = useStore(s => s.activeProjectId);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [commands, setCommands] = useState([]);
  const [showSlash, setShowSlash] = useState(false);
  const [slashFilter, setSlashFilter] = useState('');
  const descRef = useRef(null);

  useEffect(() => {
    fetchCommands().then(setCommands).catch(() => {});
  }, []);

  function handleDescChange(e) {
    const val = e.target.value;
    setDescription(val);

    // Detect / at start of line or after newline
    const cursorPos = e.target.selectionStart;
    const textBefore = val.slice(0, cursorPos);
    const lastLineStart = textBefore.lastIndexOf('\n') + 1;
    const currentLine = textBefore.slice(lastLineStart);

    if (currentLine.startsWith('/')) {
      setShowSlash(true);
      setSlashFilter(currentLine.slice(1));
    } else {
      setShowSlash(false);
    }
  }

  function handleSelectCommand(cmd) {
    // Replace the /command text with the template
    const cursorPos = descRef.current?.selectionStart || description.length;
    const textBefore = description.slice(0, cursorPos);
    const textAfter = description.slice(cursorPos);
    const lastLineStart = textBefore.lastIndexOf('\n') + 1;
    const before = description.slice(0, lastLineStart);
    const newDesc = before + cmd.template + textAfter;
    setDescription(newDesc);
    setShowSlash(false);
    // Focus back on textarea
    setTimeout(() => descRef.current?.focus(), 0);
  }

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
          <button style={styles.closeBtn} onClick={onClose} title="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
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
            <div style={styles.descWrapper}>
              <textarea
                ref={descRef}
                style={{ ...styles.input, ...styles.textarea }}
                value={description}
                onChange={handleDescChange}
                placeholder='Details, requirements, context... Type "/" for commands'
                rows={4}
              />
              {showSlash && (
                <SlashCommandOverlay
                  commands={commands}
                  filter={slashFilter}
                  onSelect={handleSelectCommand}
                  onClose={() => setShowSlash(false)}
                />
              )}
            </div>
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
    width: 36,
    height: 36,
    borderRadius: 8,
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    transition: 'background 0.15s',
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
  descWrapper: {
    position: 'relative',
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
