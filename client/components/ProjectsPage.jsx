import React, { useState } from 'react';
import { useStore } from '../store.js';
import { createProject, updateProject, archiveProject, deleteProject } from '../api.js';
import FolderPicker from './FolderPicker.jsx';

const COUNT_COLUMNS = [
  { key: 'count_not_started', label: 'To Do',     style: { background: 'var(--bg-elevated)',       color: 'var(--text-secondary)' } },
  { key: 'count_claude',      label: 'Claude',    style: { background: 'var(--purple-bg)',         color: 'var(--purple)' } },
  { key: 'count_your_turn',   label: 'Your Turn', style: { background: 'var(--orange-bg)',         color: 'var(--orange)' } },
  { key: 'count_done',        label: 'Done',      style: { background: 'var(--tertiary-container)', color: 'var(--tertiary)' } },
];

export default function ProjectsPage() {
  const projects = useStore(s => s.projects);
  const setProjects = useStore(s => s.setProjects);
  const activeProjectId = useStore(s => s.activeProjectId);
  const setActiveProject = useStore(s => s.setActiveProject);

  const [editing, setEditing] = useState(null);
  const [editName, setEditName] = useState('');
  const [editDir, setEditDir] = useState('');
  const [editMemoryDisabled, setEditMemoryDisabled] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDir, setNewDir] = useState('');
  const [newMemoryDisabled, setNewMemoryDisabled] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState(null);

  async function handleCreate(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    setError(null);
    try {
      const project = await createProject({
        name: newName.trim(),
        working_dir: newDir.trim() || undefined,
        memory_disabled: newMemoryDisabled,
      });
      setProjects([...projects, project]);
      setNewName('');
      setNewDir('');
      setNewMemoryDisabled(false);
      setShowCreate(false);
      setActiveProject(project.id);
    } catch (err) {
      setError(err.message);
    }
  }

  function startEdit(project) {
    setEditing(project.id);
    setEditName(project.name);
    setEditDir(project.working_dir || '');
    setEditMemoryDisabled(!!project.memory_disabled);
  }

  async function saveEdit(id) {
    setError(null);
    try {
      const updated = await updateProject(id, {
        name: editName,
        working_dir: editDir.trim() || null,
        memory_disabled: editMemoryDisabled,
      });
      // Preserve count fields (the update endpoint doesn't return them); the
      // websocket will refresh shortly anyway, this just avoids a brief flash to 0.
      setProjects(projects.map(p => p.id === id ? { ...p, ...updated } : p));
      setEditing(null);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleArchive(id) {
    if (!confirm('Archive this project? Its tasks will remain but it will be hidden from the project list.')) return;
    setError(null);
    try {
      await archiveProject(id);
      const remaining = projects.filter(p => p.id !== id);
      setProjects(remaining);
      if (activeProjectId === id) {
        setActiveProject(remaining[0]?.id || null);
      }
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Permanently delete this project and ALL its tasks? This cannot be undone.')) return;
    setError(null);
    try {
      await deleteProject(id);
      const remaining = projects.filter(p => p.id !== id);
      setProjects(remaining);
      if (activeProjectId === id) {
        setActiveProject(remaining[0]?.id || null);
      }
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div style={styles.container}>
      <div style={styles.sectionHeader}>
        <h2 style={styles.sectionTitle}>Active Projects</h2>
        <button style={styles.newBtn} onClick={() => setShowCreate(s => !s)}>
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
          New Project
        </button>
      </div>

      {showCreate && (
        <form onSubmit={handleCreate} style={styles.createCard}>
          <input
            style={styles.input}
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Project name"
            autoFocus
          />
          <FolderPicker value={newDir} onChange={setNewDir} />
          <label style={styles.memoryToggle}>
            <input
              type="checkbox"
              checked={newMemoryDisabled}
              onChange={e => setNewMemoryDisabled(e.target.checked)}
            />
            <div style={styles.memoryToggleText}>
              <span style={styles.memoryToggleTitle}>Disable memory</span>
              <span style={styles.memoryToggleDesc}>
                Skip memory saving, dreaming, and <code>.claude-memory</code> consolidation for this project.
              </span>
            </div>
          </label>
          <div style={styles.createActions}>
            <button type="button" style={styles.btn} onClick={() => { setShowCreate(false); setNewName(''); setNewDir(''); setNewMemoryDisabled(false); }}>Cancel</button>
            <button type="submit" style={{ ...styles.btn, ...styles.btnPrimary }} disabled={!newName.trim()}>Create</button>
          </div>
        </form>
      )}

      <div style={styles.list}>
        {projects.length === 0 && !showCreate && (
          <div style={styles.emptyState}>
            <span className="material-symbols-outlined" style={{ fontSize: 36, color: 'var(--text-muted)', marginBottom: 8 }}>folder_off</span>
            <span style={styles.emptyTitle}>No active projects</span>
            <span style={styles.emptyDesc}>Click "New Project" to create one</span>
          </div>
        )}
        {projects.map(project => (
          <div key={project.id} style={styles.item}>
            {editing === project.id ? (
              <div style={styles.editForm}>
                <input
                  style={styles.input}
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  placeholder="Project name"
                  autoFocus
                />
                <FolderPicker value={editDir} onChange={setEditDir} />
                <label style={styles.memoryToggle}>
                  <input
                    type="checkbox"
                    checked={editMemoryDisabled}
                    onChange={e => setEditMemoryDisabled(e.target.checked)}
                  />
                  <div style={styles.memoryToggleText}>
                    <span style={styles.memoryToggleTitle}>Disable memory</span>
                    <span style={styles.memoryToggleDesc}>
                      Skip memory saving, dreaming, and <code>.claude-memory</code> consolidation for this project.
                    </span>
                  </div>
                </label>
                <div style={styles.editActions}>
                  <button style={styles.btn} onClick={() => setEditing(null)}>Cancel</button>
                  <button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={() => saveEdit(project.id)}>Save</button>
                </div>
              </div>
            ) : (
              <div style={styles.itemRow}>
                <div style={styles.itemContent}>
                  <div style={styles.itemTitleRow}>
                    <span style={styles.itemName}>{project.name}</span>
                    {project.id === activeProjectId && <span style={styles.activeBadge}>Active</span>}
                    {project.memory_disabled ? (
                      <span style={styles.memoryOffBadge} title="Memory features disabled for this project">
                        <span className="material-symbols-outlined" style={{ fontSize: 12 }}>memory_alt</span>
                        Memory off
                      </span>
                    ) : null}
                  </div>
                  {project.working_dir && <span style={styles.itemDir}>{project.working_dir}</span>}
                </div>
                <div style={styles.counts}>
                  {COUNT_COLUMNS.map(col => (
                    <div key={col.key} style={{ ...styles.countChip, ...col.style }}>
                      <span style={styles.countNumber}>{project[col.key] ?? 0}</span>
                      <span style={styles.countLabel}>{col.label}</span>
                    </div>
                  ))}
                </div>
                <div style={styles.itemActions}>
                  <button style={styles.iconBtn} onClick={() => startEdit(project)} title="Edit">
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span>
                  </button>
                  <button style={styles.iconBtn} onClick={() => handleArchive(project.id)} title="Archive">
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>archive</span>
                  </button>
                  <button style={{ ...styles.iconBtn, color: 'var(--red)' }} onClick={() => handleDelete(project.id)} title="Delete permanently">
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {error && <p style={styles.error}>{error}</p>}
    </div>
  );
}

const styles = {
  container: {
    padding: '0 28px 28px',
    height: '100%',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
  },
  sectionHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
    gap: 12,
  },
  sectionTitle: {
    fontFamily: 'var(--font-headline)',
    fontSize: 'var(--fs-md)',
    fontWeight: 700,
    color: 'var(--text-primary)',
  },
  newBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    padding: '6px 12px',
    borderRadius: 'var(--radius-lg)',
    border: 'none',
    background: 'linear-gradient(135deg, var(--green), var(--green-dark))',
    color: 'var(--text-on-accent)',
    fontSize: 'var(--fs-body)',
    fontWeight: 600,
    fontFamily: 'var(--font-headline)',
    cursor: 'pointer',
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  createCard: {
    background: 'var(--bg-surface)',
    padding: 16,
    borderRadius: 'var(--radius-lg)',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    marginBottom: 8,
  },
  createActions: {
    display: 'flex',
    gap: 6,
    justifyContent: 'flex-end',
    marginTop: 4,
  },
  item: {
    background: 'var(--bg-surface)',
    padding: '12px 16px',
    borderRadius: 'var(--radius-lg)',
  },
  itemRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  itemContent: {
    flex: 1,
    minWidth: 0,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  itemTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  itemName: {
    fontFamily: 'var(--font-headline)',
    fontSize: 'var(--fs-base)',
    fontWeight: 700,
    color: 'var(--text-primary)',
  },
  itemDir: {
    fontSize: 'var(--fs-small)',
    color: 'var(--text-muted)',
    fontFamily: "'Cascadia Code', 'Fira Code', monospace",
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  activeBadge: {
    fontSize: 'var(--fs-sm)',
    padding: '1px 7px',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--green-bg)',
    color: 'var(--green)',
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  memoryOffBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 3,
    fontSize: 'var(--fs-sm)',
    padding: '1px 7px',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--bg-elevated)',
    color: 'var(--text-muted)',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  memoryToggle: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 10,
    padding: '8px 10px',
    borderRadius: 'var(--radius-sm)',
    background: 'var(--bg-sidebar)',
    cursor: 'pointer',
  },
  memoryToggleText: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  memoryToggleTitle: {
    fontSize: 'var(--fs-body)',
    color: 'var(--text-primary)',
    fontWeight: 600,
  },
  memoryToggleDesc: {
    fontSize: 'var(--fs-small)',
    color: 'var(--text-muted)',
    lineHeight: 1.3,
  },
  counts: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(68px, 1fr))',
    gap: 6,
    flexShrink: 0,
    width: 320,
  },
  countChip: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '6px 8px',
    borderRadius: 'var(--radius-sm)',
    lineHeight: 1.1,
  },
  countNumber: {
    fontFamily: 'var(--font-headline)',
    fontSize: 'var(--fs-md)',
    fontWeight: 700,
  },
  countLabel: {
    fontSize: 'var(--fs-caption)',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    opacity: 0.85,
    marginTop: 2,
  },
  itemActions: {
    display: 'flex',
    gap: 4,
    flexShrink: 0,
  },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 'var(--radius-sm)',
    border: 'none',
    background: 'none',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 0.15s, color 0.15s',
  },
  editForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  editActions: {
    display: 'flex',
    gap: 6,
    justifyContent: 'flex-end',
  },
  input: {
    padding: '8px 12px',
    borderRadius: 'var(--radius-sm)',
    border: 'none',
    background: 'var(--bg-input)',
    color: 'var(--text-primary)',
    fontSize: 'var(--fs-body)',
    outline: 'none',
    fontFamily: 'inherit',
  },
  btn: {
    padding: '6px 14px',
    borderRadius: 'var(--radius-sm)',
    border: 'none',
    background: 'var(--bg-elevated)',
    color: 'var(--text-secondary)',
    fontSize: 'var(--fs-body)',
    cursor: 'pointer',
    fontFamily: 'inherit',
  },
  btnPrimary: {
    background: 'linear-gradient(135deg, var(--green), var(--green-dark))',
    color: 'var(--text-on-accent)',
    borderRadius: 'var(--radius-lg)',
    fontFamily: 'var(--font-headline)',
    fontWeight: 600,
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: '40px 16px',
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
  error: {
    color: 'var(--red)',
    fontSize: 'var(--fs-body)',
    padding: '8px 12px',
    background: 'var(--red-alpha)',
    borderRadius: 'var(--radius-sm)',
  },
};
