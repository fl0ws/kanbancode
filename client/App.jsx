import React, { useEffect, useState, useRef } from 'react';
import { useStore } from './store.js';
import { useWebSocket } from './hooks/useWebSocket.js';
import { useTheme } from './hooks/useTheme.js';
import { fetchTasks, fetchPoolStatus, fetchProjects, archiveTask } from './api.js';
import Board from './components/Board.jsx';
import TaskDetail from './components/TaskDetail.jsx';
import CreateTaskModal from './components/CreateTaskModal.jsx';
import ArchiveModal from './components/ArchiveModal.jsx';
import ConcurrencyPrompt from './components/ConcurrencyPrompt.jsx';
import SettingsModal from './components/SettingsModal.jsx';
import ManageProjectsModal from './components/ManageProjectsModal.jsx';
import QuickQuestion from './components/QuickQuestion.jsx';

export default function App() {
  const [showCreate, setShowCreate] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [showQuickQuestion, setShowQuickQuestion] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showManageProjects, setShowManageProjects] = useState(false);
  const selectedTaskId = useStore(s => s.selectedTaskId);
  const poolStatus = useStore(s => s.poolStatus);
  const isDreaming = useStore(s => s.isDreaming);
  const activeProjectId = useStore(s => s.activeProjectId);
  const projects = useStore(s => s.projects);
  const activeProject = projects.find(p => p.id === activeProjectId);
  const setTasks = useStore(s => s.setTasks);
  const setPoolStatus = useStore(s => s.setPoolStatus);
  const setProjects = useStore(s => s.setProjects);
  const setActiveProject = useStore(s => s.setActiveProject);
  const { theme, toggleTheme } = useTheme();

  useWebSocket();

  const clearCardSelection = useStore(s => s.clearCardSelection);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.ctrlKey && e.code === 'Space') {
        e.preventDefault();
        setShowQuickQuestion(prev => !prev);
      }
      if (e.key === 'Escape') {
        clearCardSelection();
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Load projects on mount
  useEffect(() => {
    fetchProjects().then(projects => {
      setProjects(projects);
      // If no active project set, use the first one
      const stored = localStorage.getItem('kanban_active_project');
      if (!stored || !projects.find(p => p.id === stored)) {
        if (projects.length > 0) {
          setActiveProject(projects[0].id);
        }
      }
    });
    fetchPoolStatus().then(setPoolStatus);
  }, []);

  // Reload tasks when active project changes
  useEffect(() => {
    if (activeProjectId) {
      fetchTasks(activeProjectId).then(setTasks);
    }
  }, [activeProjectId]);

  const showConcurrencyPrompt = poolStatus.maxConcurrency === null;

  return (
    <>
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <ProjectTitle
            projects={projects}
            activeProject={activeProject}
            onSelect={(id) => setActiveProject(id)}
            onManage={() => setShowManageProjects(true)}
          />
        </div>
        <div style={styles.headerRight}>
          {isDreaming && <DreamingIndicator />}
          <PoolBadge status={poolStatus} />
          <button style={styles.themeBtn} onClick={toggleTheme} title={theme === 'light' ? 'Switch to dark mode' : 'Switch to light mode'}>
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
          <button style={styles.btn} onClick={() => setShowSettings(true)}>Settings</button>
          <button style={styles.btn} onClick={() => setShowArchive(true)}>Archive</button>
          <button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={() => setShowCreate(true)}>+ New Task</button>
        </div>
      </header>

      <div style={styles.body}>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <Board onAddTask={() => setShowCreate(true)} />
        </div>
      </div>

      {selectedTaskId && (
        <TaskDetail taskId={selectedTaskId} />
      )}
      {showCreate && <CreateTaskModal onClose={() => setShowCreate(false)} />}
      {showArchive && <ArchiveModal onClose={() => setShowArchive(false)} />}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      {showManageProjects && <ManageProjectsModal onClose={() => setShowManageProjects(false)} />}
      {showQuickQuestion && <QuickQuestion onClose={() => setShowQuickQuestion(false)} />}
      {showConcurrencyPrompt && <ConcurrencyPrompt />}
      <MultiSelectBar />
    </>
  );
}

