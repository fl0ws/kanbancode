import React, { useState } from 'react';
import { useStore } from '../store.js';
import { createProject, updateProject, deleteProject } from '../api.js';
import FolderPicker from './FolderPicker.jsx';

export default function ManageProjectsModal({ onClose }) {
  const projects = useStore(s => s.projects);
  const setProjects = useStore(s => s.setProjects);
  const activeProjectId = useStore(s => s.activeProjectId);
  const setActiveProject = useStore(s => s.setActiveProject);
  const [editing, setEditing] = useState(null);
  const [editName, setEditName] = useState('');
  const [editDir, setEditDir] = useState('');
  const [newName, setNewName] = useState('');
  const [newDir, setNewDir] = useState('');
  const [error, setError] = useState(null);

  async function handleCreate(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    setError(null);
    try {
      const project = await createProject({ name: newName.trim(), working_dir: newDir.trim() || undefined });
      setProjects([...projects, project]);
      setNewName('');
      setNewDir('');
      // Auto-switch to new project
      setActiveProject(project.id);
    } catch (err) {
      setError(err.message);
    }
  }

  function startEdit(project) {
    setEditing(project.id);
    setEditName(project.name);
    setEditDir(project.working_dir || '');
  }

  async function saveEdit(id) {
    setError(null);
    try {
      const updated = await updateProject(id, { name: editName, working_dir: editDir.trim() || null });
      setProjects(projects.map(p => p.id === id ? updated : p));
      setEditing(null);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this project and ALL its tasks? This cannot be undone.')) return;
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
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.modalHeader}>
          <h2 style={styles.heading}>Manage Projects</h2>
          <button style={styles.closeBtn} onClick={onClose}>&#x2715;</button>
        </div>

        <div style={styles.list}>
          {projects.map(project => (
            <div key={project.id} style={styles.item}>
              {editing === project.id ? (
                <div style={styles.editRow}>
                  <input
                    style={styles.input}
                    value={editName}
                    onChange={e => setEditName(e.target.value)}
                    placeholder="Project name"
                    autoFocus
                  />
                  <FolderPicker value={editDir} onChange={setEditDir} />
                  <div style={styles.editActions}>
                    <button style={styles.btn} onClick={() => setEditing(null)}>Cancel</button>
                    <button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={() => saveEdit(project.id)}>Save</button>
                  </div>
                </div>
              ) : (
                <div style={styles.itemRow}>
                  <div style={styles.itemInfo}>
                    <span style={styles.itemName}>
                      {project.name}
                      {project.id === activeProjectId && <span style={styles.activeBadge}>Active</span>}
                    </span>
                    {project.working_dir && <span style={styles.itemDir}>{project.working_dir}</span>}
                  </div>
                  <div style={styles.itemActions}>
                    <button style={styles.smallBtn} onClick={() => startEdit(project)}>Edit</button>
                    <button style={{ ...styles.smallBtn, ...styles.deleteBtn }} onClick={() => handleDelete(project.id)}>Delete</button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <form onSubmit={handleCreate} style={styles.createForm}>
          <h3 style={styles.subheading}>New Project</h3>
          <input
            style={styles.input}
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="Project name"
          />
          <label style={styles.fieldLabel}>Working Directory</label>
          <FolderPicker value={newDir} onChange={setNewDir} />
          <button type="submit" style={{ ...styles.btn, ...styles.btnPrimary }} disabled={!newName.trim()}>
            Create Project
          </button>
        </form>

        {error && <p style={styles.error}>{error}</p>}

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
    background: 'rgba(0,0,0,0.32)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 100,
  },
  modal: {
    background: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    width: 520,
    maxWidth: '90vw',
    maxHeight: '80vh',
    overflowY: 'auto',
    boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
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
    color: '#212121',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    border: 'none',
    background: 'transparent',
    color: '#757575',
    fontSize: 16,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  subheading: {
    fontSize: 14,
    fontWeight: 500,
    color: '#424242',
    marginBottom: 8,
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    marginBottom: 20,
  },
  item: {
    borderBottom: '1px solid #EEEEEE',
    padding: '8px 0',
  },
  itemRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
  },
  itemInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    flex: 1,
    minWidth: 0,
  },
  itemName: {
    fontSize: 14,
    fontWeight: 500,
    color: '#212121',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  activeBadge: {
    fontSize: 10,
    padding: '1px 6px',
    borderRadius: 4,
    background: '#E3F2FD',
    color: '#1976D2',
    fontWeight: 600,
  },
  itemDir: {
    fontSize: 12,
    color: '#9E9E9E',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  itemActions: {
    display: 'flex',
    gap: 6,
    flexShrink: 0,
  },
  editRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  fieldLabel: {
    fontSize: 12,
    color: '#757575',
    marginBottom: -4,
  },
  editActions: {
    display: 'flex',
    gap: 6,
    justifyContent: 'flex-end',
  },
  createForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: '16px 0',
    borderTop: '1px solid #EEEEEE',
  },
  input: {
    padding: '8px 10px',
    borderRadius: 6,
    border: '1px solid #E0E0E0',
    background: '#F5F5F5',
    color: '#212121',
    fontSize: 13,
    outline: 'none',
  },
  btn: {
    padding: '6px 14px',
    borderRadius: 6,
    border: '1px solid #E0E0E0',
    background: '#FAFAFA',
    color: '#424242',
    fontSize: 13,
    cursor: 'pointer',
  },
  btnPrimary: {
    background: '#4CAF50',
    borderColor: '#43A047',
    color: '#fff',
  },
  smallBtn: {
    padding: '4px 10px',
    borderRadius: 6,
    border: '1px solid #E0E0E0',
    background: '#FAFAFA',
    color: '#424242',
    fontSize: 12,
    cursor: 'pointer',
  },
  deleteBtn: {
    color: '#E53935',
    borderColor: '#E5393544',
  },
  error: {
    color: '#E53935',
    fontSize: 13,
    marginTop: 8,
  },
  footer: {
    display: 'flex',
    justifyContent: 'flex-end',
    marginTop: 16,
  },
};
