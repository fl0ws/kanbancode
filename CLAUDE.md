# Claude Code Kanban Board

A local kanban board for managing multiple simultaneous Claude Code tasks. Users create task cards, drag them to the "Claude" column, and the server spawns headless Claude Code processes that work autonomously. Claude streams output in real time, and the user can reply to continue the conversation.

## Quick Start

```bash
npm run dev    # Starts Express (port 3001) + Vite dev server (port 5173)
npm run build  # Production build → client/dist/
npm start      # Production: serves built client + API on port 3001
npm run mcp    # Run MCP server standalone
```

## Architecture

### Server (Node.js + Express, ESM modules)

| File | Purpose |
|---|---|
| `server/index.js` | Express app, HTTP server, WebSocket setup, worker pool init, graceful shutdown |
| `server/db.js` | SQLite via `sql.js` (pure JS, no native deps). Debounced writes to `data/kanban.db`. Exports all query functions. |
| `server/ws.js` | WebSocket server (ws library), `broadcast(event, payload)` to all clients |
| `server/state-machine.js` | Column transition rules. `validateTransition(from, to)` throws on invalid moves. Only `not_started`/`your_turn` can go to `claude`. |
| `server/worker-pool.js` | Manages concurrent Claude processes. Configurable max concurrency (stored in `settings` table). Queue with auto-drain. Reconciles stuck tasks on startup. |
| `server/claude-process.js` | Spawns `claude` CLI via temp file piped to stdin (`type file \| claude --output-format stream-json --verbose`). Parses JSONL, strips ANSI, batches output at 150ms. Separates "thoughts" (tool use, reasoning) from "final result" (chat response). Supports `CLAUDE_CONFIG_DIR` env var. Extracts `session_id` from stream events for conversation resume. |
| `server/logger.js` | Structured JSON logger with levels (debug/info/warn/error) |
| `server/mcp-server.js` | MCP stdio server that proxies tool calls to the REST API on localhost:3001 |
| `server/migrations/runner.js` | Reads `*.sql` files from migrations dir, tracks applied in `_migrations` table |
| `server/routes/tasks.js` | All task CRUD, move, reorder, archive, stop, activity log, settings endpoints. Project CRUD endpoints. Has callback hooks `onMoveToClaudeCallback` and `onStopCallback` wired by index.js to the worker pool. |
| `server/routes/health.js` | `GET /api/health` with uptime, pool status, concurrency info |
| `server/routes/output.js` | `GET /api/tasks/:id/output` returns buffered Claude output for client catch-up |

### Database (SQLite via sql.js)

- `projects` — id (TEXT PK), name, working_dir (default for new tasks), timestamps
- `tasks` — id (TEXT PK), title, description, column (CHECK constraint), position, working_dir, branch, conversation_id, needs_input, pending_prompt, archived, project_id (FK to projects), timestamps
- `activity_log` — id, task_id (FK CASCADE), author (user/claude/system), message, timestamp
- `output_buffer` — id, task_id (FK CASCADE), chunk, timestamp. Capped at ~64KB per task.
- `settings` — key/value store (maxConcurrency, claudeConfigDir, systemPrompt)
- `_migrations` — tracks applied SQL migrations

sql.js is async to initialize but synchronous for queries. Database writes are debounced (500ms) and saved to `data/kanban.db`. Critical operations call `saveNow()`.

### Client (React 18 + Vite)

| File | Purpose |
|---|---|
| `client/App.jsx` | Root component. Header with project selector, pool badge, settings, archive, new task buttons. Renders Board + TaskDetail side panel. Loads projects on mount, reloads tasks when active project changes. |
| `client/store.js` | Zustand store. Tasks map, column ID arrays, live output, pool status, projects list, activeProjectId (persisted to localStorage). Optimistic updates for drag-and-drop. |
| `client/api.js` | Fetch wrappers for all REST endpoints. **Important:** file is named `api.js` — the Vite proxy must use `/api/` (trailing slash) not `/api` to avoid intercepting this file. |
| `client/hooks/useWebSocket.js` | Connects to `ws://<host>/ws`. Auto-reconnect with exponential backoff. Dispatches events to Zustand store. Re-fetches all tasks on reconnect. |
| `client/hooks/useDragAndDrop.js` | @dnd-kit integration. Tracks drag origin via ref. Optimistic column moves in `onDragOver`, API calls in `onDragEnd`. Rollback on failure via full re-fetch. |
| `client/components/Board.jsx` | DndContext with PointerSensor (6px distance), 4 Column components, DragOverlay |
| `client/components/Column.jsx` | Droppable + SortableContext. Highlights on drag-over. |
| `client/components/SortableCard.jsx` | useSortable wrapper around TaskCard |
| `client/components/TaskCard.jsx` | Card display with title, description preview, status tags (Running/Queued/Needs Input) |
| `client/components/TaskDetail.jsx` | 460px side panel. Editable title/description, metadata, LiveOutput (while running), ActivityLog, reply form (chat-style input), quick action buttons. |
| `client/components/ActivityLog.jsx` | Tabbed view: Chat tab (iMessage-style bubbles for user/claude messages) and Log tab (system events timeline). |
| `client/components/LiveOutput.jsx` | "Thoughts" bubble — collapsible, shows Claude's reasoning and tool use in real time. Separate from chat response. |
| `client/components/CreateTaskModal.jsx` | Form: title, description, working_dir (defaults from project). Passes project_id. |
| `client/components/SettingsModal.jsx` | Max concurrency, Claude config directory, system prompt (instructions for initial task runs) |
| `client/components/ConcurrencyPrompt.jsx` | First-use modal shown when maxConcurrency is not configured |
| `client/components/ArchiveModal.jsx` | Search + restore archived tasks (filtered by active project) |
| `client/components/NeedsInputBanner.jsx` | Yellow warning when Claude may be waiting for input |
| `client/components/ProjectSelector.jsx` | Dropdown in header for switching active project. "Manage Projects..." option. |
| `client/components/ManageProjectsModal.jsx` | Full CRUD for projects: create, rename, edit default working_dir, delete (cascades tasks). |

