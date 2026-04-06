import React, { useState, useRef, useEffect } from 'react';
import { useStore } from '../store.js';

export default function ProjectSelector({ onManage }) {
  const projects = useStore(s => s.projects);
  const activeProjectId = useStore(s => s.activeProjectId);
  const setActiveProject = useStore(s => s.setActiveProject);
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const activeProject = projects.find(p => p.id === activeProjectId) || projects[0];

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function select(id) {
    setActiveProject(id);
    setOpen(false);
  }

  return (
    <div ref={ref} style={styles.container}>
      <button style={styles.trigger} onClick={() => setOpen(!open)}>
        <span style={styles.projectName}>{activeProject?.name || 'Select Project'}</span>
        <span style={styles.chevron}>{open ? '\u25b2' : '\u25bc'}</span>
      </button>
      {activeProject?.working_dir && (
        <span style={styles.workingDir} title={activeProject.working_dir}>
          {activeProject.working_dir}
        </span>
      )}
      {open && (
        <div style={styles.dropdown}>
          {projects.map(p => (
            <button
              key={p.id}
              style={{
                ...styles.option,
                ...(p.id === activeProjectId ? styles.optionActive : {}),
              }}
              onClick={() => select(p.id)}
            >
              <span>{p.name}</span>
              {p.working_dir && <span style={styles.optionDir}>{p.working_dir.split(/[\\/]/).pop()}</span>}
            </button>
          ))}
          <div style={styles.divider} />
          <button style={styles.manageBtn} onClick={() => { setOpen(false); onManage(); }}>
            Manage Projects...
          </button>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
  },
  workingDir: {
    fontSize: 12,
    color: 'var(--text-muted)',
    maxWidth: 300,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  trigger: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 12px',
    borderRadius: 6,
    border: '1px solid var(--border)',
    background: 'var(--bg-surface)',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 500,
    color: 'var(--text-primary)',
  },
  projectName: {
    maxWidth: 160,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  chevron: {
    fontSize: 10,
    color: 'var(--text-muted)',
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    marginTop: 4,
    minWidth: 220,
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    boxShadow: 'var(--shadow-dropdown)',
    zIndex: 50,
    overflow: 'hidden',
  },
  option: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    padding: '8px 12px',
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    fontSize: 13,
    color: 'var(--text-secondary)',
    textAlign: 'left',
  },
  optionActive: {
    background: 'var(--blue-bg)',
    color: 'var(--blue)',
    fontWeight: 500,
  },
  optionDir: {
    fontSize: 11,
    color: 'var(--text-muted)',
    marginLeft: 8,
  },
  divider: {
    height: 1,
    background: 'var(--border)',
  },
  manageBtn: {
    width: '100%',
    padding: '8px 12px',
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    fontSize: 13,
    color: 'var(--purple)',
    textAlign: 'left',
    fontWeight: 500,
  },
};
