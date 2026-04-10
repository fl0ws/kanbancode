import React, { useState, useEffect, useRef } from 'react';
import { createTask, moveTask, fetchCommands } from '../api.js';
import { useStore } from '../store.js';
import { useAutoResize } from '../hooks/useAutoResize.js';
import SlashCommandOverlay from './SlashCommandOverlay.jsx';

export default function CreateTaskModal({ onClose, draft, setDraft }) {
  const activeProjectId = useStore(s => s.activeProjectId);

  const [title, setTitle] = useState(draft?.title || '');
  const [description, setDescription] = useState(draft?.description || '');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [commands, setCommands] = useState([]);
  const [showSlash, setShowSlash] = useState(false);
  const [slashFilter, setSlashFilter] = useState('');
  const descRef = useRef(null);
  const { handleInput: handleDescResize } = useAutoResize(20);

  useEffect(() => {
    fetchCommands().then(setCommands).catch(() => {});
  }, []);

  // Sync draft on changes
  useEffect(() => {
    setDraft({ title, description });
  }, [title, description]);

  function handleClear() {
    setTitle('');
    setDescription('');
    if (descRef.current) {
      descRef.current.style.height = 'auto';
    }
  }

  function handleDescChange(e) {
    const val = e.target.value;
    setDescription(val);
    handleDescResize(e);

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
    // Resize textarea to fit new content, then focus
    setTimeout(() => {
      if (descRef.current) {
        descRef.current.style.height = 'auto';
        descRef.current.style.height = Math.min(descRef.current.scrollHeight, 400) + 'px';
        descRef.current.focus();
      }
    }, 0);
  }

  async function handleCreate(sendToClaude = false) {
    if (!title.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const task = await createTask({
        title: title.trim(),
        description,
        project_id: activeProjectId,
      });
      if (sendToClaude && task?.id) {
        await moveTask(task.id, 'claude');
      }
      setDraft({ title: '', description: '' });
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
          <div style={styles.headerActions}>
            {(title || description) && (
              <button style={styles.clearBtn} onClick={handleClear} title="Clear form">Clear</button>
            )}
            <button style={styles.closeBtn} onClick={onClose} title="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
          </div>
        </div>
        <form onSubmit={e => { e.preventDefault(); handleCreate(false); }} style={styles.form}>
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
                rows={2}
              />
              {showSlash && (
                <SlashCommandOverlay
                  commands={commands}
                  filter={slashFilter}
                  onSelect={handleSelectCommand}
                  anchorRef={descRef}
                  onClose={() => setShowSlash(false)}
                />
              )}
            </div>
          </label>
          {error && <p style={styles.error}>{error}</p>}
          <div style={styles.actions}>
            <button type="button" style={styles.btn} onClick={onClose}>Cancel</button>
            <button type="submit" style={{ ...styles.btn, ...styles.btnAdd }} disabled={submitting || !title.trim()}>
              {submitting ? 'Creating...' : 'Add to task list'}
            </button>
            <button type="button" style={{ ...styles.btn, ...styles.btnClaude }} disabled={submitting || !title.trim()} onClick={() => handleCreate(true)}>
              {submitting ? 'Creating...' : 'Give to Claude'}
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
    backdropFilter: 'blur(4px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  modal: {
    background: 'var(--bg-surface)',
    border: 'none',
    borderRadius: 'var(--radius-xl)',
    padding: 24,
    width: 440,
    maxWidth: '90vw',
    maxHeight: '80vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: 'var(--shadow-lg)',
    overflow: 'hidden',
  },
  form: {
    flex: 1,
    overflowY: 'auto',
    minHeight: 0,
  },
  modalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  heading: {
    fontFamily: 'var(--font-headline)',
    fontWeight: 700,
    fontSize: 15,
    color: 'var(--text-primary)',
  },
  headerActions: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
  },
  clearBtn: {
    padding: '4px 10px',
    borderRadius: 'var(--radius-sm)',
    border: 'none',
    background: 'var(--bg-elevated)',
    color: 'var(--text-muted)',
    fontSize: 12,
    cursor: 'pointer',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 'var(--radius-md)',
    border: 'none',
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
    fontSize: 12,
    fontWeight: 500,
    color: 'var(--text-secondary)',
    marginBottom: 12,
  },
  input: {
    display: 'block',
    width: '100%',
    marginTop: 4,
    padding: '8px 10px',
    borderRadius: 'var(--radius-sm)',
    border: 'none',
    background: 'var(--bg-input)',
    color: 'var(--text-primary)',
    fontSize: 13,
    outline: 'none',
  },
  textarea: {
    resize: 'none',
    fontFamily: 'inherit',
    lineHeight: '20px',
    overflow: 'hidden',
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
    borderRadius: 'var(--radius-sm)',
    border: 'none',
    background: 'var(--bg-elevated)',
    color: 'var(--text-secondary)',
    fontSize: 13,
    cursor: 'pointer',
  },
  btnAdd: {
    background: 'linear-gradient(135deg, var(--green), var(--green-dark))',
    border: 'none',
    borderRadius: 'var(--radius-lg)',
    color: 'var(--text-on-accent)',
    fontFamily: 'var(--font-headline)',
    fontWeight: 600,
  },
  btnClaude: {
    background: 'linear-gradient(135deg, var(--purple), var(--purple-dark, var(--purple)))',
    border: 'none',
    borderRadius: 'var(--radius-lg)',
    color: 'var(--text-on-accent)',
    fontFamily: 'var(--font-headline)',
    fontWeight: 600,
  },
};