### Key Data Flows

**Task creation:** CreateTaskModal → `POST /api/tasks` → db.createTask → broadcast `task:created` → store.addTask

**Drag to Claude column:** useDragAndDrop.onDragEnd → `POST /api/tasks/:id/move` → validateTransition → db.moveTask → broadcast `task:moved` → `onMoveToClaudeCallback` → workerPool.enqueue → ClaudeProcess.start

**Claude output:** ClaudeProcess stdout → parse JSONL → emit 'output' → db.insertOutput + broadcast `task:output` → store.appendOutput → LiveOutput component

**Claude finishes:** ClaudeProcess 'exit' → save conversation_id → save full output as `claude` activity entry → db.moveTask to `your_turn` → broadcast `task:moved` → drain queue

**User reply:** ReplyForm submit → `POST /api/tasks/:id/log` (author: user) → `POST /api/tasks/:id/move` to claude → workerPool.enqueue → spawn with `--resume <conversation_id>` and just the user's message as prompt

## Conventions

- All code is ESM (`"type": "module"` in package.json)
- Inline styles (JS objects), no CSS files. Dark theme with GitHub-dark color palette.
- No shorthand CSS properties mixed with individual ones (causes React warnings)
- Vite proxy: `/api/` (trailing slash) → localhost:3001, `/ws` → ws://localhost:3001
- WebSocket client connects to `/ws` path (not root)
- Windows compatibility: `cmd.exe /c claude` for spawning, `taskkill /T /F` for killing, `resolve()` for path normalization
- State machine enforces column transitions server-side. Nothing goes to `claude` except from `not_started` or `your_turn`.
- Worker pool reads `claudeConfigDir` setting and passes it as `CLAUDE_CONFIG_DIR` env var to spawned processes (with `~` expanded via `os.homedir()` and path normalized)

## Known Issues / Active Work

- Claude resume prompt: when a conversation is resumed with `--resume`, the prompt should be just the user's reply text (no boilerplate). Currently being debugged — Claude may still not follow the user's instructions precisely on resume.
- The `--resume` flag reconnects to a prior Claude conversation by session ID. The `-p` flag provides the new prompt. The interaction between these two flags needs verification.

## REST API

| Method | Path | Description |
|---|---|---|
| GET | `/api/tasks` | All active tasks (optional `?column=`) |
| POST | `/api/tasks` | Create task (title, description, working_dir) |
| GET | `/api/tasks/archived` | Archived tasks (optional `?q=search`) |
| POST | `/api/tasks/reorder` | Reorder within column (column, ids[]) |
| GET | `/api/tasks/:id` | Single task with activity log |
| PATCH | `/api/tasks/:id` | Update title, description, needs_input |
| POST | `/api/tasks/:id/move` | Move to column (triggers Claude spawn if target is `claude`) |
| POST | `/api/tasks/:id/claim` | Set working_dir, branch, session_id |
| POST | `/api/tasks/:id/log` | Add activity entry (author, message) |
| POST | `/api/tasks/:id/stop` | Kill Claude process, move to your_turn |
| POST | `/api/tasks/:id/archive` | Soft-delete |
| POST | `/api/tasks/:id/unarchive` | Restore to not_started |
| DELETE | `/api/tasks/:id` | Permanent delete (cascades activity log + output) |
| GET | `/api/tasks/:id/output` | Buffered Claude output |
| GET | `/api/health` | Server health + pool status |
| GET | `/api/pool/status` | Worker pool status (running, queued, max) |
| POST | `/api/pool/configure` | Set maxConcurrency |
| GET | `/api/settings/:key` | Read a setting |
| POST | `/api/settings` | Write a setting (key, value) |
| GET | `/api/projects` | List all projects |
| GET | `/api/projects/:id` | Single project |
| POST | `/api/projects` | Create project (name, working_dir) |
| PATCH | `/api/projects/:id` | Update project (name, working_dir) |
| DELETE | `/api/projects/:id` | Delete project (cascades all tasks) |

## WebSocket Events

All broadcast from server to client on the `/ws` path:

`task:created`, `task:updated`, `task:moved`, `task:deleted`, `task:archived`, `task:unarchived`, `task:activity`, `task:output`, `tasks:reordered`, `pool:status`, `settings:updated`, `project:created`, `project:updated`, `project:deleted`
