import React, { useEffect, useState, useRef } from 'react';
import { useStore } from './store.js';
import { useWebSocket } from './hooks/useWebSocket.js';
import { useTheme } from './hooks/useTheme.js';
import { fetchTasks, fetchPoolStatus, fetchProjects, archiveTask } from './api.js';
import Board from './components/Board.jsx';
import TaskDetail from './components/TaskDetail.jsx';
import CreateTaskModal from './components/CreateTaskModal.jsx';
import ArchivePage from './components/ArchivePage.jsx';
import ConcurrencyPrompt from './components/ConcurrencyPrompt.jsx';
import SettingsModal from './components/SettingsModal.jsx';
import ManageProjectsModal from './components/ManageProjectsModal.jsx';
import QuickQuestion from './components/QuickQuestion.jsx';
import ManageCommandsModal from './components/ManageCommandsModal.jsx';
import NotificationBell from './components/NotificationBell.jsx';
import VelocityInsights from './components/VelocityInsights.jsx';
import KeyboardShortcutsModal from './components/KeyboardShortcutsModal.jsx';
import UsageBars from './components/UsageBars.jsx';

function useZoom() {
  const [zoom, setZoom] = useState(() => Number(localStorage.getItem('kanban_zoom')) || 100);
  useEffect(() => {
    document.getElementById('root').style.zoom = (zoom / 100).toString();
    localStorage.setItem('kanban_zoom', String(zoom));
  }, [zoom]);
  return { zoom, setZoom };
}