function MultiSelectBar() {
  const selectedCardIds = useStore(s => s.selectedCardIds);
  const clearCardSelection = useStore(s => s.clearCardSelection);
  const count = selectedCardIds.size;

  if (count === 0) return null;

  async function handleArchive() {
    const ids = [...selectedCardIds];
    for (const id of ids) {
      try { await archiveTask(id); } catch {}
    }
    clearCardSelection();
  }

  async function handleDelete() {
    if (!confirm(`Permanently delete ${count} task${count > 1 ? 's' : ''}?`)) return;
    const { deleteTask } = await import('./api.js');
    const ids = [...selectedCardIds];
    for (const id of ids) {
      try { await deleteTask(id); } catch {}
    }
    clearCardSelection();
  }

  return (
    <div style={styles.multiBar}>
      <span style={styles.multiBarText}>{count} task{count > 1 ? 's' : ''} selected</span>
      <button style={styles.multiBarBtn} onClick={handleArchive}>Archive</button>
      <button style={{ ...styles.multiBarBtn, ...styles.multiBarDeleteBtn }} onClick={handleDelete}>Delete</button>
      <button style={styles.multiBarCancelBtn} onClick={clearCardSelection}>Cancel</button>
    </div>
  );
}

function ProjectTitle({ projects, activeProject, onSelect, onManage }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handle = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button style={styles.titleBtn} onClick={() => setOpen(!open)}>
        <span>{activeProject?.name || 'Select Project'}</span>
        <span style={styles.titleChevron}>{open ? '\u25b2' : '\u25bc'}</span>
      </button>
      {open && (
        <div style={styles.projectDropdown}>
          {projects.map(p => (
            <button
              key={p.id}
              style={{
                ...styles.projectOption,
                ...(p.id === activeProject?.id ? styles.projectOptionActive : {}),
              }}
              onClick={() => { onSelect(p.id); setOpen(false); }}
            >
              <span style={styles.projectOptionName}>{p.name}</span>
              {p.working_dir && (
                <span style={styles.projectOptionDir}>{p.working_dir}</span>
              )}
            </button>
          ))}
          <div style={styles.projectDivider} />
          <button style={styles.projectManageBtn} onClick={() => { setOpen(false); onManage(); }}>
            Manage Projects...
          </button>
        </div>
      )}
    </div>
  );
}

function DreamingIndicator() {
  return (
    <span style={styles.dreamBadge} title="Consolidating project memory...">
      <span style={styles.dreamIcon}>🌙</span>
      <span>Dreaming</span>
    </span>
  );
}

