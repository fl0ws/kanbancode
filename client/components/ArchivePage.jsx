import React, { useState, useEffect, useCallback } from 'react';
import {
  fetchArchived, unarchiveTask, deleteTask,
  fetchArchivedProjects, unarchiveProject, deleteProject,
} from '../api.js';
import { useStore } from '../store.js';

const PAGE_SIZE = 10;

export default function ArchivePage() {
  const activeProjectId = useStore(s => s.activeProjectId);
  const projects = useStore(s => s.projects);
  const setProjects = useStore(s => s.setProjects);

  // Task archive state
  const [taskQuery, setTaskQuery] = useState('');
  const [tasks, setTasks] = useState([]);
  const [tasksLoading, setTasksLoading] = useState(true);

  // Project archive state
  const [projectQuery, setProjectQuery] = useState('');
  const [projectPage, setProjectPage] = useState(0);
  const [projectData, setProjectData] = useState({ rows: [], total: 0 });
  const [projectsLoading, setProjectsLoading] = useState(true);

  // Task loader
  const loadTasks = useCallback(async (q) => {
    setTasksLoading(true);
    try {
      const data = await fetchArchived(q, activeProjectId);
      setTasks(data);
    } catch {
      setTasks([]);
    } finally {
      setTasksLoading(false);
    }
  }, [activeProjectId]);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  // Debounce task search
  useEffect(() => {
    const t = setTimeout(() => loadTasks(taskQuery), 200);
    return () => clearTimeout(t);
  }, [taskQuery, loadTasks]);

  // Project loader
  const loadProjects = useCallback(async () => {
    setProjectsLoading(true);
    try {
      const data = await fetchArchivedProjects(projectQuery, PAGE_SIZE, projectPage * PAGE_SIZE);
      setProjectData(data);
    } catch {
      setProjectData({ rows: [], total: 0 });
    } finally {
      setProjectsLoading(false);
    }
  }, [projectQuery, projectPage]);

  useEffect(() => { loadProjects(); }, [loadProjects]);

  // Reset page on search change, debounce
  useEffect(() => {
    const t = setTimeout(() => { setProjectPage(0); loadProjects(); }, 200);
    return () => clearTimeout(t);
  }, [projectQuery]);

  // Task actions
  async function handleRestoreTask(id) {
    await unarchiveTask(id);
    setTasks(tasks.filter(t => t.id !== id));
  }

  async function handleDeleteTask(id) {
    if (!confirm('Permanently delete this task?')) return;
    await deleteTask(id);
    setTasks(tasks.filter(t => t.id !== id));
  }

  // Project actions
  async function handleRestoreProject(project) {
    const restored = await unarchiveProject(project.id);
    setProjects([...projects, restored]);
    loadProjects();
  }

  async function handleDeleteProject(id) {
    if (!confirm('Permanently delete this project and ALL its tasks? This cannot be undone.')) return;
    await deleteProject(id);
    loadProjects();
  }

  const totalProjectPages = Math.ceil(projectData.total / PAGE_SIZE);

  return (
    <div style={styles.container}>
      {/* Tasks section */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <h2 style={styles.sectionTitle}>Archived Tasks</h2>
          <div style={styles.searchBox}>
            <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--text-muted)' }}>search</span>
            <input
              style={styles.searchInput}
              value={taskQuery}
              onChange={e => setTaskQuery(e.target.value)}
              placeholder="Search archived tasks..."
            />
          </div>
        </div>

        <div style={styles.list}>
          {tasksLoading && tasks.length === 0 && (
            <div style={styles.emptyState}><span style={styles.empty}>Loading...</span></div>
          )}
          {!tasksLoading && tasks.length === 0 && (
            <div style={styles.emptyState}>
              <span className="material-symbols-outlined" style={{ fontSize: 36, color: 'var(--text-muted)', marginBottom: 8 }}>inventory_2</span>
              <span style={styles.emptyTitle}>{taskQuery ? 'No matches' : 'No archived tasks'}</span>
              <span style={styles.emptyDesc}>{taskQuery ? 'Try a different search' : 'Tasks you archive will appear here'}</span>
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
                <button style={styles.restoreBtn} onClick={() => handleRestoreTask(task.id)} title="Restore to Not Started">
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>unarchive</span>
                  Restore
                </button>
                <button style={styles.deleteBtn} onClick={() => handleDeleteTask(task.id)} title="Permanently delete">
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Projects section */}
      <div style={styles.section}>
        <div style={styles.sectionHeader}>
          <h2 style={styles.sectionTitle}>Archived Projects</h2>
          <div style={styles.searchBox}>
            <span className="material-symbols-outlined" style={{ fontSize: 16, color: 'var(--text-muted)' }}>search</span>
            <input
              style={styles.searchInput}
              value={projectQuery}
              onChange={e => setProjectQuery(e.target.value)}
              placeholder="Search archived projects..."
            />
          </div>
        </div>

        <div style={styles.list}>
          {projectsLoading && projectData.rows.length === 0 && (
            <div style={styles.emptyState}><span style={styles.empty}>Loading...</span></div>
          )}
          {!projectsLoading && projectData.rows.length === 0 && (
            <div style={styles.emptyState}>
              <span className="material-symbols-outlined" style={{ fontSize: 36, color: 'var(--text-muted)', marginBottom: 8 }}>folder_off</span>
              <span style={styles.emptyTitle}>{projectQuery ? 'No matches' : 'No archived projects'}</span>
              <span style={styles.emptyDesc}>{projectQuery ? 'Try a different search' : 'Projects you archive will appear here'}</span>
            </div>
          )}
          {projectData.rows.map(project => (
            <div key={project.id} style={styles.item}>
              <div style={styles.itemContent}>
                <span style={styles.title}>{project.name}</span>
                {project.working_dir && <span style={styles.projectDir}>{project.working_dir}</span>}
              </div>
              <div style={styles.actions}>
                <button style={styles.restoreBtn} onClick={() => handleRestoreProject(project)} title="Restore project">
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>unarchive</span>
                  Restore
                </button>
                <button style={styles.deleteBtn} onClick={() => handleDeleteProject(project.id)} title="Permanently delete">
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span>
                </button>
              </div>
            </div>
          ))}
        </div>

        {totalProjectPages > 1 && (
          <div style={styles.pagination}>
            <button
              style={styles.pageBtn}
              onClick={() => setProjectPage(p => Math.max(0, p - 1))}
              disabled={projectPage === 0}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>chevron_left</span>
            </button>
            <span style={styles.pageInfo}>
              Page {projectPage + 1} of {totalProjectPages} · {projectData.total} total
            </span>
            <button
              style={styles.pageBtn}
              onClick={() => setProjectPage(p => Math.min(totalProjectPages - 1, p + 1))}
              disabled={projectPage >= totalProjectPages - 1}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>chevron_right</span>
            </button>
          </div>
        )}
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
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 28,
  },
  section: {
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
  searchBox: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '6px 12px',
    background: 'var(--bg-surface)',
    borderRadius: 'var(--radius-lg)',
    width: 240,
  },
  searchInput: {
    flex: 1,
    border: 'none',
    background: 'none',
    color: 'var(--text-primary)',
    fontSize: 'var(--fs-body)',
    outline: 'none',
    fontFamily: 'inherit',
  },
  list: {
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
  projectDir: {
    fontSize: 'var(--fs-small)',
    color: 'var(--text-muted)',
    fontFamily: "'Cascadia Code', 'Fira Code', monospace",
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
  pagination: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginTop: 14,
  },
  pageBtn: {
    width: 32,
    height: 32,
    borderRadius: 'var(--radius-sm)',
    border: 'none',
    background: 'var(--bg-surface)',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pageInfo: {
    fontSize: 'var(--fs-small)',
    color: 'var(--text-muted)',
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
  empty: {
    color: 'var(--text-muted)',
    fontSize: 'var(--fs-body)',
    textAlign: 'center',
    padding: 24,
  },
};
