import React, { useState, useEffect } from 'react';
import { fetchArchived, unarchiveTask, deleteTask } from '../api.js';
import { useStore } from '../store.js';

export default function ArchivePage() {
  const activeProjectId = useStore(s => s.activeProjectId);
  const [query, setQuery] = useState('');
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadArchived();
  }, [activeProjectId]);

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

  async function handleDelete(id) {
    if (!confirm('Permanently delete this task?')) return;
    await deleteTask(id);
    setTasks(tasks.filter(t => t.id !== id));
  }

  return (
    <div style={styles.container}>
      <form onSubmit={handleSearch} style={styles.searchRow}>
        <div style={styles.searchBox}>
          <span className="material-symbols-outlined" style={{ fontSize: 18, color: 'var(--text-muted)' }}>search</span>
          <input
            style={styles.input}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search archived tasks..."
          />
        </div>
      </form>

      <div style={styles.list}>
        {loading && <p style={styles.empty}>Loading...</p>}
        {!loading && tasks.length === 0 && (
          <div style={styles.emptyState}>
            <span className="material-symbols-outlined" style={{ fontSize: 36, color: 'var(--text-muted)', marginBottom: 8 }}>inventory_2</span>
            <span style={styles.emptyTitle}>No archived tasks</span>
            <span style={styles.emptyDesc}>Tasks you archive will appear here</span>
          </div>
        )}
        {tasks.map(task => (
          <div key={task.id} style={styles.item}>
            <div style={styles.itemContent}>
              <span style={styles.title}>{task.title}</span>
              {task.description && <span style={styles.desc}>{task.description.slice(0, 120)}{task.description.length > 120 ? '...' : ''}</span>}
              <span style={styles.meta}>
                <span className="material-symbols-outlined" style={{ fontSize: 12 }}>schedule</span>
                {task.updated_at ? formatDate(task.updated_at) : ''}
              </span>
            </div>
            <div style={styles.actions}>
              <button style={styles.restoreBtn} onClick={() => handleRestore(task.id)} title="Restore to Not Started">
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>unarchive</span>
                Restore
              </button>
              <button style={styles.deleteBtn} onClick={() => handleDelete(task.id)} title="Permanently delete">
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatDate(ts) {
  try {
    const d = new Date(ts + 'Z');
    return d.toLocaleDateString('en', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return '';
  }
}

const styles = {
  container: {
    padding: '0 28px 28px',
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  searchRow: {
    marginBottom: 16,
  },
  searchBox: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 14px',
    background: 'var(--bg-surface)',
    borderRadius: 'var(--radius-lg)',
  },
  input: {
    flex: 1,
    border: 'none',
    background: 'none',
    color: 'var(--text-primary)',
    fontSize: 'var(--fs-body)',
    outline: 'none',
    fontFamily: 'inherit',
  },
  list: {
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 16,
    padding: '14px 16px',
    background: 'var(--bg-surface)',
    borderRadius: 'var(--radius-lg)',
  },
  itemContent: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
  },
  title: {
    fontFamily: 'var(--font-headline)',
    fontSize: 'var(--fs-base)',
    fontWeight: 700,
    color: 'var(--text-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  desc: {
    fontSize: 'var(--fs-small)',
    color: 'var(--text-secondary)',
    lineHeight: 1.4,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  meta: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 'var(--fs-caption)',
    color: 'var(--text-muted)',
    marginTop: 2,
  },
  actions: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    flexShrink: 0,
  },
  restoreBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    padding: '6px 12px',
    borderRadius: 'var(--radius-sm)',
    border: 'none',
    background: 'var(--green-bg)',
    color: 'var(--green)',
    fontSize: 'var(--fs-small)',
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'opacity 0.15s',
  },
  deleteBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: 30,
    height: 30,
    borderRadius: 'var(--radius-sm)',
    border: 'none',
    background: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    transition: 'color 0.15s',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 16px',
  },
  emptyTitle: {
    fontFamily: 'var(--font-headline)',
    fontSize: 'var(--fs-md)',
    fontWeight: 700,
    color: 'var(--text-secondary)',
  },
  emptyDesc: {
    fontSize: 'var(--fs-small)',
    color: 'var(--text-muted)',
    marginTop: 4,
  },
  empty: {
    color: 'var(--text-muted)',
    fontSize: 'var(--fs-body)',
    textAlign: 'center',
    padding: 24,
  },
};