export default function App() {
  const [activePage, setActivePage] = useState('board');
  const [showCreate, setShowCreate] = useState(false);
  const [createDraft, setCreateDraft] = useState({ title: '', description: '' });
  const [showCommands, setShowCommands] = useState(false);
  const [showQuickQuestion, setShowQuickQuestion] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showManageProjects, setShowManageProjects] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [toast, setToast] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => localStorage.getItem('kanban_sidebar_collapsed') === 'true');
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
  const { zoom, setZoom } = useZoom();

  useWebSocket();

  const clearCardSelection = useStore(s => s.clearCardSelection);

  // Keyboard shortcuts
  useEffect(() => {
    function handleKeyDown(e) {
      // Ignore shortcuts when typing in inputs/textareas
      const tag = e.target.tagName;
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable;

      if (e.ctrlKey && e.code === 'Space') {
        e.preventDefault();
        setShowQuickQuestion(prev => !prev);
      }
      if (e.key === 'Escape') {
        // TaskDetail handles its own Escape with animation
        if (!useStore.getState().selectedTaskId) {
          clearCardSelection();
        }
      }
      if (!isInput && !e.ctrlKey && !e.metaKey) {
        if (e.key === '?') {
          e.preventDefault();
          setShowShortcuts(prev => !prev);
        }
        if (e.key === 'n' || e.key === 'N') {
          e.preventDefault();
          setShowCreate(true);
        }
        if (e.key === 'Delete' || e.key === 'Backspace') {
          const s = useStore.getState();
          const ids = s.selectedCardIds.size > 0 ? [...s.selectedCardIds] : [];
          if (ids.length > 0) {
            e.preventDefault();
            if (confirm(`Permanently delete ${ids.length} task${ids.length > 1 ? 's' : ''}?`)) {
              import('./api.js').then(({ deleteTask }) => {
                Promise.all(ids.map(id => deleteTask(id).catch(() => {}))).then(() => {
                  s.clearCardSelection();
                });
              });
            }
          }
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Load projects on mount
  useEffect(() => {
    fetchProjects().then(projects => {
      setProjects(projects);
      const stored = localStorage.getItem('kanban_active_project');
      if (!stored || !projects.find(p => p.id === stored)) {
        if (projects.length > 0) {
          setActiveProject(projects[0].id);
        }
      }
    });
    fetchPoolStatus().then(setPoolStatus);
  }, []);

  // Reload tasks and update title when active project changes
  useEffect(() => {
    if (activeProjectId) {
      fetchTasks(activeProjectId).then(setTasks);
    }
    document.title = activeProject ? `CCK: ${activeProject.name}` : 'Claude Code Kanban';
  }, [activeProjectId, activeProject?.name]);

  function toggleSidebar() {
    setSidebarCollapsed(prev => {
      localStorage.setItem('kanban_sidebar_collapsed', String(!prev));
      return !prev;
    });
  }

  function showToast(text, type = 'success') {
    setToast({ text, type, id: Date.now() });
    setTimeout(() => setToast(null), 3000);
  }

  const showConcurrencyPrompt = poolStatus.maxConcurrency === null;

  return (
    <div style={styles.appLayout}>
      {/* ═══ Sidebar ═══ */}
      <aside style={{
        ...styles.sidebar,
        width: sidebarCollapsed ? 60 : 'var(--sidebar-width)',
        padding: sidebarCollapsed ? '24px 8px' : '24px 16px',
      }}>
        {/* Brand */}
        <div style={{ ...styles.brand, justifyContent: sidebarCollapsed ? 'center' : 'flex-start' }}>
          <div style={styles.brandIcon}>
            <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--text-on-accent)', fontVariationSettings: "'FILL' 1" }}>grid_view</span>
          </div>
          {!sidebarCollapsed && (
            <div>
              <div style={styles.brandTitle}>Claude Code</div>
              <div style={styles.brandSub}>KANBAN</div>
            </div>
          )}
        </div>

        {/* New Task CTA */}
        <button
          style={{
            ...styles.newTaskBtn,
            padding: sidebarCollapsed ? '10px 0' : '12px 16px',
          }}
          onClick={() => setShowCreate(true)}
          title="New Task"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>add</span>
          {!sidebarCollapsed && 'New Task'}
        </button>

        {/* Navigation */}
        <nav style={styles.nav}>
          <NavItem icon="dashboard" label="Board" active={activePage === 'board'} filled onClick={() => setActivePage('board')} collapsed={sidebarCollapsed} />
          <NavItem icon="analytics" label="Analytics" active={activePage === 'analytics'} filled onClick={() => setActivePage('analytics')} collapsed={sidebarCollapsed} />
          <NavItem icon="inventory_2" label="Archive" active={activePage === 'archive'} filled onClick={() => setActivePage('archive')} collapsed={sidebarCollapsed} />
          <NavItem icon="terminal" label="Commands" onClick={() => setShowCommands(true)} collapsed={sidebarCollapsed} />
        </nav>

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        {/* Usage Bars */}
        <UsageBars collapsed={sidebarCollapsed} />

        {/* Pool Status Widget */}
        <PoolWidget status={poolStatus} collapsed={sidebarCollapsed} />

        {/* Dreaming indicator */}
        {isDreaming && <DreamingIndicator collapsed={sidebarCollapsed} />}

        {/* Collapse toggle */}
        <button style={styles.collapseBtn} onClick={toggleSidebar} title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>
            {sidebarCollapsed ? 'chevron_right' : 'chevron_left'}
          </span>
        </button>
      </aside>

      {/* ═══ Main Content ═══ */}
      <main style={styles.main}>
        {/* Top Bar */}
        <header style={styles.topBar}>
          <div style={styles.topBarLeft}>
            <ProjectSelector
              projects={projects}
              activeProject={activeProject}
              onSelect={(id) => setActiveProject(id)}
              onManage={() => setShowManageProjects(true)}
            />
          </div>
          <div style={styles.topBarRight}>
            <NotificationBell />
            <button style={styles.iconBtn} onClick={() => setShowShortcuts(true)} title="Keyboard shortcuts (?)">
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>help</span>
            </button>
            <button style={styles.iconBtn} onClick={() => setShowSettings(true)} title="Settings">
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>settings</span>
            </button>
            <button style={styles.iconBtn} onClick={toggleTheme} title={theme === 'light' ? 'Dark mode' : 'Light mode'}>
              <span className="material-symbols-outlined" style={{ fontSize: 20 }}>{theme === 'light' ? 'dark_mode' : 'light_mode'}</span>
            </button>
          </div>
        </header>

        {activePage === 'board' && (
          <>
            <div style={styles.boardHeader}>
              <h1 style={styles.boardTitle}>{activeProject?.name || 'Kanban Board'}</h1>
              {activeProject?.working_dir && <p style={styles.boardSubtitle}>{activeProject.working_dir}</p>}
            </div>
            <div style={styles.boardArea}>
              <Board onAddTask={() => setShowCreate(true)} />
            </div>
          </>
        )}

        {activePage === 'analytics' && (
          <>
            <div style={styles.boardHeader}>
              <h1 style={styles.boardTitle}>Analytics</h1>
              <p style={styles.boardSubtitle}>{activeProject?.name || 'All projects'}</p>
            </div>
            <div style={styles.boardArea}>
              <VelocityInsights />
            </div>
          </>
        )}

        {activePage === 'archive' && (
          <>
            <div style={styles.boardHeader}>
              <h1 style={styles.boardTitle}>Archive</h1>
              <p style={styles.boardSubtitle}>Archived tasks from {activeProject?.name || 'all projects'}</p>
            </div>
            <div style={styles.boardArea}>
              <ArchivePage />
            </div>
          </>
        )}
      </main>

      {/* ═══ Overlays ═══ */}
      {selectedTaskId && <TaskDetail taskId={selectedTaskId} />}
      {showCreate && <CreateTaskModal onClose={() => setShowCreate(false)} draft={createDraft} setDraft={setCreateDraft} />}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} onSaved={() => { setShowSettings(false); showToast('Settings saved'); }} zoom={zoom} setZoom={setZoom} />}
      {showManageProjects && <ManageProjectsModal onClose={() => setShowManageProjects(false)} />}
      {showCommands && <ManageCommandsModal onClose={() => setShowCommands(false)} />}
      {showQuickQuestion && <QuickQuestion onClose={() => setShowQuickQuestion(false)} />}
      {showConcurrencyPrompt && <ConcurrencyPrompt />}
      {showShortcuts && <KeyboardShortcutsModal onClose={() => setShowShortcuts(false)} />}
      <MultiSelectBar />
      {toast && <Toast text={toast.text} type={toast.type} />}
    </div>
  );
}

function Toast({ text, type }) {
  return (
    <div style={{
      position: 'fixed',
      bottom: 24,
      left: '50%',
      transform: 'translateX(-50%)',
      padding: '10px 20px',
      borderRadius: 'var(--radius-lg)',
      background: type === 'error' ? 'var(--red)' : 'var(--green)',
      color: '#fff',
      fontSize: 13,
      fontWeight: 600,
      fontFamily: 'var(--font-headline)',
      boxShadow: 'var(--shadow-lg)',
      zIndex: 300,
      display: 'flex',
      alignItems: 'center',
      gap: 8,
      animation: 'toast-in 0.25s ease',
    }}>
      <span className="material-symbols-outlined" style={{ fontSize: 18, fontVariationSettings: "'FILL' 1" }}>
        {type === 'error' ? 'error' : 'check_circle'}
      </span>
      {text}
    </div>
  );
}

function NavItem({ icon, label, active, filled, onClick, collapsed }) {
  return (
    <button
      style={{
        ...styles.navItem,
        ...(active ? styles.navItemActive : {}),
        justifyContent: collapsed ? 'center' : 'flex-start',
        padding: collapsed ? '10px 0' : '10px 14px',
      }}
      onClick={onClick}
      title={collapsed ? label : undefined}
    >
      <span className="material-symbols-outlined" style={{
        fontSize: 20,
        fontVariationSettings: filled && active ? "'FILL' 1" : "'FILL' 0",
      }}>{icon}</span>
      {!collapsed && <span style={styles.navLabel}>{label}</span>}
    </button>
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

function ProjectSelector({ projects, activeProject, onSelect, onManage }) {
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
      <button style={styles.projectBtn} onClick={() => setOpen(!open)}>
        <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--green)' }}>folder</span>
        <span>{activeProject?.name || 'Select Project'}</span>
        <span className="material-symbols-outlined" style={{ fontSize: 14, color: 'var(--text-muted)' }}>expand_more</span>
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

function DreamingIndicator({ collapsed }) {
  return (
    <div style={{ ...styles.dreamBadge, justifyContent: collapsed ? 'center' : 'flex-start' }} title="Consolidating project memory...">
      <span style={{ fontSize: 14 }}>🌙</span>
      {!collapsed && <span style={{ fontSize: 11, fontWeight: 600 }}>Dreaming</span>}
    </div>
  );
}

function PoolWidget({ status, collapsed }) {
  const [open, setOpen] = useState(false);
  const [runningDetails, setRunningDetails] = useState([]);
  const ref = useRef(null);
  const projects = useStore(s => s.projects);

  useEffect(() => {
    if (!open) return;
    const handle = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  useEffect(() => {
    if (open && status.running?.length > 0) {
      Promise.all(
        status.running.map(id =>
          fetch(`/api/tasks/${id}`).then(r => r.ok ? r.json() : null).catch(() => null)
        )
      ).then(results => setRunningDetails(results.filter(Boolean)));
    }
  }, [open, status.running]);

  if (status.maxConcurrency === null) return null;

  const running = status.running?.length || 0;
  const queued = status.queued?.length || 0;
  const max = status.maxConcurrency || 1;

  function getProjectName(projectId) {
    const p = projects.find(p => p.id === projectId);
    return p?.name || '';
  }

  if (collapsed) {
    return (
      <div style={{ ...styles.poolWidget, padding: '10px 6px', alignItems: 'center' }} title={`${running}/${max} running${queued > 0 ? `, ${queued} queued` : ''}`}>
        <div style={styles.poolDot} />
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>{running}/{max}</span>
        <div style={{ ...styles.poolTrack, marginTop: 4 }}>
          <div style={{ ...styles.poolBar, width: `${(running / max) * 100}%` }} />
        </div>
      </div>
    );
  }

  return (
    <div ref={ref} style={styles.poolWidget}>
      <div
        style={{ ...styles.poolHeader, cursor: running > 0 ? 'pointer' : 'default' }}
        onClick={() => running > 0 && setOpen(o => !o)}
      >
        <div style={styles.poolDot} />
        <span style={styles.poolLabel}>Worker Pool</span>
      </div>
      <div style={styles.poolRow}>
        <span style={styles.poolRowLabel}>Running</span>
        <span style={styles.poolRowValue}>{running} / {max}</span>
      </div>
      {queued > 0 && (
        <div style={styles.poolRow}>
          <span style={styles.poolRowLabel}>Queued</span>
          <span style={styles.poolRowValue}>{queued}</span>
        </div>
      )}
      <div style={styles.poolTrack}>
        <div style={{ ...styles.poolBar, width: `${(running / max) * 100}%` }} />
      </div>
      {open && runningDetails.length > 0 && (
        <div style={styles.poolDropdown}>
          <div style={styles.poolDropdownHeader}>Running Tasks</div>
          {runningDetails.map(task => (
            <div key={task.id} style={styles.poolDropdownItem}>
              <div style={styles.poolDropdownItemDot} />
              <div style={styles.poolDropdownInfo}>
                <span style={styles.poolDropdownTitle}>{task.title}</span>
                {task.project_id && (
                  <span style={styles.poolDropdownProject}>{getProjectName(task.project_id)}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const styles = {
  // ── App Layout ──
  appLayout: {
    display: 'flex',
    height: '100vh',
    overflow: 'hidden',
  },

  // ── Sidebar ──
  sidebar: {
    width: 'var(--sidebar-width)',
    flexShrink: 0,
    background: 'var(--bg-sidebar)',
    display: 'flex',
    flexDirection: 'column',
    padding: '24px 16px',
    gap: 4,
    height: '100vh',
    zIndex: 40,
    transition: 'width 0.2s ease, padding 0.2s ease',
    overflow: 'hidden',
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '0 8px',
    marginBottom: 20,
  },
  brandIcon: {
    width: 32,
    height: 32,
    borderRadius: 'var(--radius-md)',
    background: 'linear-gradient(135deg, var(--green), var(--green-dark))',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandTitle: {
    fontFamily: 'var(--font-headline)',
    fontSize: 15,
    fontWeight: 700,
    color: 'var(--green)',
  },
  brandSub: {
    fontSize: 10,
    fontWeight: 600,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.1em',
  },
  newTaskBtn: {
    width: '100%',
    padding: '12px 16px',
    borderRadius: 'var(--radius-lg)',
    border: 'none',
    background: 'linear-gradient(135deg, var(--green), var(--green-dark))',
    color: 'var(--text-on-accent)',
    fontFamily: 'var(--font-headline)',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginBottom: 12,
    transition: 'transform 0.15s, opacity 0.15s',
  },
  nav: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 14px',
    borderRadius: 'var(--radius-lg)',
    border: 'none',
    background: 'none',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    transition: 'background 0.15s, color 0.15s',
    width: '100%',
    textAlign: 'left',
  },
  navItemActive: {
    background: 'var(--bg-highest)',
    color: 'var(--green)',
    fontWeight: 600,
  },
  navLabel: {
    fontSize: 13,
    fontFamily: 'var(--font-body)',
  },

  // ── Pool Widget ──
  poolWidget: {
    padding: '14px 16px',
    background: 'var(--bg-surface)',
    borderRadius: 'var(--radius-lg)',
    position: 'relative',
  },
  poolHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    marginBottom: 10,
  },
  poolDot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
    background: 'var(--tertiary)',
    animation: 'gentle-pulse 2.5s ease-in-out infinite',
  },
  poolLabel: {
    fontSize: 10,
    fontWeight: 700,
    color: 'var(--text-primary)',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
  },
  poolRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  poolRowLabel: {
    fontSize: 12,
    color: 'var(--text-secondary)',
  },
  poolRowValue: {
    fontSize: 12,
    fontWeight: 600,
    color: 'var(--text-primary)',
  },
  poolTrack: {
    marginTop: 8,
    width: '100%',
    height: 4,
    background: 'var(--bg-elevated)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  poolBar: {
    height: '100%',
    background: 'linear-gradient(90deg, var(--green), var(--tertiary))',
    borderRadius: 4,
    transition: 'width 0.3s ease',
  },
  poolDropdown: {
    marginTop: 10,
    paddingTop: 10,
    borderTop: '1px solid var(--border)',
  },
  poolDropdownHeader: {
    fontSize: 10,
    fontWeight: 700,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
    marginBottom: 6,
  },
  poolDropdownItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
    padding: '4px 0',
  },
  poolDropdownItemDot: {
    width: 5,
    height: 5,
    borderRadius: '50%',
    background: 'var(--green)',
    flexShrink: 0,
    marginTop: 5,
  },
  poolDropdownInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: 1,
    minWidth: 0,
  },
  poolDropdownTitle: {
    fontSize: 12,
    fontWeight: 500,
    color: 'var(--text-primary)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  poolDropdownProject: {
    fontSize: 10,
    color: 'var(--text-muted)',
  },
  dreamBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '10px 14px',
    borderRadius: 'var(--radius-lg)',
    background: 'var(--purple-light-bg)',
    color: 'var(--purple)',
    animation: 'gentle-pulse 3s ease-in-out infinite',
    marginTop: 6,
  },

  collapseBtn: {
    width: '100%',
    padding: '8px 0',
    marginTop: 8,
    border: 'none',
    background: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 'var(--radius-sm)',
    transition: 'color 0.15s',
  },

  // ── Main ──
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0,
    overflow: 'hidden',
  },
  topBar: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0 28px',
    height: 52,
    flexShrink: 0,
  },
  topBarLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  },
  topBarRight: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
  },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: '50%',
    border: 'none',
    background: 'none',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background 0.15s',
  },
  boardHeader: {
    padding: '8px 28px 16px',
  },
  boardTitle: {
    fontFamily: 'var(--font-headline)',
    fontSize: 32,
    fontWeight: 800,
    color: 'var(--text-primary)',
    letterSpacing: '-0.02em',
    lineHeight: 1.2,
    marginBottom: 4,
  },
  boardSubtitle: {
    fontSize: 13,
    color: 'var(--text-secondary)',
  },
  boardArea: {
    flex: 1,
    overflow: 'hidden',
  },

  // ── Project Selector ──
  projectBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 12px',
    borderRadius: 'var(--radius-lg)',
    border: 'none',
    background: 'var(--bg-sidebar)',
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--text-primary)',
    cursor: 'pointer',
    transition: 'background 0.15s',
  },
  projectDropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    marginTop: 4,
    minWidth: 240,
    background: 'var(--bg-surface)',
    borderRadius: 'var(--radius-lg)',
    boxShadow: 'var(--shadow-dropdown)',
    zIndex: 100,
    overflow: 'hidden',
    padding: '4px 0',
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
    transition: 'background 0.1s',
  },
  projectOptionActive: {
    background: 'var(--green-bg)',
    color: 'var(--green)',
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
    margin: '4px 0',
  },
  projectManageBtn: {
    width: '100%',
    padding: '8px 14px',
    border: 'none',
    background: 'none',
    cursor: 'pointer',
    fontSize: 13,
    color: 'var(--green)',
    textAlign: 'left',
    fontWeight: 500,
    transition: 'background 0.1s',
  },

  // ── Multi-select bar ──
  multiBar: {
    position: 'fixed',
    bottom: 24,
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '10px 20px',
    borderRadius: 'var(--radius-xl)',
    background: 'var(--bg-surface)',
    boxShadow: 'var(--shadow-lg)',
    zIndex: 50,
  },
  multiBarText: {
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--text-primary)',
  },
  multiBarBtn: {
    padding: '6px 14px',
    borderRadius: 'var(--radius-sm)',
    border: 'none',
    background: 'var(--green-bg)',
    color: 'var(--green)',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
  },
  multiBarDeleteBtn: {
    background: 'var(--red-alpha)',
    color: 'var(--red)',
  },
  multiBarCancelBtn: {
    padding: '6px 14px',
    borderRadius: 'var(--radius-sm)',
    border: 'none',
    background: 'var(--bg-elevated)',
    color: 'var(--text-muted)',
    fontSize: 13,
    cursor: 'pointer',
  },
};
