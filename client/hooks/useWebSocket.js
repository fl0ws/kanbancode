import { useEffect, useRef } from 'react';
import { useStore } from '../store.js';
import { fetchTasks, fetchProjects } from '../api.js';

export function useWebSocket() {
  const wsRef = useRef(null);
  const reconnectTimeout = useRef(null);
  const reconnectDelay = useRef(1000);

  const store = useStore;

  useEffect(() => {
    function connect() {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectDelay.current = 1000;
        // Re-sync state on connect/reconnect
        const projectId = store.getState().activeProjectId;
        if (projectId) {
          fetchTasks(projectId).then(tasks => {
            store.getState().setTasks(tasks);
          });
        }
      };

      ws.onmessage = (evt) => {
        try {
          const data = JSON.parse(evt.data);
          handleEvent(data);
          // Forward qq events to QuickQuestion component via custom event
          if (data.event?.startsWith('qq:')) {
            window.dispatchEvent(new MessageEvent('qq-ws-message', { data: evt.data }));
          }
        } catch {
          // ignore malformed messages
        }
      };

      ws.onclose = () => {
        scheduleReconnect();
      };

      ws.onerror = () => {
        ws.close();
      };
    }

    function scheduleReconnect() {
      if (reconnectTimeout.current) return;
      reconnectTimeout.current = setTimeout(() => {
        reconnectTimeout.current = null;
        reconnectDelay.current = Math.min(reconnectDelay.current * 2, 30000);
        connect();
      }, reconnectDelay.current);
    }

    function handleEvent(data) {
      const s = store.getState();
      const activeProjectId = s.activeProjectId;

      // Helper: check if a task belongs to the active project
      const isActiveProject = (task) => task?.project_id === activeProjectId;
      const isTaskInStore = (taskId) => !!s.tasks[taskId];

      switch (data.event) {
        case 'task:created':
          if (isActiveProject(data.task)) {
            s.addTask(data.task);
          }
          break;
        case 'task:updated':
          if (isActiveProject(data.task)) {
            s.updateTask(data.task);
          }
          break;
        case 'task:moved':
          if (isActiveProject(data.task)) {
            s.moveTask(data.task, data.from, data.to);
            if (data.to === 'claude') {
              s.clearOutput(data.task.id);
              s.clearPendingQuestions(data.task.id);
            }
          }
          break;
        case 'task:deleted':
          if (isTaskInStore(data.id)) {
            s.deleteTask(data.id);
          }
          break;
        case 'task:archived':
          if (isTaskInStore(data.id)) {
            s.archiveTask(data.id);
          }
          break;
        case 'task:unarchived':
          if (isActiveProject(data.task)) {
            s.unarchiveTask(data.task);
          }
          break;
        case 'task:activity':
          if (isTaskInStore(data.taskId)) {
            s.addActivity(data.taskId, data.entry);
          }
          break;
        case 'task:output':
          if (isTaskInStore(data.taskId)) {
            s.appendOutput(data.taskId, data.text);
          }
          break;
        case 'task:questions':
          if (isTaskInStore(data.taskId)) {
            s.setPendingQuestions(data.taskId, data.questions);
          }
          break;
        case 'tasks:reordered':
          s.reorderColumn(data.column, data.ids);
          break;
        case 'pool:status':
          s.setPoolStatus(data);
          break;
        case 'settings:updated':
          if (data.key === 'maxConcurrency') {
            s.setPoolStatus({ ...s.poolStatus, maxConcurrency: Number(data.value) });
          }
          break;
        case 'project:created':
        case 'project:updated':
        case 'project:deleted':
          fetchProjects().then(projects => s.setProjects(projects));
          break;
        case 'dreaming:started':
          s.setDreaming(true);
          break;
        case 'dreaming:finished':
          s.setDreaming(false);
          break;
      }
    }

    connect();

    return () => {
      if (reconnectTimeout.current) clearTimeout(reconnectTimeout.current);
      if (wsRef.current) wsRef.current.close();
    };
  }, []);
}
