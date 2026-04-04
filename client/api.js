const BASE = '/api';

async function request(path, options = {}) {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${res.status}`);
  }
  return res.json();
}

export const fetchTasks = (projectId) => request(`/tasks${projectId ? `?project_id=${projectId}` : ''}`);
export const fetchTask = (id) => request(`/tasks/${id}`);
export const createTask = (data) => request('/tasks', { method: 'POST', body: JSON.stringify(data) });
export const updateTask = (id, data) => request(`/tasks/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
export const moveTask = (id, column) => request(`/tasks/${id}/move`, { method: 'POST', body: JSON.stringify({ column }) });
export const stopTask = (id) => request(`/tasks/${id}/stop`, { method: 'POST' });
export const deleteTask = (id) => request(`/tasks/${id}`, { method: 'DELETE' });
export const archiveTask = (id) => request(`/tasks/${id}/archive`, { method: 'POST' });
export const unarchiveTask = (id) => request(`/tasks/${id}/unarchive`, { method: 'POST' });
export const logActivity = (id, author, message) => request(`/tasks/${id}/log`, { method: 'POST', body: JSON.stringify({ author, message }) });
export const reorderTasks = (column, ids) => request('/tasks/reorder', { method: 'POST', body: JSON.stringify({ column, ids }) });
export const fetchArchived = (q, projectId) => {
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (projectId) params.set('project_id', projectId);
  const qs = params.toString();
  return request(`/tasks/archived${qs ? `?${qs}` : ''}`);
};
export const fetchOutput = (id) => request(`/tasks/${id}/output`);
export const fetchPoolStatus = () => request('/pool/status');
export const configurePool = (maxConcurrency) => request('/pool/configure', { method: 'POST', body: JSON.stringify({ maxConcurrency }) });
export const fetchHealth = () => request('/health');
export const saveSetting = (key, value) => request('/settings', { method: 'POST', body: JSON.stringify({ key, value }) });

// Projects
export const fetchProjects = () => request('/projects');
export const createProject = (data) => request('/projects', { method: 'POST', body: JSON.stringify(data) });
export const updateProject = (id, data) => request(`/projects/${id}`, { method: 'PATCH', body: JSON.stringify(data) });
export const deleteProject = (id) => request(`/projects/${id}`, { method: 'DELETE' });
