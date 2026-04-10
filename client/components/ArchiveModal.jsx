import React, { useState, useEffect } from 'react';
import { fetchArchived, unarchiveTask } from '../api.js';
import { useStore } from '../store.js';

export default function ArchiveModal({ onClose }) {
  const activeProjectId = useStore(s => s.activeProjectId);
  const [query, setQuery] = useState('');
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadArchived();
  }, []);

  async function loadArchived(q) {
    setLoading(true);
    try {
      const data = await fetchArchived(q, activeProjectId);
      setTasks(data);
    } catch {
      setTasks([]);
    } finally {
      setLoading(false);
    }
  }

  function handleSearch(e) {
    e.preventDefault();
    loadArchived(query);
  }

  async function handleRestore(id) {
    await unarchiveTask(id);
    setTasks(tasks.filter(t => t.id !== id));
  }

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.modalHeader}>
          <h2 style={styles.heading}>Archived Tasks</h2>
          <button style={styles.closeBtn} onClick={onClose} title="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <form onSubmit={handleSearch} style={styles.searchRow}>
          <input
            style={styles.input}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search archived tasks..."
          />
          <button type="submit" style={styles.btn}>Search</button>
        </form>
        <div style={styles.list}>
          {loading && <p style={styles.empty}>Loading...</p>}
          {!loading && tasks.length === 0 && <p style={styles.empty}>No archived tasks</p>}
          {tasks.map(task => (
            <div key={task.id} style={styles.item}>
              <div>
                <div style={styles.title}>{task.title}</div>
                {task.description && <div style={styles.desc}>{task.description.slice(0, 80)}</div>}
              </div>
              <button style={styles.restoreBtn} onClick={() => handleRestore(task.id)}>
                Restore
              </button>
            </div>
          ))}
        </div>
        <div style={styles.footer}>
          <button style={styles.btn} onClick={onClose}>Close</button>
        </div>
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
    width: 500,
    maxWidth: '90vw',
    maxHeight: '70vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: 'var(--shadow-lg)',
  },
  modalHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  heading: {
    fontFamily: 'var(--font-headline)',
    fontWeight: 700,
    fontSize: 15,
    color: 'var(--text-primary)',
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 'var(--radius-sm)',
    border: 'none',
    background: 'none',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    transition: 'background 0.15s',
  },
  searchRow: {
    display: 'flex',
    gap: 8,
    marginBottom: 12,
  },
  input: {
    flex: 1,
    padding: '6px 10px',
    borderRadius: 'var(--radius-sm)',
    border: 'none',
    background: 'var(--bg-input)',
    color: 'var(--text-primary)',
    fontSize: 13,
  },
  list: {
    flex: 1,
    overflowY: 'auto',
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 6px',
    borderRadius: 'var(--radius-sm)',
    marginBottom: 2,
    gap: 12,
  },
  title: {
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--text-primary)',
  },
  desc: {
    fontSize: 12,
    color: 'var(--text-tertiary)',
    marginTop: 2,
  },
  restoreBtn: {
    padding: '4px 10px',
    borderRadius: 'var(--radius-sm)',
    border: 'none',
    background: 'var(--green-bg)',
    color: 'var(--green)',
    fontSize: 12,
    cursor: 'pointer',
    flexShrink: 0,
  },
  empty: {
    color: 'var(--text-muted)',
    fontSize: 13,
    textAlign: 'center',
    padding: 24,
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginTop: 12,
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
};
