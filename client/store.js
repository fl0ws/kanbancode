import { create } from 'zustand';

const COLUMN_ORDER = ['not_started', 'claude', 'your_turn', 'done'];

function buildColumns(tasks) {
  const cols = { not_started: [], claude: [], your_turn: [], done: [] };
  for (const task of tasks) {
    if (cols[task.column]) {
      cols[task.column].push(task.id);
    }
  }
  // Sort each column by position
  for (const col of COLUMN_ORDER) {
    cols[col].sort((a, b) => {
      const ta = tasks.find(t => t.id === a);
      const tb = tasks.find(t => t.id === b);
      return (ta?.position || 0) - (tb?.position || 0);
    });
  }
  return cols;
}

export const useStore = create((set, get) => ({
  tasks: {},
  columns: { not_started: [], claude: [], your_turn: [], done: [] },
  selectedTaskId: null,
  selectedCardIds: new Set(),
  liveOutput: {},
  pendingQuestions: {}, // taskId -> questions array
  poolStatus: { running: [], queued: [], maxConcurrency: null },
  isDreaming: false,
  projects: [],
  activeProjectId: localStorage.getItem('kanban_active_project') || null,
  notifications: [],
  notificationSoundEnabled: localStorage.getItem('kanban_notification_sound') !== 'false',

  setProjects(projects) {
    set({ projects });
  },

  setActiveProject(id) {
    localStorage.setItem('kanban_active_project', id || '');
    set({ activeProjectId: id, selectedTaskId: null });
  },

  // Hydrate from server
  setTasks(taskList) {
    const tasks = {};
    const pendingQuestions = {};
    for (const t of taskList) {
      tasks[t.id] = t;
      // Restore pending questions from DB
      if (t.pending_questions) {
        pendingQuestions[t.id] = t.pending_questions;
      }
    }
    set(state => ({
      tasks,
      columns: buildColumns(taskList),
      pendingQuestions: { ...state.pendingQuestions, ...pendingQuestions },
    }));
  },

  addTask(task) {
    set(state => {
      const tasks = { ...state.tasks, [task.id]: task };
      const cols = { ...state.columns };
      if (!cols[task.column].includes(task.id)) {
        cols[task.column] = [...cols[task.column], task.id];
      }
      return { tasks, columns: cols };
    });
  },

  updateTask(task) {
    set(state => ({
      tasks: { ...state.tasks, [task.id]: task },
    }));
  },

  moveTask(task, from, to) {
    set(state => {
      const tasks = { ...state.tasks, [task.id]: task };
      const cols = { ...state.columns };
      cols[from] = cols[from].filter(id => id !== task.id);
      if (!cols[to].includes(task.id)) {
        cols[to] = [...cols[to], task.id];
      }
      return { tasks, columns: cols };
    });
  },

  deleteTask(id) {
    set(state => {
      const { [id]: _, ...tasks } = state.tasks;
      const cols = {};
      for (const col of COLUMN_ORDER) {
        cols[col] = state.columns[col].filter(tid => tid !== id);
      }
      return {
        tasks,
        columns: cols,
        selectedTaskId: state.selectedTaskId === id ? null : state.selectedTaskId,
      };
    });
  },

  archiveTask(id) {
    set(state => {
      const { [id]: _, ...tasks } = state.tasks;
      const cols = {};
      for (const col of COLUMN_ORDER) {
        cols[col] = state.columns[col].filter(tid => tid !== id);
      }
      return {
        tasks,
        columns: cols,
        selectedTaskId: state.selectedTaskId === id ? null : state.selectedTaskId,
      };
    });
  },

  unarchiveTask(task) {
    set(state => {
      const tasks = { ...state.tasks, [task.id]: task };
      const cols = { ...state.columns };
      if (!cols[task.column].includes(task.id)) {
        cols[task.column] = [...cols[task.column], task.id];
      }
      return { tasks, columns: cols };
    });
  },

  reorderColumn(column, ids) {
    set(state => ({
      columns: { ...state.columns, [column]: ids },
    }));
  },

  appendOutput(taskId, text) {
    set(state => ({
      liveOutput: {
        ...state.liveOutput,
        [taskId]: (state.liveOutput[taskId] || '') + text,
      },
    }));
  },

  setOutput(taskId, text) {
    set(state => ({
      liveOutput: { ...state.liveOutput, [taskId]: text },
    }));
  },

  clearOutput(taskId) {
    set(state => {
      const { [taskId]: _, ...rest } = state.liveOutput;
      return { liveOutput: rest };
    });
  },

  setPendingQuestions(taskId, questions) {
    set(state => ({
      pendingQuestions: { ...state.pendingQuestions, [taskId]: questions },
    }));
  },

  clearPendingQuestions(taskId) {
    set(state => {
      const { [taskId]: _, ...rest } = state.pendingQuestions;
      return { pendingQuestions: rest };
    });
  },

  setSelectedTask(id) {
    set({ selectedTaskId: id, selectedCardIds: new Set() });
  },

  toggleCardSelection(id) {
    set(state => {
      const next = new Set(state.selectedCardIds);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { selectedCardIds: next };
    });
  },

  clearCardSelection() {
    set({ selectedCardIds: new Set() });
  },

  setPoolStatus(status) {
    set({ poolStatus: status });
  },

  setDreaming(isDreaming) {
    set({ isDreaming });
  },

  // Optimistic drag-and-drop
  optimisticMove(taskId, fromCol, toCol, toIndex) {
    set(state => {
      const cols = { ...state.columns };
      cols[fromCol] = cols[fromCol].filter(id => id !== taskId);
      const target = [...cols[toCol]];
      target.splice(toIndex, 0, taskId);
      cols[toCol] = target;

      const task = { ...state.tasks[taskId], column: toCol, position: toIndex };
      return {
        columns: cols,
        tasks: { ...state.tasks, [taskId]: task },
      };
    });
  },

  addNotification(notification) {
    set(state => ({
      notifications: [
        { id: Date.now() + Math.random(), read: false, timestamp: Date.now(), ...notification },
        ...state.notifications,
      ].slice(0, 50), // keep last 50
    }));
  },

  markNotificationRead(id) {
    set(state => ({
      notifications: state.notifications.map(n => n.id === id ? { ...n, read: true } : n),
    }));
  },

  markAllNotificationsRead() {
    set(state => ({
      notifications: state.notifications.map(n => ({ ...n, read: true })),
    }));
  },

  clearNotifications() {
    set({ notifications: [] });
  },

  setNotificationSoundEnabled(enabled) {
    localStorage.setItem('kanban_notification_sound', String(enabled));
    set({ notificationSoundEnabled: enabled });
  },

  addActivity(taskId, entry) {
    set(state => {
      const task = state.tasks[taskId];
      if (!task) return state;
      return {
        tasks: {
          ...state.tasks,
          [taskId]: {
            ...task,
            activity_log: [...(task.activity_log || []), entry],
          },
        },
      };
    });
  },
}));
