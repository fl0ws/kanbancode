import React, { useEffect, useState } from 'react';
import { useStore } from './store.js';
import { useWebSocket } from './hooks/useWebSocket.js';
import { fetchTasks, fetchPoolStatus, fetchProjects } from './api.js';
import Board from './components/Board.jsx';
import TaskDetail from './components/TaskDetail.jsx';
import CreateTaskModal from './components/CreateTaskModal.jsx';
import ArchiveModal from './components/ArchiveModal.jsx';
import ConcurrencyPrompt from './components/ConcurrencyPrompt.jsx';
import SettingsModal from './components/SettingsModal.jsx';
import ProjectSelector from './components/ProjectSelector.jsx';
import ManageProjectsModal from './components/ManageProjectsModal.jsx';

export default function App() {
  const [showCreate, setShowCreate] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showManageProjects, setShowManageProjects] = useState(false);
  const selectedTaskId = useStore(s => s.selectedTaskId);
  const poolStatus = useStore(s => s.poolStatus);
  const isDreaming = useStore(s => s.isDreaming);
  const activeProjectId = useStore(s => s.activeProjectId);
  const setTasks = useStore(s => s.setTasks);
  const setPoolStatus = useStore(s => s.setPoolStatus);
  const setProjects = useStore(s => s.setProjects);
  const setActiveProject = useStore(s => s.setActiveProject);

  useWebSocket();

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
          <h1 style={styles.title}>Claude Code Kanban</h1>
          <ProjectSelector onManage={() => setShowManageProjects(true)} />
        </div>
        <div style={styles.headerRight}>
          {isDreaming && <DreamingIndicator />}
          <PoolBadge status={poolStatus} />
          <button style={styles.btn} onClick={() => setShowSettings(true)}>Settings</button>
          <button style={styles.btn} onClick={() => setShowArchive(true)}>Archive</button>
          <button style={{ ...styles.btn, ...styles.btnPrimary }} onClick={() => setShowCreate(true)}>+ New Task</button>
        </div>
      </header>

      <div style={styles.body}>
        <div style={{ flex: 1, overflow: 'hidden' }}>
          <Board onAddTask={() => setShowCreate(true)} />
        </div>
        {selectedTaskId && (
          <TaskDetail taskId={selectedTaskId} />
        )}
      </div>

      {showCreate && <CreateTaskModal onClose={() => setShowCreate(false)} />}
      {showArchive && <ArchiveModal onClose={() => setShowArchive(false)} />}
      {showSettings && <SettingsModal onClose={() => setShowSettings(false)} />}
      {showManageProjects && <ManageProjectsModal onClose={() => setShowManageProjects(false)} />}
      {showConcurrencyPrompt && <ConcurrencyPrompt />}
    </>
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
  if (status.maxConcurrency === null) return null;
  const running = status.running?.length || 0;
  const queued = status.queued?.length || 0;
  return (
    <span style={styles.badge}>
      {running}/{status.maxConcurrency} running
      {queued > 0 && ` | ${queued} queued`}
    </span>
  );
}

const styles = {
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 20px',
    background: '#FFFFFF',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
    flexShrink: 0,
    zIndex: 10,
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: 600,
    color: '#212121',
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
    background: '#F3E5F5',
    color: '#7B1FA2',
    border: '1px solid #CE93D8',
    animation: 'pulse 2s ease-in-out infinite',
  },
  dreamIcon: {
    fontSize: 14,
  },
  badge: {
    fontSize: 12,
    padding: '4px 10px',
    borderRadius: 12,
    background: '#E3F2FD',
    color: '#1976D2',
    border: '1px solid #BBDEFB',
  },
  btn: {
    padding: '6px 14px',
    borderRadius: 6,
    border: '1px solid #E0E0E0',
    background: '#FFFFFF',
    color: '#424242',
    fontSize: 13,
    cursor: 'pointer',
  },
  btnPrimary: {
    background: '#4CAF50',
    borderColor: '#43A047',
    color: '#fff',
  },
  body: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  },
};
