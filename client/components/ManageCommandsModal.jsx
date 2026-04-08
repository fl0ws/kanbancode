import React, { useState, useEffect } from 'react';
import { fetchCommands, createCommand, updateCommand, deleteCommand } from '../api.js';

export default function ManageCommandsModal({ onClose }) {
  const [commands, setCommands] = useState([]);
  const [editing, setEditing] = useState(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editTemplate, setEditTemplate] = useState('');
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newTemplate, setNewTemplate] = useState('');
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchCommands().then(setCommands).catch(() => {});
  }, []);

  async function handleCreate(e) {
    e.preventDefault();
    if (!newName.trim() || !newTemplate.trim()) return;
    setError(null);
    try {
      const cmd = await createCommand({ name: newName.trim(), description: newDesc.trim(), template: newTemplate.trim() });
      setCommands([...commands, cmd]);
      setNewName('');
      setNewDesc('');
      setNewTemplate('');
    } catch (err) {
      setError(err.message);
    }
  }

  function startEdit(cmd) {
    setEditing(cmd.id);
    setEditName(cmd.name);
    setEditDesc(cmd.description);
    setEditTemplate(cmd.template);
  }

  async function saveEdit(id) {
    setError(null);
    try {
      const updated = await updateCommand(id, { name: editName, description: editDesc, template: editTemplate });
      setCommands(commands.map(c => c.id === id ? updated : c));
      setEditing(null);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this command?')) return;
    setError(null);
    try {
      await deleteCommand(id);
      setCommands(commands.filter(c => c.id !== id));
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <div style={styles.modalHeader}>
          <h2 style={styles.heading}>Manage Commands</h2>
          <button style={styles.closeBtn} onClick={onClose}>&#x2715;</button>
        </div>

        <div style={styles.list}>
          {commands.map(cmd => (
            <div key={cmd.id} style={styles.item}>
              {editing === cmd.id ? (
                <div style={styles.editForm}>
                  <div style={styles.editRow}>
                    <label style={styles.fieldLabel}>
                      Name
                      <input style={styles.input} value={editName} onChange={e => setEditName(e.target.value)} placeholder="command-name" />
                    </label>
                    <label style={styles.fieldLabel}>
                      Description
                      <input style={styles.input} value={editDesc} onChange={e => setEditDesc(e.target.value)} placeholder="Short description" />
                    </label>
                  </div>
                  <label style={styles.fieldLabel}>
                    Template
                    <textarea style={{ ...styles.input, ...styles.textarea }} value={editTemplate} onChange={e => setEditTemplate(e.target.value)} rows={3} />
                  </label>
                  <div style={styles.editActions}>
                    <button style={styles.btn} onClick={() => setEditing(null)}>Cancel</button>
                    <button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={() => saveEdit(cmd.id)}>Save</button>
                  </div>
                </div>
              ) : (
                <div style={styles.itemRow}>
                  <div style={styles.itemInfo}>
                    <div style={styles.itemNameRow}>
                      <span style={styles.itemName}>/{cmd.name}</span>
                      {cmd.builtin === 1 && <span style={styles.builtinBadge}>built-in</span>}
                    </div>
                    <span style={styles.itemDesc}>{cmd.description}</span>
                    <span style={styles.itemTemplate}>{cmd.template.slice(0, 80)}{cmd.template.length > 80 ? '...' : ''}</span>
                  </div>
                  <div style={styles.itemActions}>
                    <button style={styles.smallBtn} onClick={() => startEdit(cmd)}>Edit</button>
                    {!cmd.builtin && (
                      <button style={{ ...styles.smallBtn, ...styles.deleteBtn }} onClick={() => handleDelete(cmd.id)}>Delete</button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        <form onSubmit={handleCreate} style={styles.createForm}>
          <h3 style={styles.subheading}>New Command</h3>
          <div style={styles.editRow}>
            <label style={styles.fieldLabel}>
              Name
              <input style={styles.input} value={newName} onChange={e => setNewName(e.target.value)} placeholder="e.g. deploy" />
            </label>
            <label style={styles.fieldLabel}>
              Description
              <input style={styles.input} value={newDesc} onChange={e => setNewDesc(e.target.value)} placeholder="Short description" />
            </label>
          </div>
          <label style={styles.fieldLabel}>
            Template
            <textarea style={{ ...styles.input, ...styles.textarea }} value={newTemplate} onChange={e => setNewTemplate(e.target.value)} placeholder="The prompt text that will be inserted..." rows={3} />
          </label>
          <button type="submit" style={{ ...styles.btn, ...styles.btnPrimary }} disabled={!newName.trim() || !newTemplate.trim()}>
            Create Command
          </button>
        </form>

        {error && <p style={styles.error}>{error}</p>}
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
    borderRadius: 12,
    padding: 24,
    width: 600,
    maxWidth: '90vw',
    maxHeight: '80vh',
    overflowY: 'auto',
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
  },
  subheading: {
    fontSize: 14,
    fontWeight: 500,
    color: 'var(--text-secondary)',
    marginBottom: 10,
  },
  list: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    marginBottom: 20,
  },
  item: {
    borderBottom: '1px solid var(--border)',
    padding: '10px 0',
  },
  itemRow: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 12,
  },
  itemInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: 3,
    flex: 1,
    minWidth: 0,
  },
  itemNameRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  itemName: {
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--blue)',
  },
  builtinBadge: {
    fontSize: 10,
    padding: '1px 6px',
    borderRadius: 4,
    background: 'var(--bg-input)',
    color: 'var(--text-muted)',
    fontWeight: 500,
  },
  itemDesc: {
    fontSize: 12,
    color: 'var(--text-secondary)',
  },
  itemTemplate: {
    fontSize: 11,
    color: 'var(--text-muted)',
    fontStyle: 'italic',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  itemActions: {
    display: 'flex',
    gap: 6,
    flexShrink: 0,
    paddingTop: 2,
  },
  editForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  },
  editRow: {
    display: 'flex',
    gap: 8,
  },
  editActions: {
    display: 'flex',
    gap: 6,
    justifyContent: 'flex-end',
  },
  fieldLabel: {
    display: 'block',
    fontSize: 11,
    color: 'var(--text-muted)',
    flex: 1,
  },
  createForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    padding: '16px 0',
    borderTop: '1px solid var(--border)',
  },
  input: {
    display: 'block',
    width: '100%',
    marginTop: 4,
    padding: '6px 10px',
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
  smallBtn: {
    padding: '4px 10px',
    borderRadius: 6,
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    color: 'var(--text-secondary)',
    fontSize: 12,
    cursor: 'pointer',
  },
  deleteBtn: {
    color: 'var(--red)',
    borderColor: 'var(--red-alpha, rgba(248,81,73,0.3))',
  },
  error: {
    color: 'var(--red)',
    fontSize: 13,
    marginTop: 8,
  },
};
