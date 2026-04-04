import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';

const API = process.env.KANBAN_API_URL || 'http://localhost:3001';

async function apiCall(path, options = {}) {
  const res = await fetch(`${API}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const body = await res.json();
  if (!res.ok) {
    throw new Error(body.error || `API error: ${res.status}`);
  }
  return body;
}

function textResult(data) {
  return { content: [{ type: 'text', text: typeof data === 'string' ? data : JSON.stringify(data, null, 2) }] };
}

const server = new McpServer({
  name: 'kanban',
  version: '1.0.0',
});

// Get tasks
server.tool(
  'get_tasks',
  'List all active tasks on the kanban board, optionally filtered by column',
  { column: z.enum(['not_started', 'claude', 'your_turn', 'done']).optional().describe('Filter by column') },
  async ({ column }) => {
    const query = column ? `?column=${column}` : '';
    const tasks = await apiCall(`/api/tasks${query}`);
    return textResult(tasks);
  }
);

// Get task details
server.tool(
  'get_task_details',
  'Get full details of a task including its activity log',
  { task_id: z.string().describe('The task ID') },
  async ({ task_id }) => {
    const task = await apiCall(`/api/tasks/${task_id}`);
    return textResult(task);
  }
);

// Claim task
server.tool(
  'claim_task',
  'Claim a task by setting working directory, branch, and session info',
  {
    task_id: z.string().describe('The task ID'),
    working_dir: z.string().optional().describe('Working directory path'),
    branch: z.string().optional().describe('Git branch name'),
    session_id: z.string().optional().describe('Claude session ID'),
  },
  async ({ task_id, working_dir, branch, session_id }) => {
    const result = await apiCall(`/api/tasks/${task_id}/claim`, {
      method: 'POST',
      body: JSON.stringify({ working_dir, branch, session_id }),
    });
    return textResult(result);
  }
);

// Move task
server.tool(
  'move_task',
  'Move a task to a different column on the kanban board',
  {
    task_id: z.string().describe('The task ID'),
    column: z.enum(['not_started', 'claude', 'your_turn', 'done']).describe('Target column'),
  },
  async ({ task_id, column }) => {
    const result = await apiCall(`/api/tasks/${task_id}/move`, {
      method: 'POST',
      body: JSON.stringify({ column }),
    });
    return textResult(result);
  }
);

// Log progress
server.tool(
  'log_progress',
  'Log a progress update on a task (visible in the activity log)',
  {
    task_id: z.string().describe('The task ID'),
    message: z.string().describe('Progress message'),
  },
  async ({ task_id, message }) => {
    const result = await apiCall(`/api/tasks/${task_id}/log`, {
      method: 'POST',
      body: JSON.stringify({ author: 'claude', message }),
    });
    return textResult(result);
  }
);

// Add note
server.tool(
  'add_note',
  'Add a note or summary to a task for the user to review',
  {
    task_id: z.string().describe('The task ID'),
    message: z.string().describe('Note content'),
  },
  async ({ task_id, message }) => {
    const result = await apiCall(`/api/tasks/${task_id}/log`, {
      method: 'POST',
      body: JSON.stringify({ author: 'claude', message }),
    });
    return textResult(result);
  }
);

// Update task
server.tool(
  'update_task',
  'Update a task title or description',
  {
    task_id: z.string().describe('The task ID'),
    title: z.string().optional().describe('New title'),
    description: z.string().optional().describe('New description'),
  },
  async ({ task_id, title, description }) => {
    const result = await apiCall(`/api/tasks/${task_id}`, {
      method: 'PATCH',
      body: JSON.stringify({ title, description }),
    });
    return textResult(result);
  }
);

// Start the MCP server
const transport = new StdioServerTransport();
await server.connect(transport);