function PoolBadge({ status }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const tasks = useStore(s => s.tasks);

  useEffect(() => {
    if (!open) return;
    const handle = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  if (status.maxConcurrency === null) return null;

  const running = status.running?.length || 0;
  const queued = status.queued?.length || 0;
  const runningTasks = (status.running || []).map(id => tasks[id]).filter(Boolean);

  return (
    <span ref={ref} style={{ position: 'relative' }}>
      <span
        style={{ ...styles.badge, cursor: running > 0 ? 'pointer' : 'default' }}
        onClick={() => running > 0 && setOpen(o => !o)}
      >
        {running}/{status.maxConcurrency} running
        {queued > 0 && ` | ${queued} queued`}
      </span>
      {open && runningTasks.length > 0 && (
        <div style={styles.poolDropdown}>
          <div style={styles.poolDropdownHeader}>Running Tasks</div>
          {runningTasks.map(task => (
            <div key={task.id} style={styles.poolDropdownItem}>
              <span style={styles.poolDropdownDot} />
              <span style={styles.poolDropdownTitle}>{task.title}</span>
            </div>
          ))}
        </div>
      )}
    </span>
  );
}

const styles = {
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 20px',
    background: 'var(--bg-surface)',
    boxShadow: 'var(--shadow-md)',
    flexShrink: 0,
    zIndex: 10,
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
  },
  titleBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: 18,
    fontWeight: 600,
    color: 'var(--text-primary)',
    padding: '4px 0',
  },
  titleChevron: {
    fontSize: 10,
    color: 'var(--text-muted)',
  },
  projectDropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    marginTop: 6,
    minWidth: 240,
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    boxShadow: 'var(--shadow-lg)',
    zIndex: 100,
    overflow: 'hidden',
  },
  projectOption: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    width: '100%',
    padding: '8px 14px',
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    fontSize: 13,
    color: 'var(--text-secondary)',
    textAlign: 'left',
    gap: 1,
  },
  projectOptionActive: {
    background: 'var(--blue-bg)',
    color: 'var(--blue)',
    fontWeight: 500,
  },
  projectOptionName: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    width: '100%',
  },
  projectOptionDir: {
    fontSize: 11,
    color: 'var(--text-muted)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    width: '100%',
  },
  projectDivider: {
    height: 1,
    background: 'var(--border)',
  },
  projectManageBtn: {
    width: '100%',
    padding: '8px 14px',
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    fontSize: 13,
    color: 'var(--purple)',
    textAlign: 'left',
    fontWeight: 500,
  },
  title: {
    fontSize: 18,
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  dreamBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    fontSize: 12,
    padding: '4px 10px',
    borderRadius: 12,
    background: 'var(--purple-light-bg)',
    color: 'var(--purple)',
    border: '1px solid var(--purple-border)',
    animation: 'pulse 2s ease-in-out infinite',
  },
  dreamIcon: {
    fontSize: 14,
  },
  badge: {
    fontSize: 12,
    padding: '4px 10px',
    borderRadius: 12,
    background: 'var(--blue-bg)',
    color: 'var(--blue)',
    border: '1px solid var(--blue-border)',
  },
  themeBtn: {
    padding: '6px 10px',
    borderRadius: 6,
    border: '1px solid var(--border)',
    background: 'var(--bg-surface)',
    fontSize: 16,
    cursor: 'pointer',
    lineHeight: 1,
  },
  btn: {
    padding: '6px 14px',
    borderRadius: 6,
    border: '1px solid var(--border)',
    background: 'var(--bg-surface)',
    color: 'var(--text-secondary)',
    fontSize: 13,
    cursor: 'pointer',
  },
  btnPrimary: {
    background: 'var(--green)',
    borderColor: 'var(--green-dark)',
    color: 'var(--text-on-accent)',
  },
  body: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  },
  poolDropdown: {
    position: 'absolute',
    top: 'calc(100% + 6px)',
    right: 0,
    minWidth: 220,
    maxWidth: 320,
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: 8,
    boxShadow: 'var(--shadow-lg)',
    zIndex: 100,
    padding: '4px 0',
  },
  poolDropdownHeader: {
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    padding: '6px 12px 4px',
  },
  poolDropdownItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '6px 12px',
    fontSize: 13,
    color: 'var(--text-primary)',
  },
  poolDropdownDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: 'var(--green)',
    flexShrink: 0,
  },
  poolDropdownTitle: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  multiBar: {
    position: 'fixed',
    bottom: 24,
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 20px',
    borderRadius: 12,
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    boxShadow: 'var(--shadow-lg, 0 8px 32px rgba(0,0,0,0.2))',
    zIndex: 50,
  },
  multiBarText: {
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--text-primary)',
  },
  multiBarBtn: {
    padding: '6px 14px',
    borderRadius: 6,
    border: '1px solid var(--blue-border)',
    background: 'var(--blue-bg)',
    color: 'var(--blue)',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
  },
  multiBarDeleteBtn: {
    background: 'var(--red-alpha, rgba(248,81,73,0.1))',
    borderColor: 'var(--red)',
    color: 'var(--red)',
  },
  multiBarCancelBtn: {
    padding: '6px 14px',
    borderRadius: 6,
    border: '1px solid var(--border)',
    background: 'var(--bg-elevated)',
    color: 'var(--text-muted)',
    fontSize: 13,
    cursor: 'pointer',
  },
};
