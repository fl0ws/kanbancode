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
    color: '#9E9E9E',
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
    border: '1px solid #E0E0E0',
    background: '#FFFFFF',
    cursor: 'pointer',
    fontSize: 14,
    fontWeight: 500,
    color: '#212121',
  },
  projectName: {
    maxWidth: 160,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  chevron: {
    fontSize: 10,
    color: '#9E9E9E',
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    marginTop: 4,
    minWidth: 220,
    background: '#FFFFFF',
    border: '1px solid #E0E0E0',
    borderRadius: 8,
    boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
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
    color: '#424242',
    textAlign: 'left',
  },
  optionActive: {
    background: '#E3F2FD',
    color: '#1976D2',
    fontWeight: 500,
  },
  optionDir: {
    fontSize: 11,
    color: '#9E9E9E',
    marginLeft: 8,
  },
  divider: {
    height: 1,
    background: '#E0E0E0',
  },
  manageBtn: {
    width: '100%',
    padding: '8px 12px',
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    fontSize: 13,
    color: '#7C4DFF',
    textAlign: 'left',
    fontWeight: 500,
  },
};
